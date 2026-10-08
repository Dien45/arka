# 🤖 Arka - AI Coding Agent

Aplikasi coding agent dengan dukungan multi-provider AI, mirip dengan opencode tetapi dengan fitur tambahan seperti menu agent, workspace tree, file preview, dan integrasi GitHub.

## ✨ Fitur Utama

### 💬 Chat Interface
- Interface chat interaktif mirip opencode
- Support markdown rendering
- Quick prompts untuk tugas umum
- Tool call display (read_file, write_file, terminal)
- Typing indicator dan animasi smooth

### 🤖 Agent System
- 3 agent default: Code Architect, Bug Hunter, Full Stack Dev
- Buat agent custom dengan konfigurasi:
  - System prompt
  - Tools (read_file, write_file, terminal, search, dll)
  - Provider & model spesifik
  - Icon dan deskripsi

### 📁 File Explorer
- Workspace tree dengan struktur folder lengkap
- Tab system untuk multiple files
- Line numbers dan minimap
- Syntax highlighting untuk berbagai bahasa
- Git status indicators (modified, staged, untracked)
- Search bar untuk cari file cepat
- File preview dengan breadcrumb navigation

### 🐙 GitHub Integration
- Koneksi via Personal Access Token
- Fetch repository list dari GitHub
- Upload workspace folder
- Select file yang ingin di-push
- Push langsung ke GitHub via API
- Branch management

### ⚙️ Multi-Provider Support
- **OpenAI** (GPT-4o, GPT-4, o1, o3)
- **Anthropic** (Claude 3.5 Sonnet, Claude 3 Opus)
- **Google AI** (Gemini 2.0 Flash, Gemini Pro)
- **Groq** (Llama 3.3, Mixtral)
- **OpenRouter** (50+ model)
- **Ollama** (Local models)
- **Custom API** (OpenAI-compatible)

### 🎯 Auto-Detect Model
- Toggle Auto/Manual mode
- Fetch daftar model dari provider via API
- Dropdown model yang terdeteksi
- Error handling yang graceful

### 📂 Workspace Management
- Pilih folder workspace
- Quick select folder populer
- Path display untuk referensi

### 🎨 UI/UX
- Tema pastel biru-abu yang modern
- Responsive design (mobile & desktop)
- Smooth animations dan transitions
- Dark mode support (coming soon)

## 📱 Android (native — Kotlin + Jetpack Compose)

Versi native Android ada di folder [`android/`](android/) — **bukan WebView wrapper**.
PRD lengkap: [`android/PRD.md`](android/PRD.md) · Panduan distro proot: [`android/DISTRO.md`](android/DISTRO.md)

### Fitur Android

- **Chat agent** — tool loop (8 tool), approval untuk 5 tool sensitif, Stop,
  auto-continue mode Agent, markdown, sesi (buat/ganti/rename/hapus) + workspace per sesi.
- **Model picker dengan pencarian** — scan model per provider (OpenAI, Anthropic, Google,
  Groq, OpenRouter, Ollama, Custom), hasil scan tersimpan, pilih dari daftar (tidak perlu
  ketik manual lagi).
- **File Explorer** — pohon folder, tab file, editor, preview Markdown/SVG/HTML/CSV,
  impor ZIP/file, unduh ZIP. Workspace sesi adalah folder **nyata** di perangkat.
- **GitHub** — hubungkan PAT, daftar repo + pencarian, branch, buat repo, push file
  terpilih lewat Git Data API, push "Staged AI Commits", ekspor/impor SyncManifest.
- **Skill Store** — katalog 13 skill + install dari repo GitHub + mode/config; skill aktif
  disuntik ke system prompt (konten pihak ketiga diperlakukan sebagai data).
- **PRD Generator** — dokumen 11 bagian, revisi, salin/bagikan, simpan ke workspace.
- **run_command dua backend** — shell Android (`/system/bin/sh`) atau **distro Alpine asli
  via proot tanpa root** (`apk`, `git`, `python3`, `node`, …), cwd = folder workspace sesi.
