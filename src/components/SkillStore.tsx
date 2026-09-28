import { useState, useEffect } from 'react';
import { Bot, Download, Github, Search, X, Check, ExternalLink, Loader2, Package, Sparkles } from 'lucide-react';
import { useApp } from '../store';

interface Skill {
  id: string;
  name: string;
  description: string;
  author: string;
  source: 'github' | 'openclaw' | 'hermes';
  icon: string;
  category: string;
  installed: boolean;
  version: string;
  repo?: string;
}

const availableSkills: Skill[] = [
  // GitHub Skills
  {
    id: 'gh-code-review',
    name: 'Code Reviewer',
    description: 'Review kode dan berikan saran perbaikan otomatis',
    author: 'arka-official',
    source: 'github',
    icon: '🔍',
    category: 'Code Quality',
    installed: false,
    version: '1.2.0',
    repo: 'arka-official/code-reviewer',
  },
  {
    id: 'gh-test-gen',
    name: 'Test Generator',
    description: 'Generate unit test otomatis dari kode',
    author: 'arka-official',
    source: 'github',
    icon: '🧪',
    category: 'Testing',
    installed: false,
    version: '1.0.0',
    repo: 'arka-official/test-generator',
  },
  {
    id: 'gh-doc-writer',
    name: 'Doc Writer',
    description: 'Generate dokumentasi otomatis dari kode',
    author: 'arka-official',
    source: 'github',
    icon: '📝',
    category: 'Documentation',
    installed: false,
    version: '1.1.0',
    repo: 'arka-official/doc-writer',
  },
  {
    id: 'gh-refactor',
    name: 'Auto Refactor',
    description: 'Refactor kode dengan best practices',
    author: 'arka-community',
    source: 'github',
    icon: '🔧',
    category: 'Code Quality',
    installed: false,
    version: '0.9.0',
    repo: 'arka-community/auto-refactor',
  },
  // OpenClaw Skills
  {
    id: 'oc-react-expert',
    name: 'React Expert',
    description: 'Spesialis React, hooks, dan patterns modern',
    author: 'openclaw',
    source: 'openclaw',
    icon: '⚛️',
    category: 'Frontend',
    installed: false,
    version: '2.0.0',
  },
  {
    id: 'oc-api-designer',
    name: 'API Designer',
    description: 'Desain REST API dan GraphQL yang optimal',
    author: 'openclaw',
    source: 'openclaw',
    icon: '🌐',
    category: 'Backend',
    installed: false,
    version: '1.5.0',
  },
  {
    id: 'oc-db-optimizer',
    name: 'DB Optimizer',
    description: 'Optimasi query dan schema database',
    author: 'openclaw',
    source: 'openclaw',
    icon: '🗄️',
    category: 'Database',
    installed: false,
    version: '1.3.0',
  },
  {
    id: 'oc-security',
    name: 'Security Scanner',
    description: 'Scan vulnerability dan saran keamanan',
    author: 'openclaw',
    source: 'openclaw',
    icon: '🛡️',
    category: 'Security',
    installed: false,
    version: '1.8.0',
  },
  // Hermes Skills
  {
    id: 'hm-perf-analyzer',
    name: 'Performance Analyzer',
    description: 'Analisa performa dan optimasi speed',
    author: 'hermes-labs',
    source: 'hermes',
    icon: '⚡',
    category: 'Performance',
    installed: false,
    version: '2.1.0',
  },
  {
    id: 'hm-ai-architect',
    name: 'AI Architect',
    description: 'Desain arsitektur AI/ML pipeline',
    author: 'hermes-labs',
    source: 'hermes',
    icon: '🧠',
    category: 'AI/ML',
    installed: false,
    version: '1.0.0',
  },
  {
    id: 'hm-devops',
    name: 'DevOps Assistant',
    description: 'Setup CI/CD, Docker, dan deployment',
    author: 'hermes-labs',
    source: 'hermes',
    icon: '🚀',
    category: 'DevOps',
    installed: false,
    version: '1.4.0',
  },
  {
    id: 'hm-mobile',
    name: 'Mobile Expert',
    description: 'Spesialis React Native dan Flutter',
    author: 'hermes-labs',
    source: 'hermes',
    icon: '📱',
    category: 'Mobile',
    installed: false,
    version: '1.2.0',
  },
];

