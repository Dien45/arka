// Tool calling system for Arka AI

export interface Tool {
  name: string;
  description: string;
  parameters: Record<string, any>;
  execute: (params: any) => Promise<any>;
}

export const availableTools: Tool[] = [
  {
    name: 'web_fetch',
    description: 'Fetch content from a URL. Returns the text content of the webpage.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    execute: async (params: { url: string }) => {
      try {
        const response = await fetch(params.url);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const text = await response.text();
        // Limit response size
        return text.substring(0, 10000);
      } catch (error) {
        return `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'web_search',
    description: 'Search the web for information. Returns search results.',
    parameters: {
      query: { type: 'string', description: 'The search query' },
    },
    execute: async (params: { query: string }) => {
      // Mock implementation - in real app, this would use a search API
      return `Search results for "${params.query}":\n- Result 1: Example result\n- Result 2: Another example\n- Result 3: More examples\n\nNote: This is a mock implementation. In production, integrate with a real search API.`;
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of a file from the workspace.',
    parameters: {
      path: { type: 'string', description: 'The file path to read' },
    },
    execute: async (params: { path: string }) => {
      // This would integrate with the file system
      return `File content for ${params.path}:\n// File content would be loaded here\n// This is a mock implementation`;
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the workspace.',
    parameters: {
      path: { type: 'string', description: 'The file path to write' },
      content: { type: 'string', description: 'The content to write' },
    },
    execute: async (params: { path: string; content: string }) => {
      // This would integrate with the file system
      return `Successfully wrote ${params.content.length} characters to ${params.path}`;
    },
  },
  {
    name: 'list_files',
    description: 'List files in a directory.',
    parameters: {
      path: { type: 'string', description: 'The directory path to list' },
    },
    execute: async (params: { path: string }) => {
      // This would integrate with the file system
      return `Files in ${params.path}:\n- file1.ts\n- file2.tsx\n- file3.css\n\nNote: This is a mock implementation.`;
    },
  },
  {
    name: 'run_command',
    description: 'Execute a shell command and return the output.',
    parameters: {
      command: { type: 'string', description: 'The command to execute' },
    },
    execute: async (params: { command: string }) => {
      // This would integrate with a terminal/shell
      return `Command executed: ${params.command}\nOutput:\n$ Mock output\n\nNote: This is a mock implementation. In production, integrate with a secure command execution system.`;
    },
  },
  // Hermes-style Memory Tool
  {
    name: 'memory',
    description: 'Manage persistent memory. Actions: add (add new entry), replace (update existing entry using substring match), remove (delete entry using substring match). Target can be "memory" (agent notes) or "user" (user profile).',
    parameters: {
      action: { type: 'string', enum: ['add', 'replace', 'remove'], description: 'Action to perform' },
      target: { type: 'string', enum: ['memory', 'user'], description: 'Memory store to target' },
      content: { type: 'string', description: 'Content for add/replace actions' },
      old_text: { type: 'string', description: 'Substring to match for replace/remove actions' },
    },
    execute: async (params: any) => {
      const { memoryManager } = await import('./memorySystem');
      const { action, target, content, old_text } = params;
      
      if (action === 'add') {
        if (!content) return JSON.stringify({ success: false, error: 'content is required for add action' });
        const result = memoryManager.add(target, content);
        return JSON.stringify(result);
      }
      
      if (action === 'replace') {
        if (!old_text || !content) return JSON.stringify({ success: false, error: 'old_text and content are required for replace action' });
        const result = memoryManager.replace(target, old_text, content);
        return JSON.stringify(result);
      }
      
      if (action === 'remove') {
        if (!old_text) return JSON.stringify({ success: false, error: 'old_text is required for remove action' });
        const result = memoryManager.remove(target, old_text);
        return JSON.stringify(result);
      }
      
      return JSON.stringify({ success: false, error: 'Invalid action' });
    },
  },
];

export function getToolByName(name: string): Tool | undefined {
  return availableTools.find(tool => tool.name === name);
}

export function getToolsList(): string {
  return availableTools.map(tool => 
    `- ${tool.name}: ${tool.description}`
  ).join('\n');
}

export async function executeTool(name: string, params: any): Promise<string> {
  const tool = getToolByName(name);
  if (!tool) {
    return `Error: Tool "${name}" not found`;
  }
  
  try {
    const result = await tool.execute(params);
    return typeof result === 'string' ? result : JSON.stringify(result, null, 2);
  } catch (error) {
    return `Error executing tool "${name}": ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}
