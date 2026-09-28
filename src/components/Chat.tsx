import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, User, Bot, Loader2, Code, Terminal, FileCode, Eye, ChevronDown, Check, AlertCircle } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../store';
import { Message, ToolCall } from '../types';
import { callAIProvider } from '../aiService';

function FilePreview({ fileName, content }: { fileName: string; content: string }) {
  const [expanded, setExpanded] = useState(false);
  const lines = content.split('\n');
  const displayLines = expanded ? lines : lines.slice(0, 8);

  return (
    <div className="my-2 rounded-lg border border-[#b8c9db] overflow-hidden bg-white">
      <div className="flex items-center gap-2 px-3 py-2 bg-[#f8fafc] border-b border-[#b8c9db]">
        <FileCode size={14} className="text-[#7c9cbf]" />
        <span className="text-xs font-medium text-[#334155]">{fileName}</span>
        <span className="text-[10px] text-[#94a3b8] ml-auto">{lines.length} lines</span>
      </div>
      <div className="flex">
        <div className="bg-[#f8fafc] border-r border-[#e2e8f0] py-2 px-2 select-none">
          {displayLines.map((_, i) => (
            <div key={i} className="text-[10px] text-[#94a3b8] text-right font-mono leading-5 h-5">
              {i + 1}
            </div>
          ))}
        </div>
        <pre className="flex-1 p-2 text-[11px] font-mono text-[#334155] overflow-x-auto leading-5">
          <code>{displayLines.join('\n')}</code>
        </pre>
      </div>
      {lines.length > 8 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full py-1.5 text-[10px] text-[#5a7fa0] font-medium hover:bg-[#f8fafc] border-t border-[#b8c9db] flex items-center justify-center gap-1"
        >
          <Eye size={10} />
          {expanded ? 'Tutup preview' : `Lihat ${lines.length - 8} baris lainnya`}
        </button>
      )}
    </div>
  );
}

