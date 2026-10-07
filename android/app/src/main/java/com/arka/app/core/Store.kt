package com.arka.app.core

import android.content.Context
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AppState(
    val currentView: AppView = AppView.chat,
    val sessions: List<Session> = emptyList(),
    val currentSessionId: String? = null,
    val agents: List<Agent> = defaultAgents,
    val providers: List<ProviderConfig> = defaultProviders,
    val githubToken: String = "",
    val githubRepos: List<GitHubRepo> = emptyList(),
    val githubConnected: Boolean = false,
    val loadingSessionIds: List<String> = emptyList(),
    val sidebarOpen: Boolean = false,
    val locked: Boolean = false,
    val vaultConfigured: Boolean = false,
)

sealed interface Action {
    data class SetView(val view: AppView) : Action
    data class SetSession(val id: String?) : Action
    data class AddSession(val session: Session) : Action
    data class AddMessage(val sessionId: String, val message: Message) : Action
    data class UpdateMessage(val sessionId: String, val messageId: String, val content: String) : Action
    data class DeleteSession(val sessionId: String) : Action
    data class RenameSession(val sessionId: String, val title: String) : Action
    data class SetProviders(val providers: List<ProviderConfig>) : Action
    data class UpdateProvider(val provider: ProviderConfig) : Action
    data class SetAgents(val agents: List<Agent>) : Action
    data class AddAgent(val agent: Agent) : Action
    data class DeleteAgent(val id: String) : Action
    data class SetGithubToken(val token: String) : Action
    data class SetGithubRepos(val repos: List<GitHubRepo>) : Action
    data class SetGithubConnected(val connected: Boolean) : Action
    data object ToggleSidebar : Action
    data class SetLoading(val sessionId: String, val loading: Boolean) : Action
    data class Hydrate(val persisted: PersistedState, val githubToken: String) : Action
}

fun reduce(state: AppState, action: Action): AppState = when (action) {
    is Action.SetView -> state.copy(currentView = action.view, sidebarOpen = false)
    is Action.SetSession -> state.copy(currentSessionId = action.id)
    is Action.AddSession -> state.copy(
        sessions = listOf(action.session) + state.sessions,
        currentSessionId = action.session.id,
    )
    is Action.AddMessage -> state.copy(
        sessions = state.sessions.map { s ->
            if (s.id == action.sessionId) s.copy(messages = s.messages + action.message) else s
        },
    )
    is Action.UpdateMessage -> state.copy(
        sessions = state.sessions.map { s ->
            if (s.id == action.sessionId) {
                s.copy(messages = s.messages.map { m ->
                    if (m.id == action.messageId) m.copy(content = action.content) else m
                })
            } else s
        },
    )
    is Action.DeleteSession -> state.copy(
        sessions = state.sessions.filterNot { it.id == action.sessionId },
        currentSessionId = if (state.currentSessionId == action.sessionId) null else state.currentSessionId,
    )
    is Action.RenameSession -> state.copy(
        sessions = state.sessions.map { if (it.id == action.sessionId) it.copy(title = action.title) else it },
    )
    is Action.SetProviders -> state.copy(providers = action.providers)
    is Action.UpdateProvider -> state.copy(
        providers = state.providers.map { if (it.id == action.provider.id) action.provider else it },
    )
    is Action.SetAgents -> state.copy(agents = action.agents)
    is Action.AddAgent -> state.copy(agents = state.agents + action.agent)
    is Action.DeleteAgent -> state.copy(agents = state.agents.filterNot { it.id == action.id })
    is Action.SetGithubToken -> state.copy(githubToken = action.token)
    is Action.SetGithubRepos -> state.copy(githubRepos = action.repos)
    is Action.SetGithubConnected -> state.copy(githubConnected = action.connected)
    Action.ToggleSidebar -> state.copy(sidebarOpen = !state.sidebarOpen)
    is Action.SetLoading -> state.copy(
        loadingSessionIds = if (action.loading) {
            if (action.sessionId in state.loadingSessionIds) state.loadingSessionIds
            else state.loadingSessionIds + action.sessionId
        } else {
            state.loadingSessionIds.filterNot { it == action.sessionId }
        },
    )
    is Action.Hydrate -> state.copy(
        sessions = action.persisted.sessions,
        currentSessionId = action.persisted.currentSessionId,
        agents = action.persisted.agents,
        providers = action.persisted.providers,
        githubToken = action.githubToken,
        githubRepos = action.persisted.githubRepos,
        githubConnected = action.persisted.githubConnected,
    )
}

fun toPersisted(state: AppState): PersistedState = PersistedState(
    sessions = state.sessions,
    currentSessionId = state.currentSessionId,
    agents = state.agents,
    providers = state.providers,
    githubRepos = state.githubRepos,
    githubConnected = state.githubConnected,
)

/**
 * Single mutable store, mirroring useReducer + Context in store.tsx. State and
 * prefs are persisted on every change (rate-limited naturally by dispatch).
 */
class Store(
    private val context: Context,
    private val persistence: Persistence,
    private val scope: CoroutineScope,
) {
    private val _state = MutableStateFlow(AppState())
    val state: StateFlow<AppState> = _state.asStateFlow()

    private val _prefs = MutableStateFlow(Prefs())
    val prefs: StateFlow<Prefs> = _prefs.asStateFlow()

    suspend fun init() {
        val persisted = persistence.loadState()
        val token = persistence.loadGithubToken()
        _state.value = reduce(AppState(), Action.Hydrate(persisted, token))
        _prefs.value = persistence.loadPrefs()
    }

    fun dispatch(action: Action) {
        val next = reduce(_state.value, action)
        _state.value = next
        when (action) {
            is Action.SetGithubToken -> persistence.saveGithubToken(action.token)
            is Action.DeleteSession -> VirtualFs(context).deleteSession(action.sessionId)
            else -> Unit
        }
        scope.launch { persistence.saveState(toPersisted(next)) }
    }

    fun updatePrefs(transform: (Prefs) -> Prefs) {
        val next = transform(_prefs.value)
        _prefs.value = next
        scope.launch { persistence.savePrefs(next) }
    }
}