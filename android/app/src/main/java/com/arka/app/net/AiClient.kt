package com.arka.app.net

import com.arka.app.core.Provider
import com.arka.app.core.ProviderConfig
import kotlinx.coroutines.CancellationException
import kotlinx.coroutines.currentCoroutineContext
import kotlinx.coroutines.isActive
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.add
import kotlinx.serialization.json.addJsonObject
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import okhttp3.Call
import okhttp3.Callback
import okhttp3.Response
import java.io.IOException
import java.util.concurrent.TimeUnit

data class ToolCallData(
    val id: String,
    val name: String,
    val arguments: String,
)

data class ChatMessage(
    val role: String,
    val content: String = "",
    val toolCalls: List<ToolCallData> = emptyList(),
    val toolCallId: String? = null,
    val name: String? = null,
)

data class ToolDefinition(
    val name: String,
    val description: String,
    val parameters: JsonObject,
)

data class AIResponse(
    val content: String = "",
    val toolCalls: List<ToolCallData> = emptyList(),
    val finishReason: String = "other",
)

private val json = Json { ignoreUnknownKeys = true }

/** Port of `src/aiService.ts`. */
class AiClient(
    private val client: OkHttpClient = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(240, TimeUnit.SECONDS)
        .writeTimeout(120, TimeUnit.SECONDS)
        .build(),
) {

    suspend fun callAIProvider(
        provider: ProviderConfig,
        messages: List<ChatMessage>,
        tools: List<ToolDefinition> = emptyList(),
    ): AIResponse {
        if (provider.apiKey.isEmpty() && provider.id != Provider.ollama) {
            throw IllegalStateException("API Key belum di konfigurasi. Buka Settings untuk setup.")
        }
        return when (provider.id) {
            Provider.openai -> callOpenAi(provider, messages, tools)
            Provider.anthropic -> callAnthropic(provider, messages, tools)
            Provider.google -> callGoogle(provider, messages, tools)
            Provider.groq -> callGroq(provider, messages, tools)
            Provider.openrouter -> callOpenRouter(provider, messages, tools)
            Provider.ollama -> callOllama(provider, messages, tools)
            Provider.custom -> callCustom(provider, messages, tools)
        }
    }

    /**
     * Same as callAIProvider but auto-continues truncated replies (web:
     * callAIProviderFull). At most `maxContinuations` rounds; never continues
     * past a tool-call request.
     */
    suspend fun callAIProviderFull(
        provider: ProviderConfig,
        messages: List<ChatMessage>,
        tools: List<ToolDefinition> = emptyList(),
        maxContinuations: Int = 4,
    ): AIResponse {
        var history = messages
        var response = callAIProvider(provider, history, tools)
        var combinedContent = response.content
        var rounds = 0

        while (response.finishReason == "length" && response.toolCalls.isEmpty() && rounds < maxContinuations) {
            rounds++
            history = history + listOf(
                ChatMessage(role = "assistant", content = response.content),
                ChatMessage(
                    role = "user",
                    content = "Lanjutkan PERSIS dari kata/karakter terakhir di atas — jangan mengulang apa yang sudah ditulis, jangan menambahkan kalimat pembuka seperti \"melanjutkan...\", langsung sambung teksnya.",
                ),
            )
            response = callAIProvider(provider, history, tools)
            combinedContent += response.content
        }

        return response.copy(content = combinedContent)
    }

    // ------------------------------------------------------------------ HTTP

    private suspend fun ensureActive() {
        if (!currentCoroutineContext().isActive) throw CancellationException()
    }

    private data class HttpResult(val status: Int, val element: JsonElement)

    private suspend fun httpJson(
        url: String,
        headers: Map<String, String> = emptyMap(),
        bodyJson: String? = null,
    ): HttpResult {
        ensureActive()
        val reqBuilder = Request.Builder().url(url)
        headers.forEach { (k, v) -> reqBuilder.header(k, v) }
        reqBuilder.method(if (bodyJson != null) "POST" else "GET", if (bodyJson != null) bodyJson.toRequestBody("application/json".toMediaType()) else null)

        // Enqueue instead of blocking-execute so coroutine cancellation actually
        // aborts the in-flight HTTP call (call.cancel()) — that's what makes the
        // Stop button responsive on long generations instead of waiting out the
        // 240s read timeout. Port of the web's AbortController wiring.
        return suspendCancellableCoroutine { cont ->
            val call = client.newCall(reqBuilder.build())
            cont.invokeOnCancellation { runCatching { call.cancel() } }
            call.enqueue(object : Callback {
                override fun onFailure(call: Call, e: IOException) {
                    if (cont.isCancelled) return
                    cont.resumeWith(Result.failure(e))
                }

                override fun onResponse(call: Call, response: Response) {
                    response.use { resp ->
                        val text = resp.body?.string() ?: ""
                        val element = runCatching { json.parseToJsonElement(text) }.getOrElse { JsonPrimitive(text) }
                        if (!cont.isCancelled) cont.resume(HttpResult(resp.code, element)) {}
                    }
                }
            })
        }
    }

    private fun errorMessage(status: Int, element: JsonElement, fallback: String): String {
        val nested = element.jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull
        return nested ?: if (status !in 200..299) "$fallback (HTTP $status)" else fallback
    }

    private fun parseOpenAiResponse(data: JsonObject, providerLabel: String): AIResponse {
        val choice = data["choices"]?.jsonArray?.firstOrNull()?.jsonObject
            ?: error("$providerLabel error: tidak ada pilihan respons")
        val message = choice["message"]?.jsonObject ?: JsonObject(emptyMap())
        val content = message["content"]?.jsonPrimitive?.contentOrNull ?: ""
        val finish = when (choice["finish_reason"]?.jsonPrimitive?.contentOrNull) {
            "stop" -> "stop"
            "tool_calls" -> "tool_calls"
            "length" -> "length"
            else -> "other"
        }
        val toolCalls = message["tool_calls"]?.jsonArray?.mapNotNull { tc ->
            val o = tc.jsonObject
            val fn = o["function"]?.jsonObject ?: return@mapNotNull null
            ToolCallData(
                id = o["id"]?.jsonPrimitive?.contentOrNull ?: "call_${System.currentTimeMillis()}",
                name = fn["name"]?.jsonPrimitive?.contentOrNull ?: "",
                arguments = fn["arguments"]?.jsonPrimitive?.contentOrNull ?: "{}",
            )
        } ?: emptyList()
        return AIResponse(content, toolCalls, finish)
    }

    private fun openAiMessage(m: ChatMessage): JsonObject = buildJsonObject {
        put("role", m.role)
        if (m.content.isNotEmpty()) put("content", m.content)
        if (m.toolCalls.isNotEmpty()) {
            putJsonArray("tool_calls") {
                m.toolCalls.forEach { tc ->
                    addJsonObject {
                        put("id", tc.id)
                        put("type", "function")
                        putJsonObject("function") {
                            put("name", tc.name)
                            put("arguments", tc.arguments)
                        }
                    }
                }
            }
        }
        m.toolCallId?.let { put("tool_call_id", it) }
        m.name?.let { put("name", it) }
    }

    private fun openAiTools(tools: List<ToolDefinition>): JsonArray {
        return buildJsonArray {
            tools.forEach { t ->
                addJsonObject {
                    put("type", "function")
                    putJsonObject("function") {
                        put("name", t.name)
                        put("description", t.description)
                        put("parameters", t.parameters)
                    }
                }
            }
        }
    }

    private fun openAiRequest(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): JsonObject =
        buildJsonObject {
            put("model", provider.model)
            putJsonArray("messages") { messages.forEach { add(openAiMessage(it)) } }
            put("temperature", 0.7)
            if (tools.isNotEmpty()) {
                put("tools", openAiTools(tools))
                put("tool_choice", "auto")
            }
        }

    // -------------------------------------------------------------- providers

    private suspend fun callOpenAi(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/chat/completions",
            headers = mapOf("Content-Type" to "application/json", "Authorization" to "Bearer ${provider.apiKey}"),
            bodyJson = openAiRequest(provider, messages, tools).toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "OpenAI API error"))
        }
        return parseOpenAiResponse(result.element.jsonObject, "OpenAI")
    }

    private suspend fun callGroq(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/chat/completions",
            headers = mapOf("Content-Type" to "application/json", "Authorization" to "Bearer ${provider.apiKey}"),
            bodyJson = openAiRequest(provider, messages, tools).toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "Groq API error"))
        }
        return parseOpenAiResponse(result.element.jsonObject, "Groq")
    }

    private suspend fun callOpenRouter(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/chat/completions",
            headers = mapOf(
                "Content-Type" to "application/json",
                "Authorization" to "Bearer ${provider.apiKey}",
                "HTTP-Referer" to "https://arka.local",
            ),
            bodyJson = openAiRequest(provider, messages, tools).toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "OpenRouter API error"))
        }
        return parseOpenAiResponse(result.element.jsonObject, "OpenRouter")
    }

    private suspend fun callCustom(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/chat/completions",
            headers = mapOf("Content-Type" to "application/json", "Authorization" to "Bearer ${provider.apiKey}"),
            bodyJson = openAiRequest(provider, messages, tools).toString(),
        )
        if (result.status !in 200..299) {
            val text = result.element.toString()
            val jsonMsg = runCatching { result.element.jsonObject["error"]?.jsonObject?.get("message")?.jsonPrimitive?.contentOrNull }
                .getOrNull() ?: text
            throw IllegalStateException(jsonMsg ?: "Custom API error")
        }

        val data = result.element.jsonObject
        if (data["choices"] != null) return parseOpenAiResponse(data, "Custom")

        val content = data["response"]?.jsonPrimitive?.contentOrNull
            ?: data["content"]?.jsonPrimitive?.contentOrNull
            ?: throw IllegalStateException("Format response tidak dikenali")
        return AIResponse(content = content)
    }

    private suspend fun callAnthropic(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val systemMessage = messages.firstOrNull { it.role == "system" }?.content

        val chatBody = buildJsonObject {
            put("model", provider.model)
            put("max_tokens", 8192)
            if (!systemMessage.isNullOrEmpty()) put("system", systemMessage)
            putJsonArray("messages") {
                for (m in messages) {
                    when (m.role) {
                        "system" -> Unit
                        "assistant" -> {
                            if (m.toolCalls.isNotEmpty()) {
                                addJsonObject {
                                    put("role", "assistant")
                                    putJsonArray("content") {
                                        if (m.content.isNotEmpty()) {
                                            addJsonObject { put("type", "text"); put("text", m.content) }
                                        }
                                        m.toolCalls.forEach { tc ->
                                            addJsonObject {
                                                put("type", "tool_use")
                                                put("id", tc.id)
                                                put("name", tc.name)
                                                put("input", runCatching { json.parseToJsonElement(tc.arguments) }.getOrElse { JsonObject(emptyMap()) })
                                            }
                                        }
                                    }
                                }
                            } else {
                                addJsonObject { put("role", "assistant"); put("content", m.content) }
                            }
                        }
                        "tool" -> addJsonObject {
                            put("role", "user")
                            putJsonArray("content") {
                                addJsonObject {
                                    put("type", "tool_result")
                                    put("tool_use_id", m.toolCallId ?: "")
                                    put("content", m.content)
                                }
                            }
                        }
                        else -> addJsonObject { put("role", "user"); put("content", m.content) }
                    }
                }
            }
            if (tools.isNotEmpty()) {
                putJsonArray("tools") {
                    tools.forEach { t ->
                        addJsonObject {
                            put("name", t.name)
                            put("description", t.description)
                            put("input_schema", t.parameters)
                        }
                    }
                }
            }
        }

        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/v1/messages",
            headers = mapOf(
                "Content-Type" to "application/json",
                "x-api-key" to provider.apiKey,
                "anthropic-version" to "2023-06-01",
            ),
            bodyJson = chatBody.toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "Anthropic API error"))
        }

        val data = result.element.jsonObject
        val contentBlocks = data["content"]?.jsonArray ?: buildJsonArray { }
        val content = contentBlocks.filter { it.jsonObject["type"]?.jsonPrimitive?.contentOrNull == "text" }
            .mapNotNull { it.jsonObject["text"]?.jsonPrimitive?.contentOrNull }
            .joinToString("\n")

        val finish = when (data["stop_reason"]?.jsonPrimitive?.contentOrNull) {
            "max_tokens" -> "length"
            "tool_use" -> "tool_calls"
            "end_turn", "stop_sequence" -> "stop"
            else -> "other"
        }
        val toolCalls = contentBlocks.filter { it.jsonObject["type"]?.jsonPrimitive?.contentOrNull == "tool_use" }
            .map { b ->
                val o = b.jsonObject
                ToolCallData(
                    id = o["id"]?.jsonPrimitive?.contentOrNull ?: "call_${System.currentTimeMillis()}",
                    name = o["name"]?.jsonPrimitive?.contentOrNull ?: "",
                    arguments = (o["input"] ?: JsonObject(emptyMap())).toString(),
                )
            }
        return AIResponse(content, toolCalls, finish)
    }

    private suspend fun callGoogle(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val systemMessage = messages.firstOrNull { it.role == "system" }?.content

        val body = buildJsonObject {
            putJsonArray("contents") {
                for (m in messages) {
                    when (m.role) {
                        "system" -> Unit
                        "assistant" -> {
                            val parts = buildJsonArray {
                                if (m.content.isNotEmpty()) addJsonObject { put("text", m.content) }
                                m.toolCalls.forEach { tc ->
                                    addJsonObject {
                                        putJsonObject("functionCall") {
                                            put("name", tc.name)
                                            put("args", runCatching { json.parseToJsonElement(tc.arguments) }.getOrElse { JsonObject(emptyMap()) })
                                        }
                                    }
                                }
                            }
                            if (parts.isNotEmpty()) {
                                addJsonObject { put("role", "model"); put("parts", parts) }
                            }
                        }
                        "tool" -> addJsonObject {
                            put("role", "user")
                            putJsonArray("parts") {
                                addJsonObject {
                                    putJsonObject("functionResponse") {
                                        put("name", m.name ?: "")
                                        putJsonObject("response") { put("content", m.content) }
                                    }
                                }
                            }
                        }
                        else -> if (m.content.isNotEmpty()) {
                            addJsonObject {
                                put("role", "user")
                                putJsonArray("parts") { addJsonObject { put("text", m.content) } }
                            }
                        }
                    }
                }
            }
            putJsonObject("generationConfig") {
                put("temperature", 0.7)
                put("maxOutputTokens", 8192)
            }
            if (!systemMessage.isNullOrEmpty()) {
                putJsonObject("systemInstruction") {
                    putJsonArray("parts") { addJsonObject { put("text", systemMessage) } }
                }
            }
            if (tools.isNotEmpty()) {
                putJsonArray("tools") {
                    addJsonObject {
                        putJsonArray("function_declarations") {
                            tools.forEach { t ->
                                addJsonObject {
                                    put("name", t.name)
                                    put("description", t.description)
                                    put("parameters", t.parameters)
                                }
                            }
                        }
                    }
                }
            }
        }

        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/v1beta/models/${provider.model}:generateContent?key=${provider.apiKey}",
            headers = mapOf("Content-Type" to "application/json"),
            bodyJson = body.toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "Google AI API error"))
        }

        val data = result.element.jsonObject
        val parts = data["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("content")?.jsonObject?.get("parts")?.jsonArray ?: buildJsonArray { }

        val content = parts.filter { it.jsonObject["text"] != null }
            .mapNotNull { it.jsonObject["text"]?.jsonPrimitive?.contentOrNull }
            .joinToString("")

        val rawFinish = data["candidates"]?.jsonArray?.firstOrNull()?.jsonObject
            ?.get("finishReason")?.jsonPrimitive?.contentOrNull
        var finish = when (rawFinish) {
            "MAX_TOKENS" -> "length"
            "STOP" -> "stop"
            else -> "other"
        }

        val functionCalls = parts.mapNotNull { p ->
            val fc = p.jsonObject["functionCall"]?.jsonObject ?: return@mapNotNull null
            ToolCallData(
                id = "call_${System.currentTimeMillis()}_${fc["name"]?.jsonPrimitive?.contentOrNull ?: ""}",
                name = fc["name"]?.jsonPrimitive?.contentOrNull ?: "",
                arguments = (fc["args"] ?: JsonObject(emptyMap())).toString(),
            )
        }
        if (functionCalls.isNotEmpty()) finish = "tool_calls"

        return AIResponse(content, functionCalls, finish)
    }

    private suspend fun callOllama(provider: ProviderConfig, messages: List<ChatMessage>, tools: List<ToolDefinition>): AIResponse {
        val body = buildJsonObject {
            put("model", provider.model)
            put("stream", false)
            putJsonArray("messages") { messages.forEach { add(openAiMessage(it)) } }
            if (tools.isNotEmpty()) {
                put("tools", openAiTools(tools))
            }
        }

        val result = httpJson(
            "${provider.baseUrl.removeSuffix("/")}/api/chat",
            headers = mapOf("Content-Type" to "application/json"),
            bodyJson = body.toString(),
        )
        if (result.status !in 200..299) {
            throw IllegalStateException(errorMessage(result.status, result.element, "Ollama API error"))
        }

        val data = result.element.jsonObject
        val message = data["message"]?.jsonObject ?: JsonObject(emptyMap())
        val content = message["content"]?.jsonPrimitive?.contentOrNull ?: ""

        val finish = when {
            data["done_reason"]?.jsonPrimitive?.contentOrNull == "length" -> "length"
            data["done"]?.jsonPrimitive?.booleanOrNull == false -> "other"
            else -> "stop"
        }

        val toolCalls = message["tool_calls"]?.jsonArray?.mapNotNull { tc ->
            val fn = tc.jsonObject["function"]?.jsonObject ?: return@mapNotNull null
            ToolCallData(
                id = "call_${System.currentTimeMillis()}",
                name = fn["name"]?.jsonPrimitive?.contentOrNull ?: "",
                arguments = (fn["arguments"] ?: JsonObject(emptyMap())).toString(),
            )
        } ?: emptyList()

        return AIResponse(content, toolCalls, finish)
    }
}