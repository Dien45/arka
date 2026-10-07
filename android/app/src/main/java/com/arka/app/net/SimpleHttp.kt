package com.arka.app.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.util.concurrent.TimeUnit

/** Minimal GET helper for the web_fetch / web_search tools. */
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
            headers.forEach { (k, v) -> this.header(k, v) }
        }.build()
        val response: Response = withContext(Dispatchers.IO) { client.newCall(req).execute() }
        response.use { resp ->
            return Pair(resp.code, resp.body?.string() ?: "")
        }
    }
}