import { useEffect } from 'react';
import { Menu } from 'lucide-react';
import { AppProvider, useApp } from './store';
import { LanguageProvider } from './LanguageContext';
import { View } from './types';
import Sidebar from './components/Sidebar';
import Chat from './components/Chat';
import FileExplorer from './components/FileExplorer';
import GitHubPanel from './components/GitHubPanel';
import Settings from './components/Settings';
import SkillStore from './components/SkillStore';
import Unlock from './components/Unlock';
import PRDGenerator from './components/PRDGenerator';

function MainContent() {
  const { state, dispatch } = useApp();

  // Listen for theme changes
  useEffect(() => {
    const handleThemeChange = (event: CustomEvent) => {
      // Force re-render by triggering a state update
      dispatch({ type: 'FORCE_RERENDER' });
    };

    window.addEventListener('theme-changed', handleThemeChange as EventListener);
    return () => window.removeEventListener('theme-changed', handleThemeChange as EventListener);
  }, [dispatch]);

  // If the user enabled encrypted local storage (Settings → Keamanan), API
  // keys/GitHub token stay encrypted until the passphrase is entered here.
  if (state.vaultConfigured && state.locked) {
    return <Unlock />;
  }

  // Previously this only ever rendered the ONE active view — switching tabs
  // unmounted whatever was on screen. For Chat that meant navigating away
  // while the AI was mid-response (or, worse, while it was waiting on a
  // sensitive-tool approval click) tore down its component state entirely:
  // the in-flight tool-call loop lost its UI, any pending approval could
  // never be resolved, and the run looked like it "just stopped". Every view
  // now stays mounted all the time; only the active one is shown (others get
  // `hidden`), so background work (and any approval prompt) keeps running
  // and is still there when the user switches back.
  const views: { key: View; node: JSX.Element }[] = [
    { key: 'chat', node: <Chat /> },
    { key: 'files', node: <FileExplorer /> },
    { key: 'prd', node: <PRDGenerator /> },
    { key: 'skills', node: <SkillStore /> },
    { key: 'github', node: <GitHubPanel /> },
    { key: 'settings', node: <Settings /> },
  ];

  return (
    // h-dvh (dynamic viewport height) instead of h-screen (100vh): on mobile
    // browsers, 100vh is measured against the viewport WITHOUT the address
    // bar, which is taller than what's actually visible — that mismatch is
    // what forced the whole page to scroll just to reach the sidebar menu or
    // the chat input. dvh tracks the real visible viewport instead.
    <div className="h-dvh w-screen flex overflow-hidden bg-[#f0f4f8]">
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
        {/* Content — all views stay mounted; only the active one is visible */}
        <div className="flex-1 overflow-hidden relative">
          {views.map(({ key, node }) => (
            <div key={key} className={state.currentView === key ? 'h-full' : 'hidden'}>
              {node}
            </div>
          ))}
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
