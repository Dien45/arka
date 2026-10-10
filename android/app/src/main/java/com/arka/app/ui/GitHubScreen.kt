package com.arka.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.RadioButtonUnchecked
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Switch
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.unit.dp
import com.arka.app.core.Action
import com.arka.app.core.GitHubRepo
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.StagedCommit
import com.arka.app.core.StagedCommits
import com.arka.app.core.Store
import com.arka.app.core.VirtualFs
import com.arka.app.net.GitHubApi
import com.arka.app.net.GitHubFilePayload
import com.arka.app.net.SyncManifest
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json

/**
 * M8 — Integrasi GitHub (paritas panel GitHub di web, versi native).
 *
 * Cakupan: hubungkan PAT (disimpan di EncryptedSharedPreferences), daftar repo +
 * pencarian, pilih branch, buat repo baru, push file workspace pilihan lewat
 * Git Data API, push "Staged AI Commits" hasil tool stage_commit, serta
 * ekspor/impor SyncManifest lewat SAF.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GitHubScreen(
    store: Store,
    modifier: Modifier = Modifier,
    onOpenDrawer: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val t = { k: String -> I18n.t(prefs.language, k) }
    val fs = remember { VirtualFs(context) }
    val stagedStore = remember { StagedCommits(context) }
    val json = remember { Json { ignoreUnknownKeys = true; prettyPrint = true; encodeDefaults = true } }

    val sessionId = state.currentSessionId ?: "default"

    var tokenInput by remember { mutableStateOf("") }
    var showToken by remember { mutableStateOf(false) }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var search by remember { mutableStateOf("") }
    var selectedRepo by remember { mutableStateOf<GitHubRepo?>(null) }
    var branches by remember { mutableStateOf(listOf<String>()) }
    var selectedBranch by remember { mutableStateOf<String?>(null) }
    var staged by remember { mutableStateOf(stagedStore.load()) }
    var selectedFiles by remember { mutableStateOf(setOf<String>()) }
    var commitMessage by remember { mutableStateOf("") }
    var stagedPushTarget by remember { mutableStateOf<StagedCommit?>(null) }
    var refreshKey by remember { mutableIntStateOf(0) }
    var showCreateRepo by remember { mutableStateOf(false) }
    var newRepoName by remember { mutableStateOf("") }
    var newRepoPrivate by remember { mutableStateOf(true) }

    val files = remember(refreshKey, sessionId) { fs.list(sessionId) }
    val filteredRepos = state.githubRepos.filter {
        search.isBlank() || it.fullName.contains(search, ignoreCase = true)
    }

    fun connect(token: String) {
        busy = true
        status = "Menghubungkan…"
        scope.launch {
            try {
                val user = GitHubApi.getUser(token)
                val repos = GitHubApi.fetchRepos(token)
                store.dispatch(Action.SetGithubToken(token))
                store.dispatch(Action.SetGithubRepos(repos))
                store.dispatch(Action.SetGithubConnected(true))
                val excessive = GitHubApi.getExcessiveScopes(user.scopes)
                status = buildString {
                    append("Terhubung sebagai ${user.login} · ${repos.size} repo")
                    if (user.scopes.isNotEmpty()) append(" · scope: ${user.scopes.joinToString(",")}")
                    if (excessive.isNotEmpty()) {
                        append("\n⚠️ Token punya scope berlebih (${excessive.joinToString(", ")}). " +
                            "Disarankan hanya scope \"repo\".")
                    }
                }
                tokenInput = ""
            } catch (e: Exception) {
                status = "Gagal: ${e.message}"
            }
            busy = false
        }
    }

    fun loadBranches(repo: GitHubRepo) {
        selectedRepo = repo
        selectedBranch = repo.defaultBranch
        selectedFiles = files.map { it.first }.toSet()
        busy = true
        scope.launch {
            branches = runCatching { GitHubApi.fetchBranches(state.githubToken, repo.fullName) }
                .getOrElse {
                    status = "Gagal mengambil branch: ${it.message}"
                    listOf(repo.defaultBranch)
                }
            if (selectedBranch !in branches) selectedBranch = branches.firstOrNull()
            busy = false
        }
    }

    fun push(message: String, payload: List<GitHubFilePayload>) {
        val repo = selectedRepo
        val branch = selectedBranch
        if (repo == null || branch == null) {
            status = "Pilih repo & branch dulu."
            return
        }
        if (message.isBlank()) {
            status = "Commit message tidak boleh kosong."
            return
        }
        busy = true
        status = "Push ke ${repo.fullName}@$branch…"
        scope.launch {
            val result = GitHubApi.pushFiles(state.githubToken, repo.fullName, branch, payload, message)
            status = result.message
            busy = false
        }
    }

    // --------------------------------------------------------------- SAF sync

    val manifestImporter = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val manifest = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        json.decodeFromString<SyncManifest>(stream.readBytes().decodeToString())
                    }
                }.getOrNull()
            }
            if (manifest == null) {
                status = "Manifest tidak bisa dibaca."
            } else {
                store.state.value.githubRepos.find { it.fullName == manifest.repoFullName }?.let { repo ->
                    loadBranches(repo)
                }
                selectedFiles = manifest.files.filter { path -> files.any { it.first == path } }.toSet()
                selectedBranch = manifest.branch
                status = "Manifest dimuat: ${manifest.repoFullName}@${manifest.branch}, ${manifest.files.size} file."
            }
        }
    }

    val manifestExporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/json")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val manifest = SyncManifest(
                repoFullName = selectedRepo?.fullName ?: "",
                branch = selectedBranch ?: "main",
                files = selectedFiles.toList(),
            )
            val ok = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        out.write(json.encodeToString(SyncManifest.serializer(), manifest).toByteArray())
                    }
                    true
                }.getOrDefault(false)
            }
            status = if (ok) "Manifest diekspor." else "Gagal mengekspor manifest."
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("GitHub") },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) { Icon(Icons.Default.Menu, contentDescription = "Menu") }
                },
                actions = {
                    if (state.githubConnected) {
                        IconButton(onClick = {
                            busy = true
                            scope.launch {
                                try {
                                    val repos = GitHubApi.fetchRepos(state.githubToken)
                                    store.dispatch(Action.SetGithubRepos(repos))
                                    status = "${repos.size} repo dimuat ulang."
                                } catch (e: Exception) {
                                    status = "Gagal: ${e.message}"
                                }
                                busy = false
                            }
                        }) { Icon(Icons.Default.Refresh, contentDescription = "Muat ulang repo") }
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp),
        ) {
            status?.let {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                    modifier = Modifier.fillMaxWidth().padding(vertical = 6.dp),
                ) {
                    Text(it, style = MaterialTheme.typography.bodySmall, modifier = Modifier.padding(10.dp))
                }
            }
            if (busy) {
                Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(vertical = 4.dp)) {
                    CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                    Spacer(Modifier.width(8.dp))
                    Text(t(Key.WORKING), style = MaterialTheme.typography.bodySmall)
                }
            }

            // -------------------------------------------------------- connect
            if (!state.githubConnected) {
                Text(t(Key.CONNECT_ACCOUNT), style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                Text(
                    "Buat Personal Access Token di GitHub (Settings → Developer settings), scope minimal \"repo\", " +
                        "lalu tempel di sini. Token disimpan terenkripsi (EncryptedSharedPreferences).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                OutlinedTextField(
                    value = tokenInput,
                    onValueChange = { tokenInput = it },
                    label = { Text("Personal Access Token") },
                    singleLine = true,
                    visualTransformation = if (showToken) {
                        androidx.compose.ui.text.input.VisualTransformation.None
                    } else {
                        PasswordVisualTransformation()
                    },
                    trailingIcon = {
                        TextButton(onClick = { showToken = !showToken }) { Text(if (showToken) "🙈" else "👁") }
                    },
                    modifier = Modifier.fillMaxWidth(),
                )
                Spacer(Modifier.height(8.dp))
                Button(
                    onClick = { connect(tokenInput.trim()) },
                    enabled = tokenInput.isNotBlank() && !busy,
                    modifier = Modifier.fillMaxWidth(),
                ) { Text(t(Key.CONNECT)) }
            } else {
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.secondaryContainer),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(t(Key.CONNECTED_SHORT), style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(
                            "${state.githubRepos.size} repository tersedia",
                            style = MaterialTheme.typography.bodySmall,
                        )
                    }
                }
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 8.dp)) {
                    OutlinedButton(onClick = { showCreateRepo = true }, enabled = !busy) { Text(t(Key.NEW_REPO)) }
                    OutlinedButton(onClick = {
                        store.dispatch(Action.SetGithubToken(""))
                        store.dispatch(Action.SetGithubRepos(emptyList()))
                        store.dispatch(Action.SetGithubConnected(false))
                        selectedRepo = null
                        status = "Token dihapus."
                    }) { Text(t(Key.DISCONNECT)) }
                }

                // ------------------------------------------------------ repos
                Text(
                    t(Key.SELECT_REPO),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                )
                OutlinedTextField(
                    value = search,
                    onValueChange = { search = it },
                    label = { Text(t(Key.SEARCH_REPO)) },
                    singleLine = true,
                    modifier = Modifier.fillMaxWidth(),
                )
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 220.dp)) {
                    items(filteredRepos, key = { it.id }) { repo ->
                        val active = repo.fullName == selectedRepo?.fullName
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clip(androidx.compose.foundation.shape.RoundedCornerShape(8.dp))
                                .clickable { loadBranches(repo) }
                                .padding(vertical = 8.dp, horizontal = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(if (repo.isPrivate) "🔒" else "🌍")
                            Spacer(Modifier.width(8.dp))
                            Column(Modifier.weight(1f)) {
                                Text(
                                    repo.fullName,
                                    style = MaterialTheme.typography.bodyMedium,
                                    fontWeight = if (active) FontWeight.Bold else FontWeight.Normal,
                                )
                                repo.description?.takeIf { it.isNotBlank() }?.let {
                                    Text(
                                        it,
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        maxLines = 1,
                                    )
                                }
                            }
                            if (active) Icon(Icons.Default.CheckCircle, contentDescription = null, tint = MaterialTheme.colorScheme.primary)
                        }
                        HorizontalDivider()
                    }
                }

                // ----------------------------------------------------- branch
                selectedRepo?.let { repo ->
                    Text(
                        "${t(Key.BRANCH)} (${repo.fullName})",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.SemiBold,
                        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
                    )
                    LazyRow(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.spacedBy(6.dp),
                    ) {
                        items(branches, key = { it }) { branch ->
                            FilterChip(
                                selected = branch == selectedBranch,
                                onClick = { selectedBranch = branch },
                                label = { Text(branch, maxLines = 1) },
                            )
                        }
                    }
                    OutlinedTextField(
                        value = selectedBranch ?: "",
                        onValueChange = { selectedBranch = it },
                        label = { Text(t(Key.TARGET_BRANCH)) },
                        singleLine = true,
                        modifier = Modifier.fillMaxWidth().padding(top = 4.dp),
                    )
                }

                // ------------------------------------------------- push files
                Text(
                    t(Key.PUSH_FILES),
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    TextButton(onClick = { selectedFiles = files.map { it.first }.toSet() }) { Text(t(Key.SELECT_ALL)) }
                    TextButton(onClick = { selectedFiles = emptySet() }) { Text(t(Key.CLEAR)) }
                    TextButton(onClick = { refreshKey++ }) { Text(t(Key.RELOAD_FILES)) }
                }
                if (files.isEmpty()) {
                    Text(
                        "Workspace sesi ini kosong. Minta AI membuat file (mode Build) atau tambahkan di tab Files.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 260.dp)) {
                    items(files, key = { it.first }) { (path, size) ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .clickable {
                                    selectedFiles = if (path in selectedFiles) selectedFiles - path else selectedFiles + path
                                }
                                .padding(vertical = 2.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Checkbox(checked = path in selectedFiles, onCheckedChange = {
                                selectedFiles = if (path in selectedFiles) selectedFiles - path else selectedFiles + path
                            })
                            Text(path, style = MaterialTheme.typography.bodySmall, modifier = Modifier.weight(1f), maxLines = 1)
                            Text("$size B", style = MaterialTheme.typography.labelSmall)
                        }
                    }
                }
                OutlinedTextField(
                    value = commitMessage,
                    onValueChange = { commitMessage = it },
                    label = { Text(t(Key.COMMIT_MESSAGE)) },
                    placeholder = { Text("feat: tambah fitur X") },
                    modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
                )
                Button(
                    onClick = {
                        val payload = files
                            .filter { it.first in selectedFiles }
                            .map { (path, _) -> GitHubFilePayload(path, fs.read(sessionId, path) ?: "") }
                        push(commitMessage, payload)
                    },
                    enabled = !busy && selectedRepo != null && selectedFiles.isNotEmpty() && commitMessage.isNotBlank(),
                    modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
                ) { Text("Push ${selectedFiles.size} file") }

                // ------------------------------------------------ staged AI commits
                Text(
                    "Staged AI Commits (${staged.size})",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 16.dp, bottom = 4.dp),
                )
                Text(
                    "Checkpoint yang dibuat AI lewat tool stage_commit — belum ter-push sampai kamu tekan Push.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                if (staged.isEmpty()) {
                    Text(
                        "Belum ada checkpoint. Minta AI: \"stage commit perubahan ini\".",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        modifier = Modifier.padding(vertical = 6.dp),
                    )
                }
                staged.forEach { commit ->
                    Card(
                        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                        modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                    ) {
                        Column(Modifier.padding(10.dp)) {
                            Text(commit.message, style = MaterialTheme.typography.bodyMedium, fontWeight = FontWeight.SemiBold)
                            Text(
                                "${commit.files.size} file · ${java.text.SimpleDateFormat("dd MMM HH:mm", java.util.Locale("id", "ID")).format(java.util.Date(commit.createdAt))}",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.padding(top = 6.dp)) {
                                TextButton(onClick = { stagedPushTarget = commit }) { Text("Push") }
                                TextButton(onClick = {
                                    stagedStore.remove(commit.id)
                                    staged = stagedStore.load()
                                    status = "Checkpoint dihapus."
                                }) { Text(t(Key.DISCARD), color = MaterialTheme.colorScheme.error) }
                            }
                        }
                    }
                }

                // ---------------------------------------------------- sync manifest
                Text(
                    "SyncManifest",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 12.dp, bottom = 4.dp),
                )
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = {
                        manifestExporter.launch("arka-sync-manifest.json")
                    }) { Text(t(Key.EXPORT)) }
                    OutlinedButton(onClick = { manifestImporter.launch(arrayOf("application/json", "*/*")) }) {
                        Text(t(Key.IMPORT))
                    }
                    OutlinedButton(onClick = {
                        staged = stagedStore.load()
                        refreshKey++
                    }) { Text(t(Key.RELOAD)) }
                }
            }

            Spacer(Modifier.height(32.dp))
        }
    }

    stagedPushTarget?.let { commit ->
        AlertDialog(
            onDismissRequest = { stagedPushTarget = null },
            title = { Text("Push checkpoint") },
            text = { Text("\"${commit.message}\" (${commit.files.size} file) → ${selectedRepo?.fullName ?: "-"}@${selectedBranch ?: "-"}") },
            confirmButton = {
                TextButton(onClick = {
                    val payload = commit.files.map { GitHubFilePayload(it.path, it.content) }
                    push(commit.message, payload)
                    stagedPushTarget = null
                }) { Text("Push") }
            },
            dismissButton = { TextButton(onClick = { stagedPushTarget = null }) { Text("Batal") } },
        )
    }

    if (showCreateRepo) {
        AlertDialog(
            onDismissRequest = { showCreateRepo = false },
            title = { Text("Repository baru") },
            text = {
                Column {
                    OutlinedTextField(
                        value = newRepoName,
                        onValueChange = { newRepoName = it },
                        label = { Text("Nama repo") },
                        singleLine = true,
                    )
                    Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 8.dp)) {
                        Switch(checked = newRepoPrivate, onCheckedChange = { newRepoPrivate = it })
                        Spacer(Modifier.width(8.dp))
                        Text("Private", style = MaterialTheme.typography.bodySmall)
                    }
                }
            },
            confirmButton = {
                TextButton(onClick = {
                    val name = newRepoName.trim()
                    showCreateRepo = false
                    if (name.isEmpty()) return@TextButton
                    busy = true
                    scope.launch {
                        try {
                            val repo = GitHubApi.createRepo(state.githubToken, name, newRepoPrivate)
                            store.dispatch(Action.SetGithubRepos(listOf(repo) + state.githubRepos))
                            loadBranches(repo)
                            status = "Repo ${repo.fullName} dibuat."
                        } catch (e: Exception) {
                            status = "Gagal membuat repo: ${e.message}"
                        }
                        busy = false
                    }
                }) { Text("Buat") }
            },
            dismissButton = { TextButton(onClick = { showCreateRepo = false }) { Text("Batal") } },
        )
    }
}
