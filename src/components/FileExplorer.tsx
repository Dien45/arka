import { useState } from 'react';
import { FolderOpen, File, ChevronRight, ChevronDown, FileCode, FileText, Image, Copy, Check } from 'lucide-react';

interface FileNode {
  name: string;
  type: 'file' | 'folder';
  children?: FileNode[];
  content?: string;
  language?: string;
}

const mockFileSystem: FileNode[] = [
  {
    name: 'src',
    type: 'folder',
    children: [
      {
        name: 'components',
        type: 'folder',
        children: [
          { name: 'App.tsx', type: 'file', language: 'typescript', content: `import React from 'react';\nimport { Header } from './Header';\nimport { Sidebar } from './Sidebar';\n\nexport default function App() {\n  return (\n    <div className="app">\n      <Header />\n      <Sidebar />\n      <main>\n        <h1>Hello World</h1>\n      </main>\n    </div>\n  );\n}` },
          { name: 'Header.tsx', type: 'file', language: 'typescript', content: `export function Header() {\n  return (\n    <header className="header">\n      <h1>Arka</h1>\n      <nav>\n        <a href="/">Home</a>\n        <a href="/about">About</a>\n      </nav>\n    </header>\n  );\n}` },
          { name: 'Sidebar.tsx', type: 'file', language: 'typescript', content: `export function Sidebar() {\n  return (\n    <aside className="sidebar">\n      <ul>\n        <li>Dashboard</li>\n        <li>Projects</li>\n        <li>Settings</li>\n      </ul>\n    </aside>\n  );\n}` },
        ],
      },
      {
        name: 'utils',
        type: 'folder',
        children: [
          { name: 'api.ts', type: 'file', language: 'typescript', content: `const API_BASE = 'https://api.example.com';\n\nexport async function fetchData(endpoint: string) {\n  const res = await fetch(\`\${API_BASE}/\${endpoint}\`);\n  if (!res.ok) throw new Error('Fetch failed');\n  return res.json();\n}\n\nexport async function postData(endpoint: string, data: unknown) {\n  const res = await fetch(\`\${API_BASE}/\${endpoint}\`, {\n    method: 'POST',\n    headers: { 'Content-Type': 'application/json' },\n    body: JSON.stringify(data),\n  });\n  return res.json();\n}` },
          { name: 'helpers.ts', type: 'file', language: 'typescript', content: `export function formatDate(date: Date): string {\n  return date.toLocaleDateString('id-ID', {\n    year: 'numeric',\n    month: 'long',\n    day: 'numeric',\n  });\n}\n\nexport function debounce<T extends (...args: unknown[]) => void>(fn: T, ms: number) {\n  let timer: ReturnType<typeof setTimeout>;\n  return (...args: Parameters<T>) => {\n    clearTimeout(timer);\n    timer = setTimeout(() => fn(...args), ms);\n  };\n}` },
        ],
      },
      { name: 'main.tsx', type: 'file', language: 'typescript', content: `import React from 'react';\nimport ReactDOM from 'react-dom/client';\nimport App from './components/App';\nimport './index.css';\n\nReactDOM.createRoot(document.getElementById('root')!).render(\n  <React.StrictMode>\n    <App />\n  </React.StrictMode>\n);` },
      { name: 'index.css', type: 'file', language: 'css', content: `@tailwind base;\n@tailwind components;\n@tailwind utilities;\n\n:root {\n  --primary: #7c9cbf;\n  --bg: #f0f4f8;\n}\n\nbody {\n  margin: 0;\n  font-family: 'Inter', sans-serif;\n}` },
    ],
  },
  {
    name: 'public',
    type: 'folder',
    children: [
      { name: 'favicon.ico', type: 'file', language: 'image' },
      { name: 'robots.txt', type: 'file', language: 'text', content: 'User-agent: *\nAllow: /' },
    ],
  },
  { name: 'package.json', type: 'file', language: 'json', content: `{\n  "name": "arka-app",\n  "version": "1.0.0",\n  "scripts": {\n    "dev": "vite",\n    "build": "vite build",\n    "preview": "vite preview"\n  },\n  "dependencies": {\n    "react": "^18.2.0",\n    "react-dom": "^18.2.0"\n  }\n}` },
  { name: 'tsconfig.json', type: 'file', language: 'json', content: `{\n  "compilerOptions": {\n    "target": "ES2020",\n    "module": "ESNext",\n    "strict": true,\n    "jsx": "react-jsx"\n  }\n}` },
  { name: 'README.md', type: 'file', language: 'markdown', content: `# Arka App\n\nA coding agent application built with React and TypeScript.\n\n## Getting Started\n\n\`\`\`bash\nnpm install\nnpm run dev\n\`\`\`\n\n## Features\n\n- AI-powered code assistance\n- Multi-provider support\n- GitHub integration` },
];

