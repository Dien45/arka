import { useState } from 'react';
import { 
  FolderOpen, File, ChevronRight, ChevronDown, FileCode, FileText, 
  Image, Copy, Check, Plus, Trash2, Edit2, X, Download, 
  FileJson, FileSpreadsheet, Hash, Braces, Type
} from 'lucide-react';

interface FileNode {
  id: string;
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
  size?: string;
  modified?: string;
  gitStatus?: 'modified' | 'untracked' | 'deleted' | 'staged';
}

const mockWorkspace: FileNode[] = [
  {
    id: 'root',
    name: 'arka-project',
    type: 'folder',
    children: [
      {
        id: 'src',
        name: 'src',
        type: 'folder',
        children: [
          {
            id: 'components',
            name: 'components',
            type: 'folder',
            children: [
              {
                id: 'App.tsx',
                name: 'App.tsx',
                type: 'file',
                language: 'typescript',
                size: '2.4 KB',
                modified: '2 jam lalu',
                gitStatus: 'modified',
                content: `import React from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { MainContent } from './MainContent';

interface AppProps {
  theme?: 'light' | 'dark';
}

export default function App({ theme = 'light' }: AppProps) {
  const [sidebarOpen, setSidebarOpen] = React.useState(true);

  return (
    <div className={\`app \${theme}\`}>
      <Header onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} />
        <MainContent />
      </div>
    </div>
  );
}`
              },
              {
                id: 'Header.tsx',
                name: 'Header.tsx',
                type: 'file',
                language: 'typescript',
                size: '1.2 KB',
                modified: '1 hari lalu',
                gitStatus: 'staged',
                content: `import React from 'react';
import { Menu, Bell, User } from 'lucide-react';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  return (
    <header className="header">
      <div className="flex items-center gap-4">
        <button onClick={onMenuClick}>
          <Menu size={24} />
        </button>
        <h1 className="text-xl font-bold">Arka</h1>
      </div>
      <nav className="flex items-center gap-4">
        <button><Bell size={20} /></button>
        <button><User size={20} /></button>
      </nav>
    </header>
  );
}`
              },
              {
                id: 'Sidebar.tsx',
                name: 'Sidebar.tsx',
                type: 'file',
                language: 'typescript',
                size: '1.8 KB',
                modified: '3 hari lalu',
                content: `import React from 'react';
import { Home, Folder, Settings, HelpCircle } from 'lucide-react';

interface SidebarProps {
  isOpen: boolean;
}

export function Sidebar({ isOpen }: SidebarProps) {
  const menuItems = [
    { icon: Home, label: 'Dashboard', path: '/' },
    { icon: Folder, label: 'Projects', path: '/projects' },
    { icon: Settings, label: 'Settings', path: '/settings' },
    { icon: HelpCircle, label: 'Help', path: '/help' },
  ];

  if (!isOpen) return null;

  return (
    <aside className="sidebar">
      <nav>
        {menuItems.map((item, index) => (
          <a key={index} href={item.path} className="menu-item">
            <item.icon size={20} />
            <span>{item.label}</span>
          </a>
        ))}
      </nav>
    </aside>
  );
}`
              },
              {
                id: 'MainContent.tsx',
                name: 'MainContent.tsx',
                type: 'file',
                language: 'typescript',
                size: '0.9 KB',
                modified: '5 hari lalu',
                content: `import React from 'react';

export function MainContent() {
  return (
    <main className="main-content">
      <div className="container">
        <h2>Welcome to Arka</h2>
        <p>Your AI-powered coding assistant</p>
      </div>
    </main>
  );
}`
              }
            ]
          },
          {
            id: 'utils',
            name: 'utils',
            type: 'folder',
            children: [
              {
                id: 'api.ts',
                name: 'api.ts',
                type: 'file',
                language: 'typescript',
                size: '1.5 KB',
                modified: '1 minggu lalu',
                content: `const API_BASE = 'https://api.example.com';

interface ApiResponse<T> {
  data: T;
  error?: string;
}

export async function fetchData<T>(endpoint: string): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(\`\${API_BASE}/\${endpoint}\`);
    if (!res.ok) throw new Error(\`HTTP \${res.status}\`);
    const data = await res.json();
    return { data };
  } catch (error) {
    return { data: null as any, error: error.message };
  }
}

export async function postData<T>(
  endpoint: string,
  body: unknown
): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(\`\${API_BASE}/\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    return { data };
  } catch (error) {
    return { data: null as any, error: error.message };
  }
}`
              },
              {
                id: 'helpers.ts',
                name: 'helpers.ts',
                type: 'file',
                language: 'typescript',
                size: '0.8 KB',
                modified: '2 minggu lalu',
                content: `export function formatDate(date: Date): string {
  return date.toLocaleDateString('id-ID', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export function debounce<T extends (...args: any[]) => void>(
  fn: T,
  ms: number
) {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

export function classNames(...classes: (string | boolean | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}`
              }
            ]
          },
          {
            id: 'hooks',
            name: 'hooks',
            type: 'folder',
            children: [
              {
                id: 'useAuth.ts',
                name: 'useAuth.ts',
                type: 'file',
                language: 'typescript',
                size: '1.1 KB',
                modified: '3 hari lalu',
                gitStatus: 'untracked',
                content: `import { useState, useEffect } from 'react';

interface User {
  id: string;
  name: string;
  email: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check auth status
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const userData = await response.json();
          setUser(userData);
        }
      } catch (error) {
        console.error('Auth check failed:', error);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, []);

  const login = async (email: string, password: string) => {
    // Login logic
  };

  const logout = async () => {
    setUser(null);
  };

  return { user, loading, login, logout };
}`
              }
            ]
          },
          {
            id: 'main.tsx',
            name: 'main.tsx',
            type: 'file',
            language: 'typescript',
            size: '0.4 KB',
            modified: '1 bulan lalu',
            content: `import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './components/App';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);`
          },
          {
            id: 'index.css',
            name: 'index.css',
            type: 'file',
            language: 'css',
            size: '0.6 KB',
            modified: '1 minggu lalu',
            content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --primary: #7c9cbf;
  --primary-dark: #5a7fa0;
  --bg: #f0f4f8;
  --text: #334155;
}

* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  background-color: var(--bg);
  color: var(--text);
}

.app {
  min-height: 100vh;
}

.header {
  @apply bg-white border-b border-gray-200 px-4 py-3;
}

.sidebar {
  @apply w-64 bg-white border-r border-gray-200 p-4;
}

.main-content {
  @apply flex-1 p-6;
}`
          }
        ]
      },
      {
        id: 'public',
        name: 'public',
        type: 'folder',
        children: [
          {
            id: 'favicon.ico',
            name: 'favicon.ico',
            type: 'file',
            language: 'image',
            size: '4.2 KB',
            modified: '1 bulan lalu'
          },
          {
            id: 'robots.txt',
            name: 'robots.txt',
            type: 'file',
            language: 'text',
            size: '0.1 KB',
            modified: '1 bulan lalu',
            content: `User-agent: *
Allow: /
Sitemap: https://example.com/sitemap.xml`
          }
        ]
      },
      {
        id: 'package.json',
        name: 'package.json',
        type: 'file',
        language: 'json',
        size: '0.8 KB',
        modified: '1 minggu lalu',
        content: `{
  "name": "arka-app",
  "version": "1.0.0",
  "description": "AI-powered coding agent",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview",
    "lint": "eslint . --ext ts,tsx"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "lucide-react": "^0.294.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@typescript-eslint/eslint-plugin": "^6.14.0",
    "@typescript-eslint/parser": "^6.14.0",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "eslint": "^8.55.0",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.3.6",
    "typescript": "^5.2.2",
    "vite": "^5.0.8"
  }
}`
      },
      {
        id: 'tsconfig.json',
        name: 'tsconfig.json',
        type: 'file',
        language: 'json',
        size: '0.3 KB',
        modified: '1 bulan lalu',
        content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}`
      },
      {
        id: 'vite.config.ts',
        name: 'vite.config.ts',
        type: 'file',
        language: 'typescript',
        size: '0.2 KB',
        modified: '1 bulan lalu',
        content: `import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    open: true
  }
});`
      },
      {
        id: 'README.md',
        name: 'README.md',
        type: 'file',
        language: 'markdown',
        size: '1.2 KB',
        modified: '2 hari lalu',
        content: `# Arka - AI Coding Agent

