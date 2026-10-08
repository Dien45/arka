# PRD — Arka Android (Native, Kotlin + Jetpack Compose)

> Status: **Disetujui** (08 Okt 2026) · **M0–M9 selesai, M10 (uji perangkat) berjalan**
> Repo: `Dien45/arka` — folder `android/` (satu repo, web + android berjalan bersama)

## 1. Ringkasan

Port aplikasi **Arka – AI Coding Agent** (React web, `C:\Users\Dien\Desktop\opencode\arka`) menjadi
aplikasi **Android native** — seluruh UI memakai **Jetpack Compose**, **bukan WebView wrapper**.
Web app dipertahankan; Android adalah target baru di subfolder `android/` dalam repo yang sama.

## 2. Tujuan & Non-Tujuan

**Tujuan**
- Aplikasi Android asli dengan paritas fitur inti: chat, multi-provider AI, tools, memori, settings.
- Satu-satunya backend web (`server.js`) **tidak ikut di-port ke device**: `run_command` memakai
  `Runtime.exec` native, dengan gate persetujuan & allowlist yang sama seperti web.
- Sekuritas setara web: secrets via **EncryptedSharedPreferences** (MVP); vault berbasis
  **Android Keystore** sebagai fase lanjutan.

**Non-tujuan (MVP)**
- Bukan bagian MVP: File explorer, GitHub integration, Skill Store, PRD generator, vault/Unlock.
- Tanpa akun/sync; semua data lokal di device (persistence paritas dengan web: localStorage → storage lokal).

## 3. Batasan Platform

- **minSdk 26** (Android 8.0), target phone + tablet.
- Kotlin 2.x + Jetpack Compose (Material 3).
- Jaringan: **OkHttp + kotlinx.serialization**; async: **Coroutines / Flow**.
- Tidak ada dependensi berat yang tak terpakai (pelajaran dari 9 package `unused` di web).
- Izin `INTERNET`; `cleartextTrafficPermitted` diizinkan **per-host** (Ollama LAN, custom HTTP).

## 4. Scope MVP

**Layar (2):**

1. **Chat**
   - Sesi: buat, ganti, rename, hapus (hapus sesi menghapus workspace-nya).
   - Mode chat: `plan` / `build` / `agent` (`PLAN_MODE_ALLOWED_TOOLS` dipertahankan).
   - Model switcher: 3 default model + provider model hasil auto-detect.
   - Input bar + **Stop** (membatalkan job yang berjalan, menampilkan `⏹️ Dihentikan oleh pengguna.`).
   - **Approval card** untuk tool sensitif (Izinkan / Tolak), cepat & tersimpan per tool call.
   - Render **markdown**; tool-call card; loading per-sesi (`loadingSessionIds`).
   - Auto-continue saat `finishReason = length` (cap `MAX_AUTO_CONTINUES_AGENT_MODE`).
   - Attachment sebagai text-code-block (opsional; file picker SAF).

2. **Settings**
   - Provider cards + edit modal: API key, Base URL, Model, Auto-Detect (`fetchModelsFromProvider`).
   - Command Execution URL (default `http://localhost:3399/exec`) + Test Koneksi.
     > Pada Android backend HTTP diganti eksekusi native — lihat §6 (tools). Field URL
     > tetap ada untuk kompatibilitas skema config, tapi eksekusi default memakai `Runtime.exec`.
   - Memory browser (list, pakai %, tambah/edit/hapus/clear).
   - Bahasa (id/en), Tema (light/dark/auto), Font size (small/medium/large).
   - About.

**Tools (8, sama dengan web):** `web_fetch` (SSRF guard), `web_search`, `read_file`, `write_file`,
`list_files`, `stage_commit` (stub sampai GitHub hadir), `run_command` (→ `Runtime.exec`),
`memory`. **5 sensitif** tetap wajib persetujuan: `web_fetch`, `write_file`, `stage_commit`,
`run_command`, `memory`.

**AI providers (7):** openai, anthropic, google, groq, openrouter (header `HTTP-Referer` →
 nilai statis `https://arka.app` atau diabaikan), **ollama** (default URL **kosong** — user isi URL
LAN saat pakai Ollama di device), custom (OpenAI-compatible).

**Persistence (mapping localStorage → Android):**

