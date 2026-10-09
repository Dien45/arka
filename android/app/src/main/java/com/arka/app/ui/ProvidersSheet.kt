package com.arka.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
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
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Clear
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Visibility
import androidx.compose.material.icons.filled.VisibilityOff
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.ModelInfo
import com.arka.app.core.ModelScanner
import com.arka.app.core.normalizeBaseUrl
import com.arka.app.core.Provider
import com.arka.app.core.ProviderConfig
import com.arka.app.core.Store
import com.arka.app.core.canScan
import com.arka.app.core.modelsAreStale
import com.arka.app.core.saveScanError
import com.arka.app.core.saveScanResult
import kotlinx.coroutines.launch
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Konfigurasi provider AI (M4, diperbaiki): API key, Base URL, auto-detect
 * model dengan daftar yang bisa dicari, dan pemilihan model yang tersimpan.
 *
 * Perbaikan penting vs versi lama:
 *  - bug lama: memilih model langsung menghapus daftar model hasil scan
 *    (`models = detectedModels[...]` yang sudah dikosongkan) sehingga deteksi
 *    terasa tidak berguna dan user terpaksa mengetik model manual. Sekarang
 *    setiap perubahan ditulis lewat [Store.updateProvider] ke state terkini.
 *  - hasil scan disimpan ke state + DataStore, jadi tetap ada setelah app
 *    ditutup (model tidak perlu di-scan ulang tiap kali).
 *  - daftar model ditampilkan penuh dan bisa dicari.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProvidersSheet(
    store: Store,
    onDismiss: () -> Unit,
) {
    val state by store.state.collectAsState()
    val scope = rememberCoroutineScope()

    var expandedProvider by remember { mutableStateOf<Provider?>(null) }
    var apiKeys by remember { mutableStateOf(state.providers.associate { it.id to it.apiKey }) }
    var baseUrls by remember { mutableStateOf(state.providers.associate { it.id to it.baseUrl }) }
    var modelInputs by remember { mutableStateOf(state.providers.associate { it.id to it.model }) }
    var query by remember { mutableStateOf("") }
    var detecting by remember { mutableStateOf<Set<Provider>>(emptySet()) }
    var detectError by remember { mutableStateOf<Pair<Provider, String>?>(null) }

    fun scan(provider: ProviderConfig, force: Boolean = false) {
        if (provider.id in detecting) return
        val key = apiKeys[provider.id] ?: provider.apiKey
        val url = normalizeBaseUrl(baseUrls[provider.id] ?: provider.baseUrl)
        val draft = provider.copy(apiKey = key, baseUrl = url)
        if (!draft.canScan()) {
            detectError = provider.id to "Isi ${if (provider.id == Provider.ollama || provider.id == Provider.custom) "Base URL" else "API Key"} dulu."
            return
        }
        if (!force && !provider.modelsAreStale()) return
        detecting = detecting + provider.id
        detectError = null
        scope.launch {
            ModelScanner.scan(provider.id, key, url)
                .onSuccess { outcome ->
                    // Kalau endpoint yang berhasil ternyata memakai /v1, simpan Base URL
                    // yang benar supaya user tidak perlu menebak & chat langsung jalan.
                    val corrected = outcome.resolvedBaseUrl?.takeIf { it != url }
                    store.saveScanResult(
                        provider.id,
                        outcome.models,
                        apiKey = key,
                        baseUrl = corrected ?: url,
                    )
                    if (corrected != null) {
                        baseUrls = baseUrls + (provider.id to corrected)
                        detectError = null
                    }
                    when {
                        outcome.models.isEmpty() ->
                            detectError = provider.id to
                                "Endpoint menjawab, tapi tidak ada model yang dikenali. " +
                                "Bentuk respons tidak didukung — coba cek Base URL."
                        corrected != null ->
                            detectError = provider.id to "Base URL otomatis dikoreksi ke $corrected"
                        (modelInputs[provider.id] ?: provider.model).isBlank() ->
                            modelInputs = modelInputs + (provider.id to outcome.models.first().id)
                    }
                }
                .onFailure { e ->
                    val msg = e.message ?: "Gagal mendeteksi model"
                    store.saveScanError(provider.id, msg)
                    detectError = provider.id to msg
                }
            detecting = detecting - provider.id
        }
    }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text("AI Providers", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)
            Text(
                "Scan model sekali, lalu pilih dari daftar — tidak perlu ketik manual lagi.",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
            Spacer(Modifier.height(4.dp))
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                label = { Text("Cari model (semua provider)") },
                singleLine = true,
                leadingIcon = { Icon(Icons.Default.Search, contentDescription = null) },
                trailingIcon = {
                    if (query.isNotEmpty()) {
                        IconButton(onClick = { query = "" }) { Icon(Icons.Default.Clear, contentDescription = "Bersihkan") }
                    }
                },
                modifier = Modifier.fillMaxWidth(),
            )

            state.providers.forEach { provider ->
                val expanded = expandedProvider == provider.id
                val draftKey = apiKeys[provider.id] ?: ""
                val draftUrl = baseUrls[provider.id] ?: provider.baseUrl
                val draftModel = modelInputs[provider.id] ?: provider.model
                val draft = provider.copy(apiKey = draftKey, baseUrl = draftUrl, model = draftModel)
                val visibleModels = provider.models.filter { m ->
                    query.isBlank() ||
                        m.id.contains(query, ignoreCase = true) ||
                        m.name.contains(query, ignoreCase = true) ||
                        provider.name.contains(query, ignoreCase = true)
                }

                ProviderHeader(
                    provider = provider,
                    expanded = expanded,
                    onToggleExpand = { expandedProvider = if (expanded) null else provider.id },
                    onToggleEnabled = {
                        store.updateProvider(provider.id) { it.copy(enabled = !it.enabled) }
                    },
                )

                if (expanded) {
                    // Auto-scan saat dibuka bila kredensial ada tapi model kosong/basi.
                    LaunchedEffect(provider.id) {
                        if (draft.canScan() && provider.modelsAreStale()) scan(provider)
                    }

                    Column(Modifier.padding(start = 8.dp, end = 8.dp, bottom = 12.dp)) {
                        ApiKeyField(
                            value = draftKey,
                            isCustom = provider.id == Provider.custom,
                            onValueChange = { apiKeys = apiKeys + (provider.id to it) },
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = draftUrl,
                            onValueChange = { baseUrls = baseUrls + (provider.id to it) },
                            label = { Text("Base URL") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.height(8.dp))
                        OutlinedTextField(
                            value = draftModel,
                            onValueChange = { modelInputs = modelInputs + (provider.id to it) },
                            label = { Text("Model aktif") },
                            singleLine = true,
                            modifier = Modifier.fillMaxWidth(),
                        )

                        Spacer(Modifier.height(8.dp))
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Button(
                                onClick = { scan(provider, force = true) },
                                enabled = provider.id !in detecting,
                            ) {
                                if (provider.id in detecting) {
                                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                                    Spacer(Modifier.width(8.dp))
                                    Text("Memindai…")
                                } else {
                                    Text(if (provider.models.isEmpty()) "Deteksi & pilih model" else "Scan ulang")
                                }
                            }
                            Spacer(Modifier.width(8.dp))
                            TextButton(
                                onClick = {
                                    // Simpan tanpa menunggu scan (draft ditulis ke state terkini).
                                    val cleanUrl = normalizeBaseUrl(draftUrl)
                                    baseUrls = baseUrls + (provider.id to cleanUrl)
                                    store.updateProvider(provider.id) { p ->
                                        p.copy(apiKey = draftKey, baseUrl = cleanUrl, model = draftModel)
                                    }
                                    store.selectModel(provider.id, draftModel, enableIfReady = false)
                                    detectError = null
                                },
                            ) { Text("Simpan") }
                        }

                        val status = when {
                            provider.id in detecting -> "Memindai daftar model dari ${provider.name}…"
                            provider.models.isNotEmpty() -> "${provider.models.size} model tersimpan" +
                                (provider.modelsFetchedAt?.let { " · " + formatTime(it) } ?: "")
                            provider.modelsError != null -> "Scan terakhir gagal: ${provider.modelsError}"
                            else -> "Belum ada model tersimpan untuk provider ini."
                        }
                        Text(
                            status,
                            style = MaterialTheme.typography.labelSmall,
                            color = if (provider.modelsError != null && provider.models.isEmpty()) {
                                MaterialTheme.colorScheme.error
                            } else {
                                MaterialTheme.colorScheme.onSurfaceVariant
                            },
                        )

                        if (provider.models.isNotEmpty()) {
                            Spacer(Modifier.height(6.dp))
                            Text(
                                "Model terdeteksi — tap untuk memakai",
                                style = MaterialTheme.typography.labelMedium,
                                fontWeight = FontWeight.SemiBold,
                            )
                            LazyColumn(
                                Modifier
                                    .fillMaxWidth()
                                    .heightIn(max = 240.dp)
                                    .padding(top = 4.dp),
                            ) {
                                if (visibleModels.isEmpty()) {
                                    item("no_match_${provider.id}") {
                                        Text(
                                            "Tidak ada model yang cocok dengan \"$query\".",
                                            style = MaterialTheme.typography.bodySmall,
                                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                                        )
                                    }
                                }
                                items(visibleModels, key = { "${provider.id}_${it.id}" }) { model ->
                                    DetectedModelRow(
                                        model = model,
                                        selected = model.id == draftModel,
                                        onClick = {
                                            modelInputs = modelInputs + (provider.id to model.id)
                                            store.updateProvider(provider.id) { p ->
                                                p.copy(
                                                    apiKey = draftKey,
                                                    baseUrl = draftUrl,
                                                    model = model.id,
                                                    // Biarkan daftar model apa adanya — inilah
                                                    // regresi yang dulu menghapus hasil scan.
                                                    modelsError = null,
                                                )
                                            }
                                            store.selectModel(provider.id, model.id)
                                        },
                                    )
                                }
                            }
                        }

                        detectError?.takeIf { it.first == provider.id }?.let { (_, msg) ->
                            Spacer(Modifier.height(4.dp))
                            Text(msg, style = MaterialTheme.typography.bodySmall, color = MaterialTheme.colorScheme.error)
                        }
                    }
                }
                HorizontalDivider()
            }

            detectError?.let { (_, msg) ->
                Spacer(Modifier.height(8.dp))
                Text(msg, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(24.dp))
        }
    }
}

