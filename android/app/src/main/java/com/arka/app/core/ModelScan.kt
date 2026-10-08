package com.arka.app.core

import com.arka.app.net.ModelFetcher
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Satu pintu untuk "scan model" provider, dipakai bersama oleh Settings
 * (ProvidersSheet) dan model picker di Chat.
 *
 * Tujuan perbaikan: hasil scan harus benar-benar tersimpan di state, sehingga
 * user cukup memilih model dari daftar — tidak pernah lagi wajib mengetik
 * model id manual. Kegagalan scan selalu mengembalikan pesan yang bisa
 * ditindaklanjuti (API key salah, Base URL tidak dijangkau, dll).
 */
object ModelScanner {
    /** Satu instance OkHttp client dipakai ulang agar tidak bikin koneksi baru terus. */
    private val fetcher: ModelFetcher by lazy { ModelFetcher() }

    suspend fun scan(id: Provider, apiKey: String, baseUrl: String): Result<List<ModelInfo>> =
        withContext(Dispatchers.IO) {
            runCatching { fetcher.fetchModelsFromProvider(id, apiKey, baseUrl) }
                .mapCatching { models -> models.sortedBy { it.name.lowercase() } }
        }
}

/** Apakah provider ini sudah punya bekal untuk di-scan. */
fun ProviderConfig.canScan(): Boolean = when (id) {
    Provider.ollama, Provider.custom -> baseUrl.isNotBlank()
    else -> apiKey.isNotBlank()
}

/** Scan dianggap basi kalau belum pernah, atau hasilnya kosong, atau > 12 jam. */
fun ProviderConfig.modelsAreStale(now: Long = System.currentTimeMillis()): Boolean {
    if (models.isEmpty()) return true
    val at = modelsFetchedAt ?: return true
    return now - at > 12 * 60 * 60 * 1000L
}

/**
 * Menyimpan hasil scan + perubahan kunci/URL ke state (dan otomatis ke
 * DataStore lewat Store.dispatch → Persistence).
 */
fun Store.saveScanResult(
    id: Provider,
    models: List<ModelInfo>,
    apiKey: String? = null,
    baseUrl: String? = null,
    model: String? = null,
) = updateProvider(id) { p ->
    p.copy(
        apiKey = apiKey?.takeIf { it.isNotBlank() } ?: p.apiKey,
        baseUrl = baseUrl?.takeIf { it.isNotBlank() } ?: p.baseUrl,
        model = model?.takeIf { it.isNotBlank() } ?: p.model,
        models = models,
        modelsFetchedAt = System.currentTimeMillis(),
    )
}

/** Menyimpan kegagalan scan supaya UI bisa menampilkan pesan terakhir. */
fun Store.saveScanError(id: Provider, message: String?) = updateProvider(id) { p ->
    p.copy(modelsError = message, modelsFetchedAt = System.currentTimeMillis())
}
