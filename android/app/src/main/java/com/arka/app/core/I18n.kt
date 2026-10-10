package com.arka.app.core

// Faithful port of src/i18n.ts (194 keys x id/en).
enum class ArkaLanguage { ID, EN }

object Key {
    // Sidebar
    const val CHAT = "chat"
    const val AGENTS = "agents"
    const val FILES = "files"
    const val SKILLS = "skills"
    const val GITHUB = "github"
    const val SETTINGS = "settings"
    const val SESSIONS = "sessions"
    const val NEW_SESSION = "newSession"
    const val NO_SESSIONS = "noSessions"
    const val ACTIVE_PROVIDERS = "activeProviders"

    // Chat
    const val CHAT_NEW = "chatNew"
    const val SELECT_MODEL = "selectModel"
    const val DEFAULT_MODELS = "defaultModels"
    const val YOUR_PROVIDERS = "yourProviders"
    const val SETUP_PROVIDER = "setupProvider"
    const val NO_PROVIDER_ACTIVE = "noProviderActive"
    const val OPEN_SETTINGS = "openSettings"
    const val GREETING = "greeting"
    const val GREETING_DESC = "greetingDesc"
    const val ASK_ABOUT_CODE = "askAboutCode"
    const val ARKA_DISCLAIMER = "arkaDisclaimer"

    // Quick prompts
    const val CREATE_REACT_PROJECT = "createReactProject"
    const val DEBUG_CODE = "debugCode"
    const val EXPLAIN_CODE = "explainCode"
    const val OPTIMIZE_PERFORMANCE = "optimizePerformance"

    // Settings
    const val AI_PROVIDERS = "aiProviders"
    const val ACTIVE = "active"
    const val NOT_CONFIGURED = "notConfigured"
    const val EDIT = "edit"
    const val APPEARANCE = "appearance"
    const val THEME = "theme"
    const val LIGHT = "light"
    const val DARK = "dark"
    const val AUTO = "auto"
    const val FONT_SIZE = "fontSize"
    const val SMALL = "small"
    const val MEDIUM = "medium"
    const val LARGE = "large"
    const val LANGUAGE = "language"
    const val INDONESIAN = "indonesian"
    const val ENGLISH = "english"
    const val ABOUT = "about"
    const val ABOUT_DESC = "aboutDesc"

    // Provider edit
    const val API_KEY = "apiKey"
    const val BASE_URL = "baseUrl"
    const val MODEL = "model"
    const val AUTO_DETECT = "autoDetect"
    const val MANUAL = "manual"
    const val DETECT_MODELS = "detectModels"
    const val DETECTING_MODELS = "detectingModels"
    const val MODELS_FOUND = "modelsFound"
    const val SAVE = "save"

    // GitHub
    const val CONNECT_GITHUB = "connectGithub"
    const val USE_TOKEN = "useToken"
    const val PERSONAL_ACCESS_TOKEN = "personalAccessToken"
    const val TOKEN_SCOPES = "tokenScopes"
    const val CONNECT = "connect"
    const val HOW_TO_CREATE_TOKEN = "howToCreateToken"
    const val CONNECTED = "connected"
    const val DISCONNECT = "disconnect"
    const val REPOSITORIES = "repositories"
    const val PUSH_TO = "pushTo"
    const val BRANCH = "branch"
    const val COMMIT_MESSAGE = "commitMessage"
    const val PUSH_CHANGES = "pushChanges"
    const val PUSHING = "pushing"
    const val PUSH_SUCCESS = "pushSuccess"
    const val PUSH_FAILED = "pushFailed"

    // Skills
    const val SKILL_STORE = "skillStore"
    const val INSTALLED = "installed"
    const val AVAILABLE = "available"
    const val INSTALL_FROM_URL = "installFromUrl"
    const val SEARCH_SKILLS = "searchSkills"
    const val ALL = "all"
    const val INSTALL = "install"
    const val INSTALLING = "installing"
    const val UNINSTALL = "uninstall"
    const val CONFIGURE = "configure"
    const val NO_SKILLS_FOUND = "noSkillsFound"
    const val CHANGE_FILTERS = "changeFilters"

    // Agents
    const val AGENT_LIST = "agentList"
    const val CREATE_AGENT = "createAgent"
    const val NO_AGENTS = "noAgents"
    const val CREATE_FIRST_AGENT = "createFirstAgent"

    // Files
    const val WORKSPACE = "workspace"
    const val SELECT_FILE = "selectFile"
    const val CHOOSE_FOLDER = "chooseFolder"
    const val SEARCH_FILE = "searchFile"
    const val NO_FILE_SELECTED = "noFileSelected"
    const val SELECT_FROM_TREE = "selectFromTree"

