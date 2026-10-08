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
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.ModelInfo
import com.arka.app.core.Provider
import com.arka.app.core.ProviderConfig
import com.arka.app.core.Store
import com.arka.app.core.Action
import com.arka.app.net.ModelFetcher
import kotlinx.coroutines.launch

/**
 * MRK-26. Minimal provider configuration surface (the M3 stand-in for the web
 * Settings modal): toggle a provider on, paste an API key (or Ollama/Custom
 * base URL), auto-detect available models, pick one, save. Selecting a model
 * also selects its provider + model for the Chat header.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ProvidersSheet(
    store: Store,
    onDismiss: () -> Unit,
) {
    val state by store.state.collectAsState()
    val prefs by store.prefs.collectAsState()
    val scope = rememberCoroutineScope()
    val modelFetcher = remember { ModelFetcher() }

    var expandedProvider by remember { mutableStateOf<Provider?>(null) }
    var apiKeys by remember { mutableStateOf(state.providers.associate { it.id to it.apiKey }) }
    var baseUrls by remember { mutableStateOf(state.providers.associate { it.id to it.baseUrl }) }
    var modelInputs by remember { mutableStateOf(state.providers.associate { it.id to it.model }) }
    var detectedModels by remember { mutableStateOf<Map<Provider, List<ModelInfo>>>(emptyMap()) }
    var detectingProvider by remember { mutableStateOf<Provider?>(null) }
    var detectError by remember { mutableStateOf<String?>(null) }

    ModalBottomSheet(onDismissRequest = onDismiss) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .verticalScroll(rememberScrollState())
                .padding(horizontal = 16.dp, vertical = 8.dp),
        ) {
            Text("AI Providers", style = MaterialTheme.typography.titleLarge, fontWeight = FontWeight.Bold)

            state.providers.forEach { provider ->
                val expanded = expandedProvider == provider.id

                ProviderHeader(
                    provider = provider,
                    expanded = expanded,
                    onToggleExpand = { expandedProvider = if (expanded) null else provider.id },
                    onToggleEnabled = {
                        store.dispatch(Action.UpdateProvider(provider.copy(enabled = !provider.enabled)))
                    },
                )

                if (expanded) {
                    ProviderEditor(
                        provider = provider,
                        apiKey = apiKeys[provider.id] ?: "",
                        onApiKeyChange = { apiKeys = apiKeys + (provider.id to it) },
                        baseUrl = baseUrls[provider.id] ?: "",
                        onBaseUrlChange = { baseUrls = baseUrls + (provider.id to it) },
                        model = modelInputs[provider.id] ?: "",
                        onModelChange = { modelInputs = modelInputs + (provider.id to it) },
                        detected = detectedModels[provider.id] ?: emptyList(),
                        detecting = detectingProvider == provider.id,
                        onDetect = {
                            scope.launch {
                                detectingProvider = provider.id
                                detectError = null
                                try {
                                    val found = modelFetcher.fetchModelsFromProvider(
                                        provider.id,
                                        apiKeys[provider.id] ?: "",
                                        baseUrls[provider.id] ?: provider.baseUrl,
                                    )
                                    detectedModels = detectedModels + (provider.id to found)
                                    store.dispatch(
                                        Action.UpdateProvider(
                                            provider.copy(
                                                models = found,
                                                modelsFetchedAt = System.currentTimeMillis(),
                                            ),
                                        ),
                                    )
                                } catch (e: Exception) {
                                    detectError = e.message ?: "Gagal mendeteksi model"
                                } finally {
                                    detectingProvider = null
                                }
                            }
                        },
                        onPickModel = { m ->
                            modelInputs = modelInputs + (provider.id to m)
                            detectedModels = detectedModels + (provider.id to emptyList())
                            store.dispatch(
                                Action.UpdateProvider(
                                    provider.copy(
                                        model = m,
                                        models = (detectedModels[provider.id] ?: emptyList()),
                                        modelsFetchedAt = System.currentTimeMillis(),
                                    ),
                                ),
                            )
                        },
                        onSave = {
                            val updated = provider.copy(
                                apiKey = apiKeys[provider.id] ?: "",
                                baseUrl = baseUrls[provider.id] ?: "",
                                model = modelInputs[provider.id] ?: provider.model,
                                models = detectedModels[provider.id] ?: provider.models,
                                modelsFetchedAt = System.currentTimeMillis(),
                            )
                            store.dispatch(Action.UpdateProvider(updated))
                            store.updatePrefs {
                                it.copy(
                                    selectedProvider = provider.id.name,
                                    selectedModel = updated.model,
                                )
                            }
                            detectError = null
                        },
                    )
                }
                HorizontalDivider()
            }

            detectError?.let {
                Text(it, color = MaterialTheme.colorScheme.error, style = MaterialTheme.typography.bodySmall)
            }

            Spacer(Modifier.height(24.dp))
        }
    }
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
                if (provider.enabled) "Aktif" else "Belum dikonfigurasi",
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        Switch(checked = provider.enabled, onCheckedChange = { onToggleEnabled() })
        Text(if (expanded) "▴" else "▾", style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun ProviderEditor(
    provider: ProviderConfig,
    apiKey: String,
    onApiKeyChange: (String) -> Unit,
    baseUrl: String,
    onBaseUrlChange: (String) -> Unit,
    model: String,
    onModelChange: (String) -> Unit,
    detected: List<ModelInfo>,
    detecting: Boolean,
    onDetect: () -> Unit,
    onPickModel: (String) -> Unit,
    onSave: () -> Unit,
) {
    Column(Modifier.padding(start = 8.dp, end = 8.dp, bottom = 12.dp)) {
        OutlinedTextField(
            value = apiKey,
            onValueChange = onApiKeyChange,
            label = { Text("API Key") },
            singleLine = true,
            modifier = Modifier.fillMaxWidth(),
        )
        if (provider.id == Provider.ollama || provider.id == Provider.custom) {
            Spacer(Modifier.height(8.dp))
            OutlinedTextField(
                value = baseUrl,
                onValueChange = onBaseUrlChange,
                label = { Text("Base URL") },
                singleLine = true,
                modifier = Modifier.fillMaxWidth(),
            )
        }
        Spacer(Modifier.height(8.dp))
        Row(verticalAlignment = Alignment.CenterVertically) {
            OutlinedTextField(
                value = model,
                onValueChange = onModelChange,
                label = { Text("Model") },
                singleLine = true,
                modifier = Modifier.weight(1f),
            )
            Spacer(Modifier.width(8.dp))
            TextButton(onClick = onDetect, enabled = !detecting) {
                if (detecting) {
                    CircularProgressIndicator(Modifier.size(18.dp), strokeWidth = 2.dp)
                } else {
                    Text("Deteksi")
                }
            }
        }
        if (detected.isNotEmpty()) {
            Row(
                Modifier
                    .fillMaxWidth()
                    .padding(top = 8.dp),
                horizontalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                detected.take(8).forEach { m ->
                    FilterChip(
                        selected = m.id == model,
                        onClick = { onPickModel(m.id) },
                        label = { Text(m.id) },
                    )
                }
            }
        }
        Spacer(Modifier.height(12.dp))
        Button(onClick = onSave, modifier = Modifier.fillMaxWidth()) { Text("Simpan") }
    }
}