function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const statusColors = {
    running: 'text-[#d4a574] bg-[#d4a574]/10',
    completed: 'text-[#86b8a0] bg-[#86b8a0]/10',
    error: 'text-[#c97878] bg-[#c97878]/10',
  };

  const isFileOperation = toolCall.name === 'read_file' || toolCall.name === 'write_file';
  const fileName = (toolCall.input?.path as string) || '';

  return (
    <div className="my-2">
      <div className="rounded-lg border border-[#b8c9db] overflow-hidden">
        <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${statusColors[toolCall.status]}`}>
          {toolCall.status === 'running' ? (
            <Loader2 size={12} className="animate-spin" />
          ) : toolCall.status === 'completed' ? (
            <Code size={12} />
          ) : (
            <Terminal size={12} />
          )}
          <span>{toolCall.name}</span>
          {fileName && <span className="text-[10px] opacity-70 font-mono">{fileName}</span>}
          <span className="ml-auto opacity-60">{toolCall.status}</span>
        </div>
        {toolCall.output && !isFileOperation && (
          <div className="px-3 py-2 bg-[#1e293b] text-[#e2e8f0] text-xs font-mono overflow-x-auto max-h-40">
            {toolCall.output}
          </div>
        )}
      </div>
      {isFileOperation && toolCall.output && toolCall.status === 'completed' && (
        <FilePreview fileName={fileName} content={toolCall.output} />
      )}
    </div>
  );
}

function WorkspaceChangesSummary({ toolCalls }: { toolCalls: ToolCall[] }) {
  const { dispatch } = useApp();
  const fileOps = toolCalls.filter(tc => tc.name === 'read_file' || tc.name === 'write_file');
  
  if (fileOps.length === 0) return null;

  return (
    <div className="mt-2 rounded-lg border border-[#b8c9db] bg-[#f8fafc] p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold text-[#64748b] uppercase">
          📁 Workspace Changes ({fileOps.length} file)
        </span>
        <button
          onClick={() => dispatch({ type: 'SET_VIEW', payload: 'files' })}
          className="text-[10px] text-[#5a7fa0] font-medium hover:underline flex items-center gap-1"
        >
          <FileCode size={10} />
          Buka di Explorer
        </button>
      </div>
      <div className="space-y-1">
        {fileOps.map(tc => (
          <div key={tc.id} className="flex items-center gap-2 text-xs">
            <span className={`w-1.5 h-1.5 rounded-full ${
              tc.name === 'write_file' ? 'bg-[#86b8a0]' : 'bg-[#7c9cbf]'
            }`} />
            <span className="text-[#334155] font-mono truncate">
              {tc.input?.path as string}
            </span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
              tc.name === 'write_file' 
                ? 'bg-[#86b8a0]/10 text-[#5a8a6e]' 
                : 'bg-[#7c9cbf]/10 text-[#5a7fa0]'
            }`}>
              {tc.name === 'write_file' ? 'modified' : 'read'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({ message, selectedModel }: { message: Message; selectedModel?: string }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <div className="animate-fade-in">
        {message.toolCalls?.map(tc => (
          <ToolCallDisplay key={tc.id} toolCall={tc} />
        ))}
        {message.toolCalls && message.toolCalls.length > 0 && (
          <WorkspaceChangesSummary toolCalls={message.toolCalls} />
        )}
      </div>
    );
  }

  return (
    <div className={`flex gap-3 animate-fade-in ${isUser ? 'flex-row-reverse' : ''}`}>
      <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
        isUser ? 'bg-[#7c9cbf]' : 'bg-[#93b5d3]'
      }`}>
        {isUser ? <User size={16} className="text-white" /> : <Bot size={16} className="text-white" />}
      </div>
      <div className={`max-w-[85%] md:max-w-[70%] ${isUser ? 'text-right' : ''}`}>
        <div className={`rounded-2xl px-4 py-3 ${
          isUser
            ? 'bg-[#7c9cbf] text-white rounded-tr-sm'
            : 'bg-white border border-[#b8c9db] text-[#334155] rounded-tl-sm shadow-sm'
        }`}>
          {isUser ? (
            <p className="text-sm whitespace-pre-wrap">{message.content}</p>
          ) : (
            <div className="markdown-body text-sm">
              <ReactMarkdown>{message.content}</ReactMarkdown>
            </div>
          )}
        </div>
        <div className={`flex items-center gap-2 mt-1 px-1 ${isUser ? 'justify-end' : ''}`}>
          <p className="text-[10px] text-[#94a3b8]">
            {new Date(message.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
          </p>
          {!isUser && message.role === 'assistant' && (
            <p className="text-[10px] text-[#94a3b8]">
              • {selectedModel}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

const quickPrompts = [
  { icon: '🏗️', text: 'Buat project React baru', prompt: 'Buatkan saya project React dengan TypeScript dan Tailwind CSS dari awal.' },
  { icon: '🐛', text: 'Debug kode ini', prompt: 'Bantu saya debug kode berikut dan jelaskan masalahnya.' },
  { icon: '📝', text: 'Jelaskan kode', prompt: 'Jelaskan kode ini baris per baris dengan bahasa Indonesia.' },
  { icon: '🚀', text: 'Optimasi performa', prompt: 'Analisa performa kode ini dan berikan saran optimasi.' },
];

export default function Chat() {
  const { state, dispatch } = useApp();
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [selectedModel, setSelectedModel] = useState('gpt-4o');
  const [showModelSelector, setShowModelSelector] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);
  
  // Get enabled providers and their models
  const enabledProviders = state.providers.filter(p => p.enabled);
  const currentProvider = enabledProviders.find(p => p.model === selectedModel) || enabledProviders[0];
  
  // Default models if no provider is enabled
  const defaultModels = [
    { id: 'gpt-4o', name: 'GPT-4o', provider: 'OpenAI', icon: '🟢' },
    { id: 'claude-3-5-sonnet', name: 'Claude 3.5 Sonnet', provider: 'Anthropic', icon: '🟠' },
    { id: 'gemini-pro', name: 'Gemini Pro', provider: 'Google', icon: '🔵' },
  ];

  // Close model selector when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest('[data-model-selector]')) {
        setShowModelSelector(false);
      }
    };

    if (showModelSelector) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showModelSelector]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const getAIResponse = async (userMessage: string, sessionId: string) => {
    setIsTyping(true);
    dispatch({ type: 'SET_LOADING', payload: true });

    try {
      // Find the provider for the selected model
      const provider = state.providers.find(p => p.model === selectedModel && p.enabled);
      
      if (!provider) {
        throw new Error('Provider tidak ditemukan atau belum diaktifkan. Buka Settings untuk setup.');
      }

      // Build message history from current session
      const session = state.sessions.find(s => s.id === sessionId);
      const messageHistory = session?.messages
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .map(m => ({
          role: m.role as 'user' | 'assistant',
          content: m.content,
        })) || [];

      // Add system prompt
      const messagesWithSystem = [
        {
          role: 'system' as const,
          content: `You are Arka, a friendly AI coding assistant. 

