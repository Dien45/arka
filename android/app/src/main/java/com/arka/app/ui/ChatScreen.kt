package com.arka.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.net.Uri
import android.provider.OpenableColumns
import android.widget.Toast
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.ime
import androidx.compose.foundation.layout.navigationBars
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBars
import androidx.compose.foundation.layout.union
import androidx.compose.foundation.layout.WindowInsets
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.layout.windowInsetsPadding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowDropDown
import androidx.compose.material.icons.filled.AttachFile
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Send
import androidx.compose.material.icons.filled.Stop
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.RectangleShape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.arka.app.core.Action
import com.arka.app.core.AppView
import com.arka.app.core.ArkaLanguage
import com.arka.app.core.Attachment
import com.arka.app.core.ChatController
import com.arka.app.core.ChatMode
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.Message
import com.arka.app.core.MessageRole
import com.arka.app.core.PendingToolApproval
import com.arka.app.core.ProviderConfig
import com.arka.app.core.providerFromName
import com.arka.app.core.Session
import com.arka.app.core.Store
import com.arka.app.core.ToolCallStatus
import com.arka.app.core.VirtualFs
import com.arka.app.ui.clay.*
import java.io.ByteArrayOutputStream
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject

/**
 * M3/M4. Chat screen: message list with markdown rendering, input bar with
 * file attachment picker (max 15 MB), Plan/Build/Agent mode pill inside the input,
 * Send/Stop, model picker, and the sensitive-tool approval bottom sheet
 * (per-session). Session list (switch / rename / delete / new) lives in the
 * sidebar drawer.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    store: Store,
    controller: ChatController,
    modifier: Modifier = Modifier,
    onOpenDrawer: () -> Unit = {},
) {
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val pending by controller.pendingApprovals.collectAsState()

    var input by rememberSaveable { mutableStateOf("") }
    var showModelPicker by remember { mutableStateOf(false) }
    var attachments by remember { mutableStateOf(listOf<Attachment>()) }
    var attachmentBlobs by remember { mutableStateOf(listOf<ByteArray>()) }
    var attachmentParts by remember { mutableStateOf(listOf<String?>()) }

    val context = LocalContext.current
    val pickerScope = rememberCoroutineScope()
    val pickLauncher = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri != null) {
            pickerScope.launch {
                val loaded = try {
                    withContext(Dispatchers.IO) { loadAttachment(context, uri) }
                } catch (e: CancellationException) {
                    throw e
                } catch (e: Exception) {
                    Toast.makeText(context, e.message ?: I18n.t(prefs.language, Key.FAILED_READ_FILE), Toast.LENGTH_SHORT).show()
                    null
                }
                if (loaded != null) {
                    if (attachments.size >= 5) {
                        Toast.makeText(context, "Maksimal 5 lampiran per pesan.", Toast.LENGTH_SHORT).show()
                    } else {
                        attachments = attachments + loaded.first
                        attachmentBlobs = attachmentBlobs + loaded.third
                        attachmentParts = attachmentParts + loaded.second
                    }
                }
            }
        }
    }

    val listState = rememberLazyListState()
    val currentSession = state.sessions.find { it.id == state.currentSessionId }
    val isLoading = currentSession?.id?.let { state.loadingSessionIds.contains(it) } == true
    val messages = currentSession?.messages ?: emptyList()

    LaunchedEffect(messages.size, messages.lastOrNull()?.id, isLoading) {
        val count = listState.layoutInfo.totalItemsCount
        if (count > 0) {
            // Saat AI streaming puluhan pesan tool, lompat instan (tanpa animasi
            // yang di-restart terus); animasi hanya untuk pesan final user.
            if (isLoading) listState.scrollToItem(count - 1)
            else listState.animateScrollToItem(count - 1)
        }
    }

    val send: (String) -> Unit = { text ->
        val trimmed = text.trim()
        val atts = attachments
        val blobs = attachmentBlobs
        val parts = attachmentParts
        if ((trimmed.isNotEmpty() || atts.isNotEmpty()) && !isLoading) {
            input = ""
            attachments = emptyList()
            attachmentBlobs = emptyList()
            attachmentParts = emptyList()
            pickerScope.launch {
                var sid = currentSession?.id
                if (sid == null) {
                    sid = "sess_${System.currentTimeMillis()}"
                    store.dispatch(
                        Action.AddSession(
                            Session(
                                id = sid,
                                title = trimmed
                                    .ifBlank { atts.firstOrNull()?.name ?: I18n.t(prefs.language, Key.NEW_SESSION) }
                                    .replace('\n', ' ')
                                    .take(28),
                                createdAt = System.currentTimeMillis(),
                                provider = providerFromName(prefs.selectedProvider),
                                model = prefs.selectedModel.takeIf { it.isNotBlank() },
                            ),
                        ),
                    )
                }
                val finalSid = sid
                val baseEntries = atts.mapIndexedNotNull { i, att ->
                    parts.getOrNull(i)?.let { "[FILE: ${att.name}]\n$it" }
                }
                val savedNotes = withContext(Dispatchers.IO) {
                    atts.zip(blobs).mapNotNull { (att, bytes) ->
                        saveAttachmentToWorkspace(context, finalSid, att.name, bytes)
                            ?.let { "[FILE: ${att.name} — tersimpan di workspace: $it]" }
                    }
                }
                val allParts = baseEntries + savedNotes
                controller.sendMessage(trimmed, finalSid, atts, allParts.joinToString("\n\n").ifBlank { null })
            }
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            ChatTopBar(
                title = currentSession?.title ?: "Arka",
                selectedModel = currentSession?.model ?: prefs.selectedModel,
                pinnedProviderName = currentSession?.provider?.name,
                providers = state.providers,
                onOpenModelPicker = { showModelPicker = true },
                onOpenDrawer = onOpenDrawer,
            )
        },
        bottomBar = {
            InputBar(
                input = input,
                onInputChange = { input = it },
                isLoading = isLoading,
                onSend = { send(it) },
                onStop = { currentSession?.id?.let(controller::stop) },
                mode = prefs.chatMode,
                onModeChange = { mode -> store.updatePrefs { it.copy(chatMode = mode) } },
                attachments = attachments,
                onAttachClick = { pickLauncher.launch(arrayOf("*/*")) },
                onRemoveAttachment = { att ->
                    val idx = attachments.indexOf(att)
                    if (idx >= 0) {
                        attachments = attachments.filterIndexed { i, _ -> i != idx }
                        attachmentBlobs = attachmentBlobs.filterIndexed { i, _ -> i != idx }
                        attachmentParts = attachmentParts.filterIndexed { i, _ -> i != idx }
                    }
                },
                language = prefs.language,
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
                onApproveAll = {
                    store.updatePrefs { it.copy(autoApproveTools = true) }
                    controller.resolveApproval(approval.sessionId, true)
                },
            )
        }
    }

    if (showModelPicker) {
        ModelPickerSheet(
            store = store,
            language = prefs.language,
            onDismiss = { showModelPicker = false },
            onOpenSettings = {
                showModelPicker = false
                store.dispatch(Action.SetView(AppView.settings))
            },
        )
    }
}

