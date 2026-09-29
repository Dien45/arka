import { ProviderConfig } from './types';
import { memoryManager } from './memorySystem';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  tool_calls?: any[];
  tool_call_id?: string;
  name?: string;
}

export interface ToolDefinition {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: {
      type: 'object';
      properties: Record<string, any>;
      required?: string[];
    };
  };
}

export interface AIResponse {
  content: string;
  toolCalls?: Array<{
    id: string;
    name: string;
    arguments: string;
  }>;
  /**
   * Why the model stopped generating this turn:
   *  - 'stop'       -> natural end of the response
   *  - 'tool_calls' -> stopped because it wants to call a tool
   *  - 'length'     -> stopped because it HIT the max-token cap (i.e. the
   *                    response is truncated mid-thought, not actually done)
   *  - 'other'      -> anything else / unknown
   * Used by callAIProviderFull() below to auto-continue truncated replies.
   */
  finishReason?: 'stop' | 'tool_calls' | 'length' | 'other';
}


export async function callAIProvider(
  provider: ProviderConfig,
  messages: ChatMessage[],
  tools?: ToolDefinition[]
): Promise<AIResponse> {
  if (!provider.apiKey) {
    throw new Error('API Key belum di konfigurasi. Buka Settings untuk setup.');
  }

  try {
    switch (provider.id) {
      case 'openai':
        return await callOpenAI(provider, messages, tools);
      case 'anthropic':
        return await callAnthropic(provider, messages, tools);
      case 'google':
        return await callGoogle(provider, messages, tools);
      case 'groq':
        return await callGroq(provider, messages, tools);
      case 'openrouter':
        return await callOpenRouter(provider, messages, tools);
      case 'ollama':
        return await callOllama(provider, messages, tools);
      case 'custom':
        return await callCustom(provider, messages, tools);
      default:
        throw new Error(`Provider ${provider.id} belum didukung`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Terjadi kesalahan saat menghubungi AI provider');
  }
}

async function callOpenAI(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  const requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenAI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;
  
  const result: AIResponse = {
    content: message.content || '',
    finishReason: mapOpenAIFinishReason(data.choices[0].finish_reason),
  };

  if (message.tool_calls && message.tool_calls.length > 0) {
    result.toolCalls = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  return result;
}

function mapOpenAIFinishReason(reason: string | undefined): AIResponse['finishReason'] {
  switch (reason) {
    case 'stop': return 'stop';
    case 'tool_calls': return 'tool_calls';
    case 'length': return 'length';
    default: return 'other';
  }
}

async function callAnthropic(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  // Extract system message if exists
  const systemMessage = messages.find(m => m.role === 'system');

  // Anthropic does NOT understand the generic OpenAI-shaped `role: 'tool'` /
  // `tool_calls` messages the rest of this app builds (see Chat.tsx). It needs:
  //   - assistant tool calls as `content: [{ type: 'tool_use', id, name, input }]`
  //   - tool results as a `role: 'user'` message with
  //     `content: [{ type: 'tool_result', tool_use_id, content }]`
  // Sending the raw OpenAI-shaped messages through un-translated causes the
  // Anthropic API to reject the request (400) the moment a tool call happens.
  const chatMessages: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'assistant') {
      const toolCalls = (m as any).tool_calls as Array<{ id: string; function: { name: string; arguments: string } }> | undefined;
      if (toolCalls && toolCalls.length > 0) {
        const content: any[] = [];
        if (m.content) content.push({ type: 'text', text: m.content });
        for (const tc of toolCalls) {
          let input: any = {};
          try { input = JSON.parse(tc.function.arguments || '{}'); } catch { /* leave empty */ }
          content.push({ type: 'tool_use', id: tc.id, name: tc.function.name, input });
        }
        chatMessages.push({ role: 'assistant', content });
      } else {
        chatMessages.push({ role: 'assistant', content: m.content });
      }
    } else if (m.role === 'tool') {
      chatMessages.push({
        role: 'user',
        content: [{ type: 'tool_result', tool_use_id: (m as any).tool_call_id, content: m.content }],
      });
    } else {
      chatMessages.push({ role: 'user', content: m.content });
    }
  }

  const requestBody: any = {
    model: provider.model,
    // 4096 was cutting off long replies (long code files, PRDs) mid-sentence
    // — bumped to the safe common output ceiling for current Claude models.
    max_tokens: 8192,
    system: systemMessage?.content,
    messages: chatMessages,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools.map(t => ({
      name: t.function.name,
      description: t.function.description,
      input_schema: t.function.parameters,
    }));
  }

  const response = await fetch(`${provider.baseUrl}/v1/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': provider.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Anthropic API error: ${response.statusText}`);
  }

  const data = await response.json();

  const contentBlocks: any[] = data.content || [];
  const result: AIResponse = {
    content: contentBlocks.filter(b => b.type === 'text').map(b => b.text).join('\n'),
    finishReason:
      data.stop_reason === 'max_tokens' ? 'length' :
      data.stop_reason === 'tool_use' ? 'tool_calls' :
      data.stop_reason === 'end_turn' || data.stop_reason === 'stop_sequence' ? 'stop' :
      'other',
  };

  // Claude can request multiple tool calls in a single turn — collect all of them.
  const toolUseBlocks = contentBlocks.filter(b => b.type === 'tool_use');
  if (toolUseBlocks.length > 0) {
    result.toolCalls = toolUseBlocks.map((block: any) => ({
      id: block.id,
      name: block.name,
      arguments: JSON.stringify(block.input),
    }));
  }

  return result;
}


