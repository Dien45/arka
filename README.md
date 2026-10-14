# 🤖 Arka - AI Coding Agent (Android)

Aplikasi Android native (Kotlin + Jetpack Compose, **bukan WebView wrapper**) — AI coding agent ala opencode yang jalan penuh di HP: chat multi-mode, tool loop otonom, workspace nyata di perangkat, distro Linux (proot) untuk eksekusi command beneran, dan integrasi GitHub.

## ✨ Fitur Utama

### 💬 Chat — 3 Mode
- **Plan** 🗺️ — diskusi & rencana saja (tool read-only)
- **Build** 🔨 — kerjakan task langsung
- **Agent** 🤖 — otonom sampai selesai (200 langkah tool + auto-continue)
- Markdown rendering, tombol **Salin** per pesan & per blok kode, attachment file (otomatis tersimpan ke workspace), typing indicator, Stop
- Bahasa Indonesia / English, tema terang/gelap/otomatis

### 🛠️ Tools AI (10)
`read_file`, `write_file`, `list_files` (file + folder, scope sesi/workspace), `run_command`, `web_fetch`, `web_search`, `skill`, `memory` (add/replace/remove/**search**), `session_search` (cari obrolan lama via FTS), `stage_commit`
- 5 tool sensitif lewat **approval** (Izinkan/Tolak/**Izinkan Semua** + toggle di Settings)
- History lintas-turn menyertakan gema hasil tool — konteks tidak hilang saat ganti model

### 🧠 Memory
- Catatan agen (2.200 char) + profil user (1.375 char), action search, tersimpan aman di perangkat
- `session_search`: semua pesan terindeks SQLite FTS, bisa cari pembahasan minggu lalu
- Mode Agent otomatis membuat **skill** dari task besar yang selesai (learning loop)

### 🧩 Skills
- 13 skill bawaan (prompt-only) + pasang dari repo GitHub (format `SKILL.md`), auto-install dari link/nama
- Tersedia di `/root/workspace/skills/<id>/` untuk semua sesi

### 🐙 GitHub
- Hubungkan PAT → daftar repo, branch (scrollable), buat repo, push file terpilih via Git Data API, "Staged AI Commits"
- PAT otomatis diteruskan ke credential helper proot — `git push/clone` dari AI langsung terautentikasi, tanpa tempel token di chat

### 📁 Files (Workspace)
- Pohon folder default **sesi ini** (toggle Semua sesi), tab editor + preview Markdown/HTML/CSV, impor ZIP/file, unduh ZIP
- Semua operasi berat di background thread; folder sampah (`node_modules`, `build`, ...) dilewati saat scan

### 🐧 Distro Linux (proot, tanpa root)
- Alpine asli: `apk`, `git`, `python3`, `node`, ... — cwd = folder workspace sesi (`/root/workspace`)
- Unduh rootfs sekali dari Settings (atau impor `.tar.gz` offline)

### ⚙️ Multi-Provider
OpenAI, Anthropic, Google, Groq, OpenRouter, Ollama, Custom (OpenAI-compatible) — scan model otomatis, base URL dirapikan otomatis (`100.x:11434` → `http://…`, cocok untuk Ollama via Tailscale/LAN). Server http di IP privat (Tailscale `100.x`, LAN, `*.local`/`*.ts.net`) otomatis di-relay lewat loopback (`LocalForwarder`) sehingga tetap jalan tanpa melonggarkan kebijakan cleartext aplikasi; http ke host publik tetap diblokir.

## 🚀 Pakai

1. Unduh APK terbaru dari tab **Actions** (artifact `arka-debug-apk`), atau build sendiri:
```bash
cd android
./gradlew :app:assembleDebug      # APK di app/build/outputs/apk/debug/
```
2. Buka aplikasi → Settings → pilih provider → isi API key → scan → pilih model
3. (Opsional) Panel GitHub → tempel PAT untuk push + repo private
4. (Opsional) Settings → Command & Distro → unduh Alpine untuk `run_command`

CI: [build-android-apk.yml](.github/workflows/build-android-apk.yml) (APK debug tiap push/PR ke `main`), [android-release.yml](.github/workflows/android-release.yml) (APK release saat tag `v*`).

## 📁 Struktur Proyek

```
android/                        # aplikasi (semua kode di sini)
├── app/src/main/java/com/arka/app/
│   ├── core/                   # ChatController, Tools, Store, Memory,
│   │                           # Skills, VirtualFs, SessionIndex, DistroManager
│   ├── net/                    # AiClient (7 provider), GitHubApi, NetGuard
│   └── ui/                     # Chat, Files, GitHub, Skills, PRD, Settings
├── app/src/main/res/xml/       # backup rules, network security config
└── PRD.md / DISTRO.md          # spek & panduan distro
```

## 🔧 Format Commit

`feat:`, `fix:`, `docs:`, `style:`, `refactor:`, `test:`, `chore:` — pesan ringkas Indonesia/English.

## 🔐 Keamanan

- API key & PAT di EncryptedSharedPreferences (tidak plaintext)
- SSRF guard + validasi redirect di `web_fetch`, allowlist + timeout + cap output di `run_command`, JS mati di preview file
- Backup sistem mengecualikan index chat & workspace; AI dilarang meminta/mencetak token

## 📄 License

MIT License.

---

**Made with ❤️ by Arka Team**
