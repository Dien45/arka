package com.arka.app.core

import com.arka.app.net.ModelFetcher
import com.arka.app.net.ScanOutcome
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

/**
 * Satu pintu untuk "scan model" provider, dipakai bersama oleh Settings
 * (ProvidersSheet) dan model picker di Chat.
 *
 * Hasil scan selalu tersimpan di state, sehingga user cukup memilih model dari
 * daftar. Kegagalan scan mengembalikan pesan asli dari server (HTTP 401/404/…)
 * yang bisa ditindaklanjuti — bukan lagi "tidak ada model yang cocok".
 */
object ModelScanner {
    /** Satu instance OkHttp client dipakai ulang agar tidak bikin koneksi baru terus. */
    private val fetcher: ModelFetcher by lazy { ModelFetcher() }

    suspend fun scan(id: Provider, apiKey: String, baseUrl: String): Result<ScanOutcome> =
        withContext(Dispatchers.IO) {
            runCatching { fetcher.scan(id, apiKey, baseUrl) }
                .map { outcome -> outcome.copy(models = outcome.models.sortedBy { it.name.lowercase() }) }
        }
}

/**
 * Merapikan Base URL yang diketik user, terutama untuk server di Tailscale/LAN:
 *  - spasi di ujung dibuang,
 *  - tanpa skema (`100.64.1.2:20128/v1`, `omniroute:20128`) → ditambah `http://`
 *    (tanpa ini OkHttp melempar "Expected URL scheme" dan user hanya melihat
 *    error teknis),
 *  - akhiran endpoint yang ikut ter-copy (`/chat/completions`, `/models`) dibuang,
 *    karena nanti Arka menambahkannya sendiri,
 *  - garis miring di belakang dibuang.
 */
fun normalizeBaseUrl(raw: String): String {
    var url = raw.trim()
    if (url.isEmpty()) return url
    if (!url.contains("://")) url = "http://$url"
    url = url.trimEnd('/')
    for (suffix in listOf("/chat/completions", "/completions", "/models")) {
        if (url.endsWith(suffix)) {
            url = url.removeSuffix(suffix).trimEnd('/')
            break
        }
    }
    return url
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
        modelsError = null,
    )
}

/** Menyimpan kegagalan scan supaya UI bisa menampilkan pesan terakhir. */
fun Store.saveScanError(id: Provider, message: String?) = updateProvider(id) { p ->
    p.copy(modelsError = message, modelsFetchedAt = System.currentTimeMillis())
}