    // Common
    const val CANCEL = "cancel"
    const val CONFIRM = "confirm"
    const val DELETE = "delete"
    const val CLOSE = "close"
    const val LOADING = "loading"
    const val ERROR = "error"
    const val SUCCESS = "success"

    // Arka-specific (beyond i18n.ts, used by tool loops & exec)
    const val STOPPED_BY_USER = "stoppedByUser"
    const val APPROVE = "approve"
    const val REJECT = "reject"
    const val ALLOW_ALL = "allowAll"
    const val AUTO_APPROVE_SECTION = "autoApproveSection"
    const val AUTO_APPROVE_DESC = "autoApproveDesc"
    const val TOOL_APPROVAL_TITLE = "toolApprovalTitle"
    const val EXEC_SERVER_URL = "execServerUrl"
    const val EXEC_TEST = "execTest"
    const val EXEC_CONNECTED = "execConnected"
    const val EXEC_FAILED = "execFailed"
    const val MEMORY_SECTION = "memorySection"
    const val PLACEHOLDER_TOOL_INPUT = "placeholderToolInput"

    // UI tambahan (beyond i18n.ts)
    const val PRD = "prd"
    const val TYPING = "typing"
    const val FILE_TOO_LARGE = "fileTooLarge"
    const val FAILED_READ_FILE = "failedReadFile"
    // GitHub panel
    const val NEW_REPO = "newRepo"
    const val SELECT_REPO = "selectRepo"
    const val SEARCH_REPO = "searchRepo"
    const val PUSH_FILES = "pushFiles"
    const val SELECT_ALL = "selectAll"
    const val CLEAR = "clear"
    const val RELOAD_FILES = "reloadFiles"
    const val WORKING = "working"
    const val CONNECT_ACCOUNT = "connectAccount"
    const val TARGET_BRANCH = "targetBranch"
    const val EXPORT = "export"
    const val IMPORT = "import"
    const val RELOAD = "reload"
    const val DISCARD = "discard"
    const val CONNECTED_SHORT = "connectedShort"
    // Skills
    const val INSTALL_FROM_GITHUB = "installFromGithub"
    const val READ = "read"
    const val DETAIL = "detail"
    const val INSTALLED_TITLE = "installedTitle"
    const val NO_SKILLS_INSTALLED = "noSkillsInstalled"
    const val RESYNC = "resync"
    const val REMOVE = "remove"
    const val BUILTIN_CATALOG = "builtinCatalog"
}