A powerful AI-powered coding assistant built with React and TypeScript.

## Features

- 🤖 Multi-provider AI support (OpenAI, Anthropic, Google, etc.)
- 📁 File explorer with syntax highlighting
- 🔧 Agent system for specialized tasks
- 🐙 GitHub integration
- 💬 Interactive chat interface

## Getting Started

\`\`\`bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
\`\`\`

## Tech Stack

- React 18
- TypeScript
- Vite
- Tailwind CSS
- Lucide Icons

## License

MIT`
      },
      {
        id: '.gitignore',
        name: '.gitignore',
        type: 'file',
        language: 'text',
        size: '0.2 KB',
        modified: '1 bulan lalu',
        content: `# Logs
logs
*.log
npm-debug.log*

# Dependencies
node_modules
dist
dist-ssr
*.local

# Editor
.vscode/*
!.vscode/extensions.json
.idea
.DS_Store
*.suo
*.ntvs*
*.njsproj
*.sln
*.sw?

# Environment
.env
.env.local
.env.production`
      }
    ]
  }
];

function getFileIcon(name: string, language?: string) {
  if (language === 'typescript' || name.endsWith('.tsx') || name.endsWith('.ts')) {
    return <Braces size={14} className="text-[#3b82f6]" />;
  }
  if (language === 'css' || name.endsWith('.css')) {
    return <Type size={14} className="text-[#ec4899]" />;
  }
  if (language === 'json' || name.endsWith('.json')) {
    return <FileJson size={14} className="text-[#f59e0b]" />;
  }
  if (language === 'markdown' || name.endsWith('.md')) {
    return <FileText size={14} className="text-[#64748b]" />;
  }
  if (name.endsWith('.ico') || name.endsWith('.png') || name.endsWith('.jpg')) {
    return <Image size={14} className="text-[#10b981]" />;
  }
  if (name === '.gitignore') {
    return <Hash size={14} className="text-[#64748b]" />;
  }
  return <File size={14} className="text-[#94a3b8]" />;
}

