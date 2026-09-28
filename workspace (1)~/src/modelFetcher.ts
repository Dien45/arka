import { Provider } from './types';

export interface ModelInfo {
  id: string;
  name: string;
  description?: string;
}

export async function fetchModelsFromProvider(
  providerId: Provider,
  apiKey: string,
  baseUrl: string
): Promise<ModelInfo[]> {
  try {
    switch (providerId) {
      case 'openai':
        return await fetchOpenAIModels(apiKey, baseUrl);
      case 'anthropic':
        return await fetchAnthropicModels(apiKey, baseUrl);
      case 'google':
        return await fetchGoogleModels(apiKey, baseUrl);
      case 'groq':
        return await fetchGroqModels(apiKey, baseUrl);
      case 'openrouter':
        return await fetchOpenRouterModels(apiKey, baseUrl);
      case 'ollama':
        return await fetchOllamaModels(baseUrl);
      case 'custom':
        return await fetchCustomModels(apiKey, baseUrl);
      default:
        return [];
    }
  } catch (error) {
    console.error('Failed to fetch models:', error);
    throw error;
  }
}

async function fetchOpenAIModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data
    .map((model: any) => ({
      id: model.id,
      name: model.id,
      description: model.owned_by,
    }))
    .filter((model: ModelInfo) => 
      model.id.includes('gpt') || 
      model.id.includes('o1') || 
      model.id.includes('o3') ||
      model.id.includes('chatgpt')
    )
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchAnthropicModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/v1/models`, {
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data
    .map((model: any) => ({
      id: model.id,
      name: model.display_name || model.id,
      description: model.description,
    }))
    .filter((model: ModelInfo) => model.id.includes('claude'))
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchGoogleModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/v1beta/models?key=${apiKey}`);

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models
    .map((model: any) => ({
      id: model.name.replace('models/', ''),
      name: model.displayName || model.name,
      description: model.description,
    }))
    .filter((model: ModelInfo) => 
      model.id.includes('gemini') || 
      model.id.includes('text')
    )
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchGroqModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data
    .map((model: any) => ({
      id: model.id,
      name: model.id,
      description: model.owned_by,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchOpenRouterModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/models`, {
    headers: {
      'Authorization': `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.data
    .map((model: any) => ({
      id: model.id,
      name: model.name,
      description: model.description,
    }))
    .slice(0, 50) // Limit to first 50 models
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchOllamaModels(baseUrl: string): Promise<ModelInfo[]> {
  const response = await fetch(`${baseUrl}/api/tags`);

  if (!response.ok) {
    throw new Error(`Failed to fetch models: ${response.statusText}`);
  }

  const data = await response.json();
  return data.models
    .map((model: any) => ({
      id: model.name,
      name: model.name,
      description: `Size: ${formatBytes(model.size)}`,
    }))
    .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
}

async function fetchCustomModels(apiKey: string, baseUrl: string): Promise<ModelInfo[]> {
  // Try OpenAI-compatible endpoint first
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.data && Array.isArray(data.data)) {
        return data.data
          .map((model: any) => ({
            id: model.id,
            name: model.id,
            description: model.owned_by,
          }))
          .sort((a: ModelInfo, b: ModelInfo) => a.name.localeCompare(b.name));
      }
    }
  } catch (error) {
    // Fallback to empty list
  }

  return [];
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
