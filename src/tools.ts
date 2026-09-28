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
  {
    name: 'memory_save',
    description: 'Save information to memory for later use.',
    parameters: {
      key: { type: 'string', description: 'The key to save under' },
      value: { type: 'string', description: 'The value to save' },
    },
    execute: async (params: { key: string; value: string }) => {
      try {
        const memories = JSON.parse(localStorage.getItem('arka-memories') || '{}');
        memories[params.key] = params.value;
        localStorage.setItem('arka-memories', JSON.stringify(memories));
        return `Saved to memory: ${params.key}`;
      } catch (error) {
        return `Error saving to memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'memory_search',
    description: 'Search for information in memory.',
    parameters: {
      query: { type: 'string', description: 'The search query' },
    },
    execute: async (params: { query: string }) => {
      try {
        const memories = JSON.parse(localStorage.getItem('arka-memories') || '{}');
        const results = Object.entries(memories).filter(([key, value]) => 
          key.toLowerCase().includes(params.query.toLowerCase()) ||
          String(value).toLowerCase().includes(params.query.toLowerCase())
        );
        
        if (results.length === 0) {
          return `No memories found matching "${params.query}"`;
        }
        
        return `Found ${results.length} memories:\n${results.map(([key, value]) => `- ${key}: ${value}`).join('\n')}`;
      } catch (error) {
        return `Error searching memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'memory_update',
    description: 'Update an existing memory entry.',
    parameters: {
      key: { type: 'string', description: 'The key to update' },
      value: { type: 'string', description: 'The new value' },
    },
    execute: async (params: { key: string; value: string }) => {
      try {
        const memories = JSON.parse(localStorage.getItem('arka-memories') || '{}');
        if (!memories[params.key]) {
          return `Memory key "${params.key}" not found`;
        }
        memories[params.key] = params.value;
        localStorage.setItem('arka-memories', JSON.stringify(memories));
        return `Updated memory: ${params.key}`;
      } catch (error) {
        return `Error updating memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'memory_delete',
    description: 'Delete a memory entry.',
    parameters: {
      key: { type: 'string', description: 'The key to delete' },
    },
    execute: async (params: { key: string }) => {
      try {
        const memories = JSON.parse(localStorage.getItem('arka-memories') || '{}');
        if (!memories[params.key]) {
          return `Memory key "${params.key}" not found`;
        }
        delete memories[params.key];
        localStorage.setItem('arka-memories', JSON.stringify(memories));
        return `Deleted memory: ${params.key}`;
      } catch (error) {
        return `Error deleting memory: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
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