| Key web | Android |
|---|---|
| `arka-state` (plaintext) | DataStore Preferences (`state.json`) |
| `arka-vault-*` | backlog (vault) |
| `arka-virtual-files::<session>` (+ legacy) | File JSON per sesi di app-private dir |
| `arka-patch-checkpoint::<session>` | File JSON per sesi |
| `arka-memory` | File JSON / DataStore |
| `arka-staged-commits` | DataStore Preferences |
| `arka-skills`, `arka-custom-skills`, `arka-skill-configs` | backlog (skills) |
| `arka-prds` | backlog (PRD) |
| `arka-language`, `arka-selected-model`, `arka-selected-provider`, `arka-chat-mode`, `arka-exec-url`, `arka-theme`, `arka-font-size` | DataStore Preferences |
| API keys, GitHub PAT (di `arka-state`/vault) | **EncryptedSharedPreferences** |

## 5. Backlog (setelah MVP)

- FileExplorer: file tree native + tabs editor + preview Markdown/SVG/CSV native.
  **HTML preview** — keputusan terpisah: WebView hanya sebagai *renderer konten satu file*
  (wadah UI tetap native Compose). File tree 100% native.
- GitHub integration: connect PAT, repo picker, push Git Data API, SyncManifest export/import (SAF).
- Skill Store: katalog 13 skill + install/config modal + "Install dari URL".
- PRD generator: prompt 11-section + save/copy/share (SAF/clipboard).
- Vault terenkripsi (PBKDF2/AES-GCM via Keystore) + layar Unlock.
- Sessions view khusus (web meletakkan sesi di sidebar — port langsung di sidebar navigasi).
- Release-signed APK + rilis via GitHub tag `v*`.

## 6. Arsitektur & Peta Porting

| Web (React/TS) | Android (Kotlin + Compose) |
|---|---|
| `store.tsx` reducer + Context | `Store` + `StateFlow` + `reduce()` |
| `aiService.ts` (7 provider adapter) | `AiClient` OkHttp + serializers + `callAIProviderFull()` (auto-continue) |
| `textToolCallParser.ts` (`[TOOL_CALL:name] {json}` + `<parameter=key>`) | Port parser apa adanya |
| `tools.ts` (deskriptor + run + approval) | `Tool` registry + `ToolContext` + approval contract |
| `run_command` (POST localhost) | `Runtime.exec` native (Coroutines), timeout 15s, output cap 200KB, allowlist `ARKA_EXEC_ALLOW` |
| `web_fetch` SSRF guard | Port guard (blokir private/link-local/loopback/metadata IP + cap ukuran) |
| `virtualFs` / `memorySystem` | Storage file JSON per sesi; caps chars 2200 / 1375 (persis) |
| `secureVault` (WebCrypto PBKDF2/AES-GCM) | EncryptedSharedPreferences (MVP) → Keystore (backlog) |
| `CustomEvent` bus (`virtual-files-updated`, `arka-memory-updated`, dll) | `SharedFlow` per domain |
| `i18n.ts` (194 keys × id/en) | `strings.xml` (id + en) — di-*generate* dari `i18n.ts` |
| Tailwind `#7c9cbf`, `#5a7fa0`, `#b8c9db`, `#f0f4f8` dll | Compose `ColorScheme` (light + dark) |
| Chat `AbortController` per sesi | `Job` per sesi (`Map<sessionId, Job>`) |
| Views selalu mounted (`hidden`) | Navigasi state-based; kerja background via `ViewModel` (tidak terbuang saat pindah layar) |

## 7. Sekuritas

- **Approval gate** untuk 5 tool sensitif — wajib tap Izinkan/Tolak (paritas dengan web).
- **Secrets tidak pernah plaintext** di storage biasa.
- **`web_fetch` SSRF guard**: hanya `http/https`, blokir IP private/link-local/loopback/cloud-metadata,
  cap ukuran respons.
- **`run_command`**: allowlist + timeout 15s + output cap 200KB + gate; tidak pernah mengeksekusi
  string model tanpa persetujuan.
- **Network security config**: cleartext per-host tertentu saja (Ollama/custom), selainnya HTTPS.

## 8. Kriteria Penerimaan (MVP DoD)

- `./gradlew assembleDebug` sukses di lokal **dan** di CI (GitHub Actions).
- Chat: loop tool call bekerja untuk **openai** dan **google** (2 adapter diverifikasi; sisanya
  menurun dari adapter yang sama).