@Composable
private fun ApiKeyField(
    value: String,
    isCustom: Boolean,
    onValueChange: (String) -> Unit,
) {
    var visible by remember { mutableStateOf(false) }
    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(if (isCustom) "API Key (opsional)" else "API Key") },
        singleLine = true,
        visualTransformation = if (visible) {
            androidx.compose.ui.text.input.VisualTransformation.None
        } else {
            androidx.compose.ui.text.input.PasswordVisualTransformation()
        },
        trailingIcon = {
            IconButton(onClick = { visible = !visible }) {
                Icon(
                    if (visible) Icons.Default.VisibilityOff else Icons.Default.Visibility,
                    contentDescription = if (visible) "Sembunyikan" else "Tampilkan",
                )
            }
        },
        modifier = Modifier.fillMaxWidth(),
    )
}

@Composable
private fun ProviderHeader(
    provider: ProviderConfig,
    expanded: Boolean,
    onToggleExpand: () -> Unit,
    onToggleEnabled: () -> Unit,
) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onToggleExpand),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text("${provider.icon} ", style = MaterialTheme.typography.bodyMedium)
        Column(Modifier.weight(1f)) {
            Text(provider.name, style = MaterialTheme.typography.titleSmall, fontWeight = FontWeight.SemiBold)
            Text(
                buildString {
                    append(if (provider.enabled) "Aktif" else "Belum dikonfigurasi")
                    val active = provider.effectiveModel
                    if (active.isNotBlank()) append(" · $active")
                    if (provider.models.isNotEmpty()) append(" · ${provider.models.size} model")
                },
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = provider.enabled, onCheckedChange = { onToggleEnabled() })
        Text(if (expanded) "▴" else "▾", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun DetectedModelRow(
    model: ModelInfo,
    selected: Boolean,
    onClick: () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .padding(vertical = 2.dp)
            .clip(RoundedCornerShape(8.dp))
            .clickable(onClick = onClick)
            .background(if (selected) MaterialTheme.colorScheme.secondaryContainer else MaterialTheme.colorScheme.surface)
            .padding(horizontal = 8.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(Modifier.weight(1f)) {
            Column {
                Text(model.id, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
                val sub = model.description ?: model.name.takeIf { it != model.id }
                if (!sub.isNullOrBlank()) {
                    Text(
                        sub,
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                        maxLines = 1,
                    )
                }
            }
        }
        if (selected) {
            Icon(Icons.Default.Check, contentDescription = "Aktif", tint = MaterialTheme.colorScheme.primary)
        }
    }
}

private fun formatTime(epochMillis: Long): String =
    SimpleDateFormat("dd MMM HH:mm", Locale("id", "ID")).format(Date(epochMillis))
