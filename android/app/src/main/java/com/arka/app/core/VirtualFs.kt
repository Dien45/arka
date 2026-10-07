package com.arka.app.core

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/**
 * Per-session virtual filesystem mapping key -> content. Ported conceptually
 * from `src/virtualFs.ts` (minimal read/write/list/remove per session).
 */
@Serializable
data class SessionFs(val entries: MutableMap<String, String> = mutableMapOf())

class VirtualFs(private val context: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val fsDir = File(context.filesDir, "virtual_fs").apply { mkdirs() }

    private fun fileFor(sessionId: String): File = File(fsDir, "$sessionId.json")

    fun read(sessionId: String, key: String): String? {
        return try {
            val sf = json.decodeFromString<SessionFs>(fileFor(sessionId).readText())
            sf.entries[key]
        } catch (t: Throwable) {
            null
        }
    }

    fun write(sessionId: String, key: String, content: String) {
        val f = fileFor(sessionId)
        val sf = try {
            if (f.exists()) json.decodeFromString<SessionFs>(f.readText()) else SessionFs()
        } catch (t: Throwable) {
            SessionFs()
        }
        sf.entries[key] = content
        runCatching { f.writeText(json.encodeToString(sf)) }
    }

    fun list(sessionId: String): List<Pair<String, Int>> {
        val f = fileFor(sessionId)
        return try {
            val sf = if (f.exists()) json.decodeFromString<SessionFs>(f.readText()) else SessionFs()
            sf.entries.map { it.key to it.value.length }
        } catch (t: Throwable) {
            emptyList()
        }
    }

    fun remove(sessionId: String, key: String) {
        val f = fileFor(sessionId)
        val sf = try {
            if (f.exists()) json.decodeFromString<SessionFs>(f.readText()) else return
        } catch (t: Throwable) {
            return
        }
        sf.entries.remove(key)
        runCatching { f.writeText(json.encodeToString(sf)) }
    }

    fun deleteSession(sessionId: String) {
        runCatching { fileFor(sessionId).delete() }
    }

    fun getAllKeys(sessionId: String): List<String> = list(sessionId).map { it.first }
}