- Stop & auto-continue (`finishReason=length`) bekerja.
- `run_command` mengeksekusi command nyata via `Runtime.exec` + gate approval + timeout + allowlist.
- Sesi, provider config, memory, preferensi bertahan setelah app di-*kill*.
- Bahasa id/en sesuai `i18n.ts`; tema light/dark/auto.
- APK debug dapat dipasang di emulator/device API ≥ 26.
- Commit workflow CI `android.yml`; push `main` menghasilkan APK artifact.

## 9. Deployment (GitHub)

- Satu repo **Dien45/arka**: web (Pages via `build.yml` yang sudah ada) + `android/` (native).
- Workflow baru **`.github/workflows/android.yml`** (additif):
  - Trigger: `push` ke `main` + `workflow_dispatch`.
  - Steps: `actions/checkout@v4` → `gradle/actions/setup-gradle@v4` (cache) →
    setup **JDK 21** → `./gradlew assembleDebug` di `android/` →
    `actions/upload-artifact@v4` (APK).
  - **Belum ada signing/release** — diputuskan: "CI saja, rilis belakangan".
  - Backlog: `assembleRelease` + signing via secrets (`KEYSTORE_BASE64`, dll) + `action-gh-release`
    saat tag `v*`.
- `gradle/wrapper` + `gradlew` di-commit agar CI reproduksibel.

## 10. Milestone

- **M0** Scaffold Gradle (`android/`): Kotlin 2.x + Compose BOM, minSdk 26, tema, navigasi,
        `strings.xml` hasil generate.
- **M1** Core: types, Store/StateFlow, persistence (DataStore + EncryptedSharedPreferences), i18n.
- **M2** Networking: 7 provider + model fetch + `web_fetch`/SSRF + `web_search`.
- **M3** Chat UI: tool loop, approval, Stop, auto-continue, markdown, sesi.
- **M4** Settings UI: provider modal, exec config + `Runtime.exec`, memory browser, bahasa, tema.
- **M5** CI `android.yml` (debug APK on push).
- **M6** Hardening + security review + verifikasi `assembleDebug` lokal → commit → push (CI build).

## 11. Risiko

- **HTML preview** (backlog) satu-satunya fitur yang menuntut WebView sebagai renderer konten satu
  file — keputusan ditunda, **tidak memblokir MVP**.
- Perubahan shape API provider → adapter diturunkan dari `aiService.ts` (satu sumber kebenaran).
- `Runtime.exec` di sandbox Android dibatasi per-UID; sebagian command (mis. yang butuh root)
  tidak akan jalan → ditulis eksplisit di Settings.
- Effort estimasi: ±3.500–4.500 baris Kotlin (setara ~9.4K baris TS; UI web 5.9K baris → Compose).
- Waktu build Gradle pertama (download dependencies) panjang di CI → memakai caching.

## 12. Definisi

- **Sensitive tool**: tool yang butuh persetujuan pengguna (Izinkan/Tolak) sebelum dieksekusi.
- **Virtual FS**: map path → {content, modified, size}, diisolasi per sesi.
- **`Runtime.exec`**: eksekusi proses shell di sandbox aplikasi Android.

---

**Disetujui oleh:** Dien

---

## 13. Status Implementasi (update 08 Okt 2026)

### Selesai (M0–M5, sebelumnya)

Scaffold Gradle + tema, Core types/Store/Persistence (DataStore +
EncryptedSharedPreferences), i18n id/en, 7 adapter provider + model fetch,
`web_fetch` (SSRF guard) + `web_search`, Chat UI (tool loop, approval, Stop,
auto-continue, markdown, sesi), Settings UI, `Runtime.exec` lokal, CI APK debug.

### Selesai di iterasi ini (M6–M9)

**M6 — Perbaikan scan/daftar model** (`core/ModelScan.kt`, `ui/ModelPicker.kt`,
`ui/ProvidersSheet.kt`, `core/Store.kt`)

- Bug ditemukan & diperbaiki: `onPickModel` lama mengirim
  `models = detectedModels[provider.id]` **setelah** map itu dikosongkan, sehingga
  memilih model menghapus seluruh hasil scan → user selalu berakhir mengetik model
  manual. Sekarang semua perubahan provider lewat `Store.updateProvider(id) { … }`
  yang membaca state terkini.
- Model picker baru di Chat: pencarian penuh (bukan 20 entri pertama), pengelompokan
  per provider, daftar bisa di-scan ulang per provider, tombol "Scan ulang semua",
  dan jalan manual untuk model id baru.
