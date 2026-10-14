package com.arka.app.core

import android.content.Context
import android.content.SharedPreferences
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

private val Context.appDataStore by preferencesDataStore(name = "arka_state")

/** Versi skema [PersistedState] untuk migrasi satu kali saat boot. */
internal const val CURRENT_SCHEMA_VERSION = 1

/**
 * Non-secret persisted app state (mirrors the web app's `arka-state` blob
 * minus the secrets). apiKeys and the GitHub token are stripped and stored in
 * EncryptedSharedPreferences instead (PRD §7 — secrets never plaintext).
 */
@Serializable
data class PersistedState(
    val sessions: List<Session> = emptyList(),
    val currentSessionId: String? = null,
    val agents: List<Agent> = defaultAgents,
    val providers: List<ProviderConfig> = defaultProviders,
    val githubRepos: List<GitHubRepo> = emptyList(),
    val githubConnected: Boolean = false,
    /** 0 = belum pernah dimigrasi. Lihat [CURRENT_SCHEMA_VERSION]. */
    val schemaVersion: Int = 0,
)

/** Non-secret preferences, one DataStore key each. */
data class Prefs(
    val language: ArkaLanguage = ArkaLanguage.ID,
    val theme: String = "light",
    val fontSize: String = "medium",
    val execUrl: String = "http://localhost:3399/exec",
    val selectedModel: String = "gpt-4o",
    val selectedProvider: String? = null,
    val chatMode: ChatMode = ChatMode.build,
    /** Allowlist command dipisah koma; kosong = semua diizinkan (tetap lewat approval). */
    val execAllowlist: String = "",
    val distroRootfsUrl: String = DistroManager.DEFAULT_ROOTFS_URL,
    val prootNoSeccomp: Boolean = true,
    val bindWorkspace: Boolean = true,
    /** Kalau true, semua tool sensitif langsung di-approve tanpa prompt. */
    val autoApproveTools: Boolean = false,
) {
    fun toExecSettings(): ExecSettings = ExecSettings(
        allowlist = execAllowlist.split(',').map { it.trim() }.filter { it.isNotEmpty() },
        timeoutMs = ExecRunner.PROOT_DEFAULT_TIMEOUT_MS,
        distroRootfsUrl = distroRootfsUrl.ifBlank { DistroManager.DEFAULT_ROOTFS_URL },
        prootNoSeccomp = prootNoSeccomp,
        bindWorkspace = bindWorkspace,
    )
}

