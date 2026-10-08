package com.arka.app.ui

import android.graphics.Color as AndroidColor
import android.webkit.WebView
import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.selection.SelectionContainer
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Upload
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
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
import androidx.compose.ui.viewinterop.AndroidView
import com.arka.app.core.FsEntry
import com.arka.app.core.Store
import com.arka.app.core.VirtualFs
import com.arka.app.core.ZipUtil
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * M7 — File Explorer native untuk workspace sesi.
 *
 * Semua file di sini adalah file **nyata** di `<filesDir>/sessions/<id>/workspace`,
 * folder yang sama yang dipakai `run_command` sebagai cwd dan di-bind ke
 * `/root/workspace` di distro Alpine. Jadi apa yang dibuat AI lewat write_file
 * langsung kelihatan di sini, bisa diedit tangan, lalu dijalankan lewat shell.
 *
 * Fitur: pohon folder, tab file, editor, preview (Markdown/SVG/HTML/CSV),
 * buat file & folder, rename, hapus, impor ZIP/file, unduh ZIP.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun FileExplorerScreen(
    store: Store,
    modifier: Modifier = Modifier,
    onOpenDrawer: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val fs = remember { VirtualFs(context) }
    val state by store.state.collectAsState()

    val sessionId = state.currentSessionId ?: "default"
    var refreshKey by remember { mutableIntStateOf(0) }
    var openTabs by remember(sessionId) { mutableStateOf(listOf<String>()) }
    var activeTab by remember(sessionId) { mutableStateOf<String?>(null) }
    var expanded by remember(sessionId) { mutableStateOf(setOf<String>()) }
    var draft by remember { mutableStateOf("") }
    var dirty by remember { mutableStateOf(false) }
    var previewMode by remember { mutableStateOf(true) }
    var showTree by remember { mutableStateOf(true) }
    var newFileName by remember { mutableStateOf("") }
    var newFolderName by remember { mutableStateOf("") }
    var renameTarget by remember { mutableStateOf<String?>(null) }
    var renameDraft by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<String?>(null) }
    var status by remember { mutableStateOf<String?>(null) }
    var showNewFile by remember { mutableStateOf(false) }
    var showNewFolder by remember { mutableStateOf(false) }

    val entries = remember(refreshKey, sessionId) { fs.tree(sessionId) }
    val files = entries.filterNot { it.isDir }

    fun openFile(path: String) {
        if (path !in openTabs) openTabs = openTabs + path
        activeTab = path
        draft = fs.read(sessionId, path) ?: ""
        dirty = false
        showTree = false
    }

    fun refresh(message: String? = null) {
        refreshKey++
        status = message
    }

    // ------------------------------------------------------------ SAF pickers

    val zipImporter = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val count = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        ZipUtil.importWorkspace(fs, sessionId, stream)
                    } ?: 0
                }.getOrDefault(0)
            }
            refresh("Impor ZIP selesai: $count file ditambahkan.")
        }
    }

    val fileImporter = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val name = queryDisplayName(context, uri) ?: "impor_${System.currentTimeMillis()}.txt"
            val ok = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openInputStream(uri)?.use { stream ->
                        fs.writeBytes(sessionId, name, stream.readBytes())
                    } ?: false
                }.getOrDefault(false)
            }
            refresh(if (ok) "File \"$name\" diimpor." else "Gagal mengimpor file.")
        }
    }

    val zipExporter = rememberLauncherForActivityResult(ActivityResultContracts.CreateDocument("application/zip")) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        scope.launch {
            val count = withContext(Dispatchers.IO) {
                runCatching {
                    context.contentResolver.openOutputStream(uri)?.use { out ->
                        ZipUtil.exportWorkspace(fs, sessionId, out)
                    } ?: 0
                }.getOrDefault(0)
            }
            status = "Ekspor ZIP selesai: $count file."
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text(if (showTree) "Workspace" else (activeTab ?: "File")) },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) {
                        Icon(Icons.Default.Menu, contentDescription = "Menu")
                    }
                },
                actions = {
                    if (showTree) {
                        IconButton(onClick = { refresh("Daftar file diperbarui.") }) {
                            Icon(Icons.Default.Refresh, contentDescription = "Muat ulang")
                        }
                        IconButton(onClick = { fileImporter.launch(arrayOf("*/*")) }) {
                            Icon(Icons.Default.Upload, contentDescription = "Impor file")
                        }
                        IconButton(onClick = { zipImporter.launch(arrayOf("application/zip", "*/*")) }) {
                            Icon(Icons.Default.Add, contentDescription = "Impor ZIP")
                        }
                        IconButton(onClick = {
                            zipExporter.launch("arka-workspace-${sessionId.take(8)}.zip")
                        }) {
                            Icon(Icons.Default.Download, contentDescription = "Unduh ZIP")
                        }
                    } else {
                        IconButton(onClick = { previewMode = !previewMode }) {
                            Icon(Icons.Default.Edit, contentDescription = "Mode edit/preview")
                        }
                        TextButton(
                            onClick = {
                                activeTab?.let { path ->
                                    val ok = fs.write(sessionId, path, draft)
                                    refresh(if (ok) "Tersimpan: $path" else "Gagal menyimpan $path")
                                    dirty = false
                                }
                            },
                            enabled = dirty,
                        ) { Text("Simpan") }
                    }
                },
            )
        },
    ) { padding ->
        Column(
            Modifier
                .fillMaxSize()
                .padding(padding),
        ) {
            status?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 12.dp, vertical = 4.dp),
                )
            }

            if (showTree) {
                TreePane(
                    entries = entries,
                    expanded = expanded,
                    onToggleFolder = { path ->
                        expanded = if (path in expanded) expanded - path else expanded + path
                    },
                    onOpenFile = { openFile(it) },
                    onNewFile = { showNewFile = true },
                    onNewFolder = { showNewFolder = true },
                    onNetworkHint = { status = it },
                )
            } else {
                // Tab bar
                Row(
                    Modifier
                        .fillMaxWidth()
                        .horizontalScroll(rememberScrollState()),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    TextButton(onClick = { showTree = true }) { Text("☰ File") }
                    openTabs.forEach { tab ->
                        val isActive = tab == activeTab
                        FilterChip(
                            selected = isActive,
                            onClick = { openFile(tab) },
                            label = { Text(tab.substringAfterLast('/'), maxLines = 1) },
                        )
                    }
                }
                HorizontalDivider()

                val path = activeTab
                if (path == null) {
                    Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                        Text("Pilih file dari daftar.", style = MaterialTheme.typography.bodyMedium)
                    }
                } else {
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .padding(horizontal = 12.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            path,
                            style = MaterialTheme.typography.labelMedium,
                            fontFamily = FontFamily.Monospace,
                            modifier = Modifier.weight(1f),
                        )
                        IconButton(onClick = {
                            renameTarget = path
                            renameDraft = path
                        }) { Icon(Icons.Default.Edit, contentDescription = "Rename") }
                        IconButton(onClick = { deleteTarget = path }) {
                            Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                        }
                    }

                    if (previewMode) {
                        SelectionContainer {
                            Box(
                                Modifier
                                    .fillMaxSize()
                                    .verticalScroll(rememberScrollState())
                                    .padding(horizontal = 12.dp),
                            ) {
                                FilePreview(path = path, content = draft)
                            }
                        }
                    } else {
                        OutlinedTextField(
                            value = draft,
                            onValueChange = {
                                draft = it
                                dirty = true
                            },
                            textStyle = MaterialTheme.typography.bodySmall.copy(fontFamily = FontFamily.Monospace),
                            modifier = Modifier
                                .fillMaxSize()
                                .padding(horizontal = 8.dp),
                        )
                    }
                }
            }
        }
    }

    if (showNewFile) {
        TextInputDialog(
            title = "File baru",
            label = "Path (mis. src/App.tsx)",
            value = newFileName,
            onValueChange = { newFileName = it },
            onDismiss = { showNewFile = false },
            onConfirm = {
                val name = newFileName.trim()
                if (name.isNotEmpty()) {
                    fs.write(sessionId, name, "")
                    if (name !in openTabs) openTabs = openTabs + name
                    activeTab = name
                    draft = ""
                    dirty = false
                    showTree = false
                    showNewFile = false
                    newFileName = ""
                    refresh("File \"$name\" dibuat.")
                }
            },
        )
    }

    if (showNewFolder) {
        TextInputDialog(
            title = "Folder baru",
            label = "Nama folder",
            value = newFolderName,
            onValueChange = { newFolderName = it },
            onDismiss = { showNewFolder = false },
            onConfirm = {
                val name = newFolderName.trim().trimEnd('/')
                if (name.isNotEmpty()) {
                    val f = fs.resolve(sessionId, "$name/.keep")
                    if (f != null) {
                        f.parentFile?.mkdirs()
                        f.writeText("")
                        refresh("Folder \"$name\" dibuat.")
                    }
                }
                showNewFolder = false
                newFolderName = ""
            },
        )
    }

    renameTarget?.let { path ->
        TextInputDialog(
            title = "Rename / pindahkan",
            label = "Path baru",
            value = renameDraft,
            onValueChange = { renameDraft = it },
            onDismiss = { renameTarget = null },
            onConfirm = {
                val newPath = renameDraft.trim()
                if (newPath.isNotEmpty() && newPath != path) {
                    val content = fs.read(sessionId, path)
                    if (content != null && fs.write(sessionId, newPath, content)) {
                        fs.remove(sessionId, path)
                        openTabs = openTabs.map { if (it == path) newPath else it }
                        if (activeTab == path) activeTab = newPath
                        refresh("Dipindahkan ke $newPath")
                    } else {
                        status = "Gagal memindahkan (path tidak valid?)."
                    }
                }
                renameTarget = null
            },
        )
    }

    deleteTarget?.let { path ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text("Hapus file?") },
            text = { Text(path) },
            confirmButton = {
                TextButton(onClick = {
                    fs.remove(sessionId, path)
                    openTabs = openTabs - path
                    if (activeTab == path) activeTab = openTabs.firstOrNull()
                    deleteTarget = null
                    refresh("Dihapus: $path")
                }) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = { TextButton(onClick = { deleteTarget = null }) { Text("Batal") } },
        )
    }
}

