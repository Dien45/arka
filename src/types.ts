export type Provider = 'openai' | 'anthropic' | 'google' | 'ollama' | 'groq' | 'openrouter' | 'custom';

export interface ProviderConfig {
  id: Provider;
  name: string;
  apiKey: string;
  baseUrl: string;
  model: string;
  enabled: boolean;
  icon: string;
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: Date;
  toolCalls?: ToolCall[];
  files?: FileChange[];
  /** Metadata only (name/size), for rendering attachment chips on the bubble. */
  attachments?: { name: string; size: number }[];
  /** The actual attached file content (as code-block text), sent to the AI but hidden from the rendered bubble. */
  attachmentContent?: string;
}

export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: 'running' | 'completed' | 'error';
}

export interface FileChange {
  path: string;
  action: 'create' | 'edit' | 'delete';
  content?: string;
  diff?: string;
}

export interface Session {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
  provider: Provider;
  model: string;
}

export interface Agent {
  id: string;
  name: string;
  description: string;
  icon: string;
  systemPrompt: string;
  tools: string[];
  provider: Provider;
  model: string;
}

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string;
  private: boolean;
  defaultBranch: string;
  updatedAt: string;
}

export interface GitHubCommit {
  message: string;
  files: string[];
  branch: string;
}

export type View = 'chat' | 'files' | 'github' | 'settings' | 'sessions' | 'skills' | 'prd';