class Persistence(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }

    private val stateBackup: File get() = File(context.filesDir, "arka_state.json.bak")

    /**
     * true = decode state terakhir gagal DAN backup tidak ada, jadi [saveState]
     * dilarang menulis — kalau tidak, state kosong langsung menimpa berkas yang
     * (mungkin) masih bisa dipulihkan dan data lenyap diam-diam.
     */
    @Volatile
    private var stateLoadFailed = false

    private val secrets: SharedPreferences by lazy {
        val masterKey = MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
        EncryptedSharedPreferences.create(
            context,
            "arka_secrets",
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM,
        )
    }

    private fun apiKeyKey(p: Provider) = "api_key_${p.name}"

    suspend fun loadState(): PersistedState {
        val key = stringPreferencesKey("state")
        val raw = context.appDataStore.data.map { it[key] }.first()
        if (raw == null) {
            stateLoadFailed = false
            return PersistedState()
        }
        val decoded = try {
            json.decodeFromString<PersistedState>(raw)
        } catch (t: Throwable) {
            // State korup — pulihkan dari backup sebelum menyerah, dan blokir
            // save supaya state kosong tidak menimpa data yang masih tersimpan.
            val fromBackup = runCatching {
                json.decodeFromString<PersistedState>(stateBackup.readText())
            }.getOrNull()
            stateLoadFailed = fromBackup == null
            return fromBackup ?: PersistedState()
        }
        stateLoadFailed = false
        // Migrasi satu kali: sebelum skema v1, Session.provider/model punya
        // default non-null (openai/gpt-4o) sehingga ikut tersimpan meski saat
        // itu belum pernah dipakai sebagai pin. Kini field itu dibaca sebagai
        // pin aktif, jadi sesi lama salah terkunci ke openai/gpt-4o. Reset ke null.
        val base = if (decoded.schemaVersion < CURRENT_SCHEMA_VERSION) {
            val migrated = decoded.copy(
                schemaVersion = CURRENT_SCHEMA_VERSION,
                sessions = decoded.sessions.map { it.copy(provider = null, model = null) },
            )
            runCatching {
                context.appDataStore.edit {
                    it[key] = json.encodeToString(
                        migrated.copy(providers = migrated.providers.map { p -> p.copy(apiKey = "") }),
                    )
                }
            }
            migrated
        } else decoded
        val providers = base.providers.map { p ->
            val k = secrets.getString(apiKeyKey(p.id), null)
            if (k != null) p.copy(apiKey = k) else p
        }
        return base.copy(providers = providers)
    }

    suspend fun saveState(state: PersistedState) {
        if (stateLoadFailed) return
        state.providers.forEach { p ->
            val k = apiKeyKey(p.id)
            val e = secrets.edit()
            if (p.apiKey.isNotEmpty()) e.putString(k, p.apiKey) else e.remove(k)
            e.apply()
        }
        val key = stringPreferencesKey("state")
        val sanitized = state.copy(providers = state.providers.map { it.copy(apiKey = "") })
        context.appDataStore.edit { it[key] = json.encodeToString(sanitized) }
        runCatching { stateBackup.writeText(json.encodeToString(sanitized)) }
    }

    fun saveGithubToken(token: String) {
        val e = secrets.edit()
        if (token.isEmpty()) e.remove("github_token") else e.putString("github_token", token)
        e.apply()
    }

    fun loadGithubToken(): String = secrets.getString("github_token", null) ?: ""

    suspend fun loadPrefs(): Prefs {
        // Satu koleksi DataStore untuk semua key (dulu ~11 koleksi terpisah).
        val prefs = context.appDataStore.data.first()
        fun get(key: String): String? = prefs[stringPreferencesKey(key)]
        return Prefs(
            language = runCatching { ArkaLanguage.valueOf(get("language") ?: "ID") }.getOrDefault(ArkaLanguage.ID),
            theme = get("theme") ?: "light",
            fontSize = get("font_size") ?: "medium",
            execUrl = get("exec_url") ?: "http://localhost:3399/exec",
            selectedModel = get("selected_model") ?: "gpt-4o",
            selectedProvider = get("selected_provider"),
            chatMode = runCatching { ChatMode.valueOf(get("chat_mode") ?: "build") }.getOrDefault(ChatMode.build),
            execAllowlist = get("exec_allowlist") ?: "",
            distroRootfsUrl = get("distro_rootfs_url") ?: DistroManager.DEFAULT_ROOTFS_URL,
            prootNoSeccomp = (get("proot_no_seccomp") ?: "true").toBoolean(),
            bindWorkspace = (get("bind_workspace") ?: "true").toBoolean(),
            autoApproveTools = (get("auto_approve_tools") ?: "false").toBoolean(),
        )
    }

    suspend fun savePrefs(prefs: Prefs) {
        context.appDataStore.edit {
            it[stringPreferencesKey("language")] = prefs.language.name
            it[stringPreferencesKey("theme")] = prefs.theme
            it[stringPreferencesKey("font_size")] = prefs.fontSize
            it[stringPreferencesKey("exec_url")] = prefs.execUrl
            it[stringPreferencesKey("selected_model")] = prefs.selectedModel
            prefs.selectedProvider?.let { p -> it[stringPreferencesKey("selected_provider")] = p }
            it[stringPreferencesKey("chat_mode")] = prefs.chatMode.name
            it[stringPreferencesKey("exec_allowlist")] = prefs.execAllowlist
            it[stringPreferencesKey("distro_rootfs_url")] = prefs.distroRootfsUrl
            it[stringPreferencesKey("proot_no_seccomp")] = prefs.prootNoSeccomp.toString()
            it[stringPreferencesKey("bind_workspace")] = prefs.bindWorkspace.toString()
            it[stringPreferencesKey("auto_approve_tools")] = prefs.autoApproveTools.toString()
        }
    }
}