async function callGoogle(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  // Gemini has no OpenAI-style `role: 'tool'` / `tool_calls` messages and no
  // 'system' role inside `contents` — it needs a separate `systemInstruction`
  // field, assistant tool calls as `{ functionCall: { name, args } }` parts on
  // a 'model' turn, and tool results as `{ functionResponse: { name, response } }`
  // parts on a 'user' turn. The previous implementation just stringified every
  // message as plain text (including an empty-string assistant turn right
  // before/after a tool call), which Gemini's API can reject as an invalid
  // "empty part" the moment tool calling is used.
  const systemMessage = messages.find(m => m.role === 'system');
  const contents: any[] = [];
  for (const m of messages) {
    if (m.role === 'system') continue;

    if (m.role === 'assistant') {
      const toolCalls = (m as any).tool_calls as Array<{ function: { name: string; arguments: string } }> | undefined;
      const parts: any[] = [];
      if (m.content) parts.push({ text: m.content });
      if (toolCalls && toolCalls.length > 0) {
        for (const tc of toolCalls) {
          let args: any = {};
          try { args = JSON.parse(tc.function.arguments || '{}'); } catch { /* leave empty */ }
          parts.push({ functionCall: { name: tc.function.name, args } });
        }
      }
      if (parts.length === 0) continue; // nothing to send for this turn
      contents.push({ role: 'model', parts });
    } else if (m.role === 'tool') {
      contents.push({
        role: 'user',
        parts: [{ functionResponse: { name: (m as any).name, response: { content: m.content } } }],
      });
    } else {
      if (!m.content) continue;
      contents.push({ role: 'user', parts: [{ text: m.content }] });
    }
  }

  const requestBody: any = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      // 4096 was cutting off long replies (long code files, PRDs) mid-sentence
      // — bumped to the safe common output ceiling for current Gemini models.
      maxOutputTokens: 8192,
    },
  };

  if (systemMessage?.content) {
    requestBody.systemInstruction = { parts: [{ text: systemMessage.content }] };
  }

  if (tools && tools.length > 0) {
    requestBody.tools = [{
      function_declarations: tools.map(t => ({
        name: t.function.name,
        description: t.function.description,
        parameters: t.function.parameters,
      })),
    }];
  }

  const response = await fetch(
    `${provider.baseUrl}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Google AI API error: ${response.statusText}`);
  }

  const data = await response.json();
  const responseParts: any[] = data.candidates?.[0]?.content?.parts || [];
  const geminiFinishReason: string | undefined = data.candidates?.[0]?.finishReason;

  const result: AIResponse = {
    content: responseParts.filter(p => p.text).map(p => p.text).join(''),
    finishReason:
      geminiFinishReason === 'MAX_TOKENS' ? 'length' :
      geminiFinishReason === 'STOP' ? 'stop' :
      'other',
  };

  // Gemini can return multiple function calls in one turn — collect all of them.
  const functionCallParts = responseParts.filter(p => p.functionCall);
  if (functionCallParts.length > 0) {
    result.toolCalls = functionCallParts.map((p: any, i: number) => ({
      id: `call_${Date.now()}_${i}`,
      name: p.functionCall.name,
      arguments: JSON.stringify(p.functionCall.args),
    }));
    result.finishReason = 'tool_calls';
  }

  return result;
}