function FileTreeItem({ 
  node, 
  depth = 0, 
  selectedFile, 
  onSelect,
  expandedFolders,
  toggleFolder
}: { 
  node: FileNode; 
  depth?: number; 
  selectedFile: FileNode | null; 
  onSelect: (node: FileNode) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
}) {
  const isExpanded = expandedFolders.has(node.id);

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => toggleFolder(node.id)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#e8eef4] text-left group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          {isExpanded ? (
            <ChevronDown size={12} className="text-[#94a3b8] shrink-0" />
          ) : (
            <ChevronRight size={12} className="text-[#94a3b8] shrink-0" />
          )}
          <FolderOpen size={14} className="text-[#d4a574] shrink-0" />
          <span className="text-xs text-[#334155] font-medium truncate">{node.name}</span>
        </button>
        {isExpanded && node.children?.map(child => (
          <FileTreeItem 
            key={child.id} 
            node={child} 
            depth={depth + 1} 
            selectedFile={selectedFile} 
            onSelect={onSelect}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
          />
        ))}
      </div>
    );
  }

  const gitStatusColors = {
    modified: 'text-[#d4a574]',
    untracked: 'text-[#86b8a0]',
    deleted: 'text-[#c97878]',
    staged: 'text-[#7c9cbf]',
  };

  const gitStatusLabels = {
    modified: 'M',
    untracked: 'U',
    deleted: 'D',
    staged: 'S',
  };

  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
        selectedFile?.id === node.id ? 'bg-[#7c9cbf]/15 text-[#5a7fa0]' : 'hover:bg-[#e8eef4]'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      {getFileIcon(node.name, node.language)}
      <span className={`text-xs truncate flex-1 ${
        node.gitStatus ? gitStatusColors[node.gitStatus] : 'text-[#334155]'
      }`}>
        {node.name}
      </span>
      {node.gitStatus && (
        <span className={`text-[9px] font-bold ${gitStatusColors[node.gitStatus]}`}>
          {gitStatusLabels[node.gitStatus]}
        </span>
      )}
    </button>
  );
}

