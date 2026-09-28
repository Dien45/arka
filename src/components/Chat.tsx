import { useState, useRef, useEffect } from 'react';
import { Send, Paperclip, Sparkles, User, Bot, Loader2, Code, Terminal } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { useApp } from '../store';
import { Message, ToolCall } from '../types';

function ToolCallDisplay({ toolCall }: { toolCall: ToolCall }) {
  const statusColors = {
    running: 'text-[#d4a574] bg-[#d4a574]/10',
    completed: 'text-[#86b8a0] bg-[#86b8a0]/10',
    error: 'text-[#c97878] bg-[#c97878]/10',
  };

  return (
    <div className="my-2 rounded-lg border border-[#b8c9db] overflow-hidden">
      <div className={`flex items-center gap-2 px-3 py-2 text-xs font-medium ${statusColors[toolCall.status]}`}>
        {toolCall.status === 'running' ? (
          <Loader2 size={12} className="animate-spin" />
        ) : toolCall.status === 'completed' ? (
          <Code size={12} />
        ) : (
          <Terminal size={12} />
        )}
        <span>{toolCall.name}</span>
        <span className="ml-auto opacity-60">{toolCall.status}</span>
      </div>
      {toolCall.output && (
        <div className="px-3 py-2 bg-[#1e293b] text-[#e2e8f0] text-xs font-mono overflow-x-auto max-h-40">
          {toolCall.output}
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const isTool = message.role === 'tool';

  if (isTool) {
    return (
      <div className="animate-fade-in">
        {message.toolCalls?.map(tc => (
          <ToolCallDisplay key={tc.id} toolCall={tc} />
        ))}
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
        <p className={`text-[10px] text-[#94a3b8] mt-1 px-1 ${isUser ? 'text-right' : ''}`}>
          {new Date(message.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
        </p>
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentSession = state.sessions.find(s => s.id === state.currentSessionId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [currentSession?.messages]);

  const simulateResponse = (userMessage: string, sessionId: string) => {
    setIsTyping(true);
    dispatch({ type: 'SET_LOADING', payload: true });

    setTimeout(() => {
      if (!sessionId) return;

      // Simulate tool call
      const toolMessage: Message = {
        id: Date.now().toString() + '_tool',
        role: 'tool',
        content: '',
        timestamp: new Date(),
        toolCalls: [
          {
            id: 'tc_1',
            name: 'read_file',
            input: { path: 'src/App.tsx' },
            output: '// Reading file content...\n// Found 42 lines of code',
            status: 'completed',
          },
        ],
      };
      dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: toolMessage } });

      setTimeout(() => {
        const responses = [
          `Baik, saya akan membantu Anda dengan itu. Berikut analisis saya:\n\n\`\`\`typescript\n// Contoh kode yang saya buat\nfunction solve(input: string): string {\n  return input.split('').reverse().join('');\n}\n\`\`\`\n\nPenjelasan:\n- Fungsi ini menerima string sebagai input\n- Memecah string menjadi array karakter\n- Membalik urutan array\n- Menggabungkan kembali menjadi string\n\nAda yang perlu saya jelaskan lebih lanjut?`,
          `Saya sudah menganalisis kode Anda. Berikut temuan saya:\n\n**Masalah yang ditemukan:**\n1. ⚠️ Variable \`count\` tidak diinisialisasi\n2. ⚠️ Missing error handling pada async function\n3. ✅ Struktur komponen sudah baik\n\n**Saran perbaikan:**\n\`\`\`typescript\n// Sebelum\nconst data = await fetchData();\n\n// Sesudah\ntry {\n  const data = await fetchData();\n} catch (error) {\n  console.error('Fetch failed:', error);\n}\n\`\`\``,
          `Tentu! Mari kita mulai. Saya akan membuat struktur project yang clean:\n\n📁 **Struktur Project:**\n\`\`\`\nsrc/\n├── components/\n│   ├── ui/\n│   └── layouts/\n├── hooks/\n├── utils/\n├── types/\n├── App.tsx\n└── main.tsx\n\`\`\`\n\nSaya sudah menyiapkan konfigurasi dasar. Mau saya lanjutkan dengan setup routing dan state management?`,
        ];

        const response: Message = {
          id: Date.now().toString(),
          role: 'assistant',
          content: responses[Math.floor(Math.random() * responses.length)],
          timestamp: new Date(),
        };

        dispatch({ type: 'ADD_MESSAGE', payload: { sessionId, message: response } });
        setIsTyping(false);
        dispatch({ type: 'SET_LOADING', payload: false });
      }, 1500);
    }, 800);
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
    simulateResponse(input, sessionId);
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
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <Sparkles size={18} className="text-[#7c9cbf]" />
        <div>
          <h2 className="font-semibold text-[#334155] text-sm">
            {currentSession ? currentSession.title : 'Chat Baru'}
          </h2>
          <p className="text-[10px] text-[#94a3b8]">
            {state.providers.find(p => p.enabled)?.name || 'Pilih provider di Settings'}
          </p>
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
              <MessageBubble key={msg.id} message={msg} />
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