async function callGroq(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  const requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `Groq API error: ${response.statusText}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;
  
  const result: AIResponse = {
    content: message.content || '',
    finishReason: mapOpenAIFinishReason(data.choices[0].finish_reason),
  };

  if (message.tool_calls && message.tool_calls.length > 0) {
    result.toolCalls = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  return result;
}

async function callOpenRouter(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  const requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
      'HTTP-Referer': window.location.origin,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error?.message || `OpenRouter API error: ${response.statusText}`);
  }

  const data = await response.json();
  const message = data.choices[0].message;
  
  const result: AIResponse = {
    content: message.content || '',
    finishReason: mapOpenAIFinishReason(data.choices[0].finish_reason),
  };

  if (message.tool_calls && message.tool_calls.length > 0) {
    result.toolCalls = message.tool_calls.map((tc: any) => ({
      id: tc.id,
      name: tc.function.name,
      arguments: tc.function.arguments,
    }));
  }

  return result;
}

async function callOllama(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  const requestBody: any = {
    model: provider.model,
    messages: messages,
    stream: false,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
  }

  const response = await fetch(`${provider.baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.statusText}`);
  }

  const data = await response.json();
  const result: AIResponse = {
    content: data.message.content || '',
    finishReason: data.done_reason === 'length' ? 'length' : data.done === false ? 'other' : 'stop',
  };

  if (data.message.tool_calls && data.message.tool_calls.length > 0) {
    result.toolCalls = data.message.tool_calls.map((tc: any) => ({
      id: `call_${Date.now()}`,
      name: tc.function.name,
      arguments: JSON.stringify(tc.function.arguments),
    }));
  }

  return result;
}

async function callCustom(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  // Custom provider biasanya OpenAI-compatible
  const requestBody: any = {
    model: provider.model,
    messages: messages,
    temperature: 0.7,
  };

  if (tools && tools.length > 0) {
    requestBody.tools = tools;
    requestBody.tool_choice = 'auto';
  }

  const response = await fetch(`${provider.baseUrl}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `Custom API error: ${response.statusText}`;
    
    try {
      const errorJson = JSON.parse(errorText);
      if (errorJson.error?.message) {
        errorMessage = errorJson.error.message;
      }
    } catch {
      // Use default error message
    }
    
    throw new Error(errorMessage);
  }

  const data = await response.json();
  
  const result: AIResponse = {
    content: '',
  };
  
  // Handle different response formats
  if (data.choices && data.choices[0]) {
    const message = data.choices[0].message;
    result.content = message.content || '';
    result.finishReason = mapOpenAIFinishReason(data.choices[0].finish_reason);
    
    if (message.tool_calls && message.tool_calls.length > 0) {
      result.toolCalls = message.tool_calls.map((tc: any) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));
    }
  } else if (data.response) {
    result.content = data.response;
  } else if (data.content) {
    result.content = data.content;
  } else {
    throw new Error('Format response tidak dikenali');
  }
  
  return result;
}

/**
 * Same as callAIProvider(), but auto-continues the reply when the model
 * stopped purely because it hit the max-token output cap (finishReason
 * === 'length') rather than because it was actually done — this was the
 * main cause of replies (and generated documents like PRDs) getting cut off
 * mid-sentence. Never continues past a tool-call request; the caller's own
 * tool-calling loop handles that turn instead.
 */
export async function callAIProviderFull(
  provider: ProviderConfig,
  messages: ChatMessage[],
  tools?: ToolDefinition[],
  maxContinuations = 4
): Promise<AIResponse> {
  let history = messages;
  let response = await callAIProvider(provider, history, tools);
  let combinedContent = response.content;
  let rounds = 0;

  while (
    response.finishReason === 'length' &&
    (!response.toolCalls || response.toolCalls.length === 0) &&
    rounds < maxContinuations
  ) {
    rounds++;
    history = [
      ...history,
      { role: 'assistant', content: response.content },
      {
        role: 'user',
        content: 'Lanjutkan PERSIS dari kata/karakter terakhir di atas — jangan mengulang apa yang sudah ditulis, jangan menambahkan kalimat pembuka seperti "melanjutkan...", langsung sambung teksnya.',
      },
    ];
    response = await callAIProvider(provider, history, tools);
    combinedContent += response.content;
  }

  return { ...response, content: combinedContent };
}
