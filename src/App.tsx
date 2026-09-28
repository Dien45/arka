import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { AppProvider, useApp } from './store';
import { LanguageProvider } from './LanguageContext';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import AgentPanel from './components/AgentPanel';
import FileExplorer from './components/FileExplorer';
import GitHubPanel from './components/GitHubPanel';
import Settings from './components/Settings';
import SkillStore from './components/SkillStore';

function MainContent() {
  const { state, dispatch } = useApp();

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      // Force re-render by triggering a state update
      dispatch({ type: 'SET_LOADING', payload: false });
    };

    window.addEventListener('theme-changed', handleThemeChange as EventListener);
    return () => window.removeEventListener('theme-changed', handleThemeChange as EventListener);
  }, [dispatch]);

  const renderView = () => {
    switch (state.currentView) {
      case 'chat':
        return <Chat />;
      case 'agent':
        return <AgentPanel />;
      case 'files':
        return <FileExplorer />;
      case 'skills':
        return <SkillStore />;
      case 'github':
        return <GitHubPanel />;
      case 'settings':
        return <Settings />;
      default:
        return <Chat />;
    }
  };

  return (
    <div className="h-screen w-screen flex overflow-hidden bg-[#f0f4f8]">
      <Sidebar />
      <main className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm">
          <button
            onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
            className="p-1.5 rounded-lg hover:bg-[#e8eef4]"
          >
            <Menu size={20} className="text-[#334155]" />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-gradient-to-br from-[#7c9cbf] to-[#5a7fa0] flex items-center justify-center">
              <span className="text-white font-bold text-[10px]">A</span>
            </div>
            <span className="font-semibold text-[#334155] text-sm">Arka</span>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {renderView()}
        </div>
      </main>
    </div>
  );
}

export default function App() {
  return (
    <LanguageProvider>
      <AppProvider>
        <MainContent />
      </AppProvider>
    </LanguageProvider>
  );
}
