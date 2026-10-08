package com.arka.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.ArkaLanguage
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.ModelInfo
import com.arka.app.core.ModelScanner
import com.arka.app.core.Provider
import com.arka.app.core.ProviderConfig
import com.arka.app.core.canScan
import com.arka.app.core.modelsAreStale
import com.arka.app.core.saveScanError
import com.arka.app.core.saveScanResult
import com.arka.app.core.Store
import kotlinx.coroutines.launch
import androidx.compose.runtime.rememberCoroutineScope

/**
 * Model picker untuk Chat (pengganti dropdown lama).
 *
 * Perbaikan utama dibanding versi sebelumnya:
 *  - semua model hasil auto-detect bisa dicari (bukan cuma 20 entri pertama),
 *  - provider yang belum pernah di-scan langsung di-scan saat sheet dibuka,
 *  - model yang dipilih benar-benar tersimpan ke provider + prefs (provider
 *    otomatis diaktifkan kalau kredensialnya sudah lengkap),
 *  - masih ada jalan manual untuk model id yang belum ada di daftar.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ModelPickerSheet(
    store: Store,
    language: ArkaLanguage,
    onDismiss: () -> Unit,
    onOpenSettings: () -> Unit,
) {
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val scope = rememberCoroutineScope()

    var query by remember { mutableStateOf("") }
    var detecting by remember { mutableStateOf<Set<Provider>>(emptySet()) }
    var error by remember { mutableStateOf<String?>(null) }
    var manualProvider by remember { mutableStateOf<Provider?>(prefs.selectedProvider?.let { runCatching { Provider.valueOf(it) }.getOrNull() }) }
    var manualModel by remember { mutableStateOf("") }

    val relevant = state.providers.filter { it.enabled || it.canScan() || it.models.isNotEmpty() }

    fun scan(provider: ProviderConfig, force: Boolean = false) {
        if (provider.id in detecting) return
        if (!provider.canScan()) return
        if (!force && !provider.modelsAreStale()) return
        detecting = detecting + provider.id
        scope.launch {
            ModelScanner.scan(provider.id, provider.apiKey, provider.baseUrl)
                .onSuccess { outcome ->
                    val corrected = outcome.resolvedBaseUrl?.takeIf { it != provider.baseUrl }
                    store.saveScanResult(provider.id, outcome.models, baseUrl = corrected ?: provider.baseUrl)
                    when {
                        outcome.models.isEmpty() ->
                            error = "Scan ${provider.name} berhasil tapi tidak ada model yang dikenali."
                        corrected != null ->
                            error = "${provider.name}: Base URL dikoreksi otomatis ke $corrected"
                    }
                }
                .onFailure { e ->
                    val msg = e.message ?: "Gagal mendeteksi model"
                    store.saveScanError(provider.id, msg)
                    error = "${provider.name}: $msg"
                }
            detecting = detecting - provider.id
        }
    }

    // Auto-scan saat sheet dibuka: provider yang kredensialnya sudah ada tapi
    // daftar modelnya kosong/basi akan langsung diisi tanpa perlu tap apa-apa.
    LaunchedEffect(Unit) {
        relevant.filter { it.canScan() && it.modelsAreStale() }.take(4).forEach { scan(it) }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp)
                .padding(bottom = 24.dp),
        ) {
            Text(
                I18n.t(language, Key.SELECT_MODEL),
                style = MaterialTheme.typography.titleLarge,
                fontWeight = FontWeight.Bold,
            )
            Text(
                "${prefs.selectedProvider ?: "-"} · ${prefs.selectedModel}",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )

            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Cari model…") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) {
                            Icon(Icons.Default.Clear, contentDescription = "Bersihkan")
                        }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )

            Row(verticalAlignment = Alignment.CenterVertically) {
                TextButton(onClick = { relevant.forEach { scan(it, force = true) } }) {
                    Text("Scan ulang semua")
                }
                TextButton(onClick = onOpenSettings) { Text("Kelola provider") }
            }

            error?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(4.dp))
            }

            if (relevant.isEmpty()) {
                Text(
                    "Belum ada provider yang siap dipakai. Isi API Key (atau Base URL untuk Ollama/Custom) di Settings, lalu scan modelnya.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.height(8.dp))
                Button(onClick = onOpenSettings, modifier = Modifier.fillMaxWidth()) {
                    Text(I18n.t(language, Key.OPEN_SETTINGS))
                }
            } else {
                LazyColumn(
                    Modifier
                        .fillMaxWidth()
                        .heightIn(max = 360.dp),
                ) {
                    relevant.forEach { provider ->
                        val models = provider.models.filter { m ->
                            query.isBlank() ||
                                m.id.contains(query, ignoreCase = true) ||
                                m.name.contains(query, ignoreCase = true) ||
                                provider.name.contains(query, ignoreCase = true)
                        }
                        item(key = "head_${provider.id}") {
                            ProviderSectionHeader(
                                provider = provider,
                                busy = provider.id in detecting,
                                onRescan = { scan(provider, force = true) },
                            )
                        }
                        if (models.isEmpty()) {
                            item(key = "empty_${provider.id}") {
                                Text(
                                    when {
                                        provider.id in detecting -> "Memindai daftar model…"
                                        !provider.canScan() -> "Belum ada kredensial — buka Settings untuk mengisi."
                                        provider.models.isEmpty() -> "Belum ada model terdeteksi. Tap ⟳ untuk scan."
                                        else -> "Tidak ada model yang cocok dengan \"$query\"."
                                    },
                                    style = MaterialTheme.typography.bodySmall,
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    modifier = Modifier.padding(start = 6.dp, bottom = 6.dp),
                                )
                            }
                        }
                        items(models, key = { "${provider.id}_${it.id}" }) { model ->
                            ModelRow(
                                model = model,
                                selected = provider.id.name == prefs.selectedProvider && model.id == prefs.selectedModel,
                                onClick = {
                                    store.selectModel(provider.id, model.id)
                                    onDismiss()
                                },
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(8.dp))
            HorizontalDivider()
            Spacer(Modifier.height(8.dp))

            // Jalan manual (mis. model baru yang belum muncul di endpoint /models).
            Text("Pakai model manual", style = MaterialTheme.typography.labelLarge, fontWeight = FontWeight.SemiBold)
            if (relevant.isNotEmpty()) {
                Row(
                    Modifier
                        .fillMaxWidth()
                        .padding(top = 4.dp),
                    horizontalArrangement = Arrangement.spacedBy(6.dp),
                ) {
                    relevant.take(3).forEach { p ->
                        FilterChip(
                            selected = (manualProvider ?: relevant.first().id) == p.id,
                            onClick = { manualProvider = p.id },
                            label = { Text("${p.icon} ${p.name}", maxLines = 1) },
                        )
                    }
                }
            }
            Row(verticalAlignment = Alignment.CenterVertically, modifier = Modifier.padding(top = 4.dp)) {
                OutlinedTextField(
                    value = manualModel,
                    onValueChange = { manualModel = it },
                    label = { Text("Model id") },
                    singleLine = true,
                    modifier = Modifier.weight(1f),
                )
                Spacer(Modifier.width(8.dp))
                Button(
                    onClick = {
                        val id = manualProvider ?: relevant.firstOrNull()?.id ?: prefs.selectedProvider?.let { runCatching { Provider.valueOf(it) }.getOrNull() }
                        if (id != null && manualModel.isNotBlank()) {
                            store.selectModel(id, manualModel.trim())
                            onDismiss()
                        }
                    },
                    enabled = manualModel.isNotBlank(),
                ) { Text("Pakai") }
            }
        }
    }
}

@Composable
private fun ProviderSectionHeader(
    provider: ProviderConfig,
    busy: Boolean,
    onRescan: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(top = 6.dp, bottom = 2.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(
            "${provider.icon} ${provider.name}",
            style = MaterialTheme.typography.titleSmall,
            fontWeight = FontWeight.SemiBold,
        )
        if (!provider.enabled) {
            Spacer(Modifier.width(6.dp))
            Text(
                "nonaktif",
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Spacer(Modifier.weight(1f))
        Text(
            if (provider.models.isEmpty()) "" else "${provider.models.size} model",
            style = MaterialTheme.typography.labelSmall,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (busy) {
            CircularProgressIndicator(Modifier.size(16.dp), strokeWidth = 2.dp)
            Spacer(Modifier.width(8.dp))
        }
        IconButton(onClick = onRescan) {
            Icon(Icons.Default.Refresh, contentDescription = "Scan ulang ${provider.name}")
        }
    }
}

@Composable
private fun ModelRow(
    model: ModelInfo,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .background(
                if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface,
            )
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(Modifier.weight(1f)) {
            Text(model.id, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
            val sub = model.description ?: model.name.takeIf { it != model.id }
            if (sub != null && sub.isNotBlank()) {
                Text(
                    sub,
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                )
            }
        }
        if (selected) {
            Icon(
                Icons.Default.Check,
                contentDescription = "Dipilih",
                tint = MaterialTheme.colorScheme.primary,
            )
        }
    }
}
