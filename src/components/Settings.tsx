import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Globe, Check, Eye, EyeOff, Save, RefreshCw, Sparkles, AlertCircle, Lock, ShieldCheck, Unlock as UnlockIcon, LockKeyhole, Brain, Trash2, X } from 'lucide-react';
import { useApp, useVault } from '../store';
import { Provider } from '../types';
import { fetchModelsFromProvider, ModelInfo } from '../modelFetcher';
import { useTranslation } from '../LanguageContext';
import { memoryManager, MemoryEntry } from '../memorySystem';

function SecuritySection() {
  const { vaultConfigured, enableEncryption, disableEncryption, changePassphrase, lock } = useVault();
  const [mode, setMode] = useState<'idle' | 'enable' | 'disable' | 'change'>('idle');
  const [pass1, setPass1] = useState('');
  const [pass2, setPass2] = useState('');
  const [oldPass, setOldPass] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState('');

  const reset = () => {
    setMode('idle');
    setPass1('');
    setPass2('');
    setOldPass('');
    setError('');
  };

  const handleEnable = async () => {
    setError('');
    if (pass1.length < 8) {
      setError('Passphrase minimal 8 karakter.');
      return;
    }
    if (pass1 !== pass2) {
      setError('Konfirmasi passphrase tidak cocok.');
      return;
    }
    setBusy(true);
    try {
      await enableEncryption(pass1);
      setSuccess('Enkripsi diaktifkan. API key & token GitHub sekarang tersimpan terenkripsi.');
      reset();
    } catch (e) {
      setError('Gagal mengaktifkan enkripsi.');
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    setError('');
    setBusy(true);
    const ok = await disableEncryption(oldPass);
    setBusy(false);
    if (!ok) {
      setError('Passphrase salah.');
      return;
    }
    setSuccess('Enkripsi dimatikan. Data kembali tersimpan sebagai plaintext di perangkat ini.');
    reset();
  };

  const handleChange = async () => {
    setError('');
    if (pass1.length < 8) {
      setError('Passphrase baru minimal 8 karakter.');
      return;
    }
    if (pass1 !== pass2) {
      setError('Konfirmasi passphrase baru tidak cocok.');
      return;
    }
    setBusy(true);
    const ok = await changePassphrase(oldPass, pass1);
    setBusy(false);
    if (!ok) {
      setError('Passphrase lama salah.');
      return;
    }
    setSuccess('Passphrase berhasil diganti.');
    reset();
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
        <Lock size={12} />
        Keamanan Data Lokal
      </h3>
      <div className="bg-white rounded-xl border border-[#b8c9db] p-4 space-y-3">
        <div className="flex items-start gap-2">
          {vaultConfigured ? (
            <ShieldCheck size={16} className="text-[#5a8a6e] shrink-0 mt-0.5" />
          ) : (
            <AlertCircle size={16} className="text-[#d4a574] shrink-0 mt-0.5" />
          )}
          <div>
            <p className="text-sm font-medium text-[#334155]">
              {vaultConfigured ? 'Terenkripsi' : 'Tidak terenkripsi (plaintext)'}
            </p>
            <p className="text-xs text-[#64748b] mt-0.5">
              API key provider AI dan token GitHub disimpan di browser ini ({vaultConfigured ? 'dienkripsi dengan AES-256 menggunakan passphrase kamu' : 'sebagai teks biasa'}).
              {!vaultConfigured && ' Aktifkan enkripsi supaya data ini tidak bisa dibaca langsung kalau perangkat ini diakses orang lain.'}
            </p>
            <p className="text-[10px] text-[#94a3b8] mt-1">
              Catatan: enkripsi melindungi data saat tersimpan (at rest). Selama sesi terbuka, key tetap harus ada di memori browser untuk memanggil API — ini adalah batas inheren aplikasi client-side tanpa server.
            </p>
          </div>
        </div>

        {success && <p className="text-xs text-[#5a8a6e] bg-[#86b8a0]/10 rounded-lg px-3 py-2">{success}</p>}
        {error && <p className="text-xs text-[#c97878] bg-[#c97878]/10 rounded-lg px-3 py-2">{error}</p>}

        {mode === 'idle' && (
          <div className="flex flex-wrap gap-2">
            {!vaultConfigured ? (
              <button
                onClick={() => { setMode('enable'); setSuccess(''); }}
                className="px-3 py-2 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] transition-colors flex items-center gap-1.5"
              >
                <Lock size={12} /> Aktifkan Enkripsi
              </button>
            ) : (
              <>
                <button
                  onClick={() => { setMode('change'); setSuccess(''); }}
                  className="px-3 py-2 rounded-lg border border-[#b8c9db] text-[#64748b] text-xs font-medium hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
                >
                  <Key size={12} /> Ganti Passphrase
                </button>
                <button
                  onClick={() => { setMode('disable'); setSuccess(''); }}
                  className="px-3 py-2 rounded-lg border border-[#c97878]/40 text-[#c97878] text-xs font-medium hover:bg-[#c97878]/10 transition-colors flex items-center gap-1.5"
                >
                  <UnlockIcon size={12} /> Matikan Enkripsi
                </button>
                <button
                  onClick={lock}
                  className="px-3 py-2 rounded-lg border border-[#b8c9db] text-[#64748b] text-xs font-medium hover:bg-[#f8fafc] transition-colors flex items-center gap-1.5"
                >
                  <LockKeyhole size={12} /> Kunci Sekarang
                </button>
              </>
            )}
          </div>
        )}

        {mode === 'enable' && (
          <div className="space-y-2 pt-1 border-t border-[#e8eef4]">
            <input
              type="password"
              value={pass1}
              onChange={e => setPass1(e.target.value)}
              placeholder="Passphrase baru (min. 8 karakter)"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <input
              type="password"
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              placeholder="Ulangi passphrase"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 py-2 rounded-lg border border-[#b8c9db] text-xs text-[#64748b]">Batal</button>
              <button onClick={handleEnable} disabled={busy} className="flex-1 py-2 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium disabled:opacity-40">
                {busy ? 'Memproses...' : 'Aktifkan'}
              </button>
            </div>
          </div>
        )}

        {mode === 'disable' && (
          <div className="space-y-2 pt-1 border-t border-[#e8eef4]">
            <input
              type="password"
              value={oldPass}
              onChange={e => setOldPass(e.target.value)}
              placeholder="Masukkan passphrase saat ini"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 py-2 rounded-lg border border-[#b8c9db] text-xs text-[#64748b]">Batal</button>
              <button onClick={handleDisable} disabled={busy} className="flex-1 py-2 rounded-lg bg-[#c97878] text-white text-xs font-medium disabled:opacity-40">
                {busy ? 'Memproses...' : 'Matikan Enkripsi'}
              </button>
            </div>
          </div>
        )}

        {mode === 'change' && (
          <div className="space-y-2 pt-1 border-t border-[#e8eef4]">
            <input
              type="password"
              value={oldPass}
              onChange={e => setOldPass(e.target.value)}
              placeholder="Passphrase saat ini"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <input
              type="password"
              value={pass1}
              onChange={e => setPass1(e.target.value)}
              placeholder="Passphrase baru (min. 8 karakter)"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <input
              type="password"
              value={pass2}
              onChange={e => setPass2(e.target.value)}
              placeholder="Ulangi passphrase baru"
              className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
            />
            <div className="flex gap-2">
              <button onClick={reset} className="flex-1 py-2 rounded-lg border border-[#b8c9db] text-xs text-[#64748b]">Batal</button>
              <button onClick={handleChange} disabled={busy} className="flex-1 py-2 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium disabled:opacity-40">
                {busy ? 'Memproses...' : 'Ganti'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// Lets the user actually see and manage what the AI's `memory` tool has
// written to persistent storage (arka-memory). Previously there was no UI
// for this at all: the model could silently add/replace/remove memory
// entries with zero visibility or a way for the user to intervene.
function MemorySection() {
  const [memoryEntries, setMemoryEntries] = useState<MemoryEntry[]>([]);
  const [userEntries, setUserEntries] = useState<MemoryEntry[]>([]);

  const refresh = () => {
    const all = memoryManager.getAll();
    setMemoryEntries(all.memory);
    setUserEntries(all.user);
  };

  useEffect(() => {
    refresh();
    // Picks up changes made by the AI's memory tool mid-conversation
    // (same tab) and from other tabs/windows (storage event).
    window.addEventListener('arka-memory-updated', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('arka-memory-updated', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const handleDelete = (target: 'memory' | 'user', content: string) => {
    memoryManager.remove(target, content);
    refresh();
  };

  const handleClearAll = () => {
    if (!window.confirm('Hapus semua memori AI (catatan & profil pengguna)? Tindakan ini tidak bisa dibatalkan.')) return;
    memoryManager.clear();
    refresh();
  };

  const renderEntries = (entries: MemoryEntry[], target: 'memory' | 'user') => {
    if (entries.length === 0) {
      return <p className="text-xs text-[#94a3b8] italic">Kosong — belum ada yang tersimpan.</p>;
    }
    return (
      <div className="space-y-2">
        {entries.map(entry => (
          <div key={entry.id} className="flex items-start gap-2 bg-[#f8fafc] border border-[#e2e8f0] rounded-lg px-3 py-2">
            <p className="flex-1 text-xs text-[#334155] whitespace-pre-wrap break-words">{entry.content}</p>
            <button
              onClick={() => handleDelete(target, entry.content)}
              title="Hapus entri ini"
              className="p-1 rounded hover:bg-[#fee2e2] text-[#94a3b8] hover:text-[#c97878] shrink-0"
            >
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider flex items-center gap-1.5">
          <Brain size={12} />
          Memori AI
        </h3>
        {(memoryEntries.length > 0 || userEntries.length > 0) && (
          <button
            onClick={handleClearAll}
            className="flex items-center gap-1 text-[10px] font-medium text-[#c97878] hover:bg-[#c97878]/10 px-2 py-1 rounded transition-colors"
          >
            <Trash2 size={10} />
            Hapus Semua
          </button>
        )}
      </div>
      <div className="bg-white rounded-xl border border-[#b8c9db] p-4 space-y-4">
        <p className="text-[11px] text-[#94a3b8]">
          AI dapat menyimpan catatan tentang percakapan dan profil Anda agar diingat di sesi berikutnya.
          Anda bisa meninjau dan menghapusnya di sini kapan saja.
        </p>
        <div>
          <p className="text-[11px] font-medium text-[#64748b] mb-2">Catatan Agent</p>
          {renderEntries(memoryEntries, 'memory')}
        </div>
        <div>
          <p className="text-[11px] font-medium text-[#64748b] mb-2">Profil Pengguna</p>
          {renderEntries(userEntries, 'user')}
        </div>
      </div>
    </div>
  );
}

export default function Settings() {
  const { state, dispatch } = useApp();
  const { language, setLanguage } = useTranslation();
  const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
  const [editingProvider, setEditingProvider] = useState<Provider | null>(null);
  const [editForm, setEditForm] = useState({ apiKey: '', baseUrl: '', model: '' });
  const [theme, setTheme] = useState<'light' | 'dark' | 'auto'>(() => {
    return (localStorage.getItem('arka-theme') as 'light' | 'dark' | 'auto') || 'light';
  });
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    return (localStorage.getItem('arka-font-size') as 'small' | 'medium' | 'large') || 'medium';
  });

  // Apply theme
  useEffect(() => {
    localStorage.setItem('arka-theme', theme);
    const root = document.documentElement;
    const body = document.body;
    
    if (theme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
      body.classList.add('dark');
      body.classList.remove('light');
    } else if (theme === 'light') {
      root.classList.add('light');
      root.classList.remove('dark');
      body.classList.add('light');
      body.classList.remove('dark');
    } else {
      // Auto mode - check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        root.classList.add('dark');
        root.classList.remove('light');
        body.classList.add('dark');
        body.classList.remove('light');
      } else {
        root.classList.add('light');
        root.classList.remove('dark');
        body.classList.add('light');
        body.classList.remove('dark');
      }
    }
    
    // Dispatch custom event to notify app
    window.dispatchEvent(new CustomEvent('theme-changed', { detail: { theme } }));
  }, [theme]);

  // Apply font size
  useEffect(() => {
    localStorage.setItem('arka-font-size', fontSize);
    const root = document.documentElement;
    root.style.fontSize = fontSize === 'small' ? '14px' : fontSize === 'medium' ? '16px' : '18px';
  }, [fontSize]);

  // Language is managed by LanguageContext
  const [modelMode, setModelMode] = useState<'auto' | 'manual'>('auto');
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);

  const handleEdit = (providerId: Provider) => {
    const provider = state.providers.find(p => p.id === providerId);
    if (provider) {
      setEditingProvider(providerId);
      setEditForm({ apiKey: provider.apiKey, baseUrl: provider.baseUrl, model: provider.model });
      setModelMode('auto');
      setAvailableModels([]);
      setModelError(null);
    }
  };

  const handleSave = () => {
    if (!editingProvider) return;
    const provider = state.providers.find(p => p.id === editingProvider);
    if (provider) {
      dispatch({
        type: 'UPDATE_PROVIDER',
        payload: { ...provider, apiKey: editForm.apiKey, baseUrl: editForm.baseUrl, model: editForm.model },
      });
    }
    setEditingProvider(null);
  };

  const toggleEnabled = (providerId: Provider) => {
    const provider = state.providers.find(p => p.id === providerId);
    if (provider) {
      dispatch({ type: 'UPDATE_PROVIDER', payload: { ...provider, enabled: !provider.enabled } });
    }
  };

  const handleDetectModels = async () => {
    if (!editingProvider || !editForm.apiKey.trim()) {
      setModelError('API Key diperlukan untuk mendeteksi model');
      return;
    }

    setIsLoadingModels(true);
    setModelError(null);

    try {
      const models = await fetchModelsFromProvider(
        editingProvider,
        editForm.apiKey,
        editForm.baseUrl
      );
      setAvailableModels(models);
      if (models.length > 0) {
        setEditForm({ ...editForm, model: models[0].id });
      } else {
        setModelError('Tidak ada model yang ditemukan');
      }
    } catch (error) {
      setModelError(error instanceof Error ? error.message : 'Gagal mendeteksi model');
      setAvailableModels([]);
    } finally {
      setIsLoadingModels(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <SettingsIcon size={18} className="text-[#7c9cbf]" />
        <div>
          <h2 className="font-semibold text-[#334155] text-sm">Settings</h2>
          <p className="text-[10px] text-[#94a3b8]">Konfigurasi provider & preferensi</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Provider List */}
        <div>
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3 flex items-center gap-2">
            <Globe size={12} />
            AI Providers
          </h3>
          <div className="space-y-2">
            {state.providers.map(provider => (
              <div
                key={provider.id}
                className={`bg-white rounded-xl border transition-all ${
                  provider.enabled ? 'border-[#7c9cbf]/40 shadow-sm' : 'border-[#b8c9db]'
                }`}
              >
                <div className="p-4 flex items-center gap-3">
                  <span className="text-xl">{provider.icon}</span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-[#334155] text-sm">{provider.name}</span>
                      {provider.enabled && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#86b8a0]/10 text-[#5a8a6e] font-medium">
                          Aktif
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#94a3b8] truncate">
                      {provider.model || 'Belum dikonfigurasi'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleEdit(provider.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-[#5a7fa0] hover:bg-[#7c9cbf]/10 transition-colors"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => toggleEnabled(provider.id)}
                      className={`relative w-10 h-5 rounded-full transition-colors ${
                        provider.enabled ? 'bg-[#7c9cbf]' : 'bg-[#cbd5e1]'
                      }`}
                    >
                      <div
                        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
                          provider.enabled ? 'translate-x-5' : 'translate-x-0.5'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Security */}
        <SecuritySection />

        {/* Memory */}
        <MemorySection />

        {/* Appearance */}
        <div>
          <h3 className="text-xs font-semibold text-[#64748b] uppercase tracking-wider mb-3">
            Tampilan
          </h3>
          <div className="bg-white rounded-xl border border-[#b8c9db] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#334155]">Tema</span>
              <div className="flex gap-2">
                <button 
                  onClick={() => setTheme('light')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    theme === 'light' 
                      ? 'bg-[#7c9cbf]/10 text-[#5a7fa0] border border-[#7c9cbf]/30' 
                      : 'text-[#64748b] hover:bg-[#e8eef4]'
                  }`}
                >
                  Light
                </button>
                <button 
                  onClick={() => setTheme('dark')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    theme === 'dark' 
                      ? 'bg-[#7c9cbf]/10 text-[#5a7fa0] border border-[#7c9cbf]/30' 
                      : 'text-[#64748b] hover:bg-[#e8eef4]'
                  }`}
                >
                  Dark
                </button>
                <button 
                  onClick={() => setTheme('auto')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    theme === 'auto' 
                      ? 'bg-[#7c9cbf]/10 text-[#5a7fa0] border border-[#7c9cbf]/30' 
                      : 'text-[#64748b] hover:bg-[#e8eef4]'
                  }`}
                >
                  Auto
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#334155]">Font Size</span>
              <select 
                value={fontSize}
                onChange={(e) => setFontSize(e.target.value as 'small' | 'medium' | 'large')}
                className="px-3 py-1.5 rounded-lg border border-[#b8c9db] text-xs text-[#64748b] focus:outline-none focus:border-[#7c9cbf]"
              >
                <option value="small">Small</option>
                <option value="medium">Medium</option>
                <option value="large">Large</option>
              </select>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-[#334155]">Bahasa</span>
              <select 
                value={language}
                onChange={(e) => setLanguage(e.target.value as 'id' | 'en')}
                className="px-3 py-1.5 rounded-lg border border-[#b8c9db] text-xs text-[#64748b] focus:outline-none focus:border-[#7c9cbf]"
              >
                <option value="id">Bahasa Indonesia</option>
                <option value="en">English</option>
              </select>
            </div>
          </div>
        </div>

        {/* About */}
        <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c9cbf] to-[#5a7fa0] flex items-center justify-center">
              <span className="text-white font-bold text-xs">A</span>
            </div>
            <div>
              <h4 className="font-semibold text-[#334155] text-sm">Arka</h4>
              <p className="text-[10px] text-[#94a3b8]">v1.0.0 • Coding Agent</p>
            </div>
          </div>
          <p className="text-xs text-[#64748b]">
            AI-powered coding agent yang mendukung berbagai provider. Tulis kode, debug, dan deploy dengan bantuan AI.
          </p>
        </div>
      </div>

      {/* Edit Provider Modal */}
      {editingProvider && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setEditingProvider(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-2">
                <Key size={16} className="text-[#7c9cbf]" />
                <h3 className="font-bold text-[#334155] text-sm">
                  {state.providers.find(p => p.id === editingProvider)?.name}
                </h3>
              </div>
            </div>
            <div className="p-4 space-y-4">
              {/* API Key */}
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-1">API Key</label>
                <div className="relative">
                  <input
                    type={showKeys[editingProvider] ? 'text' : 'password'}
                    value={editForm.apiKey}
                    onChange={e => setEditForm({ ...editForm, apiKey: e.target.value })}
                    placeholder="sk-xxxxxxxxxxxx"
                    className="w-full px-3 py-2.5 pr-10 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                  />
                  <button
                    onClick={() => setShowKeys({ ...showKeys, [editingProvider]: !showKeys[editingProvider] })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded hover:bg-[#e8eef4]"
                  >
                    {showKeys[editingProvider] ? <EyeOff size={14} className="text-[#64748b]" /> : <Eye size={14} className="text-[#64748b]" />}
                  </button>
                </div>
              </div>

              {/* Base URL */}
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-1">Base URL</label>
                <input
                  type="text"
                  value={editForm.baseUrl}
                  onChange={e => setEditForm({ ...editForm, baseUrl: e.target.value })}
                  placeholder="https://api.example.com/v1"
                  className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                />
              </div>

              {/* Model Selection Mode */}
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-2">Model</label>
                
                {/* Mode Toggle */}
                <div className="flex gap-2 mb-3">
                  <button
                    onClick={() => setModelMode('auto')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      modelMode === 'auto'
                        ? 'bg-[#7c9cbf]/15 text-[#5a7fa0] border-2 border-[#7c9cbf]/30'
                        : 'bg-[#f0f4f8] text-[#64748b] border border-transparent hover:border-[#b8c9db]'
                    }`}
                  >
                    <Sparkles size={14} />
                    Auto-Detect
                  </button>
                  <button
                    onClick={() => setModelMode('manual')}
                    className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      modelMode === 'manual'
                        ? 'bg-[#7c9cbf]/15 text-[#5a7fa0] border-2 border-[#7c9cbf]/30'
                        : 'bg-[#f0f4f8] text-[#64748b] border border-transparent hover:border-[#b8c9db]'
                    }`}
                  >
                    <Key size={14} />
                    Manual
                  </button>
                </div>

                {/* Auto Mode */}
                {modelMode === 'auto' && (
                  <div className="space-y-2">
                    <button
                      onClick={handleDetectModels}
                      disabled={isLoadingModels || !editForm.apiKey.trim()}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                      {isLoadingModels ? (
                        <>
                          <RefreshCw size={14} className="animate-spin" />
                          Mendeteksi Model...
                        </>
                      ) : (
                        <>
                          <Sparkles size={14} />
                          Deteksi Model Otomatis
                        </>
                      )}
                    </button>

                    {modelError && (
                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-[#c97878]/10 border border-[#c97878]/20">
                        <AlertCircle size={14} className="text-[#c97878] shrink-0 mt-0.5" />
                        <p className="text-xs text-[#c97878]">{modelError}</p>
                      </div>
                    )}

                    {availableModels.length > 0 && (
                      <div>
                        <p className="text-[10px] text-[#64748b] mb-1.5">
                          {availableModels.length} model ditemukan
                        </p>
                        <select
                          value={editForm.model}
                          onChange={e => setEditForm({ ...editForm, model: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
                        >
                          {availableModels.map(model => (
                            <option key={model.id} value={model.id}>
                              {model.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                )}

                {/* Manual Mode */}
                {modelMode === 'manual' && (
                  <input
                    type="text"
                    value={editForm.model}
                    onChange={e => setEditForm({ ...editForm, model: e.target.value })}
                    placeholder="gpt-4o, claude-3-opus, dll"
                    className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                  />
                )}
              </div>

              {/* Save Button */}
              <button
                onClick={handleSave}
                className="w-full py-2.5 rounded-lg bg-[#7c9cbf] text-white font-medium text-sm hover:bg-[#5a7fa0] transition-colors flex items-center justify-center gap-2"
              >
                <Save size={14} />
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
