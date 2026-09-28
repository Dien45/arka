import { useState } from 'react';
import { Bot, Plus, Trash2, Wrench, Zap, ChevronRight, X } from 'lucide-react';
import { useApp } from '../store';
import { Agent } from '../types';

const availableTools = [
  { id: 'read_file', name: 'Read File', icon: '📖', description: 'Membaca isi file' },
  { id: 'write_file', name: 'Write File', icon: '✏️', description: 'Menulis/mengedit file' },
  { id: 'terminal', name: 'Terminal', icon: '💻', description: 'Menjalankan command' },
  { id: 'search', name: 'Search', icon: '🔍', description: 'Mencari dalam codebase' },
  { id: 'browser', name: 'Browser', icon: '🌐', description: 'Akses web' },
  { id: 'linter', name: 'Linter', icon: '🔧', description: 'Analisa kualitas kode' },
  { id: 'git', name: 'Git', icon: '📦', description: 'Operasi Git' },
  { id: 'database', name: 'Database', icon: '🗄️', description: 'Query database' },
];

export default function AgentPanel() {
  const { state, dispatch } = useApp();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [newAgent, setNewAgent] = useState<Partial<Agent>>({
    name: '',
    description: '',
    icon: '🤖',
    systemPrompt: '',
    tools: [],
    provider: 'openai',
    model: 'gpt-4o',
  });

  const handleCreate = () => {
    if (!newAgent.name || !newAgent.systemPrompt) return;
    const agent: Agent = {
      id: Date.now().toString(),
      name: newAgent.name || 'New Agent',
      description: newAgent.description || '',
      icon: newAgent.icon || '🤖',
      systemPrompt: newAgent.systemPrompt || '',
      tools: newAgent.tools || [],
      provider: newAgent.provider || 'openai',
      model: newAgent.model || 'gpt-4o',
    };
    dispatch({ type: 'ADD_AGENT', payload: agent });
    setShowCreate(false);
    setNewAgent({ name: '', description: '', icon: '🤖', systemPrompt: '', tools: [], provider: 'openai', model: 'gpt-4o' });
  };

  const toggleTool = (toolId: string) => {
    const tools = newAgent.tools || [];
    setNewAgent({
      ...newAgent,
      tools: tools.includes(toolId) ? tools.filter(t => t !== toolId) : [...tools, toolId],
    });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Bot size={18} className="text-[#7c9cbf]" />
          <div>
            <h2 className="font-semibold text-[#334155] text-sm">Agents</h2>
            <p className="text-[10px] text-[#94a3b8]">{state.agents.length} agent tersedia</p>
          </div>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] transition-colors"
        >
          <Plus size={14} />
          Buat Agent
        </button>
      </div>

      {/* Agent List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {state.agents.map(agent => (
          <div
            key={agent.id}
            onClick={() => setSelectedAgent(agent)}
            className="bg-white rounded-xl border border-[#b8c9db] p-4 hover:border-[#7c9cbf] hover:shadow-sm transition-all cursor-pointer"
          >
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#e8eef4] flex items-center justify-center text-xl shrink-0">
                {agent.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-[#334155] text-sm">{agent.name}</h3>
                  <ChevronRight size={14} className="text-[#94a3b8]" />
                </div>
                <p className="text-xs text-[#64748b] mt-0.5">{agent.description}</p>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#7c9cbf]/10 text-[#5a7fa0] font-medium">
                    {agent.provider}
                  </span>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#86b8a0]/10 text-[#5a8a6e] font-medium">
                    {agent.tools.length} tools
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Agent Detail Modal */}
      {selectedAgent && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setSelectedAgent(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[80vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selectedAgent.icon}</span>
                <div>
                  <h3 className="font-bold text-[#334155]">{selectedAgent.name}</h3>
                  <p className="text-xs text-[#64748b]">{selectedAgent.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedAgent(null)} className="p-1 rounded hover:bg-[#e8eef4]">
                <X size={18} className="text-[#64748b]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <h4 className="text-xs font-semibold text-[#64748b] uppercase mb-2">System Prompt</h4>
                <div className="bg-[#f0f4f8] rounded-lg p-3 text-xs text-[#334155] font-mono">
                  {selectedAgent.systemPrompt}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#64748b] uppercase mb-2 flex items-center gap-1">
                  <Wrench size={12} /> Tools
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedAgent.tools.map(tool => {
                    const toolInfo = availableTools.find(t => t.id === tool);
                    return (
                      <span key={tool} className="text-xs px-2 py-1 rounded-lg bg-[#e8eef4] text-[#5a7fa0] font-medium">
                        {toolInfo?.icon} {toolInfo?.name || tool}
                      </span>
                    );
                  })}
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold text-[#64748b] uppercase mb-2 flex items-center gap-1">
                  <Zap size={12} /> Model
                </h4>
                <div className="bg-[#f0f4f8] rounded-lg p-3 text-xs text-[#334155]">
                  <span className="font-medium">{selectedAgent.provider}</span> / {selectedAgent.model}
                </div>
              </div>
              <button
                onClick={() => {
                  dispatch({ type: 'DELETE_AGENT', payload: selectedAgent.id });
                  setSelectedAgent(null);
                }}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-red-200 text-red-500 text-sm hover:bg-red-50 transition-colors"
              >
                <Trash2 size={14} />
                Hapus Agent
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Agent Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-end md:items-center justify-center p-4" onClick={() => setShowCreate(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md max-h-[85vh] overflow-y-auto shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
              <h3 className="font-bold text-[#334155]">Buat Agent Baru</h3>
              <button onClick={() => setShowCreate(false)} className="p-1 rounded hover:bg-[#e8eef4]">
                <X size={18} className="text-[#64748b]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">Nama Agent</label>
                <input
                  type="text"
                  value={newAgent.name}
                  onChange={e => setNewAgent({ ...newAgent, name: e.target.value })}
                  placeholder="Contoh: Code Reviewer"
                  className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">Deskripsi</label>
                <input
                  type="text"
                  value={newAgent.description}
                  onChange={e => setNewAgent({ ...newAgent, description: e.target.value })}
                  placeholder="Apa yang dilakukan agent ini?"
                  className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">Icon</label>
                <div className="flex gap-2 flex-wrap">
                  {['🤖', '🧠', '🎨', '🔬', '📊', '🛡️', '🎯', '⚡'].map(icon => (
                    <button
                      key={icon}
                      onClick={() => setNewAgent({ ...newAgent, icon })}
                      className={`w-10 h-10 rounded-lg text-xl flex items-center justify-center transition-all ${
                        newAgent.icon === icon ? 'bg-[#7c9cbf]/20 ring-2 ring-[#7c9cbf]' : 'bg-[#f0f4f8] hover:bg-[#e8eef4]'
                      }`}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-1">System Prompt</label>
                <textarea
                  value={newAgent.systemPrompt}
                  onChange={e => setNewAgent({ ...newAgent, systemPrompt: e.target.value })}
                  placeholder="Instruksi untuk agent..."
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none resize-none"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-[#64748b] block mb-2">Tools</label>
                <div className="grid grid-cols-2 gap-2">
                  {availableTools.map(tool => (
                    <button
                      key={tool.id}
                      onClick={() => toggleTool(tool.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg text-xs font-medium transition-all ${
                        (newAgent.tools || []).includes(tool.id)
                          ? 'bg-[#7c9cbf]/15 text-[#5a7fa0] border border-[#7c9cbf]/30'
                          : 'bg-[#f0f4f8] text-[#64748b] border border-transparent hover:border-[#b8c9db]'
                      }`}
                    >
                      <span>{tool.icon}</span>
                      <span>{tool.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-[#64748b] block mb-1">Provider</label>
                  <select
                    value={newAgent.provider}
                    onChange={e => setNewAgent({ ...newAgent, provider: e.target.value as Agent['provider'] })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
                  >
                    {state.providers.filter(p => p.enabled).map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                    {state.providers.filter(p => !p.enabled).length > 0 && (
                      <optgroup label="Non-aktif">
                        {state.providers.filter(p => !p.enabled).map(p => (
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </optgroup>
                    )}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-[#64748b] block mb-1">Model</label>
                  <input
                    type="text"
                    value={newAgent.model}
                    onChange={e => setNewAgent({ ...newAgent, model: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-[#b8c9db] text-sm focus:border-[#7c9cbf] focus:outline-none"
                  />
                </div>
              </div>
              <button
                onClick={handleCreate}
                disabled={!newAgent.name || !newAgent.systemPrompt}
                className="w-full py-2.5 rounded-lg bg-[#7c9cbf] text-white font-medium text-sm hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Buat Agent
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