export default function FileExplorer() {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]);
  const [activeTab, setActiveTab] = useState<FileNode | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['root', 'src']));
  const [searchQuery, setSearchQuery] = useState('');
  const [showActions, setShowActions] = useState(false);

  const toggleFolder = (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileSelect = (file: FileNode) => {
    setSelectedFile(file);
    if (!openTabs.find(t => t.id === file.id)) {
      setOpenTabs([...openTabs, file]);
    }
    setActiveTab(file);
  };

  const handleCloseTab = (tabId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newTabs = openTabs.filter(t => t.id !== tabId);
    setOpenTabs(newTabs);
    if (activeTab?.id === tabId) {
      setActiveTab(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
      setSelectedFile(newTabs.length > 0 ? newTabs[newTabs.length - 1] : null);
    }
  };

  const handleCopy = () => {
    if (activeTab?.content) {
      navigator.clipboard.writeText(activeTab.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const getLineCount = (content: string) => {
    return content.split('\n').length;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <FolderOpen size={18} className="text-[#7c9cbf]" />
        <div className="flex-1">
          <h2 className="font-semibold text-[#334155] text-sm">Workspace</h2>
          <p className="text-[10px] text-[#94a3b8]">
            {activeTab ? `${activeTab.name} • ${activeTab.size} • ${activeTab.modified}` : 'Pilih file untuk melihat'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* File Tree */}
        <div className="w-full md:w-72 border-b md:border-b-0 md:border-r border-[#b8c9db] overflow-y-auto bg-[#f8fafc] flex flex-col">
          {/* Search Bar */}
          <div className="p-2 border-b border-[#b8c9db]">
            <div className="flex items-center gap-1.5 bg-white rounded-lg border border-[#b8c9db] px-2 py-1.5 focus-within:border-[#7c9cbf]">
              <FileCode size={12} className="text-[#94a3b8] shrink-0" />
              <input
                type="text"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Cari file..."
                className="flex-1 bg-transparent text-xs text-[#334155] placeholder:text-[#94a3b8] outline-none"
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery('')} className="p-0.5 rounded hover:bg-[#e8eef4]">
                  <X size={10} className="text-[#64748b]" />
                </button>
              )}
            </div>
          </div>
          
          {/* Tree Header with Actions */}
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#e2e8f0]">
            <span className="text-[10px] font-semibold text-[#64748b] uppercase tracking-wider">Workspace</span>
            <div className="flex items-center gap-0.5 relative">
              <button 
                onClick={() => setShowActions(!showActions)}
                className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b]"
              >
                <Plus size={12} />
              </button>
              {showActions && (
                <div className="absolute right-0 top-full mt-1 bg-white rounded-lg border border-[#b8c9db] shadow-lg z-10 py-1 w-40">
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f0f4f8]">
                    <File size={12} className="text-[#7c9cbf]" />
                    File Baru
                  </button>
                  <button className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f0f4f8]">
                    <FolderOpen size={12} className="text-[#d4a574]" />
                    Folder Baru
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Tree Content */}
          <div className="flex-1 overflow-y-auto p-2">
            {searchQuery ? (
              <div className="space-y-0.5">
                <p className="text-[10px] text-[#94a3b8] px-2 py-1">
                  Hasil pencarian "{searchQuery}"
                </p>
                {mockWorkspace[0].children?.flatMap(function collectFiles(node: FileNode): FileNode[] {
                  if (node.type === 'file' && node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return [node];
                  }
                  if (node.children) {
                    return node.children.flatMap(collectFiles);
                  }
                  return [];
                }).map(file => (
                  <button
                    key={file.id}
                    onClick={() => handleFileSelect(file)}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left ${
                      selectedFile?.id === file.id ? 'bg-[#7c9cbf]/15' : 'hover:bg-[#e8eef4]'
                    }`}
                  >
                    {getFileIcon(file.name, file.language)}
                    <span className="text-xs text-[#334155] truncate">{file.name}</span>
                  </button>
                ))}
              </div>
            ) : (
              mockWorkspace.map(node => (
                <FileTreeItem 
                  key={node.id} 
                  node={node} 
                  selectedFile={selectedFile} 
                  onSelect={handleFileSelect}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                />
              ))
            )}
          </div>

          {/* Git Status Bar */}
          <div className="border-t border-[#b8c9db] px-3 py-2 bg-[#f8fafc]">
            <div className="flex items-center gap-2 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-[#86b8a0]" />
                <span className="text-[#64748b] font-mono">main</span>
              </div>
              <span className="text-[#94a3b8]">•</span>
              <span className="text-[#d4a574]">1 modified</span>
              <span className="text-[#94a3b8]">•</span>
              <span className="text-[#7c9cbf]">1 staged</span>
              <span className="text-[#94a3b8]">•</span>
              <span className="text-[#86b8a0]">1 untracked</span>
            </div>
          </div>
        </div>

        {/* File Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-white">
          {/* Tabs */}
          {openTabs.length > 0 && (
            <div className="flex items-center border-b border-[#b8c9db] bg-[#f8fafc] overflow-x-auto">
              {openTabs.map(tab => (
                <div
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab);
                    setSelectedFile(tab);
                  }}
                  className={`flex items-center gap-2 px-4 py-2 border-r border-[#b8c9db] cursor-pointer min-w-[120px] max-w-[200px] group ${
                    activeTab?.id === tab.id
                      ? 'bg-white border-b-2 border-b-[#7c9cbf]'
                      : 'hover:bg-[#e8eef4]'
                  }`}
                >
                  {getFileIcon(tab.name, tab.language)}
                  <span className="text-xs text-[#334155] truncate flex-1">{tab.name}</span>
                  <button
                    onClick={(e) => handleCloseTab(tab.id, e)}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#e8eef4] transition-opacity"
                  >
                    <X size={12} className="text-[#64748b]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Breadcrumb */}
          {activeTab && (
            <div className="px-4 py-2 border-b border-[#b8c9db] bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-[#64748b]">
                <span>arka-project</span>
                <ChevronRight size={12} />
                <span>src</span>
                <ChevronRight size={12} />
                <span className="text-[#334155] font-medium">{activeTab.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {activeTab.content && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#5a7fa0] px-2 py-1 rounded hover:bg-[#e8eef4]"
                  >
                    {copied ? <Check size={12} className="text-[#86b8a0]" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
                <button className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b]">
                  <Download size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Content */}
          <div className="flex-1 overflow-auto">
            {activeTab?.content ? (
              <div className="flex h-full">
                {/* Line Numbers */}
                <div className="bg-[#f8fafc] border-r border-[#e2e8f0] py-4 px-2 select-none sticky left-0">
                  {Array.from({ length: getLineCount(activeTab.content) }, (_, i) => (
                    <div key={i} className="text-xs text-[#94a3b8] text-right font-mono leading-6 h-6">
                      {i + 1}
                    </div>
                  ))}
                </div>
                {/* Code Content */}
                <pre className="flex-1 p-4 text-xs font-mono text-[#334155] overflow-auto bg-white leading-6">
                  <code>{activeTab.content}</code>
                </pre>
                {/* Minimap */}
                <div className="hidden lg:block w-24 bg-[#f8fafc] border-l border-[#e2e8f0] p-1 overflow-hidden">
                  <div className="transform scale-[0.15] origin-top-left w-[666%]">
                    <pre className="text-[8px] font-mono text-[#94a3b8] leading-[1.2] whitespace-pre">
                      {activeTab.content}
                    </pre>
                  </div>
                </div>
              </div>
            ) : activeTab ? (
              <div className="h-full flex items-center justify-center text-[#94a3b8]">
                <div className="text-center">
                  <Image size={40} className="mx-auto mb-3 opacity-30" />
                  <p className="text-sm font-medium">Binary File</p>
                  <p className="text-xs mt-1">Preview tidak tersedia untuk file ini</p>
                </div>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center text-[#94a3b8]">
                <div className="text-center">
                  <FileCode size={48} className="mx-auto mb-4 opacity-30" />
                  <p className="text-sm font-medium">Tidak ada file yang dipilih</p>
                  <p className="text-xs mt-1">Pilih file dari workspace tree di samping</p>
                </div>
              </div>
            )}
          </div>

          {/* Status Bar */}
          {activeTab && (
            <div className="px-4 py-1.5 border-t border-[#b8c9db] bg-[#f8fafc] flex items-center justify-between text-[10px] text-[#64748b]">
              <div className="flex items-center gap-4">
                <span>{activeTab.language?.toUpperCase() || 'Plain Text'}</span>
                <span>UTF-8</span>
                <span>LF</span>
              </div>
              <div className="flex items-center gap-4">
                <span>{getLineCount(activeTab.content || '')} lines</span>
                <span>{activeTab.size}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
