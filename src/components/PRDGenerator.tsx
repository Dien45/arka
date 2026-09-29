import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import {
  FileText, Sparkles, Loader2, Send, Download, Copy, Save, Trash2,
  ChevronDown, ChevronUp, AlertCircle,
} from 'lucide-react';
import { useApp } from '../store';
import { callAIProviderFull, ChatMessage } from '../aiService';
import { loadVirtualFiles, saveVirtualFiles } from '../virtualFs';

const PRD_SYSTEM_PROMPT = `You are a senior product manager. Given a short product idea from the user, write a complete, well-structured Product Requirements Document (PRD) in Markdown.

Start with a single "# " (H1) line containing a short, professional document title that you write yourself (e.g. "# PRD: Aplikasi Pengingat Minum Obat") — never the idea copy-pasted verbatim as the title.

Then always include these sections (adapt the exact wording to the idea, but keep this overall structure and use "##" headings):
1. Ringkasan (Summary) — one short paragraph
2. Asumsi — if the idea is vague or missing details, state the assumptions you made here instead of asking clarifying questions back (this is a one-shot generation)
3. Latar Belakang & Masalah — what problem this solves and why it matters
4. Tujuan (Goals) and Bukan Tujuan (Non-Goals)
5. Target Pengguna / Persona
6. User Stories — as a bullet list of "Sebagai [peran], saya ingin [aksi], supaya [manfaat]"
7. Functional Requirements — numbered, specific, testable
8. Non-Functional Requirements — performance, security, scalability, privacy, etc. where relevant
9. Success Metrics / KPI
10. Milestone & Timeline (draft) — rough phases, no need for exact dates unless the user gave them
11. Risiko & Pertanyaan Terbuka

Rules:
- Write in the same language the user wrote their idea in (an Indonesian idea gets an Indonesian PRD, an English idea gets an English PRD).
- Be concrete and specific to the idea given — never use generic filler text.
- Use proper Markdown: headings, bullet/numbered lists, and a table where it helps (e.g. requirement priority).
- When asked to revise, keep the same overall structure and only change what the revision instruction asks for, returning the FULL updated document again (not a diff).
- CRITICAL: your entire reply must be ONLY the document itself (the "# " title line through the end of "## Risiko & Pertanyaan Terbuka"). Do NOT add any greeting, preamble, or closing remark before or after it — no "Berikut PRD-nya:", no "Semoga membantu!", and especially no closing question offering to do more work (e.g. "Mau saya lanjutkan ke desain mockup?"). This output is saved directly as a file, so anything other than the document itself would end up inside that file.`;


interface PRDDoc {
  id: string;
  title: string;
  messages: { role: 'user' | 'assistant'; content: string }[];
  createdAt: string;
  updatedAt: string;
}

function deriveTitle(idea: string): string {
  const firstLine = idea.trim().split('\n')[0];
  const words = firstLine.split(/\s+/).slice(0, 8).join(' ');
  if (!words) return 'PRD Tanpa Judul';
  return words.length < firstLine.length ? `${words}...` : words;
}

/** Pulls the "# Title" the model was instructed to open the document with, if present. */
function extractTitleFromContent(content: string): string | null {
  const firstLine = content.trim().split('\n')[0]?.trim();
  if (firstLine && firstLine.startsWith('# ')) {
    return firstLine.slice(2).trim() || null;
  }
  return null;
}

function slugify(text: string): string {
  return text.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'prd';
}

function getLatestContent(doc: PRDDoc): string {
  const lastAssistant = [...doc.messages].reverse().find(m => m.role === 'assistant');
  return lastAssistant?.content || '';
}