object I18n {
    private val id: Map<String, String> = mapOf(
        // Sidebar
        Key.CHAT to "Chat", Key.AGENTS to "Agen", Key.FILES to "File", Key.SKILLS to "Skill",
        Key.GITHUB to "GitHub", Key.SETTINGS to "Pengaturan", Key.SESSIONS to "Sesi",
        Key.NEW_SESSION to "Sesi Baru", Key.NO_SESSIONS to "Belum ada sesi. Mulai chat baru!",
        Key.ACTIVE_PROVIDERS to "provider aktif",
        // Chat
        Key.CHAT_NEW to "Chat Baru", Key.SELECT_MODEL to "Pilih Model AI", Key.DEFAULT_MODELS to "Model Default",
        Key.YOUR_PROVIDERS to "Provider Anda", Key.SETUP_PROVIDER to "⚙️ Setup Provider di Settings",
        Key.NO_PROVIDER_ACTIVE to "Belum ada provider aktif", Key.OPEN_SETTINGS to "Buka Settings untuk setup",
        Key.GREETING to "Halo! Saya Arka",
        Key.GREETING_DESC to "Coding agent siap membantu Anda menulis, debug, dan memahami kode. Pilih prompt cepat atau ketik pertanyaan Anda.",
        Key.ASK_ABOUT_CODE to "Tanyakan sesuatu tentang kode...",
        Key.ARKA_DISCLAIMER to "Arka bisa membuat kesalahan. Periksa informasi penting.",
        // Quick prompts
        Key.CREATE_REACT_PROJECT to "Buat project React baru", Key.DEBUG_CODE to "Debug kode ini",
        Key.EXPLAIN_CODE to "Jelaskan kode", Key.OPTIMIZE_PERFORMANCE to "Optimasi performa",
        // Settings
        Key.AI_PROVIDERS to "AI Providers", Key.ACTIVE to "Aktif", Key.NOT_CONFIGURED to "Belum dikonfigurasi",
        Key.EDIT to "Edit", Key.APPEARANCE to "Tampilan", Key.THEME to "Tema",
        Key.LIGHT to "Light", Key.DARK to "Dark", Key.AUTO to "Auto", Key.FONT_SIZE to "Ukuran Font",
        Key.SMALL to "Kecil", Key.MEDIUM to "Sedang", Key.LARGE to "Besar", Key.LANGUAGE to "Bahasa",
        Key.INDONESIAN to "Bahasa Indonesia", Key.ENGLISH to "English", Key.ABOUT to "Tentang",
        Key.ABOUT_DESC to "AI-powered coding agent yang mendukung berbagai provider. Tulis kode, debug, dan deploy dengan bantuan AI.",
        // Provider edit
        Key.API_KEY to "API Key", Key.BASE_URL to "Base URL", Key.MODEL to "Model", Key.AUTO_DETECT to "Auto-Detect",
        Key.MANUAL to "Manual", Key.DETECT_MODELS to "Deteksi Model Otomatis", Key.DETECTING_MODELS to "Mendeteksi Model...",
        Key.MODELS_FOUND to "model ditemukan", Key.SAVE to "Simpan",
        // GitHub
        Key.CONNECT_GITHUB to "Hubungkan GitHub", Key.USE_TOKEN to "Gunakan Personal Access Token",
        Key.PERSONAL_ACCESS_TOKEN to "Personal Access Token", Key.TOKEN_SCOPES to "Token membutuhkan scope:",
        Key.CONNECT to "Hubungkan", Key.HOW_TO_CREATE_TOKEN to "Cara membuat token:",
        Key.CONNECTED to "Terhubung ke GitHub", Key.DISCONNECT to "Putuskan", Key.REPOSITORIES to "Repositories",
        Key.PUSH_TO to "Push ke", Key.BRANCH to "Branch", Key.COMMIT_MESSAGE to "Commit Message",
        Key.PUSH_CHANGES to "Push Changes", Key.PUSHING to "Pushing...", Key.PUSH_SUCCESS to "Berhasil di-push!",
        Key.PUSH_FAILED to "Gagal push. Periksa koneksi dan token.",
        // Skills
        Key.SKILL_STORE to "Skill Store", Key.INSTALLED to "terinstall", Key.AVAILABLE to "tersedia",
        Key.INSTALL_FROM_URL to "Install dari URL", Key.SEARCH_SKILLS to "Cari skill...", Key.ALL to "Semua",
        Key.INSTALL to "Install", Key.INSTALLING to "Installing...", Key.UNINSTALL to "Uninstall",
        Key.CONFIGURE to "Configure", Key.NO_SKILLS_FOUND to "Tidak ada skill yang ditemukan",
        Key.CHANGE_FILTERS to "Coba ubah filter atau kata kunci",
        // Agents
        Key.AGENT_LIST to "Daftar Agen", Key.CREATE_AGENT to "Buat Agen", Key.NO_AGENTS to "Belum ada agen",
        Key.CREATE_FIRST_AGENT to "Buat agen pertama Anda",
        // Files
        Key.WORKSPACE to "Workspace", Key.SELECT_FILE to "Pilih file untuk melihat", Key.CHOOSE_FOLDER to "Pilih Folder",
        Key.SEARCH_FILE to "Cari file...", Key.NO_FILE_SELECTED to "Tidak ada file yang dipilih",
        Key.SELECT_FROM_TREE to "Pilih file dari tree di samping",
        // Common
        Key.CANCEL to "Batal", Key.CONFIRM to "Konfirmasi", Key.DELETE to "Hapus", Key.CLOSE to "Tutup",
        Key.LOADING to "Memuat...", Key.ERROR to "Error", Key.SUCCESS to "Berhasil",
        // Arka-specific
        Key.STOPPED_BY_USER to "⏹️ Dihentikan oleh pengguna.",
        Key.APPROVE to "Izinkan", Key.REJECT to "Tolak",
        Key.ALLOW_ALL to "Izinkan Semua", Key.AUTO_APPROVE_SECTION to "Otorisasi Tool",
        Key.AUTO_APPROVE_DESC to "Setujui semua tool sensitif otomatis tanpa prompt",
        Key.TOOL_APPROVAL_TITLE to "Persetujuan yang diminta untuk tool berikut:",
        Key.EXEC_SERVER_URL to "Exec Server URL", Key.EXEC_TEST to "Test Koneksi",
        Key.EXEC_CONNECTED to "Terhubung", Key.EXEC_FAILED to "Gagal terhubung",
        Key.MEMORY_SECTION to "Memory", Key.PLACEHOLDER_TOOL_INPUT to "Menjalankan tool...",
        // UI tambahan
        Key.PRD to "PRD", Key.TYPING to "Arka sedang mengetik...",
        Key.FILE_TOO_LARGE to "File terlalu besar (maksimal 15 MB)",
        Key.FAILED_READ_FILE to "Gagal membaca file",
        Key.NEW_REPO to "Repo baru", Key.SELECT_REPO to "Pilih repository",
        Key.SEARCH_REPO to "Cari repo…", Key.PUSH_FILES to "Push file workspace",
        Key.SELECT_ALL to "Pilih semua", Key.CLEAR to "Kosongkan",
        Key.RELOAD_FILES to "Muat ulang file", Key.WORKING to "Bekerja…",
        Key.CONNECT_ACCOUNT to "Hubungkan akun",
        Key.TARGET_BRANCH to "Branch tujuan (bisa diketik manual)",
        Key.EXPORT to "Ekspor", Key.IMPORT to "Impor", Key.RELOAD to "Muat ulang",
        Key.DISCARD to "Buang", Key.CONNECTED_SHORT to "Terhubung",
        Key.INSTALL_FROM_GITHUB to "Pasang dari GitHub", Key.READ to "Baca",
        Key.DETAIL to "Detail", Key.INSTALLED_TITLE to "Terpasang",
        Key.NO_SKILLS_INSTALLED to "Belum ada skill terpasang.",
        Key.RESYNC to "Sinkron ulang", Key.REMOVE to "Lepas",
        Key.BUILTIN_CATALOG to "Katalog bawaan (prompt-only)",
    )

