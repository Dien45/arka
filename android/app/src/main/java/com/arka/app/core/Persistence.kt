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

private val Context.appDataStore by preferencesDataStore(name = "arka_state")

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
        val raw = context.appDataStore.data.map { it[key] }.first() ?: return PersistedState()
        val base = try {
            json.decodeFromString<PersistedState>(raw)
        } catch (t: Throwable) {
            return PersistedState()
        }
        val providers = base.providers.map { p ->
            val k = secrets.getString(apiKeyKey(p.id), null)
            if (k != null) p.copy(apiKey = k) else p
        }
        return base.copy(providers = providers)
    }

    suspend fun saveState(state: PersistedState) {
        state.providers.forEach { p ->
            val k = apiKeyKey(p.id)
            val e = secrets.edit()
            if (p.apiKey.isNotEmpty()) e.putString(k, p.apiKey) else e.remove(k)
            e.apply()
        }
        val key = stringPreferencesKey("state")
        val sanitized = state.copy(providers = state.providers.map { it.copy(apiKey = "") })
        context.appDataStore.edit { it[key] = json.encodeToString(sanitized) }
    }

    fun saveGithubToken(token: String) {
        val e = secrets.edit()
        if (token.isEmpty()) e.remove("github_token") else e.putString("github_token", token)
        e.apply()
    }

    fun loadGithubToken(): String = secrets.getString("github_token", null) ?: ""

    suspend fun loadPrefs(): Prefs = Prefs(
        language = runCatching { ArkaLanguage.valueOf(runBlockingGet("language") ?: "ID") }.getOrDefault(ArkaLanguage.ID),
        theme = runBlockingGet("theme") ?: "light",
        fontSize = runBlockingGet("font_size") ?: "medium",
        execUrl = runBlockingGet("exec_url") ?: "http://localhost:3399/exec",
        selectedModel = runBlockingGet("selected_model") ?: "gpt-4o",
        selectedProvider = runBlockingGet("selected_provider"),
        chatMode = runCatching { ChatMode.valueOf(runBlockingGet("chat_mode") ?: "build") }.getOrDefault(ChatMode.build),
        execAllowlist = runBlockingGet("exec_allowlist") ?: "",
        distroRootfsUrl = runBlockingGet("distro_rootfs_url") ?: DistroManager.DEFAULT_ROOTFS_URL,
        prootNoSeccomp = (runBlockingGet("proot_no_seccomp") ?: "true").toBoolean(),
        bindWorkspace = (runBlockingGet("bind_workspace") ?: "true").toBoolean(),
        autoApproveTools = (runBlockingGet("auto_approve_tools") ?: "false").toBoolean(),
    )

    private suspend fun runBlockingGet(key: String): String? =
        context.appDataStore.data.map { it[stringPreferencesKey(key)] }.first()

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