// ------------------------------------------------------------- top bar

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun ChatTopBar(
    title: String,
    selectedModel: String,
    pinnedProviderName: String?,
    providers: List<ProviderConfig>,
    onOpenModelPicker: () -> Unit,
    onOpenDrawer: () -> Unit = {},
) {
    // Chip model: menampilkan provider aktif + model, tap untuk membuka picker
    // yang bisa dicari (semua model hasil scan, bukan cuma beberapa entri).
    val activeProvider = pinnedProviderName?.let { n -> providers.find { it.id.name == n } }
        ?: providers.firstOrNull { it.enabled }
    val hasAnyModel = providers.any { it.enabled && (it.models.isNotEmpty() || it.effectiveModel.isNotBlank()) }

    ClaySurface(state = ClayState.Flat, tone = ClayTone.Base, shape = RectangleShape) {
        Row(
            modifier = Modifier
                .fillMaxWidth()
                .windowInsetsPadding(WindowInsets.statusBars)
                .height(48.dp)
                .padding(horizontal = 4.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            IconButton(onClick = onOpenDrawer, modifier = Modifier.size(40.dp)) {
                Icon(Icons.Default.Menu, contentDescription = "Menu")
            }
            Text(
                title,
                maxLines = 1,
                style = MaterialTheme.typography.titleSmall,
                modifier = Modifier.weight(1f, fill = false),
            )
            Spacer(Modifier.width(8.dp))
            ClaySurface(
                tone = if (hasAnyModel) ClayTone.Accent else ClayTone.Base,
                shape = ClayShape.Chip,
                modifier = Modifier.clickable(onClick = onOpenModelPicker),
            ) {
                Row(
                    Modifier.padding(horizontal = 8.dp, vertical = 2.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        buildString {
                            activeProvider?.icon?.let { append("$it ") }
                            append(selectedModel.ifBlank { "Pilih model" })
                        },
                        maxLines = 1,
                        style = MaterialTheme.typography.labelSmall,
                        color = if (hasAnyModel) Color.Unspecified else MaterialTheme.colorScheme.error,
                    )
                    Text(" ▾", style = MaterialTheme.typography.labelSmall)
                }
            }
        }
    }
}

// ------------------------------------------------------------- messages

@Composable
private fun MessageRow(language: ArkaLanguage, message: Message) {
    when (message.role) {
        MessageRole.user -> UserBubble(message.content, message.attachments)
        MessageRole.assistant -> AssistantBubble(message.content)
        MessageRole.tool -> ToolResultCard(message)
        MessageRole.system -> Unit
    }
}

@Composable
private fun UserBubble(content: String, attachments: List<Attachment>? = null) {
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
        ClaySurface(
            tone = ClayTone.Accent,
            shape = RoundedCornerShape(18.dp, 18.dp, 6.dp, 18.dp),
            modifier = Modifier.widthIn(max = 300.dp),
        ) {
            Column(Modifier.padding(12.dp, 8.dp)) {
                attachments?.forEach { att ->
                    Text(
                        "📎 ${att.name} (${formatBytes(att.size)})",
                        style = MaterialTheme.typography.labelSmall,
                        maxLines = 1,
                        overflow = TextOverflow.Ellipsis,
                    )
                }
                if (!attachments.isNullOrEmpty()) Spacer(Modifier.height(4.dp))
                Text(
                    content,
                    style = MaterialTheme.typography.bodyMedium,
                )
            }
        }
    }
}

