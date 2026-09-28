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

async function callAnthropic(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  // Extract system message if exists
  const systemMessage = messages.find(m => m.role === 'system');
  const chatMessages = messages.filter(m => m.role !== 'system');

  const requestBody: any = {
    model: provider.model,
    max_tokens: 4096,
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
  
  const result: AIResponse = {
    content: data.content[0]?.text || '',
  };

  // Check for tool use in Anthropic response
  if (data.content && data.content.length > 0) {
    const toolUseBlock = data.content.find((block: any) => block.type === 'tool_use');
    if (toolUseBlock) {
      result.toolCalls = [{
        id: toolUseBlock.id,
        name: toolUseBlock.name,
        arguments: JSON.stringify(toolUseBlock.input),
      }];
    }
  }

  return result;
}

async function callGoogle(provider: ProviderConfig, messages: ChatMessage[], tools?: ToolDefinition[]): Promise<AIResponse> {
  const contents = messages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const requestBody: any = {
    contents: contents,
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
    },
  };

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
  const result: AIResponse = {
    content: data.candidates[0]?.content?.parts[0]?.text || '',
  };

  // Check for function calls
  const functionCall = data.candidates[0]?.content?.parts[0]?.functionCall;
  if (functionCall) {
    result.toolCalls = [{
      id: `call_${Date.now()}`,
      name: functionCall.name,
      arguments: JSON.stringify(functionCall.args),
    }];
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
