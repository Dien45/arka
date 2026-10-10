package com.arka.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.MAX_SKILL_CONTENT_CHARS
import com.arka.app.core.Skill
import com.arka.app.core.SkillsManager
import com.arka.app.core.Store
import com.arka.app.net.SkillCandidate
import com.arka.app.net.SkillFetcher
import kotlinx.coroutines.launch

/**
 * M11 — Skill Store v2.
 *
 * Perubahan penting dari versi v1 (web maupun Android sebelumnya):
 *  1. Skill dari GitHub **diunduh berkasnya** (format Claude Skills: SKILL.md +
 *     berkas pendukung) lalu disimpan di `filesDir/skills/<id>/` *dan* disalin
 *     ke workspace sesi (`skills/<id>/`). Jadi skill benar-benar bisa dipakai —
 *     AI membacanya lewat tool `skill`/read_file, dan script-nya bisa dijalankan
 *     via run_command (Alpine) dengan approval seperti biasa.
 *  2. Koleksi besar (mis. affaan-m/ecc dengan 1.000+ SKILL.md) bisa dicari dan
 *     dipasang satu per satu: daftar ditampilkan ringan, detail diambil saat
 *     sebuah skill dibuka.
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
    val state by store.state.collectAsState()
    val skills = remember { SkillsManager(context) }

    var refresh by remember { mutableIntStateOf(0) }
    var status by remember { mutableStateOf<String?>(null) }

    // katalog bawaan
    var search by remember { mutableStateOf("") }
    var category by remember { mutableStateOf<String?>(null) }

    // unduh dari repo
    var repoInput by remember { mutableStateOf("") }
    var scanning by remember { mutableStateOf(false) }
    var installing by remember { mutableStateOf(false) }
    var candidates by remember { mutableStateOf<List<SkillCandidate>>(emptyList()) }
    var candidateQuery by remember { mutableStateOf("") }
    var preview by remember { mutableStateOf<SkillCandidate?>(null) }
    var previewLoading by remember { mutableStateOf(false) }

    val token = state.githubToken
    val sessionId = state.currentSessionId ?: "default"

    fun installCandidate(candidate: SkillCandidate) {
        installing = true
        status = "Menyiapkan \"${candidate.name}\"…"
        scope.launch {
            try {
                // Ambil detail (nama/deskripsi/instruksi) bila belum ada.
                val detail = if (candidate.instructions.isBlank()) {
                    runCatching { SkillFetcher.fetchDetail(candidate, token) }.getOrDefault(candidate)
                } else {
                    candidate
                }
                val files = SkillFetcher.downloadFiles(detail, token) { done, total ->
                    status = "Mengunduh ${detail.name}: berkas $done/$total…"
                }
                if (files.isEmpty()) {
                    status = "Gagal: tidak ada berkas yang berhasil diunduh dari ${detail.repo}."
                    installing = false
                    return@launch
                }
                val skill = Skill(
                    id = detail.id,
                    name = detail.name,
                    description = detail.description.ifBlank { "Skill dari ${detail.repo}" },
                    author = detail.author,
                    source = "github",
                    icon = "📦",
                    category = "GitHub",
                    version = detail.version,
                    repo = detail.repo,
                    dir = detail.dir,
                    enhancement = detail.instructions.take(MAX_SKILL_CONTENT_CHARS),
                    custom = true,
                )
                val stored = skills.storeFiles(skill, files)
                skills.addCustom(stored)
                val copied = skills.syncToWorkspace(sessionId)
                refresh++
                preview = null
                status = "✅ \"${stored.name}\" terpasang: ${stored.files.size} berkas disimpan" +
                    (if (copied > 0) " (+$copied disalin ke workspace sesi ini → folder skills/${stored.id}/)." else ".")
            } catch (e: Exception) {
                status = "Gagal memasang ${candidate.name}: ${e.message}"
            }
            installing = false
        }
    }

    fun scanRepo() {
        scanning = true
        status = "Membaca daftar skill dari ${repoInput.trim()}…"
        candidates = emptyList()
        scope.launch {
            try {
                val found = SkillFetcher.discover(repoInput, token).distinctBy { it.id }
                candidates = found
                status = if (found.isEmpty()) {
                    "Tidak ada skill yang ditemukan."
                } else {
                    "Ditemukan ${found.size} skill. Cari, buka untuk melihat detail, lalu Pasang."
                }
                // Repo dengan satu skill: langsung buka detailnya.
                if (found.size == 1) {
                    previewLoading = true
                    preview = runCatching { SkillFetcher.fetchDetail(found.first(), token) }.getOrNull() ?: found.first()
                    previewLoading = false
                }
            } catch (e: Exception) {
                status = "Gagal membaca repo: ${e.message}"
            }
            scanning = false
        }
    }

    val allCatalog = remember(refresh) { skills.allSkills() }
    val installedSkills = remember(refresh) { skills.installedSkills() }
    val categories = allCatalog.map { it.category }.distinct().sorted()
    val visibleCatalog = allCatalog.filter { skill ->
        (category == null || skill.category == category || skill.id in skills.installedIds()) &&
            (search.isBlank() || skill.name.contains(search, true) || skill.description.contains(search, true))
    }
    val visibleCandidates = candidates
        .filter { candidateQuery.isBlank() || it.name.contains(candidateQuery, true) || it.dir.contains(candidateQuery, true) }
        .take(300)

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("Skill Store") },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) { Icon(Icons.Default.Menu, contentDescription = "Menu") }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 12.dp),
        ) {
            Text(
                "Skill yang dipasang dari GitHub disimpan lengkap berkasnya di perangkat, lalu disalin ke workspace " +
                    "sesi (skills/<id>/). AI membacanya lewat tool `skill` dan bisa menjalankan script-nya lewat " +
                    "run_command — jadi bukan cuma tempelan teks di prompt.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            status?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(vertical = 6.dp),
                )
            }

            // ------------------------------------------------ pasang dari GitHub
            Card(
                colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            ) {
                Column(Modifier.padding(10.dp)) {
                    Text("Pasang dari GitHub", style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
                    Text(
                        "Masukkan repo berisi skill (folder dengan SKILL.md, atau skill.json/prompt.md). " +
                            "Contoh: affaan-m/ecc",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 6.dp)) {
                        OutlinedTextField(
                            value = repoInput,
                            onValueChange = { repoInput = it },
                            label = { Text("user/repo atau URL GitHub") },
                            singleLine = true,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(Modifier.width(8.dp))
                        Button(onClick = { scanRepo() }, enabled = repoInput.isNotBlank() && !scanning && !installing) {
                            if (scanning) {
                                CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            } else {
                                Text("Baca")
                            }
                        }
                    }

                    if (candidates.isNotEmpty()) {
                        OutlinedTextField(
                            value = candidateQuery,
                            onValueChange = { candidateQuery = it },
                            label = { Text("Cari di ${candidates.size} skill…") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                        )
                        Text(
                            "Menampilkan ${visibleCandidates.size} dari ${candidates.size}",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(top = 4.dp),
                        )
                        LazyColumn(
                            Modifier
                                .fillMaxWidth()
                                .heightIn(max = 280.dp),
                        ) {
                            items(visibleCandidates, key = { it.id + "|" + it.dir }) { candidate ->
                                Row(
                                    Modifier
                                        .fillMaxWidth()
                                        .padding(vertical = 4.dp),
                                    verticalAlignment = Alignment.CenterVertically,
                                ) {
                                    Column(Modifier.weight(1f)) {
                                        Text(candidate.name, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                                        Text(
                                            "${candidate.dir.ifBlank { "(root repo)" }} · ${candidate.files.size} berkas",
                                            style = MaterialTheme.typography.labelSmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                            maxLines = 1,
                                        )
                                    }
                                    TextButton(onClick = {
                                        previewLoading = true
                                        preview = candidate
                                        scope.launch {
                                            preview = runCatching { SkillFetcher.fetchDetail(candidate, token) }
                                                .getOrDefault(candidate)
                                            previewLoading = false
                                        }
                                    }) { Text("Detail") }
                                    TextButton(
                                        onClick = { installCandidate(candidate) },
                                        enabled = !installing,
                                    ) { Text("Pasang") }
                                }
                            }
                        }
                    }
                }
            }

            // ------------------------------------------------ terpasang
            Text(
                "Terpasang (${installedSkills.size})",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
            )
            if (installedSkills.isEmpty()) {
                Text(
                    "Belum ada skill terpasang.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            installedSkills.forEach { skill ->
                val fileCount = remember(refresh, skill.id) { skills.cachedFiles(skill).size }
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(skill.icon)
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(skill.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                Text(
                                    buildString {
                                        append("id: ${skill.id}")
                                        if (fileCount > 0) append(" · $fileCount berkas")
                                        if (skill.repo != null) append(" · ${skill.repo}")
                                    },
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    maxLines = 1,
                                )
                            }
                        }
                        if (skill.description.isNotBlank()) {
                            Text(
                                skill.description,
                                style = MaterialTheme.typography.bodySmall,
                                maxLines = 2,
                                modifier = Modifier.padding(top = 4.dp),
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 4.dp)) {
                            if (fileCount > 0) {
                                TextButton(onClick = {
                                    val copied = skills.syncToWorkspace(sessionId)
                                    status = "Disalin $copied berkas ke workspace sesi ini (skills/${skill.id}/)."
                                    refresh++
                                }) { Text("Salin ke sesi ini") }
                            }
                            TextButton(onClick = {
                                skills.uninstall(skill.id)
                                skills.removeFromWorkspace(sessionId, skill.id)
                                refresh++
                                status = "\"${skill.name}\" dilepas."
                            }) { Text("Lepas", color = MaterialTheme.colorScheme.error) }
                        }
                    }
                }
            }

            // ------------------------------------------------ katalog bawaan
            Text(
                "Katalog bawaan (prompt-only)",
                style = MaterialTheme.typography.titleSmall,
                fontWeight = FontWeight.SemiBold,
                modifier = Modifier.padding(top = 14.dp, bottom = 4.dp),
            )
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
                FilterChip(selected = category == null, onClick = { category = null }, label = { Text("Semua") })
                categories.forEach { cat ->
                    FilterChip(
                        selected = category == cat,
                        onClick = { category = if (category == cat) null else cat },
                        label = { Text(cat, maxLines = 1) },
                    )
                }
            }
            visibleCatalog.forEach { skill ->
                val installed = skill.id in skills.installedIds()
                Card(
                    colors = CardDefaults.cardColors(
                        containerColor = if (installed) {
                            MaterialTheme.colorScheme.secondaryContainer
                        } else {
                            MaterialTheme.colorScheme.surfaceContainerHigh
                        },
                    ),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 3.dp),
                ) {
                    Column(Modifier.padding(10.dp)) {
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(skill.icon)
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(skill.name, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                                Text(
                                    "${skill.author} · v${skill.version} · ${skill.category}",
                                    style = MaterialTheme.typography.labelSmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            TextButton(onClick = {
                                if (installed) skills.uninstall(skill.id) else skills.install(skill.id)
                                refresh++
                                status = if (installed) "Skill \"${skill.name}\" dinonaktifkan." else "Skill \"${skill.name}\" aktif."
                            }) { Text(if (installed) "Buang" else "Install") }
                        }
                        Text(skill.description, style = MaterialTheme.typography.bodySmall)
                        if (installed && skill.modes.isNotEmpty()) {
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
                    }
                }
            }

            Spacer(Modifier.height(40.dp))
        }
    }

    // ---------------------------------------------------------------- dialog detail
    preview?.let { candidate ->
        AlertDialog(
            onDismissRequest = { preview = null },
            title = { Text(candidate.name) },
            text = {
                Column(
                    Modifier
                        .heightIn(max = 420.dp)
                        .verticalScroll(rememberScrollState()),
                ) {
                    Text(
                        "${candidate.repo}${if (candidate.dir.isNotBlank()) " · ${candidate.dir}" else ""}",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    if (previewLoading) {
                        Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 8.dp)) {
                            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                            Spacer(Modifier.width(8.dp))
                            Text("Membaca SKILL.md…", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                    if (candidate.description.isNotBlank()) {
                        Text(
                            candidate.description,
                            style = MaterialTheme.typography.bodySmall,
                            modifier = Modifier.padding(top = 6.dp),
                        )
                    }
                    Text(
                        "Berkas (${candidate.files.size}): ${candidate.files.take(10).joinToString(", ") { it.path }}" +
                            if (candidate.files.size > 10) ", …" else "",
                        style = MaterialTheme.typography.labelSmall,
                        fontFamily = FontFamily.Monospace,
                        modifier = Modifier.padding(top = 8.dp),
                    )
                    if (candidate.instructions.isNotBlank()) {
                        Text(
                            "Pratinjau instruksi:",
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.SemiBold,
                            modifier = Modifier.padding(top = 8.dp),
                        )
                        Text(
                            candidate.instructions.take(1200),
                            style = MaterialTheme.typography.bodySmall,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(6.dp))
                                .background(MaterialTheme.colorScheme.surfaceVariant)
                                .padding(8.dp),
                        )
                    }
                }
            },
            confirmButton = {
                TextButton(
                    onClick = { installCandidate(candidate) },
                    enabled = !installing,
                ) { Text(if (installing) "Memasang…" else "Pasang") }
            },
            dismissButton = { TextButton(onClick = { preview = null }) { Text("Batal") } },
        )
    }
}
