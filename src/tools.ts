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
    description: 'Fetch content from a URL. Returns the text content of the webpage. Automatically handles GitHub repositories and uses CORS proxy for external sites.',
    parameters: {
      url: { type: 'string', description: 'The URL to fetch' },
    },
    execute: async (params: { url: string }) => {
      try {
        const url = params.url;
        
        // Check if it's a GitHub repository URL
        const githubRepoMatch = url.match(/github\.com\/([^\/\?#]+\/[^\/\?#]+)/);
        if (githubRepoMatch) {
          const repoPath = githubRepoMatch[1].replace(/\.git$/, '').replace(/\/$/, '');
          
          // Try GitHub API first
          try {
            const apiUrl = `https://api.github.com/repos/${repoPath}/readme`;
            const response = await fetch(apiUrl, {
              headers: {
                'Accept': 'application/vnd.github.v3.raw',
              },
            });
            
            if (response.ok) {
              const text = await response.text();
              return `# GitHub Repository: ${repoPath}\n\n${text.substring(0, 10000)}`;
            }
          } catch (apiError) {
            console.log('GitHub API failed, trying CORS proxy');
          }
        }
        
        // For other URLs or if GitHub API failed, use multiple CORS proxies
        const corsProxies = [
          'https://api.allorigins.win/raw?url=',
          'https://corsproxy.io/?',
          'https://api.codetabs.com/v1/proxy?quest=',
        ];
        
        for (const proxy of corsProxies) {
          try {
            const proxyUrl = proxy + encodeURIComponent(url);
            const response = await fetch(proxyUrl);
            
            if (response.ok) {
              const text = await response.text();
              return text.substring(0, 10000);
            }
          } catch (proxyError) {
            console.log(`Proxy ${proxy} failed, trying next...`);
            continue;
          }
        }
        
        throw new Error('All CORS proxies failed');
      } catch (error) {
        return `Error fetching URL: ${error instanceof Error ? error.message : 'Unknown error'}\n\nNote: Some websites may block automated access. Try a different URL or check if the site is accessible.`;
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
    description: 'Read the content of a file from the virtual workspace.',
    parameters: {
      path: { type: 'string', description: 'The file path to read' },
    },
    execute: async (params: { path: string }) => {
      try {
        // Get virtual files from localStorage
        const virtualFiles = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
        
        if (virtualFiles[params.path]) {
          const file = virtualFiles[params.path];
          return `# File: ${params.path}\n\n${file.content}`;
        }
        
        return `❌ File "${params.path}" tidak ditemukan di virtual workspace. File yang tersedia: ${Object.keys(virtualFiles).join(', ') || '(kosong)'}`;
      } catch (error) {
        return `❌ Error membaca file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'write_file',
    description: 'Write content to a file in the virtual workspace. Files are stored in browser memory and can be viewed in the Files tab.',
    parameters: {
      path: { type: 'string', description: 'The file path to write (e.g., "index.html" or "src/App.tsx")' },
      content: { type: 'string', description: 'The content to write' },
    },
    execute: async (params: { path: string; content: string }) => {
      try {
        // Get existing virtual files
        const virtualFiles = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
        
        // Write file to virtual workspace
        virtualFiles[params.path] = {
          content: params.content,
          modified: new Date().toISOString(),
          size: params.content.length,
        };
        
        // Save back to localStorage
        localStorage.setItem('arka-virtual-files', JSON.stringify(virtualFiles));
        
        // Trigger custom event for File Explorer to refresh
        window.dispatchEvent(new CustomEvent('virtual-files-updated'));
        
        return `✅ File "${params.path}" berhasil dibuat di virtual workspace (${params.content.length} bytes). File otomatis muncul di tab "Files".`;
      } catch (error) {
        return `❌ Error menulis file: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
    },
  },
  {
    name: 'list_files',
    description: 'List files in the virtual workspace.',
    parameters: {
      path: { type: 'string', description: 'The directory path to list (use "/" for root)' },
    },
    execute: async (params: { path: string }) => {
      try {
        // Get virtual files from localStorage
        const virtualFiles = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
        const files = Object.keys(virtualFiles);
        
        if (files.length === 0) {
          return '📁 Virtual workspace kosong. Belum ada file yang dibuat.';
        }
        
        // Filter files by path if specified
        let filteredFiles = files;
        if (params.path && params.path !== '/') {
          const normalizedPath = params.path.replace(/\/$/, '');
          filteredFiles = files.filter(f => f.startsWith(normalizedPath + '/') || f === normalizedPath);
        }
        
        const fileList = filteredFiles.map(f => {
          const file = virtualFiles[f];
          const modified = new Date(file.modified).toLocaleString('id-ID');
          return `- ${f} (${file.size} bytes, modified: ${modified})`;
        }).join('\n');
        
        return `📁 Files in virtual workspace (${filteredFiles.length} files):\n\n${fileList}`;
      } catch (error) {
        return `❌ Error listing files: ${error instanceof Error ? error.message : 'Unknown error'}`;
      }
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
