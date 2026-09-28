import { useState, useEffect } from 'react';
import { Settings as SettingsIcon, Key, Globe, Check, Eye, EyeOff, Save, RefreshCw, Sparkles, AlertCircle } from 'lucide-react';
import { useApp } from '../store';
import { Provider } from '../types';
import { fetchModelsFromProvider, ModelInfo } from '../modelFetcher';
import { useTranslation } from '../LanguageContext';

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
