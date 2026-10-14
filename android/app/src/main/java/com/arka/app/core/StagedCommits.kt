package com.arka.app.core

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

@Serializable
data class StagedCommitFile(val path: String, val content: String? = null)

@Serializable
data class StagedCommit(
    val id: String,
    val message: String,
    val files: List<StagedCommitFile> = emptyList(),
    val createdAt: Long,
)

const val MAX_STAGED_COMMITS_BYTES = 8_000_000

/** Android analog of the `arka-staged-commits` localStorage array (tools.ts + GitHub panel). */
class StagedCommits(context: Context) {
    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val file: File = File(context.filesDir, "staged_commits.json")

    fun load(): List<StagedCommit> {
        val parsed = runCatching {
            json.decodeFromString<List<StagedCommit>>(file.readText())
        }.getOrNull()
        if (parsed != null) return parsed
        return runCatching {
            json.decodeFromString<List<StagedCommit>>(AtomicFile.backupFileFor(file).readText())
        }.getOrDefault(emptyList())
    }

    private fun save(commits: List<StagedCommit>): Boolean = runCatching {
        AtomicFile.backup(file)
        AtomicFile.writeText(file, json.encodeToString(commits))
    }.isSuccess

    fun add(commit: StagedCommit): Boolean {
        val candidate = load() + commit
        if (json.encodeToString(candidate).length > MAX_STAGED_COMMITS_BYTES) return false
        return save(candidate)
    }

    fun remove(id: String) {
        save(load().filterNot { it.id == id })
    }
}