// ------------------------------------------------------------------ tree pane

@Composable
private fun TreePane(
    entries: List<FsEntry>,
    expanded: Set<String>,
    onToggleFolder: (String) -> Unit,
    onOpenFile: (String) -> Unit,
    onNewFile: () -> Unit,
    onNewFolder: () -> Unit,
    onNetworkHint: (String) -> Unit,
) {
    Column(Modifier.fillMaxSize()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 8.dp),
            horizontalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            FilterChip(selected = false, onClick = onNewFile, label = { Text("+ File") })
            FilterChip(selected = false, onClick = onNewFolder, label = { Text("+ Folder") })
        }
        Spacer(Modifier.height(4.dp))

        if (entries.isEmpty()) {
            Column(Modifier.padding(16.dp)) {
                Text("Workspace sesi ini masih kosong.", style = MaterialTheme.typography.bodyMedium)
                Spacer(Modifier.height(6.dp))
                Text(
                    "File yang dibuat AI lewat tool write_file muncul di sini, atau tambahkan sendiri dengan Impor / + File.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                val visible = entries.filter { entry ->
                    val parts = entry.path.split('/')
                    if (parts.size <= 1) entry.isDir || parts.size == 1
                    else (0 until parts.size - 1).all { expanded.contains(parts.take(it + 1).joinToString("/")) }
                }
                items(visible, key = { it.path }) { entry ->
                    val depth = entry.path.count { it == '/' }
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                if (entry.isDir) onToggleFolder(entry.path) else onOpenFile(entry.path)
                            }
                            .padding(start = (12 + depth * 14).dp, top = 8.dp, bottom = 8.dp, end = 12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(if (entry.isDir) (if (entry.path in expanded) "📂" else "📁") else iconFor(entry.path))
                        Spacer(Modifier.width(6.dp))
                        Text(
                            entry.path.substringAfterLast('/'),
                            style = MaterialTheme.typography.bodyMedium,
                            modifier = Modifier.weight(1f),
                            maxLines = 1,
                        )
                        if (!entry.isDir) {
                            Text(
                                "${entry.size} B",
                                style = MaterialTheme.typography.labelSmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }
}

// -------------------------------------------------------------------- preview

@Composable
private fun FilePreview(path: String, content: String) {
    val ext = path.substringAfterLast('.', "").lowercase()
    when (ext) {
        "md", "markdown" -> MarkdownText(markdown = content)
        "svg" -> WebPreview(
            "<html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1\"></head>" +
                "<body style=\"margin:0;background:#ffffff;display:flex;justify-content:center\">$content</body></html>",
            height = 420.dp,
        )
        "html", "htm" -> WebPreview(content, height = 460.dp)
        "csv" -> CsvTable(content)
        else -> Text(
            content.ifEmpty { "(file kosong)" },
            style = MaterialTheme.typography.bodySmall,
            fontFamily = FontFamily.Monospace,
        )
    }
}

@Composable
private fun WebPreview(html: String, height: androidx.compose.ui.unit.Dp) {
    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surface),
        modifier = Modifier
            .fillMaxWidth()
            .height(height)
            .clip(RoundedCornerShape(8.dp)),
    ) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = { ctx ->
                WebView(ctx).apply {
                    settings.javaScriptEnabled = true
                    settings.domStorageEnabled = false
                    // Preview file lokal: tidak boleh memuat apa pun dari jaringan.
                    settings.blockNetworkLoads = true
                    settings.allowFileAccess = false
                    settings.allowContentAccess = false
                    setBackgroundColor(AndroidColor.WHITE)
                }
            },
            update = { view -> view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null) },
        )
    }
}