function getFileIcon(name: string) {
  if (name.endsWith('.tsx') || name.endsWith('.ts')) return <FileCode size={14} className="text-[#7c9cbf]" />;
  if (name.endsWith('.css')) return <FileCode size={14} className="text-[#93b5d3]" />;
  if (name.endsWith('.json')) return <FileText size={14} className="text-[#d4a574]" />;
  if (name.endsWith('.md')) return <FileText size={14} className="text-[#64748b]" />;
  if (name.endsWith('.ico') || name.endsWith('.png')) return <Image size={14} className="text-[#86b8a0]" />;
  return <File size={14} className="text-[#94a3b8]" />;
}

function FileTreeItem({ node, depth = 0, selectedFile, onSelect }: { node: FileNode; depth?: number; selectedFile: FileNode | null; onSelect: (node: FileNode) => void }) {
  const [isOpen, setIsOpen] = useState(depth < 1);

  if (node.type === 'folder') {
    return (
      <div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#e8eef4] text-left group"
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
        >
          {isOpen ? <ChevronDown size={12} className="text-[#94a3b8]" /> : <ChevronRight size={12} className="text-[#94a3b8]" />}
          <FolderOpen size={14} className="text-[#d4a574]" />
          <span className="text-xs text-[#334155] font-medium">{node.name}</span>
        </button>
        {isOpen && node.children?.map(child => (
          <FileTreeItem key={child.name} node={child} depth={depth + 1} selectedFile={selectedFile} onSelect={onSelect} />
        ))}
      </div>
    );
  }

  return (
    <button
      onClick={() => onSelect(node)}
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-left transition-colors ${
        selectedFile?.name === node.name ? 'bg-[#7c9cbf]/15 text-[#5a7fa0]' : 'hover:bg-[#e8eef4]'
      }`}
      style={{ paddingLeft: `${depth * 16 + 24}px` }}
    >
      {getFileIcon(node.name)}
      <span className="text-xs text-[#334155] truncate">{node.name}</span>
    </button>
  );
}

export default function FileExplorer() {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (selectedFile?.content) {
      navigator.clipboard.writeText(selectedFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <FolderOpen size={18} className="text-[#7c9cbf]" />
        <div>
          <h2 className="font-semibold text-[#334155] text-sm">File Explorer</h2>
          <p className="text-[10px] text-[#94a3b8]">
            {selectedFile ? selectedFile.name : 'Pilih file untuk melihat'}
          </p>
        </div>
      </div>

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* File Tree */}
        <div className="w-full md:w-64 border-b md:border-b-0 md:border-r border-[#b8c9db] overflow-y-auto p-2">
          {mockFileSystem.map(node => (
            <FileTreeItem key={node.name} node={node} selectedFile={selectedFile} onSelect={setSelectedFile} />
          ))}
        </div>

        {/* File Content */}
        <div className="flex-1 overflow-auto">
          {selectedFile ? (
            <div className="h-full flex flex-col">
              <div className="px-4 py-2 border-b border-[#b8c9db] flex items-center justify-between bg-[#f8fafc]">
                <div className="flex items-center gap-2">
                  {getFileIcon(selectedFile.name)}
                  <span className="text-xs font-medium text-[#334155]">{selectedFile.name}</span>
                  {selectedFile.language && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#e8eef4] text-[#64748b]">
                      {selectedFile.language}
                    </span>
                  )}
                </div>
                {selectedFile.content && (
                  <button
                    onClick={handleCopy}
                    className="flex items-center gap-1 text-xs text-[#64748b] hover:text-[#5a7fa0] px-2 py-1 rounded hover:bg-[#e8eef4]"
                  >
                    {copied ? <Check size={12} className="text-[#86b8a0]" /> : <Copy size={12} />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                )}
              </div>
              {selectedFile.content ? (
                <pre className="flex-1 p-4 text-xs font-mono text-[#334155] overflow-auto bg-[#f8fafc] leading-relaxed">
                  <code>{selectedFile.content}</code>
                </pre>
              ) : (
                <div className="flex-1 flex items-center justify-center text-[#94a3b8] text-sm">
                  <div className="text-center">
                    <Image size={32} className="mx-auto mb-2 opacity-50" />
                    <p>Preview tidak tersedia</p>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center text-[#94a3b8]">
              <div className="text-center">
                <FileCode size={40} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">Pilih file dari tree di samping</p>
                <p className="text-xs mt-1">untuk melihat kontennya</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
