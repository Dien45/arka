package com.arka.app.ui

import androidx.activity.compose.rememberLauncherForActivityResult
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.CardDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
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
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.DistroManager
import com.arka.app.core.ExecRunner
import com.arka.app.core.Store
import kotlinx.coroutines.launch

/**
 * M8 — Runtime distro untuk `run_command` (satu-satunya backend).
 *
 * `run_command` berjalan di distro Alpine asli via proot (tanpa root): apk, git,
 * python3, node, ... Binary proot dibundel lewat jniLibs (lihat task Gradle
 * downloadProotBinaries); rootfs Alpine diunduh sekali dari sini.
 */
@Composable
fun DistroSection(store: Store) {
    val prefs by store.prefs.collectAsState()
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    val distro = remember { DistroManager(context) }
    val runner = remember { ExecRunner(context, distro) }

    var status by remember { mutableStateOf(distro.status()) }
    var progress by remember { mutableIntStateOf(0) }
    var busy by remember { mutableStateOf(false) }
    var message by remember { mutableStateOf<String?>(null) }
    var diagnostics by remember { mutableStateOf<String?>(null) }
    var showRemove by remember { mutableStateOf(false) }
    var rootfsUrl by remember { mutableStateOf(prefs.distroRootfsUrl) }
    var allowlist by remember { mutableStateOf(prefs.execAllowlist) }

    val filePicker = rememberLauncherForActivityResult(ActivityResultContracts.OpenDocument()) { uri ->
        if (uri == null) return@rememberLauncherForActivityResult
        busy = true
        message = null
        scope.launch {
            distro.installFromUri(uri) { percent, label ->
                progress = percent
                message = label
            }
                .onSuccess {
                    message = "Alpine terpasang dari file lokal."
                    status = distro.status()
                }
                .onFailure { e -> message = "Gagal memasang: ${e.message}" }
            busy = false
            progress = 0
        }
    }

    fun runDiagnostics() {
        busy = true
        diagnostics = null
        scope.launch {
            val settings = prefs.toExecSettings()
            diagnostics = try {
                val result = runner.run(distro.diagnosticCommand(), null, settings)
                buildString {
                    append("backend: ").append(result.backend).append('\n')
                    append("exit: ").append(result.exitCode).append('\n')
                    if (result.stdout.isNotBlank()) append(result.stdout)
                    if (result.stderr.isNotBlank()) append("\n[stderr]\n").append(result.stderr)
                }
            } catch (e: Exception) {
                "Gagal menjalankan: ${e.message}"
            }
            busy = false
        }
    }

    Text(
        "Command & Distro",
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        modifier = Modifier.padding(top = 8.dp, bottom = 4.dp),
    )
    Text(
        "run_command berjalan di distro Alpine (proot, tanpa root). Pasang rootfs di bawah ini dulu " +
            "sebelum AI bisa menjalankan perintah.",
        style = MaterialTheme.typography.bodySmall,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 8.dp),
    )

    Card(
        colors = CardDefaults.cardColors(containerColor = MaterialTheme.colorScheme.surfaceContainerHigh),
        modifier = Modifier.fillMaxWidth().padding(top = 8.dp),
    ) {
        Column(Modifier.padding(12.dp)) {
            Text(
                "Distro: Alpine · ${status.abi}",
                style = MaterialTheme.typography.bodyMedium,
                fontWeight = FontWeight.SemiBold,
            )
            Spacer(Modifier.height(4.dp))
            Text(status.message, style = MaterialTheme.typography.bodySmall)
            if (!status.prootAvailable || !status.loaderAvailable) {
                Text(
                    "Binary proot tidak ada di APK ini. Build ulang dengan jaringan (task Gradle downloadProotBinaries).",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error,
                )
            }
            if (busy || progress in 1..99) {
                Spacer(Modifier.height(8.dp))
                LinearProgressIndicator(progress = { progress / 100f }, modifier = Modifier.fillMaxWidth())
            }
            message?.let {
                Spacer(Modifier.height(6.dp))
                Text(it, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.onSurfaceVariant)
            }
            Spacer(Modifier.height(8.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(
                    onClick = {
                        busy = true
                        message = null
                        scope.launch {
                            distro.install(rootfsUrl) { percent, label ->
                                progress = percent
                                message = label
                            }
                                .onSuccess {
                                    message = "Alpine terpasang. Coba \"Tes distro\"."
                                    status = distro.status()
                                }
                                .onFailure { e -> message = "Gagal memasang: ${e.message}" }
                            busy = false
                            progress = 0
                        }
                    },
                    enabled = !busy,
                ) {
                    if (busy) {
                        CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
                        Spacer(Modifier.width(8.dp))
                    }
                    Text(if (status.installed) "Perbarui rootfs" else "Unduh & pasang (±3,6 MB)")
                }
                OutlinedButton(onClick = { filePicker.launch(arrayOf("*/*")) }, enabled = !busy) {
                    Text("Impor .tar.gz")
                }
            }
            Spacer(Modifier.height(6.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { runDiagnostics() }, enabled = !busy) {
                    Text("Tes distro")
                }
                OutlinedButton(onClick = { showRemove = true }, enabled = status.installed && !busy) {
                    Text("Hapus rootfs")
                }
            }
            diagnostics?.let {
                Spacer(Modifier.height(8.dp))
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    fontFamily = FontFamily.Monospace,
                )
            }
        }
    }

    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = rootfsUrl,
        onValueChange = {
            rootfsUrl = it
            store.updatePrefs { p -> p.copy(distroRootfsUrl = it) }
        },
        label = { Text("URL rootfs (default: Alpine v3.20)") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(8.dp))
    OutlinedTextField(
        value = allowlist,
        onValueChange = {
            allowlist = it
            store.updatePrefs { p -> p.copy(execAllowlist = it) }
        },
        label = { Text("Allowlist command (pisah koma, kosong = semua)") },
        placeholder = { Text("pkg, git, ls") },
        singleLine = true,
        modifier = Modifier.fillMaxWidth(),
    )
    Spacer(Modifier.height(4.dp))
    Row(verticalAlignment = Alignment.CenterVertically) {
        Switch(
            checked = prefs.bindWorkspace,
            onCheckedChange = { store.updatePrefs { p -> p.copy(bindWorkspace = it) } },
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "Bind folder sesi ke /root/workspace",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        Switch(
            checked = prefs.prootNoSeccomp,
            onCheckedChange = { store.updatePrefs { p -> p.copy(prootNoSeccomp = it) } },
        )
        Spacer(Modifier.width(8.dp))
        Text(
            "PROOT_NO_SECCOMP (aktifkan kalau proot crash di ARM64)",
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.weight(1f),
        )
    }

    if (showRemove) {
        AlertDialog(
            onDismissRequest = { showRemove = false },
            title = { Text("Hapus rootfs Alpine?") },
            text = { Text("Semua paket yang di-install di dalam distro ikut terhapus.") },
            confirmButton = {
                TextButton(onClick = {
                    distro.remove()
                    status = distro.status()
                    message = "Rootfs dihapus."
                    showRemove = false
                }) { Text("Hapus", color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { showRemove = false }) { Text("Batal") }
            },
        )
    }

    // Status di-refresh saat pertama dibuka (mis. setelah update APK).
    LaunchedEffect(Unit) { status = distro.status() }
}
