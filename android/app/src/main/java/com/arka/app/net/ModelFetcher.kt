package com.arka.app.net

import com.arka.app.core.Provider
import com.arka.app.core.ModelInfo
import com.arka.app.core.normalizeBaseUrl
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import java.util.concurrent.TimeUnit
import kotlin.math.floor
import kotlin.math.pow

/** Hasil scan model: daftar model + Base URL yang terbukti bekerja (bila berbeda). */
data class ScanOutcome(
    val models: List<ModelInfo>,
    val resolvedBaseUrl: String? = null,
)

/** Error HTTP yang membawa kode + URL + cuplikan body supaya bisa dijelaskan ke user. */
class ProviderApiException(
    val code: Int,
    val url: String,
    val bodySnippet: String,
) : Exception(humanMessage(code, url, bodySnippet)) {
    companion object {
        fun humanMessage(code: Int, url: String, bodySnippet: String): String {
            val base = when {
                code == 401 -> "API key ditolak (HTTP 401). Periksa API Key di Settings."
                code == 403 && bodySnippet.contains("rate limit", true) ->
                    "Kena rate limit GitHub/API (HTTP 403). Coba lagi nanti."
                code == 403 -> "Akses ditolak (HTTP 403). API key mungkin kurang izin."
                code == 404 -> "Endpoint tidak ditemukan (HTTP 404) di $url. Periksa Base URL."
                code == 429 -> "Rate limit (HTTP 429). Coba lagi sebentar lagi."
                code in 500..599 -> "Server provider error (HTTP $code). Coba lagi nanti."
                else -> "HTTP $code dari $url"
            }
            val extra = bodySnippet.trim().replace(Regex("\\s+"), " ").take(160)
            return if (extra.isEmpty() || code == 404) base else "$base — $extra"
        }
    }
}

/**
 * Port `src/modelFetcher.ts` + perbaikan penting untuk provider **custom**:
 *
 *  1. Dulu semua kegagalan ditelan (`catch { emptyList() }`) sehingga UI selalu
 *     bilang "tidak ada model yang cocok" — pesan asli dari server hilang.
 *     Sekarang error HTTP/koneksi diteruskan beserta kode + URL + cuplikan body.
 *  2. Dulu hanya bentuk `{"data":[{"id":...}]}` yang dikenali. Sekarang endpoint
 *     diprobe berurutan (`/models`, `/v1/models`, `/api/tags` untuk Ollama) dan
 *     respons diparsing dari beberapa bentuk (`data[]`, `models[]`, array akar).
 *  3. Kalau ternyata Base URL yang benar memakai `/v1`, hasil scan mengembalikan
 *     `resolvedBaseUrl` supaya UI bisa mengoreksi sendiri dan user tidak menebak.
 *  4. Header Authorization tidak dikirim kalau API key kosong (sebagian server
 *     menolak bearer kosong).
 */
class ModelFetcher(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(45, TimeUnit.SECONDS)
        .build(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchModelsFromProvider(
        providerId: Provider,
        apiKey: String,
        baseUrl: String,
    ): List<ModelInfo> = scan(providerId, apiKey, baseUrl).models

    suspend fun scan(
        providerId: Provider,
        apiKey: String,
        baseUrl: String,
    ): ScanOutcome {
        val base = normalizeBaseUrl(baseUrl)
        return when (providerId) {
            Provider.openai -> ScanOutcome(fetchOpenAIModels(apiKey, base.ifBlank { "https://api.openai.com/v1" }))
            Provider.anthropic -> ScanOutcome(fetchAnthropicModels(apiKey, base.ifBlank { "https://api.anthropic.com" }))
            Provider.google -> ScanOutcome(fetchGoogleModels(apiKey, base.ifBlank { "https://generativelanguage.googleapis.com" }))
            Provider.groq -> ScanOutcome(fetchGroqModels(apiKey, base.ifBlank { "https://api.groq.com/openai/v1" }))
            Provider.openrouter -> ScanOutcome(fetchOpenRouterModels(apiKey, base.ifBlank { "https://openrouter.ai/api/v1" }))
            Provider.ollama -> fetchOllamaModels(base)
            Provider.custom -> fetchCustomModelsSmart(apiKey, base)
        }
    }

    // ------------------------------------------------------------------ HTTP

    private suspend fun request(url: String, headers: Map<String, String> = emptyMap()): String {
        val req = Request.Builder().url(url).apply {
            headers.forEach { (k, v) -> if (v.isNotBlank()) header(k, v) }
        }.build()
        val response: Response = try {
            withContext(Dispatchers.IO) { client.newCall(req).execute() }
        } catch (e: Exception) {
            throw IllegalStateException(
                "Tidak bisa menghubungi $url (${e.message ?: e.javaClass.simpleName}). " +
                    "Cek koneksi & Base URL — untuk server di PC, pakai IP LAN (mis. http://192.168.1.10:11434), " +
                    "bukan localhost.",
            )
        }
        response.use { resp ->
            val body = resp.body?.string() ?: ""
            if (resp.code !in 200..299) {
                throw ProviderApiException(resp.code, url, body)
            }
            return body
        }
    }

    private fun bearer(apiKey: String) = if (apiKey.isBlank()) emptyMap() else mapOf("Authorization" to "Bearer $apiKey")

    private fun parseElement(body: String) = runCatching { json.parseToJsonElement(body) }.getOrNull()

    // ------------------------------------------------------- provider tetap

    private suspend fun fetchOpenAIModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val root = parseElement(request("$baseUrl/models", bearer(apiKey)))
        val all = modelsFrom(root)
        val filtered = all.filter {
            it.id.contains("gpt") || it.id.contains("o1") || it.id.contains("o3") || it.id.contains("chatgpt")
        }
        return (filtered.ifEmpty { all }).sortedBy { it.name.lowercase() }
    }

    private suspend fun fetchAnthropicModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val root = parseElement(
            request("$baseUrl/v1/models", mapOf("x-api-key" to apiKey, "anthropic-version" to "2023-06-01")),
        )
        return modelsFrom(root).filter { it.id.contains("claude") }.sortedBy { it.name.lowercase() }
    }

    private suspend fun fetchGoogleModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val root = parseElement(request("$baseUrl/v1beta/models?key=$apiKey"))
        val models = modelsFrom(root).map { it.copy(id = it.id.removePrefix("models/")) }
        return models.filter { it.id.contains("gemini") || it.id.contains("text") }.sortedBy { it.name.lowercase() }
    }

    private suspend fun fetchGroqModels(apiKey: String, baseUrl: String): List<ModelInfo> =
        modelsFrom(parseElement(request("$baseUrl/models", bearer(apiKey)))).sortedBy { it.name.lowercase() }

    private suspend fun fetchOpenRouterModels(apiKey: String, baseUrl: String): List<ModelInfo> =
        modelsFrom(parseElement(request("$baseUrl/models", bearer(apiKey)))).take(200).sortedBy { it.name.lowercase() }

    /** Ollama: coba endpoint native dulu, lalu gaya OpenAI-compatible. */
    private suspend fun fetchOllamaModels(baseUrl: String): ScanOutcome {
        if (baseUrl.isBlank()) {
            throw IllegalStateException(
                "Base URL Ollama masih kosong. Isi alamat server Ollama di LAN, mis. http://192.168.1.10:11434",
            )
        }
        val attempts = mutableListOf<String>()
        var lastError: Exception? = null
        for (url in listOf("$baseUrl/api/tags", "$baseUrl/v1/models", "$baseUrl/models")) {
            try {
                val models = modelsFrom(parseElement(request(url)))
                if (models.isNotEmpty()) {
                    val resolved = if (url.endsWith("/v1/models")) "$baseUrl/v1" else null
                    return ScanOutcome(models.sortedBy { it.name.lowercase() }, resolved)
                }
                attempts += "$url (200, tidak ada model)"
            } catch (e: Exception) {
                attempts += "$url (${e.message?.take(80)})"
                lastError = e
            }
        }
        throw IllegalStateException(
            "Gagal membaca daftar model Ollama.\nDicoba: ${attempts.joinToString("; ")}" +
                (lastError?.let { "\nError terakhir: ${it.message}" } ?: ""),
        )
    }

    /**
     * Provider custom / OpenAI-compatible: probe beberapa endpoint & bentuk respons.
     * Kalau user hanya menulis host tanpa `/v1`, kita temukan sendiri yang benar
     * dan kembalikan sebagai `resolvedBaseUrl`.
     */
    private suspend fun fetchCustomModelsSmart(apiKey: String, baseUrl: String): ScanOutcome {
        if (baseUrl.isBlank()) {
            throw IllegalStateException(
                "Base URL kosong. Isi alamat server (mis. http://192.168.1.10:8080/v1 atau http://192.168.1.10:11434).",
            )
        }
        val candidates = LinkedHashSet<String>()
        candidates += baseUrl
        if (!baseUrl.endsWith("/v1") && !baseUrl.endsWith("/api")) candidates += "$baseUrl/v1"
        candidates += "$baseUrl/api/tags"

        val attempts = mutableListOf<String>()
        var lastError: Exception? = null

        for (candidate in candidates) {
            val url = if (candidate.endsWith("/api/tags") || candidate.endsWith("/models")) {
                candidate
            } else {
                "$candidate/models"
            }
            try {
                val models = modelsFrom(parseElement(request(url, bearer(apiKey))))
                if (models.isNotEmpty()) {
                    val resolved = when {
                        url.endsWith("/v1/models") && !baseUrl.endsWith("/v1") -> "$baseUrl/v1"
                        else -> null
                    }
                    return ScanOutcome(models.sortedBy { it.name.lowercase() }, resolved)
                }
                attempts += "$url (200 tapi tidak ada model yang dikenali)"
            } catch (e: Exception) {
                attempts += "$url (${e.message?.take(120)})"
                lastError = e
            }
        }
        throw IllegalStateException(
            "Tidak ada model yang bisa dibaca dari endpoint custom.\nDicoba: ${attempts.joinToString("\n  - ", prefix = "\n  - ")}" +
                (lastError?.let { "\n\nPetunjuk: pastikan Base URL menuju server yang benar (seringnya perlu diakhiri /v1), " +
                    "servernya hidup, dan memakai IP LAN bila jalan di PC." } ?: ""),
        )
    }

    // -------------------------------------------------------------- parsing

    /**
     * Mengenali beberapa bentuk respons: array akar, `{data:[…]}`, `{models:[…]}`,
     * dengan id di `id`/`name`/`model`/`model_name` (Ollama, LM Studio, llama.cpp,
     * vLLM, OpenRouter-style).
     */
    private fun modelsFrom(root: kotlinx.serialization.json.JsonElement?): List<ModelInfo> {
        if (root == null) return emptyList()

        fun fromArray(arr: JsonArray?): List<ModelInfo> = arr?.mapNotNull { element ->
            val o = runCatching { element.jsonObject }.getOrNull()
            val raw = o?.let { obj ->
                listOf("id", "name", "model", "model_name", "slug")
                    .firstNotNullOfOrNull { key -> obj[key]?.jsonPrimitive?.contentOrNull }
            }
            val id = raw?.trim().orEmpty()
            if (id.isEmpty()) return@mapNotNull null
            val description = o.let { obj ->
                obj?.get("description")?.jsonPrimitive?.contentOrNull
                    ?: obj?.get("owned_by")?.jsonPrimitive?.contentOrNull
                    ?: obj?.get("size")?.jsonPrimitive?.contentOrNull?.toLongOrNull()?.let { formatBytes(it) }
            }
            ModelInfo(
                id = id,
                name = o?.get("display_name")?.jsonPrimitive?.contentOrNull ?: id,
                description = description,
            )
        } ?: emptyList()

        return when (root) {
            is JsonArray -> fromArray(root)
            is JsonObject -> {
                val fromData = fromArray(runCatching { root["data"]?.jsonArray }.getOrNull())
                if (fromData.isNotEmpty()) fromData
                else fromArray(runCatching { root["models"]?.jsonArray }.getOrNull())
            }
            else -> emptyList()
        }
    }

    private fun formatBytes(bytes: Long): String {
        if (bytes == 0L) return "0 B"
        val k = 1024.0
        val sizes = listOf("B", "KB", "MB", "GB", "TB")
        val i = floor(java.lang.Math.log(bytes.toDouble()) / java.lang.Math.log(k)).toInt().coerceIn(0, sizes.size - 1)
        val value = (bytes / k.pow(i) * 100).toLong() / 100.0
        return "$value ${sizes[i]}"
    }
}