- **Keamanan** — API key & PAT di EncryptedSharedPreferences, SSRF guard di `web_fetch`,
  allowlist + timeout + cap output di `run_command`, bukan teks plaintext.

### Build

```bash
cd android
./gradlew :app:assembleDebug      # APK debug di app/build/outputs/apk/debug/
./gradlew :app:assembleDebug -Pproot.skip=true   # tanpa mengunduh binary proot
```

CI: [`.github/workflows/build-android-apk.yml`](.github/workflows/build-android-apk.yml)
(APK debug tiap push ke `main`) dan
[`.github/workflows/android-release.yml`](.github/workflows/android-release.yml)
(APK release bertanda tangan saat tag `v*`).

## 🚀 Quick Start

### Install Dependencies
```bash
npm install
```

### Development
```bash
npm run dev
```

Buka browser di `http://localhost:5173`

### Build
```bash
npm run build
```

### Preview Production
```bash
npm run preview
```

## 📦 Tech Stack

- **React 18** - UI framework
- **TypeScript** - Type safety
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Lucide React** - Icons
- **React Markdown** - Markdown rendering

## 📁 Project Structure

```
src/
├── components/
│   ├── Chat.tsx           # Chat interface
│   ├── AgentPanel.tsx     # Agent management
│   ├── FileExplorer.tsx   # Workspace & file preview
│   ├── GitHubPanel.tsx    # GitHub integration
│   ├── Settings.tsx       # Provider configuration
│   └── Sidebar.tsx        # Navigation
├── store.tsx              # State management
├── types.ts               # TypeScript types
├── modelFetcher.ts        # Auto-detect models
├── githubApi.ts           # GitHub API integration
├── App.tsx                # Main app component
└── main.tsx               # Entry point
```

## 🔧 Configuration

### Setup Provider
1. Buka **Settings** di sidebar
2. Pilih provider (OpenAI, Anthropic, dll)
3. Masukkan API Key
4. Klik **Auto-Detect** untuk fetch model
5. Pilih model dari dropdown
6. Toggle **Enabled** untuk aktifkan

### Connect GitHub
1. Buka **GitHub** di sidebar
2. Buat Personal Access Token di GitHub
3. Paste token di form
4. Klik **Hubungkan**
5. Upload workspace folder
6. Pilih repository tujuan
7. Push files!

## 🎯 Usage Examples

### Chat dengan AI
- Ketik pertanyaan di input box
- AI akan membaca file dan memberikan response
- Lihat tool call yang dijalankan
- Preview file yang dimodifikasi

### Buat Agent Custom
1. Buka **Agents** di sidebar
2. Klik **Buat Agent**
3. Isi nama, deskripsi, icon
4. Tulis system prompt
5. Pilih tools yang dibutuhkan
6. Pilih provider & model
7. Klik **Buat Agent**

### Push ke GitHub
1. Upload folder workspace
2. Pilih repository tujuan
3. Centang file yang ingin di-push
4. Tulis commit message
5. Klik **Push**

## 📝 Commit Message Format

Gunakan format conventional commits:
- `feat:` - Fitur baru
- `fix:` - Perbaikan bug
- `docs:` - Dokumentasi
- `style:` - Formatting
- `refactor:` - Refactoring
- `test:` - Testing
- `chore:` - Maintenance

## 🔐 Security Notes

- API keys disimpan di memory browser (hilang saat refresh)
- Jangan commit `.env` file ke repository
- Gunakan Personal Access Token dengan scope minimal
- Revoke token jika tidak digunakan lagi

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

MIT License - feel free to use this project for personal or commercial purposes.

## 🙏 Acknowledgments

- Inspired by opencode
- Icons by Lucide React
- UI design with Tailwind CSS

---

**Made with ❤️ by Arka Team**
