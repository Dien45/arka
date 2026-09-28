import { createContext, useContext, useReducer, ReactNode, Dispatch, useEffect } from 'react';
import { ProviderConfig, Session, Agent, View, Message, GitHubRepo } from './types';

interface AppState {
  currentView: View;
  sessions: Session[];
  currentSessionId: string | null;
  agents: Agent[];
  providers: ProviderConfig[];
  githubToken: string;
  githubRepos: GitHubRepo[];
  githubConnected: boolean;
  sidebarOpen: boolean;
  isLoading: boolean;
}

type Action =
  | { type: 'SET_VIEW'; payload: View }
  | { type: 'SET_SESSION'; payload: string }
  | { type: 'ADD_SESSION'; payload: Session }
  | { type: 'ADD_MESSAGE'; payload: { sessionId: string; message: Message } }
  | { type: 'UPDATE_MESSAGE'; payload: { sessionId: string; messageId: string; content: string } }
  | { type: 'DELETE_SESSION'; payload: string }
  | { type: 'SET_PROVIDERS'; payload: ProviderConfig[] }
  | { type: 'UPDATE_PROVIDER'; payload: ProviderConfig }
  | { type: 'SET_AGENTS'; payload: Agent[] }
  | { type: 'ADD_AGENT'; payload: Agent }
  | { type: 'DELETE_AGENT'; payload: string }
  | { type: 'SET_GITHUB_TOKEN'; payload: string }
  | { type: 'SET_GITHUB_REPOS'; payload: GitHubRepo[] }
  | { type: 'SET_GITHUB_CONNECTED'; payload: boolean }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_LOADING'; payload: boolean };

const defaultProviders: ProviderConfig[] = [
  { id: 'openai', name: 'OpenAI', apiKey: '', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o', enabled: false, icon: '🟢' },
  { id: 'anthropic', name: 'Anthropic', apiKey: '', baseUrl: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', enabled: false, icon: '🟠' },
  { id: 'google', name: 'Google AI', apiKey: '', baseUrl: 'https://generativelanguage.googleapis.com', model: 'gemini-2.0-flash', enabled: false, icon: '🔵' },
  { id: 'groq', name: 'Groq', apiKey: '', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', enabled: false, icon: '⚡' },
  { id: 'openrouter', name: 'OpenRouter', apiKey: '', baseUrl: 'https://openrouter.ai/api/v1', model: 'auto', enabled: false, icon: '🔀' },
  { id: 'ollama', name: 'Ollama (Local)', apiKey: '', baseUrl: 'http://localhost:11434', model: 'llama3.1', enabled: false, icon: '🦙' },
  { id: 'custom', name: 'Custom', apiKey: '', baseUrl: '', model: '', enabled: false, icon: '⚙️' },
];

const defaultAgents: Agent[] = [
  {
    id: '1',
    name: 'Code Architect',
    description: 'Membantu merancang arsitektur dan struktur proyek',
    icon: '🏗️',
    systemPrompt: 'You are a senior software architect. Help design clean, scalable code architectures.',
    tools: ['read_file', 'write_file', 'search', 'terminal'],
    provider: 'openai',
    model: 'gpt-4o',
  },
  {
    id: '2',
    name: 'Bug Hunter',
    description: 'Mendeteksi dan memperbaiki bug dalam kode',
    icon: '🐛',
    systemPrompt: 'You are an expert debugger. Analyze code carefully and find bugs, then fix them.',
    tools: ['read_file', 'search', 'terminal', 'linter'],
    provider: 'anthropic',
    model: 'claude-sonnet-4-20250514',
  },
  {
    id: '3',
    name: 'Full Stack Dev',
    description: 'Developer serba bisa untuk frontend dan backend',
    icon: '💻',
    systemPrompt: 'You are a full-stack developer proficient in React, Node.js, databases, and DevOps.',
    tools: ['read_file', 'write_file', 'terminal', 'search', 'browser'],
    provider: 'google',
    model: 'gemini-2.0-flash',
  },
];

// Load state from localStorage
const loadState = (): AppState => {
  try {
    const saved = localStorage.getItem('arka-state');
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        currentView: 'chat',
        sessions: parsed.sessions || [],
        currentSessionId: parsed.currentSessionId || null,
        agents: parsed.agents || defaultAgents,
        providers: parsed.providers || defaultProviders,
        githubToken: parsed.githubToken || '',
        githubRepos: parsed.githubRepos || [],
        githubConnected: parsed.githubConnected || false,
        sidebarOpen: false,
        isLoading: false,
      };
    }
  } catch (error) {
    console.error('Failed to load state from localStorage:', error);
  }
  
  return {
    currentView: 'chat',
    sessions: [],
    currentSessionId: null,
    agents: defaultAgents,
    providers: defaultProviders,
    githubToken: '',
    githubRepos: [],
    githubConnected: false,
    sidebarOpen: false,
    isLoading: false,
  };
};

// Save state to localStorage
const saveState = (state: AppState) => {
  try {
    const toSave = {
      sessions: state.sessions,
      currentSessionId: state.currentSessionId,
      agents: state.agents,
      providers: state.providers,
      githubToken: state.githubToken,
      githubRepos: state.githubRepos,
      githubConnected: state.githubConnected,
    };
    localStorage.setItem('arka-state', JSON.stringify(toSave));
  } catch (error) {
    console.error('Failed to save state to localStorage:', error);
  }
};

const initialState: AppState = loadState();

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'SET_VIEW':
      return { ...state, currentView: action.payload, sidebarOpen: false };
    case 'SET_SESSION':
      return { ...state, currentSessionId: action.payload };
    case 'ADD_SESSION':
      return { ...state, sessions: [action.payload, ...state.sessions], currentSessionId: action.payload.id };
    case 'ADD_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? { ...s, messages: [...s.messages, action.payload.message] }
            : s
        ),
      };
    case 'UPDATE_MESSAGE':
      return {
        ...state,
        sessions: state.sessions.map(s =>
          s.id === action.payload.sessionId
            ? {
                ...s,
                messages: s.messages.map(m =>
                  m.id === action.payload.messageId ? { ...m, content: action.payload.content } : m
                ),
              }
            : s
        ),
      };
    case 'DELETE_SESSION':
      return {
        ...state,
        sessions: state.sessions.filter(s => s.id !== action.payload),
        currentSessionId: state.currentSessionId === action.payload ? null : state.currentSessionId,
      };
    case 'SET_PROVIDERS':
      return { ...state, providers: action.payload };
    case 'UPDATE_PROVIDER':
      return { ...state, providers: state.providers.map(p => p.id === action.payload.id ? action.payload : p) };
    case 'SET_AGENTS':
      return { ...state, agents: action.payload };
    case 'ADD_AGENT':
      return { ...state, agents: [...state.agents, action.payload] };
    case 'DELETE_AGENT':
      return { ...state, agents: state.agents.filter(a => a.id !== action.payload) };
    case 'SET_GITHUB_TOKEN':
      return { ...state, githubToken: action.payload };
    case 'SET_GITHUB_REPOS':
      return { ...state, githubRepos: action.payload };
    case 'SET_GITHUB_CONNECTED':
      return { ...state, githubConnected: action.payload };
    case 'TOGGLE_SIDEBAR':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    default:
      return state;
  }
}

const AppContext = createContext<{ state: AppState; dispatch: Dispatch<Action> } | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  
  // Save state to localStorage whenever it changes
  useEffect(() => {
    saveState(state);
  }, [state]);
  
  return <AppContext.Provider value={{ state, dispatch }}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
