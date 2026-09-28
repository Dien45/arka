import { useState } from 'react';
import { Github, GitBranch, GitCommit, GitPullRequest, Upload, RefreshCw, ExternalLink, Check, AlertCircle, Info, FileCode, FolderGit2 } from 'lucide-react';
import { useApp } from '../store';

export default function GitHubPanel() {
  const { state, dispatch } = useApp();
  const [token, setToken] = useState(state.githubToken);
  const [commitMessage, setCommitMessage] = useState('');
  const [branch, setBranch] = useState('main');
  const [isPushing, setIsPushing] = useState(false);
  const [pushStatus, setPushStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [showGuide, setShowGuide] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
  
  // Mock file changes
  const fileChanges = [
    { path: 'src/components/Chat.tsx', status: 'modified' },
    { path: 'src/components/FileExplorer.tsx', status: 'modified' },
    { path: 'src/components/Settings.tsx', status: 'modified' },
    { path: 'src/modelFetcher.ts', status: 'added' },
    { path: 'README.md', status: 'modified' },
  ];

  const handleConnect = () => {
    if (!token.trim()) return;
    dispatch({ type: 'SET_GITHUB_TOKEN', payload: token });
    dispatch({ type: 'SET_GITHUB_CONNECTED', payload: true });
    // Simulate repos
    dispatch({
      type: 'SET_GITHUB_REPOS',
      payload: [
        { id: 1, name: 'arka-app', fullName: 'user/arka-app', description: 'Arka coding agent application', private: false, defaultBranch: 'main', updatedAt: '2024-01-15' },
        { id: 2, name: 'my-api', fullName: 'user/my-api', description: 'Backend API server', private: true, defaultBranch: 'main', updatedAt: '2024-01-14' },
        { id: 3, name: 'portfolio', fullName: 'user/portfolio', description: 'Personal portfolio website', private: false, defaultBranch: 'main', updatedAt: '2024-01-10' },
        { id: 4, name: 'dotfiles', fullName: 'user/dotfiles', description: 'System configuration files', private: false, defaultBranch: 'master', updatedAt: '2024-01-08' },
      ],
    });
  };

  const handlePush = () => {
    if (!commitMessage.trim() || selectedFiles.length === 0) return;
    setIsPushing(true);
    setPushStatus('idle');
    setTimeout(() => {
      setIsPushing(false);
      setPushStatus('success');
      setCommitMessage('');
      setSelectedFiles([]);
      setTimeout(() => setPushStatus('idle'), 3000);
    }, 2000);
  };

  const toggleFileSelection = (filePath: string) => {
    setSelectedFiles(prev => 
      prev.includes(filePath) 
        ? prev.filter(f => f !== filePath)
        : [...prev, filePath]
    );
  };

  const selectAllFiles = () => {
    if (selectedFiles.length === fileChanges.length) {
      setSelectedFiles([]);
    } else {
      setSelectedFiles(fileChanges.map(f => f.path));
    }
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
                  disabled={!token.trim()}
                  className="w-full py-2.5 rounded-lg bg-[#334155] text-white font-medium text-sm hover:bg-[#1e293b] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  <Github size={16} />
                  Hubungkan
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
                <span className="text-sm font-medium text-[#334155]">Terhubung ke GitHub</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-xs text-red-500 hover:text-red-600 font-medium"
              >
                Putuskan
              </button>
            </div>

            {/* Repository List */}
            <div className="bg-white rounded-xl border border-[#b8c9db] overflow-hidden">
              <div className="px-4 py-3 border-b border-[#b8c9db] flex items-center justify-between">
                <span className="text-xs font-semibold text-[#64748b] uppercase">Repositories</span>
                <button className="p-1 rounded hover:bg-[#e8eef4] text-[#64748b]">
                  <RefreshCw size={14} />
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

                {/* File Selection */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium text-[#64748b]">
                      Files ({selectedFiles.length}/{fileChanges.length})
                    </label>
                    <button
                      onClick={selectAllFiles}
                      className="text-[10px] text-[#5a7fa0] font-medium hover:underline"
                    >
                      {selectedFiles.length === fileChanges.length ? 'Batal Pilih Semua' : 'Pilih Semua'}
                    </button>
                  </div>
                  <div className="border border-[#b8c9db] rounded-lg max-h-40 overflow-y-auto">
                    {fileChanges.map((file, index) => (
                      <label
                        key={index}
                        className={`flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-[#f8fafc] ${
                          index !== fileChanges.length - 1 ? 'border-b border-[#e8eef4]' : ''
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedFiles.includes(file.path)}
                          onChange={() => toggleFileSelection(file.path)}
                          className="rounded border-[#b8c9db] text-[#7c9cbf] focus:ring-[#7c9cbf]"
                        />
                        <FileCode size={12} className="text-[#7c9cbf] shrink-0" />
                        <span className="text-xs text-[#334155] font-mono truncate flex-1">{file.path}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
                          file.status === 'modified' 
                            ? 'bg-[#d4a574]/10 text-[#d4a574]' 
                            : 'bg-[#86b8a0]/10 text-[#5a8a6e]'
                        }`}>
                          {file.status}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>

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
                  disabled={!commitMessage.trim() || selectedFiles.length === 0 || isPushing}
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
                    <span>Berhasil di-push {selectedFiles.length} file ke branch {branch}!</span>
                  </div>
                )}
                {pushStatus === 'error' && (
                  <div className="flex items-center gap-2 text-[#c97878] text-xs font-medium bg-[#c97878]/10 p-2 rounded-lg">
                    <AlertCircle size={14} />
                    <span>Gagal push. Periksa koneksi dan token.</span>
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