- Auto-scan saat sheet dibuka / provider di-expand untuk provider yang sudah punya
  kredensial tapi daftar modelnya kosong/basi (> 12 jam).
- Hasil scan (termasuk pesan error terakhir, `modelsError`) tersimpan di state →
  persist ke DataStore, tidak perlu scan ulang tiap buka aplikasi.

**M7 — Workspace nyata di disk + File Explorer** (`core/VirtualFs.kt`,
`core/Zip.kt`, `ui/FileExplorerScreen.kt`)

- Perubahan arsitektur: workspace sesi bukan lagi satu blob JSON in-memory, tapi folder
  nyata `<filesDir>/sessions/<sid>/workspace`. Data JSON lama dimigrasi otomatis.
- Efeknya: `write_file` (AI), File Explorer, `run_command` (cwd), dan bind mount
  `/root/workspace` di distro **memakai file yang sama** — di web keduanya sempat
  terpisah (virtual FS vs folder asli).
- File Explorer native: pohon folder, tab file, editor, preview
  (Markdown/SVG/HTML via WebView dengan `blockNetworkLoads`, CSV sebagai tabel),
  buat file/folder, rename, hapus, impor ZIP/file, unduh ZIP.

**M8 — Backend exec + distro Alpine (proot)** (`core/ExecRunner.kt`,
`core/DistroManager.kt`, `core/ExecSettings.kt`, `ui/DistroSettings.kt`,
task Gradle `downloadProotBinaries`)

- Bug diperbaiki: shell lama dipanggil sebagai `/bin/sh` yang **tidak ada di Android**
  (shell-nya `/system/bin/sh`) → `run_command` selalu gagal "Cannot run program".
  Sekarang shell dideteksi, cwd = folder workspace sesi, env PATH/HOME/TMPDIR diisi.
- Dua backend: **native** (`/system/bin/sh`, selalu siap) dan **proot/Alpine**
  (userland Linux lengkap tanpa root: `apk`, `git`, `python3`, `node`).
- Binary proot dibundel via jniLibs (Android 10+ melarang exec dari folder data
  aplikasi), diunduh saat build dari paket Termux — repo tetap bebas binary.
  Rootfs Alpine diunduh sekali dari Settings (atau impor `.tar.gz`), plus tombol
  "Tes distro" untuk diagnostik. Detail: `android/DISTRO.md`.

**M9 — File Explorer/PRD/Skills/GitHub + navigasi** (`ui/PrdScreen.kt`,
`core/Prd.kt`, `ui/SkillStoreScreen.kt`, `core/Skills.kt`, `net/GitHubApi.kt`,
`ui/GitHubScreen.kt`, `ui/ArkaRoot.kt`)

- **Skill Store**: katalog 13 skill, install/buang, pilih mode per skill, dan
  "Install dari URL" (repo GitHub dengan `skill.json`/`prompt.md`) — konten pihak
  ketiga diberi pembungkus anti prompt-injection seperti versi web. Skill aktif
  disuntik ke system prompt (`SkillsManager.enhancementBlock()`).
- **PRD generator**: prompt 11 bagian yang sama, arsip dokumen, revisi lanjutan,
  salin, bagikan (Intent), simpan ke workspace (`prd/*.md`) supaya bisa langsung di-push.
- **GitHub**: hubungkan PAT (tersimpan terenkripsi), daftar repo + pencarian,
  pilih branch, buat repo baru, push file workspace terpilih lewat Git Data API
  (blob → tree → commit → ref, sama seperti `githubApi.ts`), push "Staged AI Commits",
  serta ekspor/impor SyncManifest lewat SAF. Peringatan scope token berlebih ikut diport.
- **Navigasi**: drawer (Chat, Workspace, PRD, Skills, GitHub, Pengaturan) + bottom bar
  5 tujuan utama; ChatController hidup di root sehingga pekerjaan AI & approval tidak
  hilang saat pindah layar.

### Backlog berikutnya

- Vault terenkripsi (PBKDF2/AES-GCM via Keystore) + layar Unlock (sekarang masih
  EncryptedSharedPreferences).
- Agent panel native (3 agent default sudah ada di state, belum ada UI-nya).
- Uji di perangkat nyata untuk proot (diagnostik sudah tersedia di Settings).
- Rilis bertanda tangan + `action-gh-release` (workflow `android-release.yml` sudah ada,
  tinggal mengisi secret).
