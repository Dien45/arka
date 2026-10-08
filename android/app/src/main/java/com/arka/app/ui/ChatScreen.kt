package com.arka.app.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.arka.app.core.Action
import com.arka.app.core.AppView
import com.arka.app.core.ArkaLanguage
import com.arka.app.core.ChatController
import com.arka.app.core.ChatMode
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.Message
import com.arka.app.core.MessageRole
import com.arka.app.core.PendingToolApproval
import com.arka.app.core.ProviderConfig
import com.arka.app.core.Session
import com.arka.app.core.Store
import com.arka.app.core.ToolCallStatus
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject

/**
 * M3/M4. Chat screen: message list with markdown rendering, input bar with
 * Send/Stop, Plan/Build/Agent mode switcher, model picker, session list
 * (switch / rename / delete / new), and the sensitive-tool approval bottom
 * sheet (per-session).
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    store: Store,
    controller: ChatController,
    modifier: Modifier = Modifier,
) {
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val pending by controller.pendingApprovals.collectAsState()

    var input by rememberSaveable { mutableStateOf("") }
    var showSessions by remember { mutableStateOf(false) }

    val listState = rememberLazyListState()
    val currentSession = state.sessions.find { it.id == state.currentSessionId }
    val isLoading = currentSession?.id?.let { state.loadingSessionIds.contains(it) } == true
    val messages = currentSession?.messages ?: emptyList()

    LaunchedEffect(messages.size, messages.lastOrNull()?.id, isLoading) {
        val count = listState.layoutInfo.totalItemsCount
        if (count > 0) listState.animateScrollToItem(count - 1)
    }

    val send: (String) -> Unit = { text ->
        val trimmed = text.trim()
        if (trimmed.isNotEmpty() && !isLoading) {
            input = ""
            val sid = currentSession?.id
            if (sid != null) {
                controller.sendMessage(trimmed, sid)
            } else {
                val newId = "sess_${System.currentTimeMillis()}"
                store.dispatch(
                    Action.AddSession(
                        Session(
                            id = newId,
                            title = trimmed.replace('\n', ' ').take(28),
                            createdAt = System.currentTimeMillis(),
                            model = prefs.selectedModel,
                        ),
                    ),
                )
                controller.sendMessage(trimmed, newId)
            }
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            Column {
                ChatTopBar(
                    title = currentSession?.title ?: "Arka",
                    selectedModel = prefs.selectedModel,
                    isLoading = isLoading,
                    providers = state.providers,
                    onPickModel = { providerId, modelName ->
                        store.updatePrefs {
                            it.copy(selectedProvider = providerId, selectedModel = modelName)
                        }
                    },
                    onOpenSessions = { showSessions = true },
                    onOpenSettings = { store.dispatch(Action.SetView(AppView.settings)) },
                    onStop = { currentSession?.id?.let(controller::stop) },
                )
                ModeSwitcher(
                    selected = prefs.chatMode,
                    onSelect = { mode -> store.updatePrefs { it.copy(chatMode = mode) } },
                )
            }
        },
        bottomBar = {
            InputBar(
                input = input,
                onInputChange = { input = it },
                isLoading = isLoading,
                onSend = { send(it) },
                onStop = { currentSession?.id?.let(controller::stop) },
            )
        },
    ) { padding ->
        Box(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            if (messages.isEmpty()) {
                Greeting(prefs.language, onQuickPrompt = { send(it) })
            } else {
                LazyColumn(
                    state = listState,
                    modifier = Modifier.fillMaxSize(),
                    contentPadding = PaddingValues(16.dp),
                    verticalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    items(messages, key = { it.id }) { message ->
                        MessageRow(prefs.language, message)
                    }
                    if (isLoading) {
                        item("typing") { TypingIndicator(prefs.language) }
                    }
                }
            }
        }
    }

    // Sensitive-tool approval bottom sheet (per-session).
    currentSession?.let { session ->
        pending[session.id]?.let { approval ->
            ApprovalSheet(
                language = prefs.language,
                approval = approval,
                onApprove = { controller.resolveApproval(approval.sessionId, true) },
                onReject = { controller.resolveApproval(approval.sessionId, false) },
            )
        }
    }

    if (showSessions) {
        SessionsSheet(
            store = store,
            language = prefs.language,
            defaultModel = prefs.selectedModel,
            onDismiss = { showSessions = false },
        )
    }
}

// ------------------------------------------------------------- top bar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatTopBar(
    title: String,
    selectedModel: String,
    isLoading: Boolean,
    providers: List<ProviderConfig>,
    onPickModel: (providerId: String, modelName: String) -> Unit,
    onOpenSessions: () -> Unit,
    onOpenSettings: () -> Unit,
    onStop: () -> Unit,
) {
    var modelMenuOpen by remember { mutableStateOf(false) }

    TopAppBar(
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(title, maxLines = 1)
                Spacer(Modifier.width(8.dp))
                Box {
                    TextButton(onClick = { modelMenuOpen = true }) {
                        Text(selectedModel, maxLines = 1, style = MaterialTheme.typography.labelMedium)
                    }
                    DropdownMenu(expanded = modelMenuOpen, onDismissRequest = { modelMenuOpen = false }) {
                        providers.filter { it.enabled }.forEach { provider ->
                            DropdownMenuItem(
                                text = { Text("${provider.icon} ${provider.name}") },
                                onClick = {
                                    if (provider.model.isNotEmpty()) {
                                        onPickModel(provider.id.name, provider.model)
                                        modelMenuOpen = false
                                    }
                                },
                            )
                            provider.models.take(20).forEach { m ->
                                DropdownMenuItem(
                                    text = { Text(m.name) },
                                    onClick = {
                                        onPickModel(provider.id.name, m.id)
                                        modelMenuOpen = false
                                    },
                                )
                            }
                        }
                        if (providers.none { it.enabled }) {
                            DropdownMenuItem(
                                text = { Text("Belum ada provider aktif — buka ⚙️") },
                                onClick = { modelMenuOpen = false },
                            )
                        }
                    }
                }
            }
        },
        actions = {
            if (isLoading) {
                IconButton(onClick = onStop) { Icon(Icons.Default.Stop, contentDescription = "Stop") }
            }
            IconButton(onClick = onOpenSessions) { Icon(Icons.Default.Menu, contentDescription = "Sessions") }
            IconButton(onClick = onOpenSettings) { Icon(Icons.Default.Settings, contentDescription = "Settings") }
        },
    )
}

@Composable
private fun ModeSwitcher(
    selected: ChatMode,
    onSelect: (ChatMode) -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 4.dp),
        horizontalArrangement = Arrangement.SpaceBetween,
    ) {
        ChatMode.entries.forEach { mode ->
            FilterChip(
                selected = selected == mode,
                onClick = { onSelect(mode) },
                label = {
                    Text(
                        when (mode) {
                            ChatMode.plan -> "Plan 🗺️"
                            ChatMode.build -> "Build 🔨"
                            ChatMode.agent -> "Agent 🤖"
                        },
                    )
                },
            )
        }
    }
}

// ------------------------------------------------------------- messages

@Composable
private fun MessageRow(language: ArkaLanguage, message: Message) {
    when (message.role) {
        MessageRole.user -> UserBubble(message.content)
        MessageRole.assistant -> AssistantBubble(message.content)
        MessageRole.tool -> ToolResultCard(message)
        MessageRole.system -> Unit
    }
}

@Composable
private fun UserBubble(content: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        Surface(
            color = MaterialTheme.colorScheme.primaryContainer,
            shape = RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp),
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(RoundedCornerShape(16.dp, 16.dp, 4.dp, 16.dp)),
        ) {
            Text(
                content,
                modifier = Modifier.padding(12.dp, 8.dp),
                style = MaterialTheme.typography.bodyMedium,
            )
        }
    }
}

@Composable
private fun AssistantBubble(content: String) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        Surface(
            color = MaterialTheme.colorScheme.surfaceVariant,
            shape = RoundedCornerShape(4.dp, 16.dp, 16.dp, 16.dp),
            modifier = Modifier.widthIn(max = 340.dp),
        ) {
            MarkdownText(
                markdown = content,
                modifier = Modifier.padding(12.dp, 8.dp),
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun ToolResultCard(message: Message) {
    val toolCall = message.toolCalls?.firstOrNull() ?: return
    var expanded by remember { mutableStateOf(false) }
    val output = toolCall.output?.let { raw ->
        runCatching {
            Json { prettyPrint = true }.parseToJsonElement(raw).jsonObject.toString()
        }.getOrElse { raw }
    } ?: "(no output)"

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(12.dp)),
    ) {
        Column(Modifier.padding(horizontal = 12.dp, vertical = 8.dp)) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    when (toolCall.status) {
                        ToolCallStatus.completed -> "🛠️"
                        ToolCallStatus.error -> "⛔"
                        ToolCallStatus.running -> "⏳"
                    },
                    fontSize = MaterialTheme.typography.labelMedium.fontSize,
                )
                Spacer(Modifier.width(6.dp))
                Text(
                    toolCall.name,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                )
                Spacer(Modifier.weight(1f))
                TextButton(onClick = { expanded = !expanded }) {
                    Text(if (expanded) "Sembunyikan" else "Lihat")
                }
            }
            AnimatedVisibility(visible = expanded, enter = fadeIn(), exit = fadeOut()) {
                Text(
                    output,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                )
            }
        }
    }
}

@Composable
private fun TypingIndicator(language: ArkaLanguage) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
        Spacer(Modifier.width(8.dp))
        Text(
            "Arka ${if (language == ArkaLanguage.ID) "sedang mengetik..." else "is typing..."}",
            style = MaterialTheme.typography.bodySmall,
        )
    }
}

@Composable
private fun Greeting(language: ArkaLanguage, onQuickPrompt: (String) -> Unit) {
    val t = { k: String -> I18n.t(language, k) }
    Column(
        Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        Text("🤖", style = MaterialTheme.typography.displayMedium)
        Spacer(Modifier.height(12.dp))
        Text(t(Key.GREETING), style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
        Spacer(Modifier.height(4.dp))
        Text(
            t(Key.GREETING_DESC),
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.height(20.dp))
        listOf(
            Key.CREATE_REACT_PROJECT,
            Key.DEBUG_CODE,
            Key.EXPLAIN_CODE,
            Key.OPTIMIZE_PERFORMANCE,
        ).forEach { key ->
            FilterChip(
                selected = false,
                onClick = { onQuickPrompt(t(key)) },
                label = { Text(t(key)) },
                modifier = Modifier.padding(vertical = 3.dp),
            )
        }
        Spacer(Modifier.height(16.dp))
        Text(
            t(Key.ARKA_DISCLAIMER),
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
        )
    }
}

// ------------------------------------------------------------- input bar

@Composable
private fun InputBar(
    input: String,
    onInputChange: (String) -> Unit,
    isLoading: Boolean,
    onSend: (String) -> Unit,
    onStop: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .imePadding()
            .navigationBarsPadding(),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        OutlinedTextField(
            value = input,
            onValueChange = onInputChange,
            placeholder = { Text("Tanyakan sesuatu tentang kode...") },
            shape = RoundedCornerShape(24.dp),
            maxLines = 4,
            modifier = Modifier.weight(1f),
        )
        Spacer(Modifier.width(8.dp))
        if (isLoading) {
            IconButton(onClick = onStop) {
                Icon(Icons.Default.Stop, contentDescription = "Stop", tint = MaterialTheme.colorScheme.error)
            }
        } else {
            IconButton(
                onClick = { onSend(input) },
                enabled = input.isNotBlank(),
            ) {
                Icon(Icons.Default.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.primary)
            }
        }
    }
}

// ------------------------------------------------------------- sessions

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun SessionsSheet(
    store: Store,
    language: ArkaLanguage,
    defaultModel: String,
    onDismiss: () -> Unit,
) {
    val state by store.state.collectAsState()
    val t = { k: String -> I18n.t(language, k) }

    var renameTarget by remember { mutableStateOf<Session?>(null) }
    var renameText by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<Session?>(null) }

    fun newSession() {
        store.dispatch(
            Action.AddSession(
                Session(
                    id = "sess_${System.currentTimeMillis()}",
                    title = "Sesi Baru",
                    createdAt = System.currentTimeMillis(),
                    model = defaultModel,
                ),
            ),
        )
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 20.dp),
        ) {
            Row(
                Modifier.fillMaxWidth(),
                horizontalArrangement = Arrangement.SpaceBetween,
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(t(Key.SESSIONS), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                TextButton(onClick = { newSession() }) {
                    Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                    Spacer(Modifier.width(4.dp))
                    Text(t(Key.NEW_SESSION))
                }
            }
            if (state.sessions.isEmpty()) {
                Text(
                    t(Key.NO_SESSIONS),
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 16.dp),
                )
            } else {
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 440.dp)) {
                    items(state.sessions, key = { it.id }) { session ->
                        val isCurrent = session.id == state.currentSessionId
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable { store.dispatch(Action.SetSession(session.id)) }
                                .padding(vertical = 10.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                session.title,
                                style = MaterialTheme.typography.bodyMedium,
                                fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                                color = if (isCurrent) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.onSurface,
                                maxLines = 1,
                                modifier = Modifier.weight(1f),
                            )
                            Spacer(Modifier.width(8.dp))
                            Text(
                                "${session.messages.count { it.role != MessageRole.system }} msg",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            IconButton(onClick = {
                                renameTarget = session
                                renameText = session.title
                            }) {
                                Icon(Icons.Default.Edit, contentDescription = "Rename")
                            }
                            IconButton(onClick = { deleteTarget = session }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = "Delete",
                                    tint = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                        HorizontalDivider()
                    }
                }
            }
        }
    }

    renameTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text("Rename") },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = renameText.trim()
                        if (name.isNotEmpty()) {
                            store.dispatch(Action.RenameSession(session.id, name))
                        }
                        renameTarget = null
                    },
                ) { Text(t(Key.SAVE)) }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) { Text(t(Key.CANCEL)) }
            },
        )
    }

    deleteTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text(t(Key.DELETE)) },
            text = { Text("Hapus sesi \"${session.title}\"? Workspace-nya ikut terhapus.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        store.dispatch(Action.DeleteSession(session.id))
                        deleteTarget = null
                    },
                ) { Text(t(Key.DELETE), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text(t(Key.CANCEL)) }
            },
        )
    }
}

// ------------------------------------------------------------- approval

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ApprovalSheet(
    language: ArkaLanguage,
    approval: PendingToolApproval,
    onApprove: () -> Unit,
    onReject: () -> Unit,
) {
    val t = { k: String -> I18n.t(language, k) }
    ModalBottomSheet(onDismissRequest = onReject) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 20.dp)
                .padding(bottom = 28.dp),
        ) {
            Text(
                "🛡️ ${t(Key.TOOL_APPROVAL_TITLE)}",
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            Spacer(Modifier.height(12.dp))
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
            ) {
                Column(Modifier.padding(12.dp)) {
                    Text(approval.name, style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(6.dp))
                    val prettyParams = runCatching {
                        Json { prettyPrint = true }.parseToJsonElement(approval.paramsJson).jsonObject.toString()
                    }.getOrElse { approval.paramsJson }
                    Text(
                        prettyParams,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                    )
                }
            }
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                TextButton(onClick = onReject) { Text(t(Key.REJECT)) }
                TextButton(onClick = onApprove) { Text(t(Key.APPROVE)) }
            }
        }
    }
}