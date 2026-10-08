package com.arka.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.ArkaLanguage
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.MEMORY_CHAR_LIMIT
import com.arka.app.core.MemoryEntry
import com.arka.app.core.MemoryManager
import com.arka.app.core.MemoryTarget
import com.arka.app.core.Store
import com.arka.app.core.USER_CHAR_LIMIT
import com.arka.app.net.SimpleHttp
import kotlinx.coroutines.launch

/**
 * M4 — Settings screen: AI providers (reuses ProvidersSheet), command exec
 * server URL + connection test, memory browser (add/edit/delete/clear with
 * usage bars), appearance (theme light/dark/auto, font size), language
 * (id/en), and About.
 */
@Composable
fun SettingsScreen(
    store: Store,
    memory: MemoryManager,
    modifier: Modifier = Modifier,
) {
    val prefs by store.prefs.collectAsState()
    val state by store.state.collectAsState()
    val t = { k: String -> I18n.t(prefs.language, k) }
    val scope = rememberCoroutineScope()

    var showProviders by remember { mutableStateOf(false) }

    var execUrl by remember { mutableStateOf(prefs.execUrl) }
    var execTesting by remember { mutableStateOf(false) }
    var execStatus by remember { mutableStateOf<String?>(null) }

    var memRefresh by remember { mutableIntStateOf(0) }
    var memTarget by remember { mutableStateOf(MemoryTarget.MEMORY) }
    var memText by remember { mutableStateOf("") }
    var memStatus by remember { mutableStateOf<String?>(null) }
    var editing by remember { mutableStateOf<MemoryEntry?>(null) }
    var editText by remember { mutableStateOf("") }

    val memStore = memory.getAll()
    val memChars = memStore.memory.sumOf { it.content.length }
    val userChars = memStore.user.sumOf { it.content.length }

    Column(
        modifier = modifier
            .verticalScroll(rememberScrollState())
            .padding(horizontal = 16.dp, vertical = 8.dp),
    ) {
        Text("Pengaturan", style = MaterialTheme.typography.headlineSmall, fontWeight = FontWeight.Bold)

        SectionHeader(t(Key.AI_PROVIDERS))
        Card(
            colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
            modifier = Modifier
                .fillMaxWidth()
                .clickable { showProviders = true },
        ) {
            Column(Modifier.padding(12.dp)) {
                state.providers.forEach { provider ->
                    Row(
                        Modifier.fillMaxWidth().padding(vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text("${provider.icon} ", style = MaterialTheme.typography.bodyMedium)
                        Text(
                            provider.name,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.weight(1f),
                        )
                        Text(
                            if (provider.enabled) t(Key.ACTIVE) else t(Key.NOT_CONFIGURED),
                            style = MaterialTheme.typography.labelSmall,
                            color = if (provider.enabled) {
                                MaterialTheme.colorScheme.tertiary
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )
                    }
                }
            }
        }

        SectionHeader("Eksekusi Command")
        OutlinedTextField(
            value = execUrl,
            onValueChange = {
                execUrl = it
                store.updatePrefs { p -> p.copy(execUrl = it) }
            },
            label = { Text(t(Key.EXEC_SERVER_URL)) },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        Spacer(Modifier.height(6.dp))
        Text(
            if (prefs.language == ArkaLanguage.ID) {
                "Di Android, run_command memakai eksekusi native (Runtime.exec). URL ini dipertahankan untuk kompatibilitas."
            } else {
                "On Android run_command uses native execution (Runtime.exec). This URL is kept for config compatibility."
            },
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            Button(onClick = {
                scope.launch {
                    execTesting = true
                    execStatus = null
                    execStatus = try {
                        val (code, _) = SimpleHttp.get(execUrl.trim())
                        "${t(Key.EXEC_CONNECTED)} (HTTP $code)"
                    } catch (e: Exception) {
                        "${t(Key.EXEC_FAILED)}: ${e.message.orEmpty().take(60)}"
                    }
                    execTesting = false
                }
            }, enabled = !execTesting) {
                if (execTesting) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text(t(Key.EXEC_TEST))
                }
            }
            Spacer(Modifier.width(8.dp))
            execStatus?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = if (it.startsWith(t(Key.EXEC_CONNECTED))) {
                        MaterialTheme.colorScheme.tertiary
                    } else {
                        MaterialTheme.colorScheme.error
                    },
                )
            }
        }

        SectionHeader(t(Key.MEMORY_SECTION))
        MemoryUsageBar("🧠 Memory", memChars, MEMORY_CHAR_LIMIT, prefs.language)
        MemoryUsageBar("👤 Profil", userChars, USER_CHAR_LIMIT, prefs.language)

        Row(Modifier.padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            MemoryTarget.entries.forEach { target ->
                FilterChip(
                    selected = memTarget == target,
                    onClick = { memTarget = target },
                    label = { Text(if (target == MemoryTarget.MEMORY) "Memory" else "Profil") },
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = memText,
                onValueChange = { memText = it },
                placeholder = { Text("Catatan baru untuk ${if (memTarget == MemoryTarget.MEMORY) "memory" else "profil"}...") },
                singleLine = false,
                minLines = 2,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            IconButton(
                onClick = {
                    val result = memory.add(memTarget, memText.trim())
                    memStatus = if (result.success) null else (result.error
                        ?: "Gagal menambahkan catatan")
                    if (result.success) memText = ""
                    memRefresh++
                },
                enabled = memText.isNotBlank(),
            ) {
                Icon(Icons.Default.Add, contentDescription = "Tambah", tint = MaterialTheme.colorScheme.primary)
            }
        }

        memStatus?.let {
            Text(
                it,
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.error,
                modifier = Modifier.padding(top = 4.dp),
            )
        }

        listOf("🧠 Memory" to memStore.memory, "👤 Profil" to memStore.user).forEach { (label, entries) ->
            if (entries.isNotEmpty()) {
                Text(
                    label,
                    style = MaterialTheme.typography.labelLarge,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                )
                entries.forEach { entry ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 2.dp),
                    ) {
                        Row(
                            Modifier.padding(start = 12.dp, top = 6.dp, bottom = 6.dp, end = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                entry.content,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2,
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = {
                                editing = entry
                                editText = entry.content
                            }) {
                                Icon(Icons.Default.Edit, contentDescription = t(Key.EDIT))
                            }
                            IconButton(onClick = {
                                memory.remove(
                                    if (label.startsWith("👤")) MemoryTarget.USER else MemoryTarget.MEMORY,
                                    entry.content,
                                )
                                memRefresh++
                            }) {
                                Icon(
                                    Icons.Default.Delete,
                                    contentDescription = t(Key.DELETE),
                                    tint = MaterialTheme.colorScheme.error,
                                )
                            }
                        }
                    }
                }
            }
        }

        Row(
            Modifier.fillMaxWidth().padding(top = 8.dp),
            horizontalArrangement = Arrangement.End,
        ) {
            TextButton(onClick = {
                memory.clear()
                memRefresh++
                memStatus = null
            }) {
                Text(t(Key.DELETE) + " semua memory", color = MaterialTheme.colorScheme.error)
            }
        }
        HorizontalDivider(Modifier.padding(vertical = 8.dp))

        SectionHeader(t(Key.APPEARANCE))
        ChoiceRow(
            label = t(Key.THEME),
            options = listOf(t(Key.LIGHT) to "light", t(Key.DARK) to "dark", t(Key.AUTO) to "auto"),
            selected = prefs.theme,
            onSelect = { value -> store.updatePrefs { it.copy(theme = value) } },
        )
        ChoiceRow(
            label = t(Key.FONT_SIZE),
            options = listOf(t(Key.SMALL) to "small", t(Key.MEDIUM) to "medium", t(Key.LARGE) to "large"),
            selected = prefs.fontSize,
            onSelect = { value -> store.updatePrefs { it.copy(fontSize = value) } },
        )

        SectionHeader(t(Key.LANGUAGE))
        ChoiceRow(
            label = "",
            options = listOf(t(Key.INDONESIAN) to ArkaLanguage.ID.name, t(Key.ENGLISH) to ArkaLanguage.EN.name),
            selected = prefs.language.name,
            onSelect = { value ->
                store.updatePrefs {
                    it.copy(language = runCatching { ArkaLanguage.valueOf(value) }.getOrDefault(ArkaLanguage.ID))
                }
            },
        )

        SectionHeader(t(Key.ABOUT))
        Text(
            t(Key.ABOUT_DESC),
            style = MaterialTheme.typography.bodyMedium,
        )
        Spacer(Modifier.height(4.dp))
        Text(
            "Arka Android • v0.1.0",
            style = MaterialTheme.typography.bodySmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        Spacer(Modifier.height(24.dp))
    }

    if (showProviders) {
        ProvidersSheet(store, onDismiss = { showProviders = false })
    }

    editing?.let { entry ->
        AlertDialog(
            onDismissRequest = { editing = null },
            title = { Text("Edit memory") },
            text = {
                OutlinedTextField(
                    value = editText,
                    onValueChange = { editText = it },
                    minLines = 3,
                )
            },
            confirmButton = {
                TextButton(onClick = {
                    val target = if (memStore.memory.any { it.id == entry.id }) {
                        MemoryTarget.MEMORY
                    } else {
                        MemoryTarget.USER
                    }
                    memory.replace(target, entry.content, editText.trim())
                    memRefresh++
                    editing = null
                }) { Text("Simpan") }
            },
            dismissButton = {
                TextButton(onClick = { editing = null }) { Text(t(Key.CANCEL)) }
            },
        )
    }
}

@Composable
private fun SectionHeader(text: String) {
    Text(
        text,
        style = MaterialTheme.typography.titleSmall,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 16.dp, bottom = 8.dp),
    )
}

@Composable
private fun MemoryUsageBar(label: String, used: Int, limit: Int, language: ArkaLanguage) {
    val fraction = (used.toFloat() / limit).coerceIn(0f, 1f)
    val pct = (used.toFloat() * 100 / limit).toInt()
    Column(Modifier.padding(vertical = 4.dp)) {
        Row(Modifier.fillMaxWidth()) {
            Text(label, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f))
            Text(
                "$pct% · $used/$limit",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        LinearProgressIndicator(
            progress = { fraction },
            modifier = Modifier
                .fillMaxWidth()
                .height(6.dp),
        )
    }
}

@Composable
private fun ChoiceRow(
    label: String,
    options: List<Pair<String, String>>,
    selected: String,
    onSelect: (String) -> Unit,
) {
    Column(Modifier.padding(vertical = 4.dp)) {
        if (label.isNotEmpty()) {
            Text(label, style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.height(4.dp))
        }
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            options.forEach { (display, value) ->
                FilterChip(
                    selected = selected == value,
                    onClick = { onSelect(value) },
                    label = { Text(display) },
                )
            }
        }
    }
}