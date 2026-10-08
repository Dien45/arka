package com.arka.app.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.util.concurrent.TimeUnit

/** Minimal GET helper untuk web_fetch / web_search / skill fetcher. */
object SimpleHttp {
    fun client(readTimeoutMs: Long = 30_000): OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(readTimeoutMs, TimeUnit.MILLISECONDS)
        .build()

    suspend fun get(
        url: String,
        headers: Map<String, String> = emptyMap(),
        client: OkHttpClient = client(),
    ): Pair<Int, String> {
        val req = Request.Builder().url(url).apply {
            headers.forEach { (k, v) -> if (v.isNotBlank()) this.header(k, v) }
        }.build()
        val response: Response = withContext(Dispatchers.IO) { client.newCall(req).execute() }
        response.use { resp ->
            return Pair(resp.code, resp.body?.string() ?: "")
        }
    }

    /**
     * GET yang langsung mengembalikan body dan melempar error yang bisa dibaca
     * user (dipakai pengunduh skill).
     */
    suspend fun getAsString(
        client: OkHttpClient,
        url: String,
        headers: Map<String, String> = emptyMap(),
    ): String {
        val (code, body) = get(url, headers, client)
        if (code in 200..299) return body
        val raw = body.trim().replace(Regex("\\s+"), " ").take(200)
        val friendly = when {
            code == 404 -> "Berkas/endpoint tidak ditemukan (HTTP 404): $url"
            code == 401 -> "Akses ditolak (HTTP 401). Periksa Personal Access Token GitHub."
            code == 403 && raw.contains("rate limit", true) ->
                "Limit GitHub API tercapai (HTTP 403). Tunggu beberapa menit, atau hubungkan GitHub " +
                    "(tab GitHub) agar memakai token dan limitnya jauh lebih besar."
            code == 403 -> "Akses ditolak (HTTP 403). Token mungkin kurang izin (butuh scope repo untuk repo private)."
            code == 429 -> "Too many requests (HTTP 429). Coba lagi sebentar lagi."
            else -> "HTTP $code dari $url"
        }
        throw IllegalStateException(if (raw.isEmpty()) friendly else "$friendly — $raw")
    }
}
