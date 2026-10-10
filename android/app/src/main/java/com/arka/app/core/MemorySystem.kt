package com.arka.app.core

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File
import kotlin.math.roundToInt

// Ported from src/memorySystem.ts — identical caps & message strings.
const val MEMORY_CHAR_LIMIT = 2200
const val USER_CHAR_LIMIT = 1375

@Serializable
data class MemoryEntry(val id: String, val content: String, val timestamp: Long)

@Serializable
data class MemoryStore(
    val memory: List<MemoryEntry> = emptyList(),
    val user: List<MemoryEntry> = emptyList(),
)

enum class MemoryTarget { MEMORY, USER }

@Serializable
data class MemoryResult(
    val success: Boolean,
    val error: String? = null,
    val currentEntries: List<String>? = null,
    val usage: String? = null,
)

class MemoryManager private constructor(private val context: Context) {

    companion object {
        @Volatile
        private var instance: MemoryManager? = null

        fun getInstance(context: Context): MemoryManager =
            instance ?: synchronized(this) {
                instance ?: MemoryManager(context.applicationContext).also { instance = it }
            }
    }

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val file: File get() = File(context.filesDir, "memory.json")

    private var store: MemoryStore = load()
    private var lastMtime: Long = file.lastModified()

    /** Reload dari disk kalau file berubah di luar instance ini (mis. instance lain menulis). */
    private fun reloadIfChanged() {
        val mtime = file.lastModified()
        if (mtime != lastMtime) {
            store = load()
            lastMtime = mtime
        }
    }

    private fun load(): MemoryStore = try {
        json.decodeFromString<MemoryStore>(file.readText())
    } catch (t: Throwable) {
        MemoryStore()
    }

    private fun save() {
        runCatching {
            file.writeText(json.encodeToString(store))
            lastMtime = file.lastModified()
        }
    }

    private fun charCount(entries: List<MemoryEntry>): Int = entries.sumOf { it.content.length }

    private fun generateId(): String =
        "mem_${System.currentTimeMillis()}_${java.util.UUID.randomUUID().toString().replace("-", "").substring(0, 8)}"

    private fun limitFor(target: MemoryTarget): Int =
        if (target == MemoryTarget.MEMORY) MEMORY_CHAR_LIMIT else USER_CHAR_LIMIT

    fun add(target: MemoryTarget, content: String): MemoryResult {
        reloadIfChanged()
        val entries = if (target == MemoryTarget.MEMORY) store.memory else store.user
        val limit = limitFor(target)
        val currentCount = charCount(entries)

        if (entries.any { it.content == content }) return MemoryResult(success = true)

        if (currentCount + content.length > limit) {
            return MemoryResult(
                success = false,
                error = "Memory at $currentCount/$limit chars. Adding this entry (${content.length} chars) would exceed the limit. Consolidate now: use 'replace' to merge overlapping entries or 'remove' stale entries.",
                currentEntries = entries.map { it.content },
                usage = "$currentCount/$limit",
            )
        }

        val updated = MemoryEntry(generateId(), content, System.currentTimeMillis())
        store = if (target == MemoryTarget.MEMORY) {
            store.copy(memory = store.memory + updated)
        } else {
            store.copy(user = store.user + updated)
        }
        save()
        return MemoryResult(success = true)
    }

    fun replace(target: MemoryTarget, oldText: String, newContent: String): MemoryResult {
        reloadIfChanged()
        val entries = if (target == MemoryTarget.MEMORY) store.memory else store.user
        val limit = limitFor(target)
        val matches = entries.filter { it.content.contains(oldText) }

        if (matches.isEmpty()) return MemoryResult(success = false, error = "No entry found containing \"$oldText\"")
        if (matches.size > 1) return MemoryResult(success = false, error = "Multiple entries match \"$oldText\". Please be more specific.")

        val currentCount = charCount(entries)
        val oldEntry = matches[0]
        val sizeDiff = newContent.length - oldEntry.content.length

        if (currentCount + sizeDiff > limit) {
            return MemoryResult(
                success = false,
                error = "Replacing would exceed limit (${currentCount + sizeDiff}/$limit). Shorten the new content or remove other entries first.",
            )
        }

        val replaced = oldEntry.copy(content = newContent, timestamp = System.currentTimeMillis())
        store = if (target == MemoryTarget.MEMORY) {
            store.copy(memory = store.memory.map { if (it.id == oldEntry.id) replaced else it })
        } else {
            store.copy(user = store.user.map { if (it.id == oldEntry.id) replaced else it })
        }
        save()
        return MemoryResult(success = true)
    }

    fun remove(target: MemoryTarget, oldText: String): MemoryResult {
        reloadIfChanged()
        val entries = if (target == MemoryTarget.MEMORY) store.memory else store.user
        val matches = entries.filter { it.content.contains(oldText) }
        if (matches.isEmpty()) return MemoryResult(success = false, error = "No entry found containing \"$oldText\"")
        if (matches.size > 1) return MemoryResult(success = false, error = "Multiple entries match \"$oldText\". Please be more specific.")

        store = if (target == MemoryTarget.MEMORY) {
            store.copy(memory = store.memory.filterNot { it.id == matches[0].id })
        } else {
            store.copy(user = store.user.filterNot { it.id == matches[0].id })
        }
        save()
        return MemoryResult(success = true)
    }

    fun getAll(): MemoryStore {
        reloadIfChanged()
        return store
    }

    fun getFormatted(): String {
        reloadIfChanged()
        val memoryCount = charCount(store.memory)
        val userCount = charCount(store.user)

        val sb = StringBuilder()
        if (store.memory.isNotEmpty()) {
            sb.append("\n══════════════════════════════════════════════\n")
            sb.append("MEMORY (your personal notes) [${(memoryCount.toDouble() * 100 / MEMORY_CHAR_LIMIT).roundToInt()}% — $memoryCount/$MEMORY_CHAR_LIMIT chars]\n")
            sb.append("══════════════════════════════════════════════\n\n")
            sb.append(store.memory.joinToString("\n\n§\n\n") { it.content })
            sb.append("\n\n")
        }
        if (store.user.isNotEmpty()) {
            sb.append("\n══════════════════════════════════════════════\n")
            sb.append("USER PROFILE [${(userCount.toDouble() * 100 / USER_CHAR_LIMIT).roundToInt()}% — $userCount/$USER_CHAR_LIMIT chars]\n")
            sb.append("══════════════════════════════════════════════\n\n")
            sb.append(store.user.joinToString("\n\n§\n\n") { it.content })
            sb.append("\n\n")
        }
        return sb.toString()
    }

    fun clear() {
        reloadIfChanged()
        store = MemoryStore()
        save()
    }

    /** Cari entri yang mengandung kata kunci (case-insensitive). Target null = cari di keduanya. */
    fun search(query: String, target: MemoryTarget? = null): List<MemoryEntry> {
        reloadIfChanged()
        if (query.isBlank()) return emptyList()
        val q = query.lowercase()
        val pools = when (target) {
            MemoryTarget.MEMORY -> listOf(store.memory)
            MemoryTarget.USER -> listOf(store.user)
            null -> listOf(store.memory, store.user)
        }
        return pools.flatten().filter { it.content.lowercase().contains(q) }
    }
}