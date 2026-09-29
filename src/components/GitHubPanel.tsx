import { useState, useEffect, useMemo } from 'react';
import { Github, GitBranch, GitCommit, GitPullRequest, Upload, RefreshCw, ExternalLink, Check, AlertCircle, Info, FileCode, FolderGit2, FolderUp, Trash2, X, Bot, Download } from 'lucide-react';
import { useApp } from '../store';
import { fetchGitHubRepos, pushToGitHub, getGitHubUser, getExcessiveScopes } from '../githubApi';
import { loadVirtualFiles as loadSessionVirtualFiles, virtualFilesKey } from '../virtualFs';

// A "patch manifest" is Arka's answer to a raw git bundle: instead of the
// browser having to parse git's binary pack format (which the browser can't
// push to GitHub anyway — see the CORS note on handleApplySync below), it's
// just an ordered list of commits, each with the files it adds/updates
// (string content) or deletes (content: null). Any Arka session can export
// one of these, and any Arka session can replay it as real commits via the
// same Git Data API pushToGitHub() already uses.
interface SyncCommit {
  message: string;
  files: { path: string; content: string | null }[];
}
interface SyncManifest {
  version: 1;
  commits: SyncCommit[];
}


export default function GitHubPanel() {
  const { state, dispatch } = useApp();
  // Every chat session has its own isolated virtual workspace (see
  // virtualFs.ts) — this panel pushes whatever the currently active session
  // has, matching what's shown in the Files tab.
  const sessionId = state.currentSessionId;
  const [token, setToken] = useState(state.githubToken);
  const [commitMessage, setCommitMessage] = useState('');
  const [branch, setBranch] = useState('main');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [pushMessage, setPushMessage] = useState('');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  // Manually uploaded via the folder picker below.
  const [uploadedFiles, setUploadedFiles] = useState<Map<string, string>>(new Map());
  // Live-synced from the AI's virtual workspace (same localStorage the
  // `write_file` tool and FileExplorer use) — so code the AI writes can be
  // pushed straight to GitHub without a manual export/re-upload round trip.
  const [virtualFiles, setVirtualFiles] = useState<Record<string, { content: string; modified: string; size: number }>>({});
  // Paths the user wants removed from the repo on the next push (there's no
  // "upload" equivalent for a deletion, so it's tracked separately).
  const [deletionPaths, setDeletionPaths] = useState<string[]>([]);
  const [deletionInput, setDeletionInput] = useState('');
  const [isLoadingRepos, setIsLoadingRepos] = useState(false);
  const [userName, setUserName] = useState<string>('');
  const [excessiveScopes, setExcessiveScopes] = useState<string[]>([]);
  const [syncManifest, setSyncManifest] = useState<SyncManifest | null>(null);
  const [syncFileName, setSyncFileName] = useState('');
  const [isApplyingSync, setIsApplyingSync] = useState(false);
  const [syncLog, setSyncLog] = useState<string[]>([]);
  // Commits checkpointed by the AI itself via the `stage_commit` tool,
  // waiting for the human to review and actually push them.
  const [stagedCommits, setStagedCommits] = useState<(SyncCommit & { id: string; createdAt: string })[]>([]);
  const [isPushingStaged, setIsPushingStaged] = useState(false);
  const [stagedLog, setStagedLog] = useState<string[]>([]);


  // Combined view used for selection/push — virtual (AI-written) files win
  // over an uploaded file at the same path, since they're the live source.
  const workspaceFiles = useMemo(() => {
    const merged = new Map<string, string>(uploadedFiles);
    Object.entries(virtualFiles).forEach(([path, file]) => merged.set(path, file.content));
    return merged;
  }, [uploadedFiles, virtualFiles]);

  const loadVirtualFiles = () => {
    setVirtualFiles(loadSessionVirtualFiles(sessionId));
  };

  const loadStagedCommits = () => {
    try {
      const staged = JSON.parse(localStorage.getItem('arka-staged-commits') || '[]');
      setStagedCommits(Array.isArray(staged) ? staged : []);
    } catch (error) {
      console.error('Failed to load staged commits:', error);
    }
  };

  useEffect(() => {
    loadVirtualFiles();
    loadStagedCommits();
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === virtualFilesKey(sessionId)) loadVirtualFiles();
      if (e.key === 'arka-staged-commits') loadStagedCommits();
    };
    window.addEventListener('storage', handleStorageChange);
    // Dispatched by the AI's write_file tool and by FileExplorer — ignore
    // updates meant for a different session than the one shown here.
    const handleVirtualFilesUpdated = (e: Event) => {
      const detailSessionId = (e as CustomEvent).detail?.sessionId;
      if (detailSessionId === undefined || detailSessionId === sessionId) {
        loadVirtualFiles();
      }
    };
    window.addEventListener('virtual-files-updated', handleVirtualFilesUpdated);
    // Dispatched by the AI's stage_commit tool.
    window.addEventListener('staged-commits-updated', loadStagedCommits);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('virtual-files-updated', handleVirtualFilesUpdated);
      window.removeEventListener('staged-commits-updated', loadStagedCommits);
    };
  }, [sessionId]);


  const handleConnect = async () => {
    if (!token.trim()) return;
    setIsLoadingRepos(true);
    
    try {
      // Verify token and get user info
      const user = await getGitHubUser(token);
      setUserName(user.name);

      // Least-privilege check: warn if the token (classic PATs only expose
      // this via the x-oauth-scopes header) grants more than Arka needs.
      // A broader token is a bigger blast radius if it ever leaks.
      setExcessiveScopes(getExcessiveScopes(user.scopes));

      // Fetch real repositories
      const repos = await fetchGitHubRepos(token);
      
      dispatch({ type: 'SET_GITHUB_TOKEN', payload: token });
      dispatch({ type: 'SET_GITHUB_CONNECTED', payload: true });
      dispatch({ type: 'SET_GITHUB_REPOS', payload: repos });
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Gagal terhubung ke GitHub. Periksa token Anda.');
    } finally {
      setIsLoadingRepos(false);
    }
  };

  const handlePush = async () => {
    if (!commitMessage.trim() || !selectedRepo) return;
    if (selectedFiles.length === 0 && deletionPaths.length === 0) return;
    
    setIsPushing(true);
    setPushStatus('idle');
    setPushMessage('');

    try {
      // Prepare files to add/update, plus any marked for deletion
      // (content: null tells pushToGitHub to remove that path from the tree).
      const filesToPush = [
        ...selectedFiles.map(path => ({
          path,
          content: workspaceFiles.get(path) ?? '',
        })),
        ...deletionPaths.map(path => ({ path, content: null })),
      ];

      // Push to GitHub as a single atomic commit (blob -> tree -> commit -> ref update)
      const result = await pushToGitHub(
        state.githubToken,
        selectedRepo,
        branch,
        filesToPush,
        commitMessage
      );

      if (result.success) {
        setPushStatus('success');
        setPushMessage(result.message);
        setCommitMessage('');
        setSelectedFiles([]);
        setDeletionPaths([]);
        setTimeout(() => setPushStatus('idle'), 5000);
      } else {
        setPushStatus('error');
        setPushMessage(result.message);
      }
    } catch (error) {
      setPushStatus('error');
      setPushMessage(error instanceof Error ? error.message : 'Unknown error');
    } finally {
      setIsPushing(false);
    }
  };

  const handleFolderUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const newWorkspaceFiles = new Map<string, string>();
    let rootFolder = '';

    // Detect root folder name from first file
    for (let i = 0; i < files.length; i++) {
      const path = files[i].webkitRelativePath || files[i].name;
      const parts = path.split('/');
      if (parts.length > 1) {
        rootFolder = parts[0];
        break;
      }
    }

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      let path = file.webkitRelativePath || file.name;
      
      // Strip root folder from path
      if (rootFolder && path.startsWith(rootFolder + '/')) {
        path = path.substring(rootFolder.length + 1);
      }
      
      // Skip binary files, node_modules, and .git
      if (path.includes('node_modules') || path.includes('.git') || path.startsWith('.')) continue;
      if (/\.(png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|pdf|zip|rar)$/i.test(path)) continue;
      
      try {
        const content = await file.text();
        newWorkspaceFiles.set(path, content);
      } catch (error) {
        console.error(`Failed to read ${path}:`, error);
      }
    }

    setUploadedFiles(newWorkspaceFiles);
    setSelectedFiles([]);
  };

  const handleRemoveDeletion = (path: string) => {
    setDeletionPaths(prev => prev.filter(p => p !== path));
  };

  const handleAddDeletion = () => {
    const path = deletionInput.trim().replace(/^\/+/, '');
    if (!path) return;
    if (!deletionPaths.includes(path)) {
      setDeletionPaths(prev => [...prev, path]);
    }
    setDeletionInput('');
  };

  const handleSyncFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-selecting the same file later
    if (!file) return;

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);

      if (!parsed || !Array.isArray(parsed.commits)) {
        alert('File patch tidak valid: field "commits" tidak ditemukan.');
        return;
      }
      for (const c of parsed.commits) {
        if (typeof c?.message !== 'string' || !Array.isArray(c?.files)) {
          alert('File patch tidak valid: setiap commit harus punya "message" (string) dan "files" (array).');
          return;
        }
      }

      setSyncManifest(parsed as SyncManifest);
      setSyncFileName(file.name);
      setSyncLog([]);
    } catch (err) {
      alert('Gagal membaca file patch: ' + (err instanceof Error ? err.message : 'format JSON tidak valid'));
    }
  };

  // NOTE on why this isn't a real `git push`: GitHub's git smart-HTTP
  // endpoints (git-receive-pack) don't send CORS headers, so a browser can't
  // speak the real git protocol to github.com without routing the request
  // (and the user's PAT) through a third-party CORS proxy — a security
  // regression we specifically want to avoid. Instead, each commit in the
  // manifest is replayed one at a time through the same GitHub Git Data API
  // (blob -> tree -> commit -> ref update) as the manual push button above,
  // which GitHub does serve with proper CORS headers.
  const handleApplySync = async () => {
    if (!syncManifest || !selectedRepo) return;
    setIsApplyingSync(true);
    setSyncLog([]);

    const total = syncManifest.commits.length;
    let successCount = 0;

    for (let i = 0; i < total; i++) {
      const commit = syncManifest.commits[i];
      const label = `(${i + 1}/${total}) ${commit.message}`;
      setSyncLog(prev => [...prev, `⏳ ${label}...`]);

      // Sequential (not parallel) on purpose: each call fetches the branch's
      // current HEAD fresh, so committing one at a time keeps them properly
      // chained as parent -> child, in the same order as the original session.
      const result = await pushToGitHub(state.githubToken, selectedRepo, branch, commit.files, commit.message);

      setSyncLog(prev => {
        const withoutLast = prev.slice(0, -1);
        return [...withoutLast, result.success ? `✅ ${label}` : `❌ ${label}: ${result.message}`];
      });

      if (!result.success) break; // stop so later commits don't build on a half-applied state
      successCount++;
    }

    setIsApplyingSync(false);
    if (successCount === total) {
      setSyncManifest(null);
      setSyncFileName('');
    }
  };

  const handlePushStaged = async () => {
    if (stagedCommits.length === 0 || !selectedRepo) return;
    setIsPushingStaged(true);
    setStagedLog([]);

    const total = stagedCommits.length;
    let pushedIds: string[] = [];

    for (let i = 0; i < total; i++) {
      const commit = stagedCommits[i];
      const label = `(${i + 1}/${total}) ${commit.message}`;
      setStagedLog(prev => [...prev, `⏳ ${label}...`]);

      const result = await pushToGitHub(state.githubToken, selectedRepo, branch, commit.files, commit.message);

      setStagedLog(prev => {
        const withoutLast = prev.slice(0, -1);
        return [...withoutLast, result.success ? `✅ ${label}` : `❌ ${label}: ${result.message}`];
      });

      if (!result.success) break; // stop so later commits don't build on a half-applied state
      pushedIds.push(commit.id);
    }

    // Remove only the commits that actually got pushed, in case of a
    // failure partway through — the rest stay staged for a retry.
    if (pushedIds.length > 0) {
      const remaining = JSON.parse(localStorage.getItem('arka-staged-commits') || '[]')
        .filter((c: any) => !pushedIds.includes(c.id));
      localStorage.setItem('arka-staged-commits', JSON.stringify(remaining));
      window.dispatchEvent(new CustomEvent('staged-commits-updated'));
    }

    setIsPushingStaged(false);
  };

  const handleDiscardStagedCommit = (id: string) => {
    const remaining = JSON.parse(localStorage.getItem('arka-staged-commits') || '[]')
      .filter((c: any) => c.id !== id);
    localStorage.setItem('arka-staged-commits', JSON.stringify(remaining));
    window.dispatchEvent(new CustomEvent('staged-commits-updated'));
  };

  const handleDiscardAllStaged = () => {
    localStorage.setItem('arka-staged-commits', JSON.stringify([]));
    window.dispatchEvent(new CustomEvent('staged-commits-updated'));
    setStagedLog([]);
  };

  // Lets a staged checkpoint be handed to a *different* Arka
  // session/browser (same idea as the "Import Patch" card above, just in
  // the opposite direction) without needing this session's GitHub token.
  const handleDownloadStaged = () => {
    const manifest: SyncManifest = {
      version: 1,
      commits: stagedCommits.map(({ message, files }) => ({ message, files })),
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `arka-patch-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter((f: string) => f !== filePath)
        : [...prev, filePath]
    );
  };

  const handleDisconnect = () => {
    dispatch({ type: 'SET_GITHUB_TOKEN', payload: '' });
    dispatch({ type: 'SET_GITHUB_CONNECTED', payload: false });
    dispatch({ type: 'SET_GITHUB_REPOS', payload: [] });
    setToken('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <Github size={18} className="text-[#334155]" />
        <div>
          <h2 className="font-semibold text-[#334155] text-sm">GitHub</h2>
          <p className="text-[10px] text-[#94a3b8]">
            {state.githubConnected ? 'Terhubung' : 'Belum terhubung'}
          </p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!state.githubConnected ? (
          /* Connect Form */
          <div className="space-y-4">
            {/* Workflow Visualization */}
            <div className="bg-gradient-to-br from-[#7c9cbf]/10 to-[#93b5d3]/10 rounded-xl p-4 border border-[#7c9cbf]/20">
              <h3 className="text-sm font-semibold text-[#334155] mb-3 flex items-center gap-2">
                <FolderGit2 size={16} className="text-[#7c9cbf]" />
                Cara Push ke GitHub
              </h3>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#7c9cbf] text-white text-xs font-bold flex items-center justify-center shrink-0">1</div>
                  <div>
                    <p className="text-xs font-medium text-[#334155]">Buat Personal Access Token</p>
                    <p className="text-[10px] text-[#64748b]">Token ini memberikan akses Arka ke repository GitHub Anda</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#7c9cbf] text-white text-xs font-bold flex items-center justify-center shrink-0">2</div>
                  <div>
                    <p className="text-xs font-medium text-[#334155]">Hubungkan Arka dengan GitHub</p>
                    <p className="text-[10px] text-[#64748b]">Paste token di form di bawah untuk menghubungkan</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#7c9cbf] text-white text-xs font-bold flex items-center justify-center shrink-0">3</div>
                  <div>
                    <p className="text-xs font-medium text-[#334155]">Pilih Repository</p>
                    <p className="text-[10px] text-[#64748b]">Pilih repo tujuan dari daftar repository Anda</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#7c9cbf] text-white text-xs font-bold flex items-center justify-center shrink-0">4</div>
                  <div>
                    <p className="text-xs font-medium text-[#334155]">Pilih Files & Commit</p>
                    <p className="text-[10px] text-[#64748b]">Pilih file yang ingin di-push dan tulis commit message</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="w-6 h-6 rounded-full bg-[#86b8a0] text-white text-xs font-bold flex items-center justify-center shrink-0">✓</div>
                  <div>
                    <p className="text-xs font-medium text-[#334155]">Push ke GitHub!</p>
                    <p className="text-[10px] text-[#64748b]">Changes akan langsung tersedia di repository Anda</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#b8c9db] p-5">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-[#334155] flex items-center justify-center">
                  <Github size={20} className="text-white" />
                </div>
                <div>
                  <h3 className="font-semibold text-[#334155] text-sm">Hubungkan GitHub</h3>
                  <p className="text-xs text-[#64748b]">Gunakan Personal Access Token</p>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-medium text-[#64748b] block mb-1">Personal Access Token</label>
                  <input
                    type="password"
                    value={token}
                    onChange={e => setToken(e.target.value)}
                    placeholder="ghp_xxxxxxxxxxxx"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                  />
                  <p className="text-[10px] text-[#94a3b8] mt-1">
                    Token membutuhkan scope: <code className="bg-[#f0f4f8] px-1 rounded">repo</code> dan <code className="bg-[#f0f4f8] px-1 rounded">workflow</code>
                  </p>
                </div>
                <button
                  onClick={handleConnect}
                  disabled={!token.trim() || isLoadingRepos}
                  className="w-full py-2.5 rounded-lg bg-[#334155] text-white font-medium text-sm hover:bg-[#1e293b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  {isLoadingRepos ? (
                    <>
                      <RefreshCw size={16} className="animate-spin" />
                      Menghubungkan...
                    </>
                  ) : (
                    <>
                      <Github size={16} />
                      Hubungkan
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="bg-[#f0f4f8] rounded-xl p-4">
              <h4 className="text-xs font-semibold text-[#64748b] mb-2 flex items-center gap-1">
                <Info size={12} />
                Cara membuat token:
              </h4>
              <ol className="text-xs text-[#64748b] space-y-1.5 list-decimal list-inside">
                <li>Buka <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="text-[#5a7fa0] hover:underline font-medium">github.com/settings/tokens</a></li>
                <li>Klik "Generate new token" → "Generate new token (classic)"</li>
                <li>Beri nama token (contoh: "Arka App")</li>
                <li>Pilih expiration (disarankan: 90 days)</li>
                <li>Centang scope: <code className="bg-white px-1 rounded">repo</code> dan <code className="bg-white px-1 rounded">workflow</code></li>
                <li>Klik "Generate token" di bawah</li>
                <li><strong>Copy token</strong> dan paste di form di atas</li>
              </ol>
              <div className="mt-3 p-2 bg-[#d4a574]/10 border border-[#d4a574]/20 rounded-lg">
                <p className="text-[10px] text-[#d4a574]">
                  ⚠️ <strong>Penting:</strong> Token hanya ditampilkan sekali! Simpan di tempat aman.
                </p>
              </div>
            </div>
          </div>
        ) : (
          /* Connected State */
          <div className="space-y-4">
            {/* Connection Status */}
            <div className="bg-white rounded-xl border border-[#b8c9db] p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-[#86b8a0] animate-pulse" />
                <div>
                  <span className="text-sm font-medium text-[#334155]">Terhubung ke GitHub</span>
                  {userName && <p className="text-[10px] text-[#94a3b8]">Login sebagai {userName}</p>}
                </div>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Putuskan
              </button>
            </div>

            {excessiveScopes.length > 0 && (
              <div className="bg-[#d4a574]/10 border border-[#d4a574]/40 rounded-xl p-3 flex items-start gap-2">
                <AlertCircle size={14} className="text-[#8a5a1f] shrink-0 mt-0.5" />
                <p className="text-[11px] text-[#8a5a1f] leading-relaxed">
                  Token ini punya scope lebih luas dari yang Arka butuhkan (<span className="font-mono">{excessiveScopes.join(', ')}</span>).
                  Arka hanya perlu scope <span className="font-mono">repo</span>. Pertimbangkan membuat token baru dengan scope minimal di{' '}
                  <a href="https://github.com/settings/tokens" target="_blank" rel="noopener noreferrer" className="underline font-medium">
                    github.com/settings/tokens
                  </a>{' '}
                  supaya risikonya lebih kecil kalau token ini bocor.
                </p>
              </div>
            )}

            {/* Workspace Upload */}
            <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-xs font-semibold text-[#64748b] uppercase flex items-center gap-1">
                  <FolderUp size={12} />
                  Upload Workspace
                </h4>
                {workspaceFiles.size > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.setAttribute('webkitdirectory', 'true');
                        input.setAttribute('directory', 'true');
                        input.onchange = handleFolderUpload as any;
                        input.click();
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#5a7fa0] hover:bg-[#7c9cbf]/10 transition-colors"
                    >
                      <RefreshCw size={10} />
                      Refresh
                    </button>
                    {uploadedFiles.size > 0 && (
                      <button
                        onClick={() => {
                          if (confirm('Hapus semua file yang diupload manual? (File dari AI/Virtual Workspace tidak akan terhapus)')) {
                            setSelectedFiles(prev => prev.filter(p => !uploadedFiles.has(p)));
                            setUploadedFiles(new Map());
                          }
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium text-[#c97878] hover:bg-[#c97878]/10 transition-colors"
                      >
                        <Trash2 size={10} />
                        Clear Upload
                      </button>
                    )}
                  </div>
                )}
              </div>
              <p className="text-[10px] text-[#94a3b8] -mt-2 mb-3">
                File yang ditulis AI (via write_file) di sesi chat yang lagi aktif otomatis muncul di sini juga — tidak perlu upload manual. Ganti sesi di sidebar untuk push workspace sesi lain.
              </p>
              
              {workspaceFiles.size === 0 ? (
                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-dashed border-[#b8c9db] rounded-lg cursor-pointer hover:border-[#7c9cbf] hover:bg-[#f8fafc] transition-all">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FolderUp size={24} className="text-[#7c9cbf] mb-2" />
                    <p className="text-xs text-[#64748b] mb-1">
                      <span className="font-semibold text-[#5a7fa0]">Klik untuk upload</span> atau drag & drop
                    </p>
                    <p className="text-[10px] text-[#94a3b8]">Pilih folder proyek Anda</p>
                  </div>
                  <input
                    type="file"
                    className="hidden"
                    onChange={handleFolderUpload}
                    {...({ webkitdirectory: 'true', directory: 'true' } as any)}
                  />
                </label>
              ) : (
                <div className="border border-[#b8c9db] rounded-lg max-h-64 overflow-y-auto">
                  <div className="sticky top-0 bg-[#f8fafc] border-b border-[#b8c9db] px-3 py-2 flex items-center justify-between">
                    <span className="text-[10px] font-semibold text-[#64748b]">
                      {workspaceFiles.size} file ter-load
                    </span>
                    <button
                      onClick={() => {
                        if (selectedFiles.length === workspaceFiles.size) {
                          setSelectedFiles([]);
                        } else {
                          setSelectedFiles(Array.from(workspaceFiles.keys()));
                        }
                      }}
                      className="text-[10px] text-[#5a7fa0] font-medium hover:underline"
                    >
                      {selectedFiles.length === workspaceFiles.size ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="divide-y divide-[#e8eef4]">
                    {Array.from(workspaceFiles.keys()).map((path) => {
                      const isVirtual = Object.prototype.hasOwnProperty.call(virtualFiles, path);
                      return (
                        <div key={path} className="flex items-center gap-2 px-3 py-2 hover:bg-[#f8fafc]">
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(path)}
                            onChange={() => toggleFileSelection(path)}
                            className="rounded border-[#b8c9db] text-[#7c9cbf] focus:ring-[#7c9cbf]"
                          />
                          {isVirtual ? (
                            <Bot size={12} className="text-[#9c7cbf] shrink-0" />
                          ) : (
                            <FileCode size={12} className="text-[#7c9cbf] shrink-0" />
                          )}
                          <span className="text-xs text-[#334155] font-mono truncate flex-1">{path}</span>
                          {isVirtual && (
                            <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#9c7cbf]/10 text-[#9c7cbf] font-medium shrink-0">
                              AI
                            </span>
                          )}
                          {!isVirtual && (
                            <button
                              onClick={() => {
                                const newFiles = new Map(uploadedFiles);
                                newFiles.delete(path);
                                setUploadedFiles(newFiles);
                                setSelectedFiles(prev => prev.filter(f => f !== path));
                              }}
                              className="p-1 rounded hover:bg-[#c97878]/10 text-[#c97878] transition-colors"
                              title="Hapus dari daftar upload"
                            >
                              <X size={12} />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Delete files from repo */}
            <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
              <h4 className="text-xs font-semibold text-[#64748b] uppercase flex items-center gap-1 mb-2">
                <Trash2 size={12} />
                Hapus File dari Repo
              </h4>
              <p className="text-[10px] text-[#94a3b8] mb-3">
                Tulis path file yang ada di repo GitHub (misal <span className="font-mono">arka-updates.bundle</span>) untuk dihapus di push berikutnya — tidak perlu ke website GitHub lagi.
              </p>
              <div className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={deletionInput}
                  onChange={e => setDeletionInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddDeletion(); } }}
                  placeholder="path/ke/file.ext"
                  className="flex-1 px-3 py-2 rounded-lg border border-[#b8c9db] text-xs font-mono focus:border-[#7c9cbf] focus:outline-none"
                />
                <button
                  onClick={handleAddDeletion}
                  disabled={!deletionInput.trim()}
                  className="px-3 py-2 rounded-lg bg-[#c97878]/10 text-[#c97878] text-xs font-medium hover:bg-[#c97878]/20 disabled:opacity-40 transition-colors"
                >
                  Tandai Hapus
                </button>
              </div>
              {deletionPaths.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {deletionPaths.map(path => (
                    <span key={path} className="flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded bg-[#c97878]/10 text-[#c97878]">
                      {path}
                      <button onClick={() => handleRemoveDeletion(path)} className="hover:text-[#a85f5f]">
                        <X size={10} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Commits checkpointed by the AI itself via the stage_commit tool */}
            {stagedCommits.length > 0 && (
              <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase flex items-center gap-1">
                    <Bot size={12} />
                    Staged AI Commits
                  </h4>
                  <span className="text-[10px] bg-[#5a7fa0]/10 text-[#5a7fa0] px-2 py-0.5 rounded-full font-medium">
                    {stagedCommits.length}
                  </span>
                </div>
                <p className="text-[10px] text-[#94a3b8] mb-3">
                  AI di chat sudah bikin checkpoint dari progres kerjanya. Review dulu, lalu push semuanya ke repo yang dipilih di bawah — urut sesuai waktu dibuat.
                </p>

                <ul className="space-y-1.5 mb-3 max-h-40 overflow-y-auto">
                  {stagedCommits.map((c) => (
                    <li key={c.id} className="flex items-start justify-between gap-2 bg-[#f8fafc] rounded-lg px-2.5 py-1.5">
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-[#334155] truncate">{c.message}</p>
                        <p className="text-[10px] text-[#94a3b8]">{c.files.length} file · {new Date(c.createdAt).toLocaleString('id-ID')}</p>
                      </div>
                      <button
                        onClick={() => handleDiscardStagedCommit(c.id)}
                        disabled={isPushingStaged}
                        className="p-1 rounded hover:bg-[#c97878]/10 text-[#c97878] shrink-0"
                        title="Buang checkpoint ini (tidak di-push)"
                      >
                        <X size={12} />
                      </button>
                    </li>
                  ))}
                </ul>

                <div className="flex gap-2">
                  <button
                    onClick={handlePushStaged}
                    disabled={!selectedRepo || isPushingStaged}
                    className="flex-1 py-2 rounded-lg bg-[#86b8a0] text-white text-xs font-medium hover:bg-[#6fa085] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isPushingStaged ? 'Mendorong...' : `Push ${stagedCommits.length} Commit ke GitHub`}
                  </button>
                  <button
                    onClick={handleDownloadStaged}
                    disabled={isPushingStaged}
                    className="px-3 py-2 rounded-lg border border-[#b8c9db] text-[#5a7fa0] text-xs font-medium hover:bg-[#f8fafc] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Download sebagai file .json untuk dipakai di sesi Arka lain"
                  >
                    <Download size={12} />
                  </button>
                  <button
                    onClick={handleDiscardAllStaged}
                    disabled={isPushingStaged}
                    className="px-3 py-2 rounded-lg border border-[#c97878]/40 text-[#c97878] text-xs font-medium hover:bg-[#c97878]/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    title="Buang semua checkpoint"
                  >
                    Buang Semua
                  </button>
                </div>
                {!selectedRepo && (
                  <p className="text-[10px] text-[#c97878] mt-2">Pilih repo dulu di bagian Repositories di bawah.</p>
                )}
                {stagedLog.length > 0 && (
                  <div className="bg-[#f8fafc] rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto mt-2">
                    {stagedLog.map((line, i) => (
                      <p key={i} className="text-[10px] font-mono text-[#334155]">{line}</p>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Import & apply a patch manifest from another session/sandbox */}
            <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
              <h4 className="text-xs font-semibold text-[#64748b] uppercase flex items-center gap-1 mb-2">
                <Upload size={12} />
                Import Patch (.json)
              </h4>
              <p className="text-[10px] text-[#94a3b8] mb-3">
                Kalau ada perubahan dari sesi/sandbox Arka lain (mis. file yang saya kirim di chat), upload file patch-nya di sini — akan langsung dibuat jadi commit asli ke repo yang dipilih di bawah, tanpa perlu terminal.
              </p>

              {!syncManifest ? (
                <label className="flex flex-col items-center justify-center w-full h-20 border-2 border-dashed border-[#b8c9db] rounded-lg cursor-pointer hover:border-[#7c9cbf] hover:bg-[#f8fafc] transition-all">
                  <p className="text-xs text-[#64748b]">
                    <span className="font-semibold text-[#5a7fa0]">Klik untuk pilih file</span> patch (.json)
                  </p>
                  <input type="file" accept=".json,application/json" className="hidden" onChange={handleSyncFileSelect} />
                </label>
              ) : (
                <div className="border border-[#b8c9db] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono text-[#334155] truncate">{syncFileName}</span>
                    <button
                      onClick={() => { setSyncManifest(null); setSyncFileName(''); setSyncLog([]); }}
                      className="p-1 rounded hover:bg-[#c97878]/10 text-[#c97878]"
                      title="Batal"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <p className="text-[10px] text-[#64748b]">
                    {syncManifest.commits.length} commit siap diterapkan ke <span className="font-mono">{selectedRepo || '(pilih repo dulu di bawah)'}</span> @ <span className="font-mono">{branch}</span>
                  </p>
                  <ul className="text-[10px] text-[#334155] space-y-0.5 max-h-24 overflow-y-auto">
                    {syncManifest.commits.map((c, i) => (
                      <li key={i} className="truncate">• {c.message} <span className="text-[#94a3b8]">({c.files.length} file)</span></li>
                    ))}
                  </ul>
                  <button
                    onClick={handleApplySync}
                    disabled={!selectedRepo || isApplyingSync}
                    className="w-full py-2 rounded-lg bg-[#86b8a0] text-white text-xs font-medium hover:bg-[#6fa085] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    {isApplyingSync ? 'Menerapkan...' : `Terapkan ${syncManifest.commits.length} Commit`}
                  </button>
                  {syncLog.length > 0 && (
                    <div className="bg-[#f8fafc] rounded-lg p-2 space-y-1 max-h-32 overflow-y-auto">
                      {syncLog.map((line, i) => (
                        <p key={i} className="text-[10px] font-mono text-[#334155]">{line}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Repository List */}
            <div className="bg-white rounded-xl border border-[#b8c9db] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#b8c9db] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase">
                  Repositories {isLoadingRepos && '(Loading...)'}
                </span>
                <button 
                  onClick={handleConnect}
                  disabled={isLoadingRepos}
                  className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b] disabled:opacity-50"
                >
                  <RefreshCw size={14} className={isLoadingRepos ? 'animate-spin' : ''} />
                </button>
              </div>
              <div className="divide-y divide-[#e8eef4]">
                {state.githubRepos.map(repo => (
                  <div
                    key={repo.id}
                    onClick={() => setSelectedRepo(repo.fullName)}
                    className={`px-4 py-3 flex items-center gap-3 cursor-pointer transition-colors ${
                      selectedRepo === repo.fullName ? 'bg-[#7c9cbf]/10' : 'hover:bg-[#f0f4f8]'
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-[#334155] truncate">{repo.fullName}</span>
                        {repo.private && (
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-[#d4a574]/10 text-[#d4a574] font-medium">
                            Private
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-[#94a3b8] truncate">{repo.description}</p>
                    </div>
                    <ExternalLink size={14} className="text-[#94a3b8] shrink-0" />
                  </div>
                ))}
              </div>
            </div>

            {/* Push Panel */}
            {selectedRepo && (
              <div className="bg-white rounded-xl border border-[#b8c9db] p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-[#64748b] uppercase flex items-center gap-1">
                    <Upload size={12} /> Push ke {selectedRepo}
                  </h4>
                  <button
                    onClick={() => setShowGuide(!showGuide)}
                    className="flex items-center gap-1 text-[10px] text-[#5a7fa0] font-medium hover:underline"
                  >
                    <Info size={10} />
                    Panduan
                  </button>
                </div>

                {/* Guide Section */}
                {showGuide && (
                  <div className="bg-[#f0f4f8] rounded-lg p-3 space-y-2">
                    <h5 className="text-xs font-semibold text-[#334155]">📋 Langkah-langkah Push:</h5>
                    <ol className="text-xs text-[#64748b] space-y-1 list-decimal list-inside">
                      <li>Pilih branch tujuan (default: main)</li>
                      <li>Pilih file yang ingin di-commit</li>
                      <li>Tulis commit message yang deskriptif</li>
                      <li>Klik "Push Changes"</li>
                    </ol>
                    <div className="pt-2 border-t border-[#b8c9db]">
                      <p className="text-[10px] text-[#94a3b8]">
                        💡 <strong>Tips:</strong> Gunakan format commit message: <code className="bg-white px-1 rounded">feat:</code>, <code className="bg-white px-1 rounded">fix:</code>, <code className="bg-white px-1 rounded">docs:</code>, <code className="bg-white px-1 rounded">style:</code>, <code className="bg-white px-1 rounded">refactor:</code>
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-[#64748b] block mb-1">Branch</label>
                  <div className="flex items-center gap-2">
                    <GitBranch size={14} className="text-[#64748b]" />
                    <input
                      type="text"
                      value={branch}
                      onChange={e => setBranch(e.target.value)}
                      className="flex-1 px-3 py-2 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                    />
                  </div>
                </div>

                {/* File Info */}
                {(workspaceFiles.size > 0 || deletionPaths.length > 0) && (
                  <div className="bg-[#86b8a0]/10 border border-[#86b8a0]/20 rounded-lg p-3">
                    <p className="text-xs text-[#5a8a6e] font-medium">
                      ✓ {selectedFiles.length} dari {workspaceFiles.size} file dipilih untuk ditambah/diupdate
                      {deletionPaths.length > 0 && `, ${deletionPaths.length} file ditandai hapus`}
                    </p>
                    <p className="text-[10px] text-[#64748b] mt-1">
                      Pilih file di bagian "Upload Workspace" atau tandai file untuk dihapus di atas
                    </p>
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-[#64748b] block mb-1">Commit Message</label>
                  <textarea
                    value={commitMessage}
                    onChange={e => setCommitMessage(e.target.value)}
                    placeholder="feat: add new feature..."
                    rows={2}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none resize-none"
                  />
                  <div className="flex gap-2 mt-2">
                    {['feat:', 'fix:', 'docs:', 'style:', 'refactor:'].map(prefix => (
                      <button
                        key={prefix}
                        onClick={() => setCommitMessage(prev => prev ? `${prefix} ${prev}` : prefix + ' ')}
                        className="text-[10px] px-2 py-1 rounded bg-[#f0f4f8] text-[#64748b] hover:bg-[#e8eef4] transition-colors"
                      >
                        {prefix}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  onClick={handlePush}
                  disabled={!commitMessage.trim() || (selectedFiles.length === 0 && deletionPaths.length === 0) || isPushing}
                  className="w-full py-2.5 rounded-lg bg-[#7c9cbf] text-white font-medium text-sm hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {isPushing ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      Push {selectedFiles.length} File{selectedFiles.length !== 1 ? 's' : ''}
                    </>
                  )}
                </button>

                {pushStatus === 'success' && (
                  <div className="flex items-center gap-2 text-[#86b8a0] text-xs font-medium bg-[#86b8a0]/10 p-2 rounded-lg">
                    <Check size={14} />
                    <span>{pushMessage || `Berhasil di-push ${selectedFiles.length} file ke branch ${branch}!`}</span>
                  </div>
                )}
                {pushStatus === 'error' && (
                  <div className="flex items-center gap-2 text-[#c97878] text-xs font-medium bg-[#c97878]/10 p-2 rounded-lg">
                    <AlertCircle size={14} />
                    <span>{pushMessage || 'Gagal push. Periksa koneksi dan token.'}</span>
                  </div>
                )}
              </div>
            )}

            {/* Quick Stats */}
            <div className="grid grid-cols-3 gap-2">
              <div className="bg-white rounded-xl border border-[#b8c9db] p-3 text-center">
                <GitBranch size={16} className="text-[#7c9cbf] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#334155]">12</p>
                <p className="text-[10px] text-[#94a3b8]">Branches</p>
              </div>
              <div className="bg-white rounded-xl border border-[#b8c9db] p-3 text-center">
                <GitCommit size={16} className="text-[#7c9cbf] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#334155]">156</p>
                <p className="text-[10px] text-[#94a3b8]">Commits</p>
              </div>
              <div className="bg-white rounded-xl border border-[#b8c9db] p-3 text-center">
                <GitPullRequest size={16} className="text-[#7c9cbf] mx-auto mb-1" />
                <p className="text-lg font-bold text-[#334155]">3</p>
                <p className="text-[10px] text-[#94a3b8]">Open PRs</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