@Composable
private fun CsvTable(content: String) {
    val rows = content.lines().filter { it.isNotBlank() }.map { it.split(',') }
    if (rows.isEmpty()) {
        Text("(csv kosong)", style = MaterialTheme.typography.bodySmall)
        return
    }
    Column(
        Modifier
            .fillMaxWidth()
            .horizontalScroll(rememberScrollState()),
    ) {
        rows.take(200).forEachIndexed { index, cells ->
            Row(Modifier.fillMaxWidth()) {
                cells.forEach { cell ->
                    Text(
                        cell.trim(),
                        style = if (index == 0) {
                            MaterialTheme.typography.labelMedium.copy(fontWeight = FontWeight.SemiBold)
                        } else {
                            MaterialTheme.typography.bodySmall
                        },
                        modifier = Modifier
                            .width(120.dp)
                            .padding(4.dp),
                        maxLines = 1,
                    )
                }
            }
            HorizontalDivider()
        }
    }
}

// --------------------------------------------------------------------- utils

@Composable
private fun TextInputDialog(
    title: String,
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    onDismiss: () -> Unit,
    onConfirm: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            OutlinedTextField(
                value = value,
                onValueChange = onValueChange,
                label = { Text(label) },
                singleLine = true,
            )
        },
        confirmButton = { TextButton(onClick = onConfirm) { Text("Simpan") } },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Batal") } },
    )
}

private fun iconFor(path: String): String = when (path.substringAfterLast('.', "").lowercase()) {
    "md", "markdown", "txt" -> "📄"
    "kt", "java", "ts", "tsx", "js", "jsx", "py", "go", "rs", "c", "cpp" -> "🧩"
    "json", "yaml", "yml", "toml", "xml" -> "🔧"
    "html", "htm", "svg" -> "🌐"
    "csv" -> "📊"
    "png", "jpg", "jpeg", "webp", "gif" -> "🖼️"
    "zip", "tar", "gz" -> "🗜️"
    else -> "📄"
}

private fun queryDisplayName(context: android.content.Context, uri: android.net.Uri): String? {
    return runCatching {
        context.contentResolver.query(uri, null, null, null, null)?.use { cursor ->
            val index = cursor.getColumnIndex(android.provider.OpenableColumns.DISPLAY_NAME)
            if (index >= 0 && cursor.moveToFirst()) cursor.getString(index) else null
        }
    }.getOrNull()
}
