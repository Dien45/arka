package com.arka.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.MAX_SKILL_CONTENT_CHARS
import com.arka.app.core.Skill
import com.arka.app.core.SkillsManager
import com.arka.app.core.Store
import com.arka.app.net.SimpleHttp
import kotlinx.coroutines.launch
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow

/**
 * M9 — Skill Store.
 *
 * Port dari `src/components/SkillStore.tsx`: katalog 13 skill + install dari
 * repo GitHub (`skill.json` / `prompt.md`) + pilih mode/config. Skill aktif
 * disuntikkan ke system prompt Chat (lihat SkillsManager.enhancementBlock).
 * Konten skill pihak ketiga diperlakukan sebagai data (anti prompt-injection).
 */
@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun SkillStoreScreen(
    store: Store,
    modifier: Modifier = Modifier,
    onOpenDrawer: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val skills = remember { SkillsManager(context) }
    val json = remember { Json { ignoreUnknownKeys = true } }

    var refresh by remember { mutableIntStateOf(0) }
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }
    var customInput by remember { mutableStateOf("") }
    var customLoading by remember { mutableStateOf(false) }
    var preview by remember { mutableStateOf<Skill?>(null) }
    var status by remember { mutableStateOf<String?>(null) }

    val all = remember(refresh) { skills.allSkills() }
    val categories = all.map { it.category }.distinct().sorted()
    val filtered = all.filter { skill ->
        (category == null || skill.category == category) &&
            (search.isBlank() || skill.name.contains(search, ignoreCase = true) ||
                skill.description.contains(search, ignoreCase = true))
    }

    fun fetchCustomSkill(repoInput: String) {
        var repoPath = repoInput.trim()
        if (repoPath.contains("github.com")) {
            repoPath = Regex("github\\.com/([^/]+/[^/]+)").find(repoPath)?.groupValues?.get(1) ?: repoPath
        }
        repoPath = repoPath.removeSuffix(".git")
        if (!Regex("^[\\w.-]+/[\\w.-]+$").matches(repoPath)) {
            status = "Format tidak valid. Gunakan \"username/repo\" atau URL GitHub lengkap."
            return
        }
        customLoading = true
        status = "Mengambil skill dari $repoPath…"
        scope.launch {
            try {
                var name = repoPath.substringAfter('/')
                var description = ""
                var enhancement = ""
                var version = "custom"

                val metaResponse = runCatching {
                    SimpleHttp.get("https://raw.githubusercontent.com/$repoPath/main/skill.json")
                }.getOrNull()
                if (metaResponse != null && metaResponse.first in 200..299) {
                    val obj = runCatching { json.parseToJsonElement(metaResponse.second).jsonObject }.getOrNull()
                    name = obj?.get("name")?.jsonPrimitive?.contentOrNull ?: name
                    description = obj?.get("description")?.jsonPrimitive?.contentOrNull ?: ""
                    enhancement = obj?.get("enhancement")?.jsonPrimitive?.contentOrNull ?: ""
                    version = obj?.get("version")?.jsonPrimitive?.contentOrNull ?: version
                }

                val promptResponse = runCatching {
                    SimpleHttp.get("https://raw.githubusercontent.com/$repoPath/main/prompt.md")
                }.getOrNull()
                if (promptResponse != null && promptResponse.first in 200..299 && promptResponse.second.isNotBlank()) {
                    enhancement = promptResponse.second
                }
                if (enhancement.isBlank()) {
                    enhancement = "Custom skill dari $repoPath. Gunakan kemampuannya saat relevan."
                }

                preview = Skill(
                    id = "custom-${repoPath.replace('/', '-')}",
                    name = name,
                    description = description.ifBlank { "Skill dari $repoPath" },
                    author = repoPath.substringBefore('/'),
                    source = "github",
                    icon = "📦",
                    category = "Custom",
                    version = version,
                    repo = repoPath,
                    enhancement = enhancement.take(MAX_SKILL_CONTENT_CHARS),
                    custom = true,
                )
                status = "Pratinjau siap — periksa lalu tekan Install."
            } catch (e: Exception) {
                status = "Gagal mengambil skill: ${e.message}"
            }
            customLoading = false
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Skill Store") },
                navigationIcon = {
                    IconButtonCompat(onOpenDrawer)
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .padding(horizontal = 12.dp),
        ) {
            status?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }

            OutlinedTextField(
                value = search,
                onValueChange = { search = it },
                label = { Text("Cari skill…") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )

            FlowRow(
                Modifier.fillMaxWidth().padding(vertical = 6.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                FilterChip(
                    selected = category == null,
                    onClick = { category = null },
                    label = { Text("Semua") },
                )
                categories.forEach { cat ->
                    FilterChip(
                        selected = category == cat,
                        onClick = { category = if (category == cat) null else cat },
                        label = { Text(cat, maxLines = 1) },
                    )
                }
            }

            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                modifier = Modifier.fillMaxWidth(),
            ) {
                Column(Modifier.padding(10.dp)) {
                    Text("Install dari URL", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Repo GitHub yang punya skill.json / prompt.md (mis. user/repo).",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                        OutlinedTextField(
                            value = customInput,
                            onValueChange = { customInput = it },
                            label = { Text("user/repo") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(Modifier.width(8.dp))
                        Button(
                            onClick = { fetchCustomSkill(customInput) },
                            enabled = customInput.isNotBlank() && !customLoading,
                        ) {
                            if (customLoading) {
                                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Muat")
                            }
                        }
                    }
                }
            }

            Spacer(Modifier.height(6.dp))
            Text(
                "${skills.installedIds().size} skill aktif · ${all.size} tersedia",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            LazyColumn(Modifier.fillMaxWidth()) {
                items(filtered, key = { it.id }) { skill ->
                    val installed = skills.isInstalled(skill.id)
                    Card(
                        colors = CardDefaults.cardColors(
                            containerColor = if (installed) {
                                MaterialTheme.colorScheme.secondaryContainer
                            } else {
                                MaterialTheme.colorScheme.surfaceContainerHigh
                            },
                        ),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Column(Modifier.padding(12.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text(skill.icon, style = MaterialTheme.typography.titleMedium)
                                Spacer(Modifier.width(8.dp))
                                Column(Modifier.weight(1f)) {
                                    Text(skill.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                                    Text(
                                        "${skill.author} · v${skill.version} · ${skill.category}",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                                TextButton(onClick = {
                                    if (installed) {
                                        skills.uninstall(skill.id)
                                    } else {
                                        skills.install(skill.id)
                                    }
                                    refresh++
                                    status = if (installed) "Skill \"${skill.name}\" dinonaktifkan." else "Skill \"${skill.name}\" aktif."
                                }) { Text(if (installed) "Buang" else "Install") }
                            }
                            Spacer(Modifier.height(4.dp))
                            Text(skill.description, style = MaterialTheme.typography.bodySmall)

                            if (installed && skill.modes.isNotEmpty()) {
                                Text(
                                    "Mode (${skills.configOf(skill.id) ?: skill.modes.first()})",
                                    style = MaterialTheme.typography.labelSmall,
                                    modifier = Modifier.padding(top = 6.dp),
                                )
                                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                                    skill.modes.forEach { mode ->
                                        FilterChip(
                                            selected = (skills.configOf(skill.id) ?: skill.modes.first()) == mode,
                                            onClick = {
                                                skills.setConfig(skill.id, mode)
                                                refresh++
                                            },
                                            label = { Text(mode, maxLines = 1) },
                                        )
                                    }
                                }
                            }
                            if (skill.custom) {
                                Text(
                                    "Sumber: ${skill.repo ?: "URL"}. Konten pihak ketiga diperlakukan sebagai data, bukan instruksi.",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(top = 4.dp),
                                )
                            }
                        }
                    }
                }
            }
        }
    }

    preview?.let { skill ->
        AlertDialog(
            onDismissRequest = { preview = null },
            title = { Text("Install \"${skill.name}\"?") },
            text = {
                Column {
                    Text(skill.description, style = MaterialTheme.typography.bodySmall)
                    Spacer(Modifier.height(8.dp))
                    Text("Pratinjau instruksi:", style = MaterialTheme.typography.labelMedium, fontWeight = FontWeight.SemiBold)
                    Text(
                        skill.enhancement.take(1200),
                        style = MaterialTheme.typography.bodySmall,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.heightIn(max = 220.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    skills.addCustom(skill)
                    refresh++
                    status = "Skill \"${skill.name}\" terpasang & aktif."
                    preview = null
                }) { Text("Install") }
            },
            dismissButton = { TextButton(onClick = { preview = null }) { Text("Batal") } },
        )
    }
}

@Composable
private fun IconButtonCompat(onClick: () -> Unit) {
    androidx.compose.material3.IconButton(onClick = onClick) {
        androidx.compose.material3.Icon(Icons.Default.Menu, contentDescription = "Menu")
    }
}