IMPORTANT RULES:
- Respond in Indonesian (Bahasa Indonesia) unless asked otherwise
- Be concise and direct - no lengthy explanations unless asked
- Do NOT show your thinking process or internal reasoning
- Do NOT include <think> tags or reasoning in your response
- Just give the final answer directly
- Use markdown for code blocks when showing code
- Be helpful and friendly

Keep responses short and actionable.`,
        },
        ...messageHistory,
      ];

      // Call the AI provider
      const responseContent = await callAIProvider(provider, messagesWithSystem);

      const response: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: responseContent,
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: response } });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Terjadi kesalahan saat menghubungi AI';
      
      const response: Message = {
        id: Date.now().toString(),
        role: 'assistant',
        content: `❌ **Error:** ${errorMessage}\n\nPastikan:\n- API Key sudah benar di Settings\n- Provider sudah diaktifkan\n- Koneksi internet stabil`,
        timestamp: new Date(),
      };

      dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: response } });
    } finally {
      setIsTyping(false);
      dispatch({ type: 'SET_LOADING', payload: false });
    }
  };

  const handleSend = () => {
    if (!input.trim()) return;

    let sessionId: string = state.currentSessionId || '';

    if (!sessionId) {
      const newSession = {
        id: Date.now().toString(),
        title: input.slice(0, 40) + (input.length > 40 ? '...' : ''),
        messages: [],
        createdAt: new Date(),
        provider: 'openai' as const,
        model: 'gpt-4o',
      };
      dispatch({ type: 'ADD_SESSION', payload: newSession });
      sessionId = newSession.id;
    }

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date(),
    };

    dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: userMessage } });
    setInput('');
    getAIResponse(input, sessionId);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Sparkles size={18} className="text-[#7c9cbf]" />
          <div className="flex-1">
            <h2 className="font-semibold text-[#334155] text-sm">
              {currentSession ? currentSession.title : 'Chat Baru'}
            </h2>
          </div>
          
          {/* Model Selector */}
          <div className="relative" data-model-selector>
            <button
              onClick={() => setShowModelSelector(!showModelSelector)}
              className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#7c9cbf]/10 text-[#5a7fa0] text-xs font-medium hover:bg-[#7c9cbf]/20 transition-colors"
            >
              <span className="truncate max-w-[120px]">{selectedModel}</span>
              <ChevronDown size={12} />
            </button>
            
            {showModelSelector && (
              <div className="absolute right-0 top-full mt-2 w-72 bg-white rounded-xl border border-[#b8c9db] shadow-lg z-10 overflow-hidden">
                <div className="p-2 border-b border-[#b8c9db] bg-[#f8fafc]">
                  <p className="text-[10px] font-semibold text-[#64748b] uppercase">Pilih Model AI</p>
                </div>
                <div className="max-h-96 overflow-y-auto">
                  {/* Default Models */}
                  <div className="border-b border-[#e8eef4]">
                    <div className="px-3 py-2 bg-[#f8fafc] flex items-center gap-2">
                      <Sparkles size={12} className="text-[#7c9cbf]" />
                      <span className="text-xs font-medium text-[#334155]">Default Models</span>
                    </div>
                    {defaultModels.map(model => (
                      <button
                        key={model.id}
                        onClick={() => {
                          setSelectedModel(model.id);
                          setShowModelSelector(false);
                        }}
                        className={`w-full px-3 py-2.5 text-left hover:bg-[#f0f4f8] transition-colors ${
                          selectedModel === model.id ? 'bg-[#7c9cbf]/10' : ''
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{model.icon}</span>
                          <div className="flex-1">
                            <p className={`text-xs font-medium ${
                              selectedModel === model.id ? 'text-[#5a7fa0]' : 'text-[#334155]'
                            }`}>
                              {model.name}
                            </p>
                            <p className="text-[10px] text-[#94a3b8]">{model.provider}</p>
                          </div>
                          {selectedModel === model.id && (
                            <Check size={14} className="text-[#7c9cbf]" />
                          )}
                        </div>
                      </button>
                    ))}
                  </div>

                  {/* Enabled Providers */}
                  {enabledProviders.length > 0 && (
                    <div>
                      <div className="px-3 py-2 bg-[#f8fafc] flex items-center gap-2">
                        <span className="text-xs font-medium text-[#334155]">Your Providers</span>
                      </div>
                      {enabledProviders.map(provider => (
                        <div key={provider.id} className="border-b border-[#e8eef4] last:border-b-0">
                          <button
                            onClick={() => {
                              setSelectedModel(provider.model);
                              setShowModelSelector(false);
                            }}
                            className={`w-full px-3 py-2.5 text-left hover:bg-[#f0f4f8] transition-colors ${
                              selectedModel === provider.model ? 'bg-[#7c9cbf]/10' : ''
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{provider.icon}</span>
                              <div className="flex-1">
                                <p className={`text-xs font-mono ${
                                  selectedModel === provider.model ? 'text-[#5a7fa0] font-medium' : 'text-[#334155]'
                                }`}>
                                  {provider.model}
                                </p>
                                <p className="text-[10px] text-[#94a3b8]">{provider.name}</p>
                              </div>
                              {selectedModel === provider.model && (
                                <Check size={14} className="text-[#7c9cbf]" />
                              )}
                            </div>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Setup Link */}
                  <div className="p-3 bg-[#f8fafc] border-t border-[#e8eef4]">
                    <button
                      onClick={() => {
                        dispatch({ type: 'SET_VIEW', payload: 'settings' });
                        setShowModelSelector(false);
                      }}
                      className="w-full text-xs text-[#5a7fa0] font-medium hover:underline text-center"
                    >
                      ⚙️ Setup Provider di Settings
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
        
        {/* Provider Info */}
        <div className="mt-2 flex items-center gap-2">
          {currentProvider && (
            <>
              <span className="text-sm">{currentProvider.icon}</span>
              <span className="text-[10px] text-[#64748b]">
                {currentProvider.name} • {selectedModel}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {!currentSession || currentSession.messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#7c9cbf] to-[#93b5d3] flex items-center justify-center mb-4 shadow-lg">
              <span className="text-3xl">🤖</span>
            </div>
            <h3 className="text-xl font-bold text-[#334155] mb-2">Halo! Saya Arka</h3>
            <p className="text-sm text-[#64748b] mb-6 max-w-sm">
              Coding agent siap membantu Anda menulis, debug, dan memahami kode. Pilih prompt cepat atau ketik pertanyaan Anda.
            </p>
            <div className="grid grid-cols-2 gap-2 w-full max-w-sm">
              {quickPrompts.map((qp, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInput(qp.prompt);
                    inputRef.current?.focus();
                  }}
                  className="flex items-center gap-2 p-3 rounded-xl bg-white border border-[#b8c9db] hover:border-[#7c9cbf] hover:shadow-sm transition-all text-left"
                >
                  <span className="text-lg">{qp.icon}</span>
                  <span className="text-xs text-[#64748b] font-medium">{qp.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {currentSession.messages.map(msg => (
              <MessageBubble key={msg.id} message={msg} selectedModel={selectedModel} />
            ))}
            {isTyping && (
              <div className="flex gap-3 animate-fade-in">
                <div className="w-8 h-8 rounded-full bg-[#93b5d3] flex items-center justify-center">
                  <Bot size={16} className="text-white" />
                </div>
                <div className="bg-white border border-[#b8c9db] rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                  <div className="flex gap-1.5">
                    <div className="w-2 h-2 rounded-full bg-[#7c9cbf] typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#7c9cbf] typing-dot" />
                    <div className="w-2 h-2 rounded-full bg-[#7c9cbf] typing-dot" />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input Area */}
      <div className="p-3 border-t border-[#b8c9db] bg-white/50 backdrop-blur-sm">
        <div className="flex items-end gap-2 bg-white rounded-2xl border border-[#b8c9db] p-2 shadow-sm focus-within:border-[#7c9cbf] focus-within:shadow-md transition-all">
          <button className="p-2 rounded-lg hover:bg-[#e8eef4] text-[#64748b] shrink-0">
            <Paperclip size={18} />
          </button>
          <textarea
            ref={inputRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Tanyakan sesuatu tentang kode..."
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm text-[#334155] placeholder:text-[#94a3b8] outline-none py-2 max-h-32"
            style={{ minHeight: '36px' }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || state.isLoading}
            className="p-2 rounded-lg bg-[#7c9cbf] text-white hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed transition-all shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
        <p className="text-[10px] text-[#94a3b8] text-center mt-2">
          Arka bisa membuat kesalahan. Periksa informasi penting.
        </p>
      </div>
    </div>
  );
}
