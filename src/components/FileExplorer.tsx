import { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, File, ChevronRight, ChevronDown, FileCode, FileText, 
  Image, Copy, Check, Plus, Trash2, Edit2, X, Download, 
  FileJson, FileSpreadsheet, Hash, Braces, Type, Folder
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


// Every node in the tree now comes from the AI's virtual workspace
// (localStorage) — there is no more static demo data, so every file/folder
// shown here is deletable.
function isVirtualFileNode(node: FileNode): boolean {
  return node.type === 'file' && node.id.startsWith('virtual-') && node.id !== 'virtual-empty';
}
function isVirtualFolderNode(node: FileNode): boolean {
  return node.type === 'folder' && node.id.startsWith('virtual/');
}

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
  toggleFolder,
  onDeleteFile,
  onDeleteFolder,
}: { 
  node: FileNode; 
  depth?: number; 
  selectedFile: FileNode | null; 
  onSelect: (node: FileNode) => void;
  expandedFolders: Set<string>;
  toggleFolder: (id: string) => void;
  onDeleteFile: (node: FileNode) => void;
  onDeleteFolder: (node: FileNode) => void;
}) {
  const isExpanded = expandedFolders.has(node.id);

  if (node.type === 'folder') {
    const canDelete = isVirtualFolderNode(node);
    return (
      <div>
        <div
          className="w-full flex items-center gap-1.5 px-2 py-1.5 rounded hover:bg-[#e8eef4] group"
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
        >
          <button
            onClick={() => toggleFolder(node.id)}
            className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
          >
            {isExpanded ? (
              <ChevronDown size={12} className="text-[#94a3b8] shrink-0" />
            ) : (
              <ChevronRight size={12} className="text-[#94a3b8] shrink-0" />
            )}
            <FolderOpen size={14} className="text-[#d4a574] shrink-0" />
            <span className="text-xs text-[#334155] font-medium truncate">{node.name}</span>
          </button>
          {canDelete && (
            <button
              onClick={(e) => { e.stopPropagation(); onDeleteFolder(node); }}
              className="opacity-70 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-[#c97878]/10 text-[#c97878] shrink-0 transition-opacity"
              title="Hapus folder ini beserta semua isinya"
            >
              <Trash2 size={11} />
            </button>
          )}
        </div>
        {isExpanded && node.children?.map(child => (
          <FileTreeItem 
            key={child.id} 
            node={child} 
            depth={depth + 1} 
            selectedFile={selectedFile} 
            onSelect={onSelect}
            expandedFolders={expandedFolders}
            toggleFolder={toggleFolder}
            onDeleteFile={onDeleteFile}
            onDeleteFolder={onDeleteFolder}
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

  const canDeleteFile = isVirtualFileNode(node);

  return (
    <div
      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded transition-colors group ${
        selectedFile?.id === node.id ? 'bg-[#7c9cbf]/15 text-[#5a7fa0]' : 'hover:bg-[#e8eef4]'
      }`}
      style={{ paddingLeft: `${depth * 12 + 20}px` }}
    >
      <button
        onClick={() => onSelect(node)}
        className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
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
      {canDeleteFile && (
        <button
          onClick={(e) => { e.stopPropagation(); onDeleteFile(node); }}
          className="opacity-70 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-[#c97878]/10 text-[#c97878] shrink-0 transition-opacity"
          title="Hapus file ini dari workspace"
        >
          <Trash2 size={11} />
        </button>
      )}
    </div>
  );
}


export default function FileExplorer() {
  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]);
  const [activeTab, setActiveTab] = useState<FileNode | null>(null);
  const [copied, setCopied] = useState(false);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string>('Virtual Workspace');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [virtualFiles, setVirtualFiles] = useState<Record<string, any>>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Load virtual files from localStorage
  const loadVirtualFiles = useCallback(() => {
    try {
      const files = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
      setVirtualFiles(files);
    } catch (error) {
      console.error('Failed to load virtual files:', error);
    }
  }, []);

  useEffect(() => {
    loadVirtualFiles();

    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'arka-virtual-files') {
        loadVirtualFiles();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom event from tools (same tab)
    const handleVirtualFilesUpdated = () => {
      loadVirtualFiles();
    };
    window.addEventListener('virtual-files-updated', handleVirtualFilesUpdated);
    
    // Check periodically for changes from same tab (tools, etc)
    const interval = setInterval(loadVirtualFiles, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('virtual-files-updated', handleVirtualFilesUpdated);
      clearInterval(interval);
    };
  }, [loadVirtualFiles]);

  // Read-modify-write helper for the virtual filesystem, shared by New File / New Folder.
  const writeVirtualFile = (path: string, content: string) => {
    try {
      const files = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
      files[path] = {
        content,
        modified: new Date().toISOString(),
        size: content.length,
      };
      localStorage.setItem('arka-virtual-files', JSON.stringify(files));
      window.dispatchEvent(new CustomEvent('virtual-files-updated'));
      setVirtualFiles(files);
      return true;
    } catch (error) {
      console.error('Gagal menulis file virtual:', error);
      return false;
    }
  };

  const handleCreateNewFile = () => {
    setShowActions(false);
    const name = window.prompt('Nama file baru (contoh: src/utils/helper.ts):', 'file-baru.txt');
    if (!name || !name.trim()) return;
    const path = name.trim().replace(/^\/+/, '');
    if (path.includes('..')) {
      window.alert('Nama file tidak boleh mengandung ".."');
      return;
    }
    const currentFiles = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
    if (currentFiles[path]) {
      window.alert(`File "${path}" sudah ada.`);
      return;
    }
    if (writeVirtualFile(path, '')) {
      const fileName = path.split('/').pop() || path;
      const extension = fileName.split('.').pop() || '';
      const languageMap: Record<string, string> = {
        ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
        html: 'html', css: 'css', json: 'json', md: 'markdown',
      };
      const newNode: FileNode = {
        id: `virtual-${path}`,
        name: fileName,
        type: 'file',
        content: '',
        language: languageMap[extension] || 'text',
        size: '0.0 KB',
        modified: new Date().toLocaleString('id-ID'),
        gitStatus: 'untracked',
      };
      handleFileSelect(newNode);
    }
  };

  const handleCreateNewFolder = () => {
    setShowActions(false);
    const name = window.prompt('Nama folder baru (contoh: src/components):', 'folder-baru');
    if (!name || !name.trim()) return;
    const path = name.trim().replace(/^\/+/, '').replace(/\/+$/, '');
    if (path.includes('..')) {
      window.alert('Nama folder tidak boleh mengandung ".."');
      return;
    }
    // The virtual filesystem is a flat path->content map, so an empty folder is represented
    // by a hidden ".gitkeep" placeholder file; the tree builder groups it into a real folder node.
    writeVirtualFile(`${path}/.gitkeep`, '');
    setExpandedFolders(prev => new Set(prev).add(`virtual/${path}`));
  };

  const toggleFolder = (id: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedFolders(newExpanded);
  };

  // Closes any open tab / clears selection for paths that no longer exist
  // after a delete, so the content pane doesn't keep showing stale content.
  const forgetTabsForIds = (ids: Set<string>) => {
    setOpenTabs(prev => prev.filter(t => !ids.has(t.id)));
    setActiveTab(prev => (prev && ids.has(prev.id) ? null : prev));
    setSelectedFile(prev => (prev && ids.has(prev.id) ? null : prev));
  };

  const handleDeleteFile = (node: FileNode) => {
    if (!window.confirm(`Hapus file "${node.name}" dari workspace? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const path = node.id.replace(/^virtual-/, '');
      const files = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
      delete files[path];
      localStorage.setItem('arka-virtual-files', JSON.stringify(files));
      window.dispatchEvent(new CustomEvent('virtual-files-updated'));
      setVirtualFiles(files);
      forgetTabsForIds(new Set([node.id]));
    } catch (error) {
      console.error('Gagal menghapus file virtual:', error);
      window.alert('Gagal menghapus file.');
    }
  };

  const handleDeleteFolder = (node: FileNode) => {
    const folderPath = node.id.replace(/^virtual\//, '');
    if (!window.confirm(`Hapus folder "${node.name}" beserta SEMUA isinya dari workspace? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      const files = JSON.parse(localStorage.getItem('arka-virtual-files') || '{}');
      const prefix = `${folderPath}/`;
      const pathsToDelete = Object.keys(files).filter(p => p === folderPath || p.startsWith(prefix));
      pathsToDelete.forEach(p => delete files[p]);
      localStorage.setItem('arka-virtual-files', JSON.stringify(files));
      window.dispatchEvent(new CustomEvent('virtual-files-updated'));
      setVirtualFiles(files);
      forgetTabsForIds(new Set(pathsToDelete.map(p => `virtual-${p}`)));
    } catch (error) {
      console.error('Gagal menghapus folder virtual:', error);
      window.alert('Gagal menghapus folder.');
    }
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

  const handleDownload = () => {
    if (!activeTab || activeTab.content === undefined) return;
    const blob = new Blob([activeTab.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const getLineCount = (content: string) => {
    return content.split('\n').length;
  };

  // Convert virtual files (flat path -> content map) into a nested FileNode tree,
  // so files like "src/components/Foo.tsx" render inside proper "src" / "components" folders
  // instead of being dumped flat into the workspace root.
  const getVirtualFileNodes = useCallback((): FileNode[] => {
    const languageMap: Record<string, string> = {
      'ts': 'typescript',
      'tsx': 'typescript',
      'js': 'javascript',
      'jsx': 'javascript',
      'html': 'html',
      'css': 'css',
      'json': 'json',
      'md': 'markdown',
    };

    const root: FileNode = { id: 'virtual-root-tree', name: '', type: 'folder', children: [] };

    Object.entries(virtualFiles).forEach(([path, file]) => {
      const parts = path.split('/').filter(Boolean);
      const fileName = parts[parts.length - 1];
      // ".gitkeep" placeholders exist only so empty folders show up in the tree; don't list them as files.
      const isPlaceholder = fileName === '.gitkeep';

      let current = root;
      const folderParts = isPlaceholder ? parts.slice(0, -1) : parts.slice(0, -1);
      let idPath = 'virtual';
      folderParts.forEach((part) => {
        idPath += `/${part}`;
        let folder = current.children?.find(c => c.type === 'folder' && c.name === part);
        if (!folder) {
          folder = { id: idPath, name: part, type: 'folder', children: [] };
          current.children = current.children || [];
          current.children.push(folder);
        }
        current = folder;
      });

      if (isPlaceholder) {
        // Ensure the (possibly empty) folder exists; nothing else to add.
        return;
      }

      const extension = fileName.split('.').pop() || '';
      current.children = current.children || [];
      current.children.push({
        id: `virtual-${path}`,
        name: fileName,
        type: 'file' as const,
        content: file.content,
        language: languageMap[extension] || 'text',
        size: `${(file.size / 1024).toFixed(1)} KB`,
        modified: new Date(file.modified).toLocaleString('id-ID'),
        gitStatus: 'untracked' as const,
      });
    });

    // Sort: folders first, then files, alphabetically within each group.
    const sortTree = (node: FileNode) => {
      if (!node.children) return;
      node.children.sort((a, b) => {
        if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      node.children.forEach(sortTree);
    };
    sortTree(root);

    return root.children || [];
  }, [virtualFiles]);

  // The workspace tree is now just the AI's virtual files directly — no more
  // wrapping "📦 Virtual Workspace" folder and no more static mock/demo tree
  // underneath it (that demo data couldn't be deleted, which was confusing).
  const getMergedWorkspace = useCallback((): FileNode[] => {
    const virtualNodes = getVirtualFileNodes();

    if (virtualNodes.length > 0) return virtualNodes;

    return [
      {
        id: 'virtual-empty',
        name: '(kosong - AI akan buat file di sini)',
        type: 'file' as const,
        content: '',
        language: 'text',
        size: '0 KB',
        modified: '-',
      },
    ];
  }, [getVirtualFileNodes]);

  const mergedWorkspace = getMergedWorkspace();

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <FolderOpen size={18} className="text-[#7c9cbf]" />
          <div className="flex-1">
            <h2 className="font-semibold text-[#334155] text-sm">Workspace</h2>
            <p className="text-[10px] text-[#94a3b8]">
              {activeTab ? `${activeTab.name} • ${activeTab.size} • ${activeTab.modified}` : 'Pilih file untuk melihat'}
            </p>
          </div>
          <button
            onClick={() => setShowFolderPicker(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c9cbf]/10 text-[#5a7fa0] text-xs font-medium hover:bg-[#7c9cbf]/20 transition-colors"
          >
            <Folder size={12} />
            Pilih Folder
          </button>
        </div>
        {/* Workspace Path */}
        <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-[#f8fafc] border border-[#b8c9db]">
          <span className="text-[10px] text-[#64748b] font-medium">📁</span>
          <span className="text-xs text-[#334155] font-mono truncate">{workspacePath}</span>
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
                  <button
                    onClick={handleCreateNewFile}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f0f4f8]"
                  >
                    <File size={12} className="text-[#7c9cbf]" />
                    File Baru
                  </button>
                  <button
                    onClick={handleCreateNewFolder}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-[#334155] hover:bg-[#f0f4f8]"
                  >
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
                {mergedWorkspace.flatMap(function collectFiles(node: FileNode): FileNode[] {
                  if (node.type === 'file' && node.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return [node];
                  }
                  if (node.children) {
                    return node.children.flatMap(collectFiles);
                  }
                  return [];
                }).map(file => (
                  <div
                    key={file.id}
                    className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded group ${
                      selectedFile?.id === file.id ? 'bg-[#7c9cbf]/15' : 'hover:bg-[#e8eef4]'
                    }`}
                  >
                    <button
                      onClick={() => handleFileSelect(file)}
                      className="flex-1 min-w-0 flex items-center gap-1.5 text-left"
                    >
                      {getFileIcon(file.name, file.language)}
                      <span className="text-xs text-[#334155] truncate">{file.name}</span>
                    </button>
                    {isVirtualFileNode(file) && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeleteFile(file); }}
                        className="opacity-70 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-1 rounded hover:bg-[#c97878]/10 text-[#c97878] shrink-0 transition-opacity"
                        title="Hapus file ini dari workspace"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              mergedWorkspace.map(node => (
                <FileTreeItem 
                  key={node.id} 
                  node={node} 
                  selectedFile={selectedFile} 
                  onSelect={handleFileSelect}
                  expandedFolders={expandedFolders}
                  toggleFolder={toggleFolder}
                  onDeleteFile={handleDeleteFile}
                  onDeleteFolder={handleDeleteFolder}
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
                    className="opacity-70 group-hover:opacity-100 md:opacity-0 md:group-hover:opacity-100 p-0.5 rounded hover:bg-[#e8eef4] transition-opacity"
                  >
                    <X size={12} className="text-[#64748b]" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Breadcrumb — derived from the file's real virtual path instead
              of a hardcoded "arka-project / src" that no longer means anything
              now that the workspace tree is just the AI's actual files. */}
          {activeTab && (
            <div className="px-4 py-2 border-b border-[#b8c9db] bg-[#f8fafc] flex items-center justify-between">
              <div className="flex items-center gap-1 text-xs text-[#64748b] min-w-0 flex-wrap">
                {activeTab.id.startsWith('virtual-')
                  ? activeTab.id.slice('virtual-'.length).split('/').filter(Boolean).map((segment, i, arr) => (
                      <span key={i} className="flex items-center gap-1">
                        <span className={i === arr.length - 1 ? 'text-[#334155] font-medium' : ''}>{segment}</span>
                        {i < arr.length - 1 && <ChevronRight size={12} />}
                      </span>
                    ))
                  : <span className="text-[#334155] font-medium">{activeTab.name}</span>}
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
                <button
                  onClick={handleDownload}
                  className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b]"
                  title="Download file"
                >
                  <Download size={14} />
                </button>
                {isVirtualFileNode(activeTab) && (
                  <button
                    onClick={() => handleDeleteFile(activeTab)}
                    className="p-1 rounded hover:bg-[#c97878]/10 text-[#c97878]"
                    title="Hapus file ini dari workspace"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
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

      {/* Folder Picker Modal */}
      {showFolderPicker && (
        <div 
          className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4"
          onClick={() => setShowFolderPicker(false)}
        >
          <div 
            className="bg-white rounded-2xl w-full max-w-md shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Folder size={16} className="text-[#7c9cbf]" />
                <h3 className="font-bold text-[#334155] text-sm">Pilih Folder Workspace</h3>
              </div>
              <button 
                onClick={() => setShowFolderPicker(false)}
                className="p-1 rounded hover:bg-[#e8eef4]"
              >
                <X size={18} className="text-[#64748b]" />
              </button>
            </div>
            
            <div className="p-4 space-y-4">
              {/* Current Path */}
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-1">Path Folder</label>
                <input
                  type="text"
                  value={workspacePath}
                  onChange={e => setWorkspacePath(e.target.value)}
                  placeholder="/home/user/projects/my-project"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                />
              </div>

              {/* Quick Select */}
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-2">Pilih Cepat</label>
                <div className="space-y-2">
                  {[
                    { path: '/home/user/projects/arka-project', name: 'Arka Project' },
                    { path: '/home/user/projects/web-app', name: 'Web App' },
                    { path: '/home/user/projects/mobile-app', name: 'Mobile App' },
                    { path: '/home/user/Desktop', name: 'Desktop' },
                    { path: '/home/user/Documents', name: 'Documents' },
                  ].map(folder => (
                    <button
                      key={folder.path}
                      onClick={() => setWorkspacePath(folder.path)}
                      className={`w-full flex items-center gap-3 p-3 rounded-lg border transition-all text-left ${
                        workspacePath === folder.path
                          ? 'border-[#7c9cbf] bg-[#7c9cbf]/5'
                          : 'border-[#b8c9db] hover:border-[#7c9cbf]/50 hover:bg-[#f8fafc]'
                      }`}
                    >
                      <Folder size={16} className="text-[#d4a574] shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#334155] truncate">{folder.name}</p>
                        <p className="text-xs text-[#94a3b8] font-mono truncate">{folder.path}</p>
                      </div>
                      {workspacePath === folder.path && (
                        <Check size={16} className="text-[#7c9cbf] shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Browse Button */}
              <label className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm text-[#64748b] hover:bg-[#f8fafc] transition-colors cursor-pointer">
                <FolderOpen size={14} />
                Browse Folder...
                <input
                  type="file"
                  className="hidden"
                  onChange={(e) => {
                    const files = e.target.files;
                    if (files && files.length > 0) {
                      const firstFile = files[0];
                      const path = firstFile.webkitRelativePath || firstFile.name;
                      const folderPath = path.split('/')[0];
                      setWorkspacePath(`/${folderPath}`);
                    }
                  }}
                  {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                />
              </label>

              {/* Action Buttons */}
              <div className="flex gap-2">
                <button
                  onClick={() => setShowFolderPicker(false)}
                  className="flex-1 px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={() => setShowFolderPicker(false)}
                  className="flex-1 px-3 py-2.5 rounded-lg bg-[#7c9cbf] text-white text-sm font-medium hover:bg-[#5a7fa0] transition-colors"
                >
                  Pilih
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
