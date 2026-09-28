import { MessageSquare, Bot, FolderOpen, Github, Settings, Plus, X, MessageCircle, Trash2 } from 'lucide-react';
import { useApp } from '../store';
import { View } from '../types';

const menuItems: { view: View; icon: typeof MessageSquare; label: string }[] = [
  { view: 'chat', icon: MessageSquare, label: 'Chat' },
  { view: 'agent', icon: Bot, label: 'Agents' },
  { view: 'files', icon: FolderOpen, label: 'Files' },
  { view: 'github', icon: Github, label: 'GitHub' },
  { view: 'settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { state, dispatch } = useApp();

  return (
    <>
      {/* Overlay for mobile */}
      {state.sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed md:relative top-0 left-0 h-full z-50 w-72 flex flex-col transition-transform duration-300
          ${state.sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          bg-[#e8eef4] border-r border-[#b8c9db]`}
      >
        {/* Header */}
        <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#7c9cbf] to-[#5a7fa0] flex items-center justify-center">
              <span className="text-white font-bold text-sm">A</span>
            </div>
            <div>
              <h1 className="font-bold text-[#334155] text-lg leading-tight">Arka</h1>
              <p className="text-[10px] text-[#64748b]">Coding Agent</p>
            </div>
          </div>
          <button
            className="md:hidden p-1 rounded hover:bg-[#cbd5e1]"
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          >
            <X size={20} className="text-[#64748b]" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="p-3 space-y-1">
          {menuItems.map(item => (
            <button
              key={item.view}
              onClick={() => dispatch({ type: 'SET_VIEW', payload: item.view })}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all
                ${state.currentView === item.view
                  ? 'bg-[#7c9cbf]/20 text-[#5a7fa0] shadow-sm'
                  : 'text-[#64748b] hover:bg-[#cbd5e1]/50 hover:text-[#334155]'
                }`}
            >
              <item.icon size={18} />
              {item.label}
            </button>
          ))}
        </nav>

        {/* Sessions */}
        <div className="flex-1 overflow-y-auto px-3 py-2">
          <div className="flex items-center justify-between mb-2 px-1">
            <span className="text-xs font-semibold text-[#64748b] uppercase tracking-wider">Sessions</span>
            <button
              onClick={() => {
                const newSession = {
                  id: Date.now().toString(),
                  title: 'New Session',
                  messages: [],
                  createdAt: new Date(),
                  provider: 'openai' as const,
                  model: 'gpt-4o',
                };
                dispatch({ type: 'ADD_SESSION', payload: newSession });
                dispatch({ type: 'SET_VIEW', payload: 'chat' });
              }}
              className="p-1 rounded hover:bg-[#cbd5e1] text-[#64748b]"
            >
              <Plus size={14} />
            </button>
          </div>
          {state.sessions.length === 0 ? (
            <p className="text-xs text-[#94a3b8] px-2 py-4 text-center">
              Belum ada sesi. Mulai chat baru!
            </p>
          ) : (
            <div className="space-y-1">
              {state.sessions.map(session => (
                <div
                  key={session.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all
                    ${state.currentSessionId === session.id
                      ? 'bg-[#7c9cbf]/15 text-[#5a7fa0]'
                      : 'hover:bg-[#cbd5e1]/50 text-[#64748b]'
                    }`}
                  onClick={() => {
                    dispatch({ type: 'SET_SESSION', payload: session.id });
                    dispatch({ type: 'SET_VIEW', payload: 'chat' });
                  }}
                >
                  <MessageCircle size={14} className="shrink-0" />
                  <span className="text-sm truncate flex-1">{session.title}</span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      dispatch({ type: 'DELETE_SESSION', payload: session.id });
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-red-100 text-red-400 transition-opacity"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-[#b8c9db]">
          <div className="flex items-center gap-2 px-2">
            <div className="w-2 h-2 rounded-full bg-[#86b8a0] animate-pulse" />
            <span className="text-xs text-[#64748b]">
              {state.providers.filter(p => p.enabled).length} provider aktif
            </span>
          </div>
        </div>
      </aside>
    </>
  );
}