@Composable
private fun AssistantBubble(content: String) {
    val context = LocalContext.current
    var copied by remember { mutableStateOf(false) }
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.Start) {
        ClaySurface(
            tone = ClayTone.Base,
            shape = RoundedCornerShape(6.dp, 18.dp, 18.dp, 18.dp),
            modifier = Modifier.widthIn(max = 340.dp),
        ) {
            Column(Modifier.padding(12.dp, 8.dp)) {
                MarkdownText(
                    markdown = content,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.End) {
                    ClayButton(onClick = {
                        val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                        cm.setPrimaryClip(ClipData.newPlainText("chat", content))
                        copied = true
                    }, variant = ClayVariant.Ghost) {
                        Text(
                            if (copied) "Disalin ✓" else "Salin",
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                }
            }
        }
    }
}

@Composable
private fun ToolResultCard(message: Message) {
    val toolCall = message.toolCalls?.firstOrNull() ?: return
    val context = LocalContext.current
    var expanded by remember { mutableStateOf(false) }
    var copiedOut by remember { mutableStateOf(false) }
    val rawOutput = toolCall.output ?: "(no output)"
    val output = remember(rawOutput) {
        runCatching {
            Json { prettyPrint = true }.parseToJsonElement(rawOutput).jsonObject.toString()
        }.getOrElse { rawOutput }
    }

    ClayCard(
        tone = ClayTone.Base,
        shape = RoundedCornerShape(12.dp),
        contentPadding = PaddingValues(horizontal = 12.dp, vertical = 8.dp),
        modifier = Modifier.fillMaxWidth(),
    ) {
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
                ClayButton(onClick = {
                    val cm = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                    cm.setPrimaryClip(ClipData.newPlainText("tool_output", output))
                    copiedOut = true
                }, variant = ClayVariant.Ghost) {
                    Text(
                        if (copiedOut) "Disalin ✓" else "Salin",
                        style = MaterialTheme.typography.labelSmall,
                    )
                }
                ClayButton(onClick = { expanded = !expanded }, variant = ClayVariant.Ghost) {
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
            ClayChip(
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

private fun modeLabel(mode: ChatMode): String = when (mode) {
    ChatMode.plan -> "Plan 🗺️"
    ChatMode.build -> "Build 🔨"
    ChatMode.agent -> "Agent 🤖"
}

@Composable
private fun InputBar(
    input: String,
    onInputChange: (String) -> Unit,
    isLoading: Boolean,
    onSend: (String) -> Unit,
    onStop: () -> Unit,
    mode: ChatMode,
    onModeChange: (ChatMode) -> Unit,
    attachments: List<Attachment>,
    onAttachClick: () -> Unit,
    onRemoveAttachment: (Attachment) -> Unit,
    language: ArkaLanguage,
) {
    var modeMenuExpanded by remember { mutableStateOf(false) }

    val insetsDensity = LocalDensity.current
    val imeVisible = WindowInsets.ime.getBottom(insetsDensity) > 0
    val bottomInsets = if (imeVisible) {
        WindowInsets.ime.union(WindowInsets.navigationBars)
    } else {
        WindowInsets(0, 0, 0, 0)
    }
    Column(
        Modifier
            .fillMaxWidth()
            .background(MaterialTheme.colorScheme.surface)
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .windowInsetsPadding(bottomInsets),
    ) {
        if (attachments.isNotEmpty()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .horizontalScroll(rememberScrollState())
                    .padding(bottom = 6.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                attachments.forEach { att ->
                    ClaySurface(
                        tone = ClayTone.Accent,
                        shape = ClayShape.Chip,
                    ) {
                        Row(
                            Modifier.padding(start = 10.dp, end = 2.dp, top = 2.dp, bottom = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                "📎 ${att.name}",
                                style = MaterialTheme.typography.labelSmall,
                                maxLines = 1,
                                overflow = TextOverflow.Ellipsis,
                                modifier = Modifier.widthIn(max = 160.dp),
                            )
                            IconButton(
                                onClick = { onRemoveAttachment(att) },
                                modifier = Modifier.size(24.dp),
                            ) {
                                Icon(
                                    Icons.Default.Close,
                                    contentDescription = "Hapus lampiran",
                                    modifier = Modifier.size(14.dp),
                                )
                            }
                        }
                    }
                    Spacer(Modifier.width(6.dp))
                }
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            IconButton(onClick = onAttachClick, enabled = !isLoading) {
                Icon(
                    Icons.Default.AttachFile,
                    contentDescription = "Lampirkan file",
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            ClaySurface(
                state = ClayState.Pressed,
                tone = ClayTone.Base,
                shape = RoundedCornerShape(24.dp),
                modifier = Modifier.weight(1f),
            ) {
                Row(
                    Modifier.padding(horizontal = 12.dp, vertical = 6.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box {
                        ClayButton(
                            onClick = { modeMenuExpanded = true },
                            variant = ClayVariant.Ghost,
                            contentPadding = PaddingValues(0.dp),
                        ) {
                            Text(modeLabel(mode), style = MaterialTheme.typography.labelSmall)
                            Icon(Icons.Default.ArrowDropDown, contentDescription = null)
                        }
                        DropdownMenu(
                            expanded = modeMenuExpanded,
                            onDismissRequest = { modeMenuExpanded = false },
                        ) {
                            ChatMode.entries.forEach { m ->
                                DropdownMenuItem(
                                    text = { Text(modeLabel(m)) },
                                    onClick = {
                                        modeMenuExpanded = false
                                        onModeChange(m)
                                    },
                                )
                            }
                        }
                    }
                    Spacer(Modifier.width(6.dp))
                    BasicTextField(
                        value = input,
                        onValueChange = onInputChange,
                        textStyle = MaterialTheme.typography.bodyLarge.copy(color = MaterialTheme.colorScheme.onSurface),
                        cursorBrush = SolidColor(MaterialTheme.colorScheme.primary),
                        maxLines = 4,
                        modifier = Modifier.weight(1f),
                        decorationBox = { innerTextField ->
                            Box {
                                if (input.isEmpty()) {
                                    Text(
                                        I18n.t(language, Key.ASK_ABOUT_CODE),
                                        style = MaterialTheme.typography.bodyLarge,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                innerTextField()
                            }
                        },
                    )
                }
            }
            Spacer(Modifier.width(8.dp))
            if (isLoading) {
                ClayIconButton(onClick = onStop, variant = ClayVariant.Destructive) {
                    Icon(Icons.Default.Stop, contentDescription = "Stop", tint = MaterialTheme.colorScheme.error)
                }
            } else {
                ClayIconButton(
                    onClick = { onSend(input) },
                    enabled = input.isNotBlank() || attachments.isNotEmpty(),
                    variant = ClayVariant.Primary,
                ) {
                    Icon(Icons.Default.Send, contentDescription = "Send", tint = MaterialTheme.colorScheme.primary)
                }
            }
        }
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
    onApproveAll: () -> Unit = {},
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
            ClayCard(
                tone = ClayTone.Base,
                contentPadding = PaddingValues(12.dp),
            ) {
                    Text(approval.name, style = MaterialTheme.typography.titleSmall)
                    Spacer(Modifier.height(6.dp))
                    val prettyParams = remember(approval.paramsJson) {
                        runCatching {
                            Json { prettyPrint = true }.parseToJsonElement(approval.paramsJson).jsonObject.toString()
                        }.getOrElse { approval.paramsJson }
                    }
                    Text(
                        prettyParams,
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                    )
            }
            Spacer(Modifier.height(16.dp))
            Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                ClayButton(onClick = onReject, variant = ClayVariant.Ghost) { Text(t(Key.REJECT)) }
                ClayButton(onClick = onApproveAll, variant = ClayVariant.Ghost) { Text(t(Key.ALLOW_ALL)) }
                ClayButton(onClick = onApprove, variant = ClayVariant.Ghost) { Text(t(Key.APPROVE)) }
            }
        }
    }
}

// ------------------------------------------------------------- attachments

private const val MAX_ATTACHMENT_BYTES = 15L * 1024 * 1024
private const val MAX_ATTACHMENT_TEXT_CHARS = 100_000

private class AttachmentTooLargeException : Exception("File terlalu besar (maksimal 15 MB)")

private val TEXT_MIME_TYPES = setOf(
    "application/json",
    "application/xml",
    "application/javascript",
    "application/x-yaml",
    "application/yaml",
    "application/toml",
    "application/x-sh",
    "application/sql",
    "application/csv",
)

private val TEXT_EXTENSIONS = setOf(
    "txt", "md", "json", "xml", "csv", "tsv", "yml", "yaml", "toml", "ini", "cfg",
    "conf", "log", "kt", "kts", "java", "py", "js", "ts", "tsx", "jsx", "html",
    "css", "scss", "sh", "bash", "gradle", "properties", "sql", "pro", "gitignore",
)

private fun isTextFile(mime: String?, name: String): Boolean {
    val ext = name.substringAfterLast('.', "").lowercase()
    if (ext in TEXT_EXTENSIONS) return true
    if (mime != null && mime.startsWith("text/")) return true
    return mime != null && mime in TEXT_MIME_TYPES
}

/**
 * Baca file dari [uri] dengan batas [MAX_ATTACHMENT_BYTES]. Melempar
 * [AttachmentTooLargeException] kalau file lebih dari 15 MB. Konten teks
 * (max [MAX_ATTACHMENT_TEXT_CHARS] karakter) ikut dikembalikan supaya bisa
 * disuntikkan ke konteks model; file binari hanya metadata-nya saja.
 */
private fun loadAttachment(context: Context, uri: Uri): Triple<Attachment, String?, ByteArray> {
    val resolver = context.contentResolver
    var name = "file"
    var size = -1L
    resolver.query(uri, arrayOf(OpenableColumns.DISPLAY_NAME, OpenableColumns.SIZE), null, null, null)
        ?.use { cursor ->
            if (cursor.moveToFirst()) {
                val nameIdx = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME)
                if (nameIdx >= 0) name = cursor.getString(nameIdx) ?: name
                val sizeIdx = cursor.getColumnIndex(OpenableColumns.SIZE)
                if (sizeIdx >= 0 && !cursor.isNull(sizeIdx)) size = cursor.getLong(sizeIdx)
            }
        }
    if (size > MAX_ATTACHMENT_BYTES) throw AttachmentTooLargeException()

    val mime = resolver.getType(uri)
    val bytes = resolver.openInputStream(uri)?.use { input ->
        val buffer = ByteArray(64 * 1024)
        val out = ByteArrayOutputStream()
        var total = 0L
        while (true) {
            val n = input.read(buffer)
            if (n < 0) break
            total += n
            if (total > MAX_ATTACHMENT_BYTES) throw AttachmentTooLargeException()
            out.write(buffer, 0, n)
        }
        out.toByteArray()
    } ?: throw IllegalStateException("Tidak bisa membaca file")

    if (size < 0) size = bytes.size.toLong()
    val content = if (isTextFile(mime, name)) {
        String(bytes, Charsets.UTF_8).take(MAX_ATTACHMENT_TEXT_CHARS)
    } else {
        null
    }
    return Triple(Attachment(name = name, size = size), content, bytes)
}

/**
 * Simpan bytes attachment ke workspace sesi (`attachments/<nama>`).
 * Return path relatif kalau berhasil, null kalau gagal.
 */
private fun saveAttachmentToWorkspace(context: Context, sessionId: String, name: String, bytes: ByteArray): String? {
    val fs = VirtualFs(context)
    val safe = name.replace(Regex("[/\\\\]"), "_").replace("..", "_").take(100).ifBlank { "file" }
    var rel = "attachments/$safe"
    if (fs.resolve(sessionId, rel)?.exists() == true) rel = "attachments/${System.currentTimeMillis()}_$safe"
    return if (fs.writeBytes(sessionId, rel, bytes)) rel else null
}

private fun formatBytes(bytes: Long): String = when {
    bytes >= 1024L * 1024L -> String.format("%.1f MB", bytes / (1024.0 * 1024.0))
    bytes >= 1024L -> String.format("%.1f KB", bytes / 1024.0)
    else -> "$bytes B"
}