    private val en: Map<String, String> = mapOf(
        // Sidebar
        Key.CHAT to "Chat", Key.AGENTS to "Agents", Key.FILES to "Files", Key.SKILLS to "Skills",
        Key.GITHUB to "GitHub", Key.SETTINGS to "Settings", Key.SESSIONS to "Sessions",
        Key.NEW_SESSION to "New Session", Key.NO_SESSIONS to "No sessions yet. Start a new chat!",
        Key.ACTIVE_PROVIDERS to "active providers",
        // Chat
        Key.CHAT_NEW to "New Chat", Key.SELECT_MODEL to "Select AI Model", Key.DEFAULT_MODELS to "Default Models",
        Key.YOUR_PROVIDERS to "Your Providers", Key.SETUP_PROVIDER to "⚙️ Setup Provider in Settings",
        Key.NO_PROVIDER_ACTIVE to "No active providers", Key.OPEN_SETTINGS to "Open Settings to setup",
        Key.GREETING to "Hello! I'm Arka",
        Key.GREETING_DESC to "Coding agent ready to help you write, debug, and understand code. Choose a quick prompt or type your question.",
        Key.ASK_ABOUT_CODE to "Ask something about code...",
        Key.ARKA_DISCLAIMER to "Arka can make mistakes. Verify important information.",
        // Quick prompts
        Key.CREATE_REACT_PROJECT to "Create new React project", Key.DEBUG_CODE to "Debug this code",
        Key.EXPLAIN_CODE to "Explain code", Key.OPTIMIZE_PERFORMANCE to "Optimize performance",
        // Settings
        Key.AI_PROVIDERS to "AI Providers", Key.ACTIVE to "Active", Key.NOT_CONFIGURED to "Not configured",
        Key.EDIT to "Edit", Key.APPEARANCE to "Appearance", Key.THEME to "Theme",
        Key.LIGHT to "Light", Key.DARK to "Dark", Key.AUTO to "Auto", Key.FONT_SIZE to "Font Size",
        Key.SMALL to "Small", Key.MEDIUM to "Medium", Key.LARGE to "Large", Key.LANGUAGE to "Language",
        Key.INDONESIAN to "Bahasa Indonesia", Key.ENGLISH to "English", Key.ABOUT to "About",
        Key.ABOUT_DESC to "AI-powered coding agent supporting multiple providers. Write code, debug, and deploy with AI assistance.",
        // Provider edit
        Key.API_KEY to "API Key", Key.BASE_URL to "Base URL", Key.MODEL to "Model", Key.AUTO_DETECT to "Auto-Detect",
        Key.MANUAL to "Manual", Key.DETECT_MODELS to "Auto-Detect Models", Key.DETECTING_MODELS to "Detecting Models...",
        Key.MODELS_FOUND to "models found", Key.SAVE to "Save",
        // GitHub
        Key.CONNECT_GITHUB to "Connect GitHub", Key.USE_TOKEN to "Use Personal Access Token",
        Key.PERSONAL_ACCESS_TOKEN to "Personal Access Token", Key.TOKEN_SCOPES to "Token requires scopes:",
        Key.CONNECT to "Connect", Key.HOW_TO_CREATE_TOKEN to "How to create token:",
        Key.CONNECTED to "Connected to GitHub", Key.DISCONNECT to "Disconnect", Key.REPOSITORIES to "Repositories",
        Key.PUSH_TO to "Push to", Key.BRANCH to "Branch", Key.COMMIT_MESSAGE to "Commit Message",
        Key.PUSH_CHANGES to "Push Changes", Key.PUSHING to "Pushing...", Key.PUSH_SUCCESS to "Successfully pushed!",
        Key.PUSH_FAILED to "Push failed. Check connection and token.",
        // Skills
        Key.SKILL_STORE to "Skill Store", Key.INSTALLED to "installed", Key.AVAILABLE to "available",
        Key.INSTALL_FROM_URL to "Install from URL", Key.SEARCH_SKILLS to "Search skills...", Key.ALL to "All",
        Key.INSTALL to "Install", Key.INSTALLING to "Installing...", Key.UNINSTALL to "Uninstall",
        Key.CONFIGURE to "Configure", Key.NO_SKILLS_FOUND to "No skills found",
        Key.CHANGE_FILTERS to "Try changing filters or keywords",
        // Agents
        Key.AGENT_LIST to "Agent List", Key.CREATE_AGENT to "Create Agent", Key.NO_AGENTS to "No agents yet",
        Key.CREATE_FIRST_AGENT to "Create your first agent",
        // Files
        Key.WORKSPACE to "Workspace", Key.SELECT_FILE to "Select a file to view", Key.CHOOSE_FOLDER to "Choose Folder",
        Key.SEARCH_FILE to "Search file...", Key.NO_FILE_SELECTED to "No file selected",
        Key.SELECT_FROM_TREE to "Select a file from the tree on the left",
        // Common
        Key.CANCEL to "Cancel", Key.CONFIRM to "Confirm", Key.DELETE to "Delete", Key.CLOSE to "Close",
        Key.LOADING to "Loading...", Key.ERROR to "Error", Key.SUCCESS to "Success",
        // Arka-specific
        Key.STOPPED_BY_USER to "⏹️ Stopped by user.",
        Key.APPROVE to "Allow", Key.REJECT to "Reject",
        Key.ALLOW_ALL to "Allow All", Key.AUTO_APPROVE_SECTION to "Tool Authorization",
        Key.AUTO_APPROVE_DESC to "Auto-approve all sensitive tools without prompting",
        Key.TOOL_APPROVAL_TITLE to "Approval requested for tool:",
        Key.EXEC_SERVER_URL to "Exec Server URL", Key.EXEC_TEST to "Test Connection",
        Key.EXEC_CONNECTED to "Connected", Key.EXEC_FAILED to "Failed to connect",
        Key.MEMORY_SECTION to "Memory", Key.PLACEHOLDER_TOOL_INPUT to "Running tool...",
        // UI tambahan
        Key.PRD to "PRD", Key.TYPING to "Arka is typing...",
        Key.FILE_TOO_LARGE to "File too large (max 15 MB)",
        Key.FAILED_READ_FILE to "Failed to read file",
        Key.NEW_REPO to "New repo", Key.SELECT_REPO to "Select repository",
        Key.SEARCH_REPO to "Search repos…", Key.PUSH_FILES to "Push workspace files",
        Key.SELECT_ALL to "Select all", Key.CLEAR to "Clear",
        Key.RELOAD_FILES to "Reload files", Key.WORKING to "Working…",
        Key.CONNECT_ACCOUNT to "Connect account",
        Key.TARGET_BRANCH to "Target branch (can type manually)",
        Key.EXPORT to "Export", Key.IMPORT to "Import", Key.RELOAD to "Reload",
        Key.DISCARD to "Discard", Key.CONNECTED_SHORT to "Connected",
        Key.INSTALL_FROM_GITHUB to "Install from GitHub", Key.READ to "Read",
        Key.DETAIL to "Detail", Key.INSTALLED_TITLE to "Installed",
        Key.NO_SKILLS_INSTALLED to "No skills installed.",
        Key.RESYNC to "Resync", Key.REMOVE to "Remove",
        Key.BUILTIN_CATALOG to "Built-in catalog (prompt-only)",
    )

    fun t(lang: ArkaLanguage, key: String): String {
        val table = if (lang == ArkaLanguage.ID) id else en
        return table[key] ?: id[key] ?: key
    }
}