package com.arka.app.core

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
enum class Provider { openai, anthropic, google, ollama, groq, openrouter, custom }

@Serializable
data class ProviderConfig(
    val id: Provider,
    val name: String,
    val apiKey: String = "",
    val baseUrl: String,
    val model: String = "",
    val enabled: Boolean = false,
    val icon: String = "",
    val models: List<ModelInfo> = emptyList(),
    val modelsFetchedAt: Long? = null,
    /** Pesan error terakhir saat scan model gagal (null = terakhir sukses). */
    val modelsError: String? = null,
) {
    /** Nama model yang benar-benar dipakai untuk request (fallback ke default provider). */
    val effectiveModel: String
        get() = model.ifBlank { models.firstOrNull()?.id ?: "" }
}

@Serializable
data class ModelInfo(
    val id: String,
    val name: String,
    val description: String? = null,
)

@Serializable
enum class MessageRole { user, assistant, system, tool }

@Serializable
enum class ToolCallStatus { running, completed, error }

@Serializable
data class ToolCall(
    val id: String,
    val name: String,
    // Raw JSON args string (mirrors web's `arguments`). Parsed on demand.
    val input: String = "{}",
    val output: String? = null,
    val status: ToolCallStatus = ToolCallStatus.running,
)

@Serializable
data class Attachment(
    val name: String,
    val size: Long,
)

@Serializable
enum class FileAction { create, edit, delete }

@Serializable
data class FileChange(
    val path: String,
    val action: FileAction,
    val content: String? = null,
    val diff: String? = null,
)

@Serializable
data class Message(
    val id: String,
    val role: MessageRole,
    val content: String = "",
    // Epoch millis (web used Date).
    val timestamp: Long,
    val toolCalls: List<ToolCall>? = null,
    val files: List<FileChange>? = null,
    val attachments: List<Attachment>? = null,
    val attachmentContent: String? = null,
)

@Serializable
data class Session(
    val id: String,
    val title: String,
    val messages: List<Message> = emptyList(),
    val createdAt: Long,
    val provider: Provider = Provider.openai,
    val model: String = "gpt-4o",
)

@Serializable
data class Agent(
    val id: String,
    val name: String,
    val description: String = "",
    val icon: String = "🤖",
    val systemPrompt: String = "",
    val tools: List<String> = emptyList(),
    val provider: Provider = Provider.openai,
    val model: String = "gpt-4o",
)

enum class AppView { chat, files, prd, skills, github, settings }

@Serializable
data class GitHubRepo(
    val id: Long,
    val name: String,
    val fullName: String,
    val description: String? = null,
    @SerialName("private") val isPrivate: Boolean = false,
    val defaultBranch: String = "main",
    val updatedAt: String = "",
)

enum class ChatMode { plan, build, agent }