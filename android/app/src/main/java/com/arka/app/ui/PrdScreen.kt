package com.arka.app.ui

import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Menu
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
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.PrdDoc
import com.arka.app.core.PrdGenerator
import com.arka.app.core.PrdMessage
import com.arka.app.core.PrdStore
import com.arka.app.core.PrdUtil
import com.arka.app.core.ProviderConfig
import com.arka.app.core.Store
import com.arka.app.core.VirtualFs
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * M9 — Generator PRD (11 bagian) + arsip dokumen.
 *
 * Port dari `src/components/PRDGenerator.tsx`: idea → dokumen Markdown lengkap
 * satu-shot, lalu bisa direvisi (instruksi lanjutan), disalin, dibagikan, atau
 * disimpan ke workspace supaya bisa langsung di-push ke GitHub.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun PrdScreen(
    store: Store,
    modifier: Modifier = Modifier,
    onOpenDrawer: () -> Unit = {},
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val prdStore = remember { PrdStore(context) }
    val generator = remember { PrdGenerator() }
    val fs = remember { VirtualFs(context) }

    var docs by remember { mutableStateOf(prdStore.load()) }
    var activeId by remember { mutableStateOf(docs.firstOrNull()?.id) }
    var idea by remember { mutableStateOf("") }
    var revision by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var status by remember { mutableStateOf<String?>(null) }
    var refresh by remember { mutableIntStateOf(0) }

    val active = docs.find { it.id == activeId }

    fun resolveProvider(): ProviderConfig? {
        val selected = prefs.selectedModel
        val base = prefs.selectedProvider?.let { id ->
            state.providers.find { it.id.name == id && it.enabled }
        } ?: state.providers.find { it.model == selected && it.enabled }
            ?: state.providers.find { it.enabled }
        return base?.copy(model = prefs.selectedModel.ifBlank { base.model })
    }

    fun run(ideaText: String, base: PrdDoc?) {
        val provider = resolveProvider()
        if (provider == null) {
            status = "Belum ada provider aktif. Atur di Settings."
            return
        }
        busy = true
        status = if (base == null) "Membuat PRD…" else "Merevisi PRD…"
        scope.launch {
            try {
                val history = base?.messages ?: emptyList()
                val content = generator.generate(ideaText, provider, history)
                val now = System.currentTimeMillis()
                val doc = if (base == null) {
                    PrdDoc(
                        id = "prd_$now",
                        title = PrdUtil.extractTitleFromContent(content) ?: PrdUtil.deriveTitle(ideaText),
                        messages = listOf(
                            PrdMessage("user", ideaText),
                            PrdMessage("assistant", content),
                        ),
                        createdAt = now,
                        updatedAt = now,
                    )
                } else {
                    base.copy(
                        title = PrdUtil.extractTitleFromContent(content) ?: base.title,
                        messages = base.messages + PrdMessage("user", ideaText) + PrdMessage("assistant", content),
                        updatedAt = now,
                    )
                }
                prdStore.upsert(doc)
                docs = prdStore.load().sortedByDescending { it.updatedAt }
                activeId = doc.id
                status = "Selesai (${content.length} karakter)."
                idea = ""
                revision = ""
                refresh++
            } catch (e: Exception) {
                status = "Gagal: ${e.message}"
            }
            busy = false
        }
    }

    Scaffold(
        modifier = modifier,
        topBar = {
            TopAppBar(
                title = { Text("PRD Generator") },
                navigationIcon = {
                    IconButton(onClick = onOpenDrawer) { Icon(Icons.Default.Menu, contentDescription = "Menu") }
                },
                actions = {
                    IconButton(onClick = {
                        docs = prdStore.load().sortedByDescending { it.updatedAt }
                        refresh++
                    }) { Icon(Icons.Default.Add, contentDescription = "Muat ulang daftar") }
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
            Text(
                "Tulis ide produk singkat — Arka menyusun PRD 11 bagian (ringkasan, tujuan, user stories, " +
                    "requirement, KPI, milestone, risiko).",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            status?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.labelSmall,
                    modifier = Modifier.padding(vertical = 4.dp),
                )
            }

            OutlinedTextField(
                value = idea,
                onValueChange = { idea = it },
                label = { Text("Ide produk") },
                placeholder = { Text("mis. Aplikasi pengingat minum obat untuk lansia") },
                minLines = 2,
                modifier = Modifier.fillMaxWidth().padding(top = 6.dp),
            )
            Row(
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                verticalAlignment = Alignment.CenterVertically,
                modifier = Modifier.padding(top = 6.dp),
            ) {
                OutlinedButton(
                    enabled = !busy,
                    onClick = { run(idea, null) },
                ) {
                    if (busy) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text("Buat PRD")
                }
                TextButton(onClick = {
                    idea = ""
                    activeId = null
                    status = "Siap membuat dokumen baru."
                }) { Text("Dokumen baru") }
            }

            if (docs.isNotEmpty()) {
                Text(
                    "Arsip (${docs.size})",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.SemiBold,
                    modifier = Modifier.padding(top = 8.dp),
                )
                LazyColumn(Modifier.fillMaxWidth().heightIn(max = 160.dp)) {
                    items(docs, key = { it.id }) { doc ->
                        Row(
                            Modifier
                                .fillMaxWidth()
                                .padding(vertical = 4.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            FilterChip(
                                selected = doc.id == activeId,
                                onClick = { activeId = doc.id },
                                label = { Text(doc.title.take(28), maxLines = 1) },
                                modifier = Modifier.weight(1f),
                            )
                            IconButton(onClick = {
                                prdStore.remove(doc.id)
                                docs = prdStore.load().sortedByDescending { it.updatedAt }
                                if (activeId == doc.id) activeId = docs.firstOrNull()?.id
                                refresh++
                            }) {
                                Icon(Icons.Default.Delete, contentDescription = "Hapus", tint = MaterialTheme.colorScheme.error)
                            }
                        }
                    }
                }
            }

            active?.let { doc ->
                Spacer(Modifier.height(8.dp))
                Card(
                    colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Column(Modifier.padding(12.dp)) {
                        Text(doc.title, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.Bold)
                        Text(
                            "${doc.latestContent.length} karakter · ${doc.messages.size} pesan",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), modifier = Modifier.padding(top = 6.dp)) {
                            OutlinedButton(onClick = {
                                val clipboard = context.getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager
                                clipboard.setPrimaryClip(ClipData.newPlainText("PRD", doc.latestContent))
                                status = "PRD disalin ke clipboard."
                            }) { Text("Salin") }
                            OutlinedButton(onClick = {
                                val send = Intent(Intent.ACTION_SEND).apply {
                                    type = "text/markdown"
                                    putExtra(Intent.EXTRA_SUBJECT, doc.title)
                                    putExtra(Intent.EXTRA_TEXT, doc.latestContent)
                                }
                                context.startActivity(Intent.createChooser(send, "Bagikan PRD"))
                            }) { Text("Bagikan") }
                            OutlinedButton(onClick = {
                                scope.launch {
                                    val path = "prd/${PrdUtil.slugify(doc.title)}.md"
                                    val ok = withContext(Dispatchers.IO) {
                                        fs.write(state.currentSessionId ?: "default", path, doc.latestContent)
                                    }
                                    status = if (ok) "Disimpan ke workspace: $path" else "Gagal menyimpan ke workspace."
                                }
                            }) { Text("Ke Workspace") }
                        }
                    }
                }

                Spacer(Modifier.height(10.dp))
                MarkdownText(markdown = doc.latestContent)

                Spacer(Modifier.height(12.dp))
                OutlinedTextField(
                    value = revision,
                    onValueChange = { revision = it },
                    label = { Text("Revisi (mis. \"tambahkan section monetisasi\")") },
                    minLines = 2,
                    modifier = Modifier.fillMaxWidth(),
                )
                OutlinedButton(
                    enabled = !busy && revision.isNotBlank(),
                    onClick = { run(revision, doc) },
                    modifier = Modifier.padding(top = 6.dp),
                ) { Text("Kirim revisi") }
            }

            Spacer(Modifier.height(40.dp))
        }
    }
}