export default function PRDGenerator() {
  const { state } = useApp();
  const [idea, setIdea] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState('');
  const [prds, setPrds] = useState<PRDDoc[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('arka-prds') || '[]');
    } catch {
      return [];
    }
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refineInputs, setRefineInputs] = useState<Record<string, string>>({});
  const [refiningId, setRefiningId] = useState<string | null>(null);
  const [notice, setNotice] = useState<Record<string, 'copied' | 'saved' | undefined>>({});

  const enabledProviders = state.providers.filter(p => p.enabled);
  const [selectedModel, setSelectedModel] = useState<string>(
    () => localStorage.getItem('arka-selected-model') || ''
  );
  const activeProvider = enabledProviders.find(p => p.model === selectedModel) || enabledProviders[0];

  const persistPrds = (next: PRDDoc[]) => {
    setPrds(next);
    localStorage.setItem('arka-prds', JSON.stringify(next));
  };

  const flashNotice = (id: string, kind: 'copied' | 'saved') => {
    setNotice(prev => ({ ...prev, [id]: kind }));
    setTimeout(() => setNotice(prev => ({ ...prev, [id]: undefined })), 2000);
  };

  const handleGenerate = async () => {
    if (!idea.trim()) return;
    if (!activeProvider) {
      setError('Belum ada AI provider aktif. Aktifkan salah satu di Settings dulu.');
      return;
    }
    setIsGenerating(true);
    setError('');
    try {
      const userMsg = { role: 'user' as const, content: idea.trim() };
      const messages: ChatMessage[] = [
        { role: 'system', content: PRD_SYSTEM_PROMPT },
        userMsg,
      ];
      const response = await callAIProviderFull(activeProvider, messages);
      const title = customTitle.trim() || extractTitleFromContent(response.content) || deriveTitle(idea);
      const now = new Date().toISOString();
      const doc: PRDDoc = {
        id: `${Date.now()}`,
        title,
        messages: [userMsg, { role: 'assistant', content: response.content }],
        createdAt: now,
        updatedAt: now,
      };
      persistPrds([doc, ...prds]);
      setExpandedId(doc.id);
      setIdea('');
      setCustomTitle('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat PRD.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRefine = async (docId: string) => {
    const instruction = (refineInputs[docId] || '').trim();
    const doc = prds.find(p => p.id === docId);
    if (!instruction || !doc || !activeProvider) return;

    setRefiningId(docId);
    try {
      const messages: ChatMessage[] = [
        { role: 'system', content: PRD_SYSTEM_PROMPT },
        ...doc.messages,
        { role: 'user', content: instruction },
      ];
      const response = await callAIProviderFull(activeProvider, messages);
      const updatedMessages = [
        ...doc.messages,
        { role: 'user' as const, content: instruction },
        { role: 'assistant' as const, content: response.content },
      ];
      const next = prds.map(p =>
        p.id === docId ? { ...p, messages: updatedMessages, updatedAt: new Date().toISOString() } : p
      );
      persistPrds(next);
      setRefineInputs(prev => ({ ...prev, [docId]: '' }));
    } catch (err) {
      alert('Gagal merevisi PRD: ' + (err instanceof Error ? err.message : 'Unknown error'));
    } finally {
      setRefiningId(null);
    }
  };

  const handleDownload = (doc: PRDDoc) => {
    const blob = new Blob([getLatestContent(doc)], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${slugify(doc.title)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCopy = async (doc: PRDDoc) => {
    try {
      await navigator.clipboard.writeText(getLatestContent(doc));
      flashNotice(doc.id, 'copied');
    } catch {
      alert('Gagal menyalin ke clipboard.');
    }
  };

  const handleSaveToWorkspace = (doc: PRDDoc) => {
    // Each chat session has its own isolated virtual workspace (see
    // virtualFs.ts) — save into whichever session is currently active so
    // the file actually shows up in that session's Files tab.
    if (!state.currentSessionId) {
      alert('Pilih atau mulai sesi chat dulu — file akan disimpan ke workspace sesi itu.');
      return;
    }
    try {
      const virtualFiles = loadVirtualFiles(state.currentSessionId);
      const path = `docs/prd/${slugify(doc.title)}.md`;
      const content = getLatestContent(doc);
      virtualFiles[path] = { content, modified: new Date().toISOString(), size: content.length };
      saveVirtualFiles(state.currentSessionId, virtualFiles);
      flashNotice(doc.id, 'saved');
    } catch {
      alert('Gagal menyimpan ke workspace.');
    }
  };

  const handleDelete = (docId: string) => {
    if (!confirm('Hapus PRD ini? Tindakan ini tidak bisa dibatalkan.')) return;
    persistPrds(prds.filter(p => p.id !== docId));
    if (expandedId === docId) setExpandedId(null);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm flex items-center gap-3">
        <FileText size={18} className="text-[#334155]" />
        <div>
          <h2 className="font-semibold text-[#334155] text-sm">PRD Generator</h2>
          <p className="text-[10px] text-[#94a3b8]">{prds.length} dokumen dibuat</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Idea input */}
        <div className="bg-white rounded-xl border border-[#b8c9db] p-4">
          <h3 className="text-sm font-semibold text-[#334155] mb-1 flex items-center gap-2">
            <Sparkles size={16} className="text-[#7c9cbf]" />
            Ide Produk Baru
          </h3>
          <p className="text-[10px] text-[#94a3b8] mb-3">
            Tulis ide singkat, AI akan susun jadi PRD lengkap — latar belakang, user stories, requirements, sampai metrik sukses.
          </p>

          {enabledProviders.length === 0 && (
            <div className="mb-3 flex items-center gap-2 bg-[#f0b86e]/10 border border-[#f0b86e]/30 text-[#a67a3d] text-xs rounded-lg px-3 py-2">
              <AlertCircle size={14} className="shrink-0" />
              Belum ada AI provider aktif. Aktifkan salah satu di Settings dulu.
            </div>
          )}

          <input
            type="text"
            value={customTitle}
            onChange={e => setCustomTitle(e.target.value)}
            placeholder="Judul (opsional, kalau kosong diambil dari ide)"
            className="w-full mb-2 px-3 py-2 text-sm border border-[#b8c9db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7c9cbf]/40"
          />
          <textarea
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder='Contoh: "Aplikasi pengingat minum obat untuk lansia, terhubung ke keluarga"'
            rows={4}
            className="w-full px-3 py-2 text-sm border border-[#b8c9db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7c9cbf]/40 resize-none"
          />

          {enabledProviders.length > 1 && (
            <select
              value={selectedModel}
              onChange={e => setSelectedModel(e.target.value)}
              className="mt-2 w-full px-3 py-2 text-xs border border-[#b8c9db] rounded-lg bg-white text-[#334155]"
            >
              {enabledProviders.map(p => (
                <option key={p.id} value={p.model}>{p.icon} {p.name} — {p.model}</option>
              ))}
            </select>
          )}

          {error && <p className="text-xs text-[#c97878] mt-2">{error}</p>}

          <button
            onClick={handleGenerate}
            disabled={!idea.trim() || isGenerating || enabledProviders.length === 0}
            className="mt-3 w-full flex items-center justify-center gap-2 py-2.5 rounded-lg bg-[#7c9cbf] text-white text-sm font-medium hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {isGenerating ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Menyusun PRD...
              </>
            ) : (
              <>
                <Send size={16} /> Generate PRD
              </>
            )}
          </button>
        </div>

        {/* History */}
        {prds.length === 0 ? (
          <p className="text-xs text-[#94a3b8] text-center py-8">Belum ada PRD. Mulai dengan menulis ide di atas.</p>
        ) : (
          <div className="space-y-3">
            {prds.map(doc => {
              const isExpanded = expandedId === doc.id;
              return (
                <div key={doc.id} className="bg-white rounded-xl border border-[#b8c9db] overflow-hidden">
                  <button
                    onClick={() => setExpandedId(isExpanded ? null : doc.id)}
                    className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-[#f8fafc] transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-[#334155] truncate">{doc.title}</p>
                      <p className="text-[10px] text-[#94a3b8]">
                        {new Date(doc.updatedAt).toLocaleString('id-ID')} · {doc.messages.filter(m => m.role === 'user').length} revisi
                      </p>
                    </div>
                    {isExpanded ? (
                      <ChevronUp size={16} className="text-[#94a3b8] shrink-0" />
                    ) : (
                      <ChevronDown size={16} className="text-[#94a3b8] shrink-0" />
                    )}
                  </button>

                  {isExpanded && (
                    <div className="border-t border-[#e8eef4] p-4 space-y-3">
                      <div className="flex flex-wrap gap-2">
                        <button
                          onClick={() => handleCopy(doc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#b8c9db] text-[#5a7fa0] text-xs font-medium hover:bg-[#f8fafc]"
                        >
                          <Copy size={12} /> {notice[doc.id] === 'copied' ? 'Disalin!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleDownload(doc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#b8c9db] text-[#5a7fa0] text-xs font-medium hover:bg-[#f8fafc]"
                        >
                          <Download size={12} /> Download .md
                        </button>
                        <button
                          onClick={() => handleSaveToWorkspace(doc)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#86b8a0]/50 text-[#5a7fa0] text-xs font-medium hover:bg-[#86b8a0]/10"
                          title="Simpan sebagai file .md di virtual workspace (muncul di tab Files & bisa dipush ke GitHub)"
                        >
                          <Save size={12} /> {notice[doc.id] === 'saved' ? 'Tersimpan!' : 'Simpan ke Workspace'}
                        </button>
                        <button
                          onClick={() => handleDelete(doc.id)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-[#c97878]/40 text-[#c97878] text-xs font-medium hover:bg-[#c97878]/10 ml-auto"
                        >
                          <Trash2 size={12} /> Hapus
                        </button>
                      </div>

                      <div className="markdown-body text-sm bg-[#f8fafc] rounded-lg p-4 max-h-[28rem] overflow-y-auto border border-[#e8eef4]">
                        <ReactMarkdown>{getLatestContent(doc)}</ReactMarkdown>
                      </div>

                      <div className="flex gap-2 items-start">
                        <input
                          type="text"
                          value={refineInputs[doc.id] || ''}
                          onChange={e => setRefineInputs(prev => ({ ...prev, [doc.id]: e.target.value }))}
                          onKeyDown={e => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                              e.preventDefault();
                              handleRefine(doc.id);
                            }
                          }}
                          placeholder="Minta revisi, mis. 'tambahkan bagian monetisasi'"
                          disabled={refiningId === doc.id}
                          className="flex-1 px-3 py-2 text-xs border border-[#b8c9db] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7c9cbf]/40 disabled:opacity-50"
                        />
                        <button
                          onClick={() => handleRefine(doc.id)}
                          disabled={refiningId === doc.id || !(refineInputs[doc.id] || '').trim()}
                          className="px-3 py-2 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                        >
                          {refiningId === doc.id ? <Loader2 size={14} className="animate-spin" /> : 'Revisi'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
