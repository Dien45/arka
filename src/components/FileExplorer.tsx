import { useState, useEffect, useCallback } from 'react';
import { 
  FolderOpen, File, ChevronRight, ChevronDown, FileCode, FileText, 
  Image, Copy, Check, Plus, Trash2, Edit2, X, Download, Upload,
  FileJson, FileSpreadsheet, Hash, Braces, Type, Folder, Loader2,
  Eye, Code2, ExternalLink
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../store';
import { loadVirtualFiles, saveVirtualFiles, virtualFilesKey, VirtualFileMap } from '../virtualFs';

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

/** Which file types get a rendered "Preview" mode alongside the raw code view. */
type PreviewKind = 'html' | 'markdown' | 'svg' | 'csv';

function getPreviewKind(name: string): PreviewKind | null {
  const ext = name.split('.').pop()?.toLowerCase() || '';
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  if (ext === 'svg') return 'svg';
  if (ext === 'csv') return 'csv';
  return null;
}

/** Minimal CSV parser (comma-separated, no quoted-field escaping) — good
 *  enough for a quick tabular preview of AI-generated CSV files. */
function parseCsvPreview(content: string): string[][] {
  return content
    .trim()
    .split(/\r?\n/)
    .filter(line => line.length > 0)
    .map(line => line.split(','));
}

/** Renders a file's content instead of its raw source, for types where a
 *  "what does this actually look like" view is more useful than code:
 *  HTML pages, Markdown docs, SVG graphics, and CSV tables. */
function FilePreviewPane({ kind, content, fileName }: { kind: PreviewKind; content: string; fileName: string }) {
  if (kind === 'html') {
    return (
      <iframe
        title={fileName}
        srcDoc={content}
        sandbox="allow-scripts allow-forms allow-modals allow-popups"
        className="w-full h-full bg-white border-0"
      />
    );
  }

  if (kind === 'svg') {
    const dataUrl = `data:image/svg+xml;utf8,${encodeURIComponent(content)}`;
    return (
      <div className="w-full h-full flex items-center justify-center bg-[#f8fafc] p-6 overflow-auto">
        <img src={dataUrl} alt={fileName} className="max-w-full max-h-full" />
      </div>
    );
  }

  if (kind === 'markdown') {
    return (
      <div className="markdown-body text-sm p-6 max-w-3xl mx-auto">
        <ReactMarkdown>{content}</ReactMarkdown>
      </div>
    );
  }

  // csv
  const rows = parseCsvPreview(content);
  if (rows.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-[#94a3b8] text-xs">
        File CSV kosong
      </div>
    );
  }
  const [header, ...body] = rows;
  return (
    <div className="p-4 overflow-auto h-full">
      <table className="text-xs border-collapse w-full">
        <thead>
          <tr>
            {header.map((cell, i) => (
              <th key={i} className="border border-[#e2e8f0] bg-[#f1f5f9] px-2 py-1.5 text-left font-semibold text-[#334155] whitespace-nowrap">
                {cell}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {body.map((row, ri) => (
            <tr key={ri} className="hover:bg-[#f8fafc]">
              {row.map((cell, ci) => (
                <td key={ci} className="border border-[#e2e8f0] px-2 py-1.5 text-[#334155] whitespace-nowrap">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
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
  if (name.endsWith('.ico') || name.endsWith('.png') || name.endsWith('.jpg') || name.endsWith('.svg')) {
    return <Image size={14} className="text-[#10b981]" />;
  }
  if (name.endsWith('.csv')) {
    return <FileSpreadsheet size={14} className="text-[#22c55e]" />;
  }
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    return <FileCode size={14} className="text-[#f97316]" />;
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
  const { state } = useApp();
  // Every session gets its own isolated workspace (see virtualFs.ts) —
  // files written while working on one chat don't leak into another.
  const sessionId = state.currentSessionId;

  const [selectedFile, setSelectedFile] = useState<FileNode | null>(null);
  const [openTabs, setOpenTabs] = useState<FileNode[]>([]);
  const [activeTab, setActiveTab] = useState<FileNode | null>(null);
  const [copied, setCopied] = useState(false);
  // Code vs rendered-preview toggle for previewable file types (html/md/svg/csv).
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState('');
  const [showActions, setShowActions] = useState(false);
  const [workspacePath, setWorkspacePath] = useState<string>('Virtual Workspace');
  const [showFolderPicker, setShowFolderPicker] = useState(false);
  const [virtualFiles, setVirtualFiles] = useState<VirtualFileMap>({});
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-read the active session's files from localStorage into component state.
  const refreshVirtualFiles = useCallback(() => {
    setVirtualFiles(loadVirtualFiles(sessionId));
  }, [sessionId]);

  useEffect(() => {
    // Closing over the tabs/selection from a *previous* session would let
    // stale content (or a stale delete) leak across sessions, so clear them
    // whenever the active session changes.
    setOpenTabs([]);
    setActiveTab(null);
    setSelectedFile(null);
    refreshVirtualFiles();

    // Listen for storage changes from other tabs/windows
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === virtualFilesKey(sessionId)) {
        refreshVirtualFiles();
      }
    };
    window.addEventListener('storage', handleStorageChange);
    
    // Listen for custom event from tools (same tab)
    const handleVirtualFilesUpdated = (e: Event) => {
      const detailSessionId = (e as CustomEvent).detail?.sessionId;
      // Ignore updates for a different session so switching tasks in the
      // background (e.g. Agent mode still running on another session)
      // never overwrites what's currently shown here.
      if (detailSessionId === undefined || detailSessionId === sessionId) {
        refreshVirtualFiles();
      }
    };
    window.addEventListener('virtual-files-updated', handleVirtualFilesUpdated);
    
    // Check periodically for changes from same tab (tools, etc)
    const interval = setInterval(refreshVirtualFiles, 500);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('virtual-files-updated', handleVirtualFilesUpdated);
      clearInterval(interval);
    };
  }, [refreshVirtualFiles, sessionId]);

  // Read-modify-write helper for the virtual filesystem, shared by New File / New Folder.
  const writeVirtualFile = (path: string, content: string) => {
    try {
      const files = loadVirtualFiles(sessionId);

      files[path] = {
        content,
        modified: new Date().toISOString(),
        size: content.length,
      };
      saveVirtualFiles(sessionId, files);
      setVirtualFiles(files);
      return true;
    } catch (error) {
      console.error('Gagal menulis file virtual:', error);
      return false;
    }
  };

  const handleCreateNewFile = () => {
    setShowActions(false);
    if (!sessionId) {
      window.alert('Pilih atau mulai sesi chat dulu — setiap sesi punya workspace file-nya sendiri.');
      return;
    }
    const name = window.prompt('Nama file baru (contoh: src/utils/helper.ts):', 'file-baru.txt');
    if (!name || !name.trim()) return;
    const path = name.trim().replace(/^\/+/, '');
    if (path.includes('..')) {
      window.alert('Nama file tidak boleh mengandung ".."');
      return;
    }
    const currentFiles = loadVirtualFiles(sessionId);
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
    if (!sessionId) {
      window.alert('Pilih atau mulai sesi chat dulu — setiap sesi punya workspace file-nya sendiri.');
      return;
    }
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
      const files = loadVirtualFiles(sessionId);
      delete files[path];
      saveVirtualFiles(sessionId, files);
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
      const files = loadVirtualFiles(sessionId);
      const prefix = `${folderPath}/`;
      const pathsToDelete = Object.keys(files).filter(p => p === folderPath || p.startsWith(prefix));
      pathsToDelete.forEach(p => delete files[p]);
      saveVirtualFiles(sessionId, files);
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

  // Default back to the code view whenever a different file becomes active,
  // so a "Preview" chosen for one file doesn't stick around confusingly
  // when switching to another (non-)previewable file.
  useEffect(() => {
    setViewMode('code');
  }, [activeTab?.id]);

  const activePreviewKind = activeTab ? getPreviewKind(activeTab.name) : null;

  const handleOpenPreviewInNewTab = () => {
    if (!activeTab?.content) return;
    const blob = new Blob([activeTab.content], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    window.open(url, '_blank');
    // Give the new tab time to actually load the blob before revoking it.
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
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

  const [isZipping, setIsZipping] = useState(false);

  // Bundles every real (virtual) file the AI has written into a single .zip,
  // preserving the folder structure — so the whole workspace can be grabbed
  // in one go instead of downloading files one at a time.
  const handleDownloadWorkspaceZip = async () => {
    const entries = Object.entries(virtualFiles).filter(([path]) => !path.endsWith('/.gitkeep'));
    if (entries.length === 0) {
      alert('Workspace masih kosong — belum ada file untuk di-download.');
      return;
    }

    setIsZipping(true);
    try {
      // Lazy-loaded so the ~100KB zip library only downloads when someone
      // actually uses this button, instead of bloating the main app bundle.
      const { default: JSZip } = await import('jszip');
      const zip = new JSZip();
      entries.forEach(([path, file]) => {
        zip.file(path, (file as { content: string }).content ?? '');
      });
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
      a.href = url;
      a.download = `arka-workspace-${stamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Gagal membuat ZIP workspace:', error);
      alert('Gagal membuat file ZIP. Coba lagi.');
    } finally {
      setIsZipping(false);
    }
  };

  const [isImportingZip, setIsImportingZip] = useState(false);

  // Paths inside an uploaded project .zip that are never useful to bring into
  // the virtual workspace — dependency/build/VCS folders bloat the (limited)
  // localStorage quota with thousands of files the AI will never need to read.
  const ZIP_IMPORT_IGNORED_PREFIXES = [
    'node_modules/', '.git/', 'dist/', 'build/', '.next/', '.nuxt/',
    'out/', 'coverage/', '.venv/', 'venv/', '__pycache__/', '.turbo/',
    '.cache/', '.idea/', '.vscode/',
  ];
  // Common binary/media extensions — reading these as text via JSZip would
  // just produce corrupted mojibake, so skip them instead of writing garbage.
  const ZIP_IMPORT_BINARY_EXT = new Set([
    'png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg', 'pdf',
    'woff', 'woff2', 'ttf', 'eot', 'otf', 'zip', 'gz', 'tar', 'rar', '7z',
    'mp3', 'mp4', 'mov', 'avi', 'webm', 'wav', 'ogg', 'flac',
    'exe', 'dll', 'so', 'dylib', 'class', 'jar', 'wasm',
  ]);
  const ZIP_IMPORT_MAX_FILE_BYTES = 1_000_000; // keep in sync with tools.ts' write_file cap
  const ZIP_IMPORT_MAX_TOTAL_BYTES = 8_000_000; // keep in sync with tools.ts' virtual workspace quota

  // Lets the user bring in an existing project from outside Arka: pick any
  // .zip, and every text file inside (skipping node_modules/.git/binaries)
  // gets written into this session's virtual workspace, exactly as if the
  // AI had written each file itself — so the AI can then read/edit it.
  const handleUploadZip = async (file: File) => {
    if (!sessionId) {
      alert('Mulai atau pilih sesi chat dulu sebelum upload project — setiap sesi punya workspace sendiri.');
      return;
    }
    if (!file.name.toLowerCase().endsWith('.zip')) {
      alert('File harus berformat .zip.');
      return;
    }

    setIsImportingZip(true);
    try {
      const { default: JSZip } = await import('jszip');
      const zip = await JSZip.loadAsync(file);

      const files = loadVirtualFiles(sessionId);
      let currentTotal = Object.values(files).reduce((sum: number, f: any) => sum + (f?.size || 0), 0) as number;

      let imported = 0;
      const skipped: string[] = [];

      const entries = Object.values(zip.files) as Array<{ name: string; dir: boolean; async: (type: 'string') => Promise<string> }>;
      for (const entry of entries) {
        if (entry.dir) continue;

        // Zip entries commonly nest everything under one top-level folder
        // (e.g. "my-project-main/src/App.tsx") — strip that so files land
        // at sensible paths like "src/App.tsx" in the workspace instead.
        const parts = entry.name.split('/');
        const path = parts.length > 1 ? parts.slice(1).join('/') : entry.name;
        if (!path) continue;

        const lowerPath = path.toLowerCase();
        const ext = lowerPath.split('.').pop() || '';

        if (ZIP_IMPORT_IGNORED_PREFIXES.some(prefix => (path + '/').startsWith(prefix) || lowerPath.startsWith(prefix))) {
          continue; // silently skip — these are expected/noisy, not worth reporting
        }
        if (ZIP_IMPORT_BINARY_EXT.has(ext)) {
          skipped.push(`${path} (format binary tidak didukung)`);
          continue;
        }

        let content: string;
        try {
          content = await entry.async('string');
        } catch {
          skipped.push(`${path} (gagal dibaca)`);
          continue;
        }

        if (content.length > ZIP_IMPORT_MAX_FILE_BYTES) {
          skipped.push(`${path} (>1MB, terlalu besar)`);
          continue;
        }
        const previousSize = files[path]?.size || 0;
        const newTotal = currentTotal - previousSize + content.length;
        if (newTotal > ZIP_IMPORT_MAX_TOTAL_BYTES) {
          skipped.push(`${path} (kuota workspace ~8MB penuh)`);
          continue;
        }

        files[path] = {
          content,
          modified: new Date().toISOString(),
          size: content.length,
        };
        currentTotal = newTotal;
        imported++;
      }

      if (imported === 0) {
        alert('Tidak ada file yang bisa di-import dari ZIP ini (mungkin isinya cuma binary/folder kosong, atau kuota workspace sudah penuh).');
        return;
      }

      saveVirtualFiles(sessionId, files);
      setVirtualFiles(files);

      let message = `✅ Berhasil import ${imported} file dari "${file.name}" ke workspace.`;
      if (skipped.length > 0) {
        const shown = skipped.slice(0, 10);
        message += `\n\n⚠️ ${skipped.length} file dilewati:\n${shown.join('\n')}`;
        if (skipped.length > shown.length) message += `\n...dan ${skipped.length - shown.length} lainnya.`;
      }
      alert(message);
    } catch (error) {
      console.error('Gagal import ZIP:', error);
      alert('Gagal membuka/extract file ZIP. Pastikan file tidak rusak dan benar-benar berformat .zip.');
    } finally {
      setIsImportingZip(false);
    }
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
        name: sessionId
          ? '(kosong - AI akan buat file di sini)'
          : '(pilih atau mulai sesi chat dulu)',
        type: 'file' as const,
        content: '',
        language: 'text',
        size: '0 KB',
        modified: '-',
      },
    ];
  }, [getVirtualFileNodes, sessionId]);

  const mergedWorkspace = getMergedWorkspace();
  const currentSession = state.sessions.find(s => s.id === sessionId);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <FolderOpen size={18} className="text-[#7c9cbf] shrink-0" />
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-[#334155] text-sm truncate">
              Workspace{currentSession ? ` — ${currentSession.title}` : ''}
            </h2>
            <p className="text-[10px] text-[#94a3b8] truncate">
              {activeTab
                ? `${activeTab.name} • ${activeTab.size} • ${activeTab.modified}`
                : currentSession
                ? 'Pilih file untuk melihat'
                : 'Belum ada sesi aktif — setiap sesi punya workspace sendiri'}
            </p>
          </div>
          <button
            onClick={handleDownloadWorkspaceZip}
            disabled={isZipping}
            title="Download semua file di workspace sebagai .zip"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#7c9cbf]/10 text-[#5a7fa0] text-xs font-medium hover:bg-[#7c9cbf]/20 disabled:opacity-50 transition-colors shrink-0"
          >
            {isZipping ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Download size={12} />
            )}
            <span className="hidden sm:inline">{isZipping ? 'Membuat ZIP...' : 'Download ZIP'}</span>
          </button>
          <label
            title="Upload project (.zip) dari luar Arka ke workspace ini"
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#7c9cbf]/10 text-[#5a7fa0] text-xs font-medium hover:bg-[#7c9cbf]/20 transition-colors shrink-0 cursor-pointer ${isImportingZip ? 'opacity-50 pointer-events-none' : ''}`}
          >
            {isImportingZip ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Upload size={12} />
            )}
            <span className="hidden sm:inline">{isImportingZip ? 'Meng-import...' : 'Upload ZIP'}</span>
            <input
              type="file"
              accept=".zip,application/zip,application/x-zip-compressed"
              className="hidden"
              disabled={isImportingZip}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUploadZip(file);
                e.target.value = ''; // allow re-selecting the same file later
              }}
            />
          </label>
          <button
            onClick={() => setShowFolderPicker(true)}
            title="Pilih Folder"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#7c9cbf]/10 text-[#5a7fa0] text-xs font-medium hover:bg-[#7c9cbf]/20 transition-colors shrink-0"
          >
            <Folder size={12} />
            <span className="hidden sm:inline">Pilih Folder</span>
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
                {activePreviewKind && (
                  <div className="flex items-center rounded-lg border border-[#b8c9db] bg-white p-0.5 gap-0.5">
                    <button
                      onClick={() => setViewMode('code')}
                      title="Lihat kode mentah"
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        viewMode === 'code' ? 'bg-[#7c9cbf] text-white' : 'text-[#64748b] hover:bg-[#f0f4f8]'
                      }`}
                    >
                      <Code2 size={12} />
                      Code
                    </button>
                    <button
                      onClick={() => setViewMode('preview')}
                      title="Lihat hasil render file ini"
                      className={`flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-medium transition-colors ${
                        viewMode === 'preview' ? 'bg-[#7c9cbf] text-white' : 'text-[#64748b] hover:bg-[#f0f4f8]'
                      }`}
                    >
                      <Eye size={12} />
                      Preview
                    </button>
                  </div>
                )}
                {activePreviewKind === 'html' && (
                  <button
                    onClick={handleOpenPreviewInNewTab}
                    className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b]"
                    title="Buka preview di tab baru"
                  >
                    <ExternalLink size={14} />
                  </button>
                )}
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
            {activeTab?.content && viewMode === 'preview' && activePreviewKind ? (
              <FilePreviewPane kind={activePreviewKind} content={activeTab.content} fileName={activeTab.name} />
            ) : activeTab?.content ? (
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
