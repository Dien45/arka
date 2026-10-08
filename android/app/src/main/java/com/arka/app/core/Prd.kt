package com.arka.app.core

import android.content.Context
import com.arka.app.net.AiClient
import com.arka.app.net.ChatMessage
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** Prompt sistem generator PRD — port apa adanya dari `src/components/PRDGenerator.tsx`. */
const val PRD_SYSTEM_PROMPT: String = """You are a senior product manager. Given a short product idea from the user, write a complete, well-structured Product Requirements Document (PRD) in Markdown.

Start with a single "# " (H1) line containing a short, professional document title that you write yourself (e.g. "# PRD: Aplikasi Pengingat Minum Obat") — never the idea copy-pasted verbatim as the title.

Then always include these sections (adapt the exact wording to the idea, but keep this overall structure and use "##" headings):
1. Ringkasan (Summary) — one short paragraph
2. Asumsi — if the idea is vague or missing details, state the assumptions you made here instead of asking clarifying questions back (this is a one-shot generation)
3. Latar Belakang & Masalah — what problem this solves and why it matters
4. Tujuan (Goals) and Bukan Tujuan (Non-Goals)
5. Target Pengguna / Persona
6. User Stories — as a bullet list of "Sebagai [peran], saya ingin [aksi], supaya [manfaat]"
7. Functional Requirements — numbered, specific, testable
8. Non-Functional Requirements — performance, security, scalability, privacy, etc. where relevant
9. Success Metrics / KPI
10. Milestone & Timeline (draft) — rough phases, no need for exact dates unless the user gave them
11. Risiko & Pertanyaan Terbuka

Rules:
- Write in the same language the user wrote their idea in (an Indonesian idea gets an Indonesian PRD, an English idea gets an English PRD).
- Be concrete and specific to the idea given — never use generic filler text.
- Use proper Markdown: headings, bullet/numbered lists, and a table where it helps (e.g. requirement priority).
- When asked to revise, keep the same overall structure and only change what the revision instruction asks for, returning the FULL updated document again (not a diff).
- CRITICAL: your entire reply must be ONLY the document itself (the "# " title line through the end of "## Risiko & Pertanyaan Terbuka"). Do NOT add any greeting, preamble, or closing remark before or after it — no "Berikut PRD-nya:", no "Semoga membantu!", and especially no closing question offering to do more work (e.g. "Mau saya lanjutkan ke desain mockup?"). This output is saved directly as a file, so anything other than the document itself would end up inside that file."""

@Serializable
data class PrdMessage(val role: String, val content: String)

@Serializable
data class PrdDoc(
    val id: String,
    val title: String,
    val messages: List<PrdMessage> = emptyList(),
    val createdAt: Long,
    val updatedAt: Long,
) {
    val latestContent: String
        get() = messages.lastOrNull { it.role == "assistant" }?.content ?: ""
}

/** Port dari util kecil di PRDGenerator.tsx (deriveTitle / extractTitle / slugify). */
object PrdUtil {
    fun deriveTitle(idea: String): String {
        val firstLine = idea.trim().lineSequence().firstOrNull()?.trim().orEmpty()
        val words = firstLine.split(Regex("\\s+")).filter { it.isNotEmpty() }.take(8).joinToString(" ")
        if (words.isEmpty()) return "PRD Tanpa Judul"
        return if (words.length < firstLine.length) "$words..." else words
    }

    fun extractTitleFromContent(content: String): String? {
        val firstLine = content.trim().lineSequence().firstOrNull()?.trim() ?: return null
        return if (firstLine.startsWith("# ")) firstLine.removePrefix("# ").trim().ifEmpty { null } else null
    }

    fun slugify(text: String): String =
        text.lowercase()
            .replace(Regex("[^a-z0-9\\s-]"), "")
            .trim()
            .replace(Regex("\\s+"), "-")
            .take(48)
            .ifEmpty { "prd" }
}

/** Penyimpanan dokumen PRD (paritas `arka-prds` di web). */
class PrdStore(context: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val file: File = File(context.filesDir, "prds.json")

    fun load(): List<PrdDoc> = try {
        json.decodeFromString<List<PrdDoc>>(file.readText())
    } catch (t: Throwable) {
        emptyList()
    }

    private fun save(docs: List<PrdDoc>) {
        runCatching { file.writeText(json.encodeToString(docs)) }
    }

    fun upsert(doc: PrdDoc) {
        val docs = load().filterNot { it.id == doc.id } + doc
        save(docs)
    }

    fun remove(id: String) {
        save(load().filterNot { it.id == id })
    }
}

/**
 * Generator PRD satu-shot: idea → dokumen 11 bagian.
 * Memakai provider/model yang sedang dipilih di prefs (sama seperti Chat).
 */
class PrdGenerator(private val aiClient: AiClient = AiClient()) {

    suspend fun generate(
        idea: String,
        provider: ProviderConfig,
        history: List<PrdMessage> = emptyList(),
    ): String {
        val messages = buildList {
            add(ChatMessage(role = "system", content = PRD_SYSTEM_PROMPT))
            history.forEach { add(ChatMessage(role = it.role, content = it.content)) }
            add(ChatMessage(role = "user", content = idea))
        }
        val response = aiClient.callAIProviderFull(provider, messages, emptyList())
        return response.content.trim()
    }
}