export default function SkillStore() {
  const { state } = useApp();
  const [skills, setSkills] = useState<Skill[]>(() => {
    const saved = localStorage.getItem('arka-skills');
    if (saved) {
      try {
        const savedSkills = JSON.parse(saved);
        return availableSkills.map(skill => ({
          ...skill,
          installed: savedSkills.includes(skill.id)
        }));
      } catch {
        return availableSkills;
      }
    }
    return availableSkills;
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedSource, setSelectedSource] = useState<'all' | 'github' | 'openclaw' | 'hermes'>('all');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [installingSkill, setInstallingSkill] = useState<string | null>(null);
  const [showInstallModal, setShowInstallModal] = useState(false);
  const [customRepo, setCustomRepo] = useState('');
  const [configuringSkill, setConfiguringSkill] = useState<Skill | null>(null);

  // Save skills to localStorage whenever they change
  useEffect(() => {
    const installedIds = skills.filter(s => s.installed).map(s => s.id);
    localStorage.setItem('arka-skills', JSON.stringify(installedIds));
  }, [skills]);

  const categories = ['all', ...new Set(skills.map(s => s.category))];

  const filteredSkills = skills.filter(skill => {
    const matchSearch = skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      skill.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchSource = selectedSource === 'all' || skill.source === selectedSource;
    const matchCategory = selectedCategory === 'all' || skill.category === selectedCategory;
    return matchSearch && matchSource && matchCategory;
  });

  const handleInstall = (skillId: string) => {
    setInstallingSkill(skillId);
    setTimeout(() => {
      setSkills(prev => prev.map(s => 
        s.id === skillId ? { ...s, installed: true } : s
      ));
      setInstallingSkill(null);
    }, 2000);
  };

  const handleUninstall = (skillId: string) => {
    setSkills(prev => prev.map(s => 
      s.id === skillId ? { ...s, installed: false } : s
    ));
  };

  const handleInstallCustom = () => {
    if (!customRepo.trim()) return;
    const newSkill: Skill = {
      id: `custom-${Date.now()}`,
      name: customRepo.split('/').pop() || 'Custom Skill',
      description: `Skill dari ${customRepo}`,
      author: customRepo.split('/')[0] || 'unknown',
      source: 'github',
      icon: '📦',
      category: 'Custom',
      installed: false,
      version: '1.0.0',
      repo: customRepo,
    };
    setSkills(prev => [newSkill, ...prev]);
    setShowInstallModal(false);
    setCustomRepo('');
    handleInstall(newSkill.id);
  };

  const installedCount = skills.filter(s => s.installed).length;

  const sourceColors = {
    github: 'bg-[#334155]/10 text-[#334155]',
    openclaw: 'bg-[#7c9cbf]/10 text-[#5a7fa0]',
    hermes: 'bg-[#93b5d3]/10 text-[#5a7fa0]',
  };

  const sourceIcons = {
    github: '🐙',
    openclaw: '🦀',
    hermes: '🪽',
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[#b8c9db] bg-white/50 backdrop-blur-sm">
        <div className="flex items-center gap-3">
          <Package size={18} className="text-[#7c9cbf]" />
          <div className="flex-1">
            <h2 className="font-semibold text-[#334155] text-sm">Skill Store</h2>
            <p className="text-[10px] text-[#94a3b8]">{installedCount} skill terinstall • {skills.length} tersedia</p>
          </div>
          <button
            onClick={() => setShowInstallModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] transition-colors"
          >
            <Github size={12} />
            Install dari URL
          </button>
        </div>

        {/* Filters */}
        <div className="mt-3 flex flex-wrap gap-2">
          {/* Search */}
          <div className="flex items-center gap-1.5 bg-white rounded-lg border border-[#b8c9db] px-2 py-1.5 flex-1 min-w-[200px]">
            <Search size={12} className="text-[#94a3b8]" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Cari skill..."
              className="flex-1 bg-transparent text-xs text-[#334155] placeholder:text-[#94a3b8] outline-none"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')}>
                <X size={12} className="text-[#64748b]" />
              </button>
            )}
          </div>

          {/* Source Filter */}
          <div className="flex gap-1">
            {(['all', 'github', 'openclaw', 'hermes'] as const).map(source => (
              <button
                key={source}
                onClick={() => setSelectedSource(source)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedSource === source
                    ? 'bg-[#7c9cbf]/15 text-[#5a7fa0] border border-[#7c9cbf]/30'
                    : 'bg-white border border-[#b8c9db] text-[#64748b] hover:border-[#7c9cbf]/50'
                }`}
              >
                {source === 'all' ? '🌐 Semua' : `${sourceIcons[source]} ${source.charAt(0).toUpperCase() + source.slice(1)}`}
              </button>
            ))}
          </div>
        </div>

        {/* Category Filter */}
        <div className="mt-2 flex gap-1 overflow-x-auto pb-1">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-2 py-1 rounded-md text-[10px] whitespace-nowrap transition-all ${
                selectedCategory === cat
                  ? 'bg-[#7c9cbf] text-white'
                  : 'bg-[#f0f4f8] text-[#64748b] hover:bg-[#e8eef4]'
              }`}
            >
              {cat === 'all' ? 'Semua' : cat}
            </button>
          ))}
        </div>
      </div>

      {/* Skills Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredSkills.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-center">
            <Package size={40} className="text-[#94a3b8] mb-3 opacity-50" />
            <p className="text-sm text-[#64748b]">Tidak ada skill yang ditemukan</p>
            <p className="text-xs text-[#94a3b8] mt-1">Coba ubah filter atau kata kunci</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredSkills.map(skill => (
              <div
                key={skill.id}
                className={`bg-white rounded-xl border p-4 transition-all ${
                  skill.installed 
                    ? 'border-[#86b8a0]/40 bg-[#86b8a0]/5' 
                    : 'border-[#b8c9db] hover:border-[#7c9cbf]/50 hover:shadow-sm'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#f0f4f8] flex items-center justify-center text-xl shrink-0">
                    {skill.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-[#334155] text-sm">{skill.name}</h3>
                      {skill.installed && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-[#86b8a0]/10 text-[#5a8a6e] font-medium">
                          Installed
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-[#64748b] mt-0.5 line-clamp-2">{skill.description}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${sourceColors[skill.source]}`}>
                        {sourceIcons[skill.source]} {skill.source}
                      </span>
                      <span className="text-[9px] text-[#94a3b8]">v{skill.version}</span>
                      <span className="text-[9px] text-[#94a3b8]">by {skill.author}</span>
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  {skill.installed ? (
                    <>
                      <button
                        onClick={() => handleUninstall(skill.id)}
                        className="flex-1 py-1.5 rounded-lg border border-[#c97878]/30 text-[#c97878] text-xs font-medium hover:bg-[#c97878]/5 transition-colors"
                      >
                        Uninstall
                      </button>
                      <button 
                        onClick={() => setConfiguringSkill(skill)}
                        className="flex-1 py-1.5 rounded-lg bg-[#86b8a0]/10 text-[#5a8a6e] text-xs font-medium hover:bg-[#86b8a0]/20 transition-colors"
                      >
                        Configure
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleInstall(skill.id)}
                      disabled={installingSkill === skill.id}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[#7c9cbf] text-white text-xs font-medium hover:bg-[#5a7fa0] disabled:opacity-50 transition-colors"
                    >
                      {installingSkill === skill.id ? (
                        <>
                          <Loader2 size={12} className="animate-spin" />
                          Installing...
                        </>
                      ) : (
                        <>
                          <Download size={12} />
                          Install
                        </>
                      )}
                    </button>
                  )}
                  {skill.repo && (
                    <a
                      href={`https://github.com/${skill.repo}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-1.5 rounded-lg border border-[#b8c9db] text-[#64748b] hover:bg-[#f0f4f8] transition-colors"
                    >
                      <ExternalLink size={12} />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Install from URL Modal */}
      {showInstallModal && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setShowInstallModal(false)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Github size={16} className="text-[#7c9cbf]" />
                <h3 className="font-bold text-[#334155] text-sm">Install Skill dari URL</h3>
              </div>
              <button onClick={() => setShowInstallModal(false)} className="p-1 rounded hover:bg-[#e8eef4]">
                <X size={18} className="text-[#64748b]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-1">Repository URL atau Path</label>
                <input
                  type="text"
                  value={customRepo}
                  onChange={e => setCustomRepo(e.target.value)}
                  placeholder="username/skill-name atau https://github.com/..."
                  className="w-full px-3 py-2.5 rounded-lg border border-[#b8c9db] text-sm font-mono focus:border-[#7c9cbf] focus:outline-none"
                />
              </div>
              <div className="bg-[#f0f4f8] rounded-lg p-3">
                <p className="text-[10px] text-[#64748b] font-medium mb-2">Format yang didukung:</p>
                <div className="space-y-1">
                  <p className="text-[10px] text-[#64748b] font-mono">• github: username/repo-name</p>
                  <p className="text-[10px] text-[#64748b] font-mono">• openclaw: openclaw://skill-id</p>
                  <p className="text-[10px] text-[#64748b] font-mono">• hermes: hermes://skill-name</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowInstallModal(false)}
                  className="flex-1 py-2.5 rounded-lg border border-[#b8c9db] text-sm text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleInstallCustom}
                  disabled={!customRepo.trim()}
                  className="flex-1 py-2.5 rounded-lg bg-[#7c9cbf] text-white text-sm font-medium hover:bg-[#5a7fa0] disabled:opacity-40 transition-colors flex items-center justify-center gap-2"
                >
                  <Download size={14} />
                  Install
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Configure Skill Modal */}
      {configuringSkill && (
        <div className="fixed inset-0 bg-black/30 z-50 flex items-center justify-center p-4" onClick={() => setConfiguringSkill(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md shadow-xl" onClick={e => e.stopPropagation()}>
            <div className="p-4 border-b border-[#b8c9db] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xl">{configuringSkill.icon}</span>
                <h3 className="font-bold text-[#334155] text-sm">Configure: {configuringSkill.name}</h3>
              </div>
              <button onClick={() => setConfiguringSkill(null)} className="p-1 rounded hover:bg-[#e8eef4]">
                <X size={18} className="text-[#64748b]" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <p className="text-xs text-[#64748b] mb-2">{configuringSkill.description}</p>
                <div className="bg-[#f0f4f8] rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748b]">Version</span>
                    <span className="text-xs font-medium text-[#334155]">v{configuringSkill.version}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748b]">Source</span>
                    <span className="text-xs font-medium text-[#334155] capitalize">{configuringSkill.source}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748b]">Author</span>
                    <span className="text-xs font-medium text-[#334155]">{configuringSkill.author}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[#64748b]">Category</span>
                    <span className="text-xs font-medium text-[#334155]">{configuringSkill.category}</span>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-xs font-medium text-[#64748b] block mb-1">Skill Settings</label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded border-[#b8c9db] text-[#7c9cbf] focus:ring-[#7c9cbf]" />
                    <span className="text-xs text-[#334155]">Enable auto-suggestions</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" defaultChecked className="rounded border-[#b8c9db] text-[#7c9cbf] focus:ring-[#7c9cbf]" />
                    <span className="text-xs text-[#334155]">Show notifications</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <input type="checkbox" className="rounded border-[#b8c9db] text-[#7c9cbf] focus:ring-[#7c9cbf]" />
                    <span className="text-xs text-[#334155]">Advanced mode</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setConfiguringSkill(null)}
                  className="flex-1 py-2.5 rounded-lg border border-[#b8c9db] text-sm text-[#64748b] hover:bg-[#f8fafc] transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => setConfiguringSkill(null)}
                  className="flex-1 py-2.5 rounded-lg bg-[#7c9cbf] text-white text-sm font-medium hover:bg-[#5a7fa0] transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
