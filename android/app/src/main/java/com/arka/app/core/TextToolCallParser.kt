package com.arka.app.core

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.jsonObject

/**
 * Port of `src/textToolCallParser.ts`. Recovers tool calls from the textual
 * `[TOOL_CALL:name] ... [/TOOL_CALL]` convention (and the `<parameter=key>`
 * variant some local models invent) for providers that don't return native,
 * structured `tool_calls`.
 */
data class ParsedTextToolCall(
    val id: String,
    val name: String,
    val arguments: String,
)

data class TextToolCallExtraction(
    val toolCalls: List<ParsedTextToolCall>,
    val cleanedContent: String,
)

private val BLOCK_RE = Regex(
    """\[TOOL_CALL:\s*([a-zA-Z0-9_]+)\s*\]([\s\S]*?)(?:\[/TOOL_CALL\]|</function>|(?=\[TOOL_CALL:)|$)""",
)

private val PARAM_TAG_RE = Regex(
    """<parameter(?:\s+name)?\s*[=:]\s*"?([a-zA-Z0-9_]+)"?\s*>([\s\S]*?)(?:</parameter>|(?=<parameter)|$)""",
)

private val json = Json { ignoreUnknownKeys = true }

private var uid = 0

private fun parseBlockBody(body: String): JsonElement? {
    val trimmed = body.trim()
    if (trimmed.isEmpty()) return null

    if (trimmed.startsWith("{")) {
        try {
            return json.parseToJsonElement(trimmed).jsonObject
        } catch (t: Throwable) {
            // Fall through to the <parameter=> tag form.
        }
    }

    val params = mutableMapOf<String, JsonElement>()
    for (match in PARAM_TAG_RE.findAll(body)) {
        val key = match.groupValues[1]
        var value = match.groupValues[2]
        value = value.removePrefix("\n").removeSuffix("\n")
        if (!value.contains('\n')) value = value.trim()
        params[key] = JsonPrimitive(value)
    }
    return if (params.isEmpty()) null else JsonObject(params)
}

fun extractTextToolCalls(content: String): TextToolCallExtraction {
    if (content.isEmpty() || !content.contains("[TOOL_CALL:")) {
        return TextToolCallExtraction(emptyList(), content)
    }

    val toolCalls = mutableListOf<ParsedTextToolCall>()
    var cleanedContent = content
    for (match in BLOCK_RE.findAll(content)) {
        val fullMatch = match.value
        val name = match.groupValues[1]
        val body = match.groupValues[2]
        val args = parseBlockBody(body)
        if (args != null) {
            toolCalls.add(
                ParsedTextToolCall(
                    id = "text_toolcall_${System.currentTimeMillis()}_${uid++}",
                    name = name,
                    arguments = args.toString(),
                ),
            )
            cleanedContent = cleanedContent.replace(fullMatch, "")
        }
    }
    return TextToolCallExtraction(toolCalls, cleanedContent.trim())
}