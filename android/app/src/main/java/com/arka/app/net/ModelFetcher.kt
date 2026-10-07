package com.arka.app.net

import com.arka.app.core.Provider
import com.arka.app.core.ModelInfo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import kotlin.math.floor
import kotlin.math.pow
import java.util.concurrent.TimeUnit

/** Port of `src/modelFetcher.ts`. */
class ModelFetcher(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build(),
) {
    private val json = Json { ignoreUnknownKeys = true }

    suspend fun fetchModelsFromProvider(
        providerId: Provider,
        apiKey: String,
        baseUrl: String,
    ): List<ModelInfo> {
        val base = baseUrl.removeSuffix("/")
        return when (providerId) {
            Provider.openai -> fetchOpenAIModels(apiKey, base)
            Provider.anthropic -> fetchAnthropicModels(apiKey, base)
            Provider.google -> fetchGoogleModels(apiKey, base)
            Provider.groq -> fetchGroqModels(apiKey, base)
            Provider.openrouter -> fetchOpenRouterModels(apiKey, base)
            Provider.ollama -> fetchOllamaModels(base)
            Provider.custom -> fetchCustomModels(apiKey, base)
        }
    }

    private suspend fun get(url: String, headers: Map<String, String> = emptyMap()): kotlinx.serialization.json.JsonElement {
        val req = Request.Builder().url(url).apply {
            headers.forEach { (k, v) -> this.header(k, v) }
        }.build()
        val response: Response = withContext(Dispatchers.IO) { client.newCall(req).execute() }
        response.use { resp ->
            if (resp.code !in 200..299) {
                throw IllegalStateException("Failed to fetch models: ${resp.message}")
            }
            val text = resp.body?.string() ?: ""
            return json.parseToJsonElement(text)
        }
    }

    private suspend fun fetchOpenAIModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val data = get("$baseUrl/models", mapOf("Authorization" to "Bearer $apiKey"))
        return data.jsonObject["data"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val ownedBy = o["owned_by"]?.jsonPrimitive?.contentOrNull
            ModelInfo(id = id, name = id, description = ownedBy)
        }?.filter {
            it.id.contains("gpt") || it.id.contains("o1") || it.id.contains("o3") || it.id.contains("chatgpt")
        }?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchAnthropicModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val data = get(
            "$baseUrl/v1/models",
            mapOf("x-api-key" to apiKey, "anthropic-version" to "2023-06-01"),
        )
        return data.jsonObject["data"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            ModelInfo(
                id = id,
                name = o["display_name"]?.jsonPrimitive?.contentOrNull ?: id,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
            )
        }?.filter { it.id.contains("claude") }?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchGoogleModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val data = get("$baseUrl/v1beta/models?key=$apiKey")
        return data.jsonObject["models"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val raw = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val id = raw.removePrefix("models/")
            ModelInfo(
                id = id,
                name = o["displayName"]?.jsonPrimitive?.contentOrNull ?: raw,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
            )
        }?.filter { it.id.contains("gemini") || it.id.contains("text") }?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchGroqModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val data = get("$baseUrl/models", mapOf("Authorization" to "Bearer $apiKey"))
        return data.jsonObject["data"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            ModelInfo(id = id, name = id, description = o["owned_by"]?.jsonPrimitive?.contentOrNull)
        }?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchOpenRouterModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        val data = get("$baseUrl/models", mapOf("Authorization" to "Bearer $apiKey"))
        return data.jsonObject["data"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            ModelInfo(
                id = id,
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: id,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
            )
        }?.take(50)?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchOllamaModels(baseUrl: String): List<ModelInfo> {
        val data = get("$baseUrl/api/tags")
        return data.jsonObject["models"]?.jsonArray?.mapNotNull { m ->
            val o = m.jsonObject
            val name = o["name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            val size = o["size"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L
            ModelInfo(id = name, name = name, description = "Size: ${formatBytes(size)}")
        }?.sortedBy { it.name } ?: emptyList()
    }

    private suspend fun fetchCustomModels(apiKey: String, baseUrl: String): List<ModelInfo> {
        return try {
            val data = get("$baseUrl/models", mapOf("Authorization" to "Bearer $apiKey"))
            if (data.jsonObject["data"]?.jsonArray != null) {
                data.jsonObject["data"]!!.jsonArray.mapNotNull { m ->
                    val o = m.jsonObject
                    val id = o["id"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
                    ModelInfo(id = id, name = id, description = o["owned_by"]?.jsonPrimitive?.contentOrNull)
                }.sortedBy { it.name }
            } else {
                emptyList()
            }
        } catch (t: Throwable) {
            emptyList()
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