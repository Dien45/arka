package com.arka.app.core

import android.content.Context
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import java.io.File

/** Satu entri (file/folder) di workspace sesi. */
data class FsEntry(
    val path: String,
    val size: Long,
    val modified: Long,
    val isDir: Boolean = false,
)

@Serializable
private data class LegacySessionFs(val entries: MutableMap<String, String> = mutableMapOf())

/**
 * Workspace per sesi — sekarang **nyata di disk**, bukan JSON in-memory lagi.
 *
 * Hirarki:
 * ```
 * <filesDir>/sessions/<sessionId>/workspace/...   <- file yang dibuat AI & user
 * ```
 *
 * Alasan perubahan (M7):
 *  - `run_command` dijalankan dengan cwd folder ini, jadi command shell dan
 *    file yang dibuat AI berada di satu dunia yang sama (di web keduanya
 *    terpisah: virtual FS vs folder asli).
 *  - distro proot (Alpine) bisa mem-bind folder ini ke `/root/workspace`.
 *  - File Explorer membaca folder yang sama, tidak ada dua salinan data.
 *
 * Data lama (`<filesDir>/virtual_fs/<sid>.json`) tetap dibaca: begitu sesi
 * diakses, isinya dimigrasi ke layout baru lalu file JSON lamanya dibuang.
 */
class VirtualFs(private val context: Context) {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val legacyDir = File(context.filesDir, "virtual_fs")
    private val sessionsDir = File(context.filesDir, "sessions").apply { mkdirs() }

    /** Folder root milik satu sesi (bukan workspace-nya). */
    fun sessionDir(sessionId: String): File {
        val dir = File(sessionsDir, sanitizeSessionId(sessionId))
        if (!dir.exists()) dir.mkdirs()
        migrateLegacy(sessionId, dir)
        return dir
    }

    /** Folder yang dipakai sebagai cwd command & isi workspace. */
    fun workspaceDir(sessionId: String): File =
        File(sessionDir(sessionId), "workspace").apply { mkdirs() }

    private fun sanitizeSessionId(sessionId: String): String {
        val cleaned = sessionId.replace(Regex("[^A-Za-z0-9_.-]"), "_").take(64)
        return cleaned.ifBlank { "default" }
    }

    /**
     * Resolusi path aman: relatif terhadap workspace sesi, menolak path absolut
     * dan traversal (`..`). Return null kalau path tidak valid.
     */
    fun resolve(sessionId: String, path: String): File? {
        val root = workspaceDir(sessionId)
        val normalized = path.trim().trimStart('/').replace('\\', '/')
        if (normalized.isEmpty()) return null
        if (normalized.split('/').any { it == ".." }) return null
        val target = File(root, normalized)
        // Pastikan hasilnya tetap di dalam workspace (jaga-jaga symlink/path aneh).
        val rootPath = root.canonicalPath + File.separator
        return if (target.canonicalPath.startsWith(rootPath) || target.canonicalPath == root.canonicalPath) {
            target
        } else {
            null
        }
    }

    // ------------------------------------------------------------- read/write

    fun read(sessionId: String, path: String): String? {
        val f = resolve(sessionId, path) ?: return null
        if (!f.isFile) return null
        return runCatching { f.readText() }.getOrNull()
    }

    fun readBytes(sessionId: String, path: String): ByteArray? {
        val f = resolve(sessionId, path) ?: return null
        if (!f.isFile) return null
        return runCatching { f.readBytes() }.getOrNull()
    }

    /** Menulis file (folder induk dibuat otomatis). Return false kalau path invalid. */
    fun write(sessionId: String, path: String, content: String): Boolean {
        val f = resolve(sessionId, path) ?: return false
        return runCatching {
            f.parentFile?.mkdirs()
            f.writeText(content)
            true
        }.getOrDefault(false)
    }

    fun writeBytes(sessionId: String, path: String, bytes: ByteArray): Boolean {
        val f = resolve(sessionId, path) ?: return false
        return runCatching {
            f.parentFile?.mkdirs()
            f.writeBytes(bytes)
            true
        }.getOrDefault(false)
    }

    fun remove(sessionId: String, path: String): Boolean {
        val f = resolve(sessionId, path) ?: return false
        return runCatching { f.deleteRecursively() }.getOrDefault(false)
    }

    /** Path → ukuran (byte), urut alfabetis. Dipertahankan untuk kompatibilitas pemanggil lama. */
    fun list(sessionId: String): List<Pair<String, Int>> =
        listEntries(sessionId).filterNot { it.isDir }.map { it.path to it.size.toInt() }

    /** Daftar file (tanpa folder) lengkap dengan waktu modifikasi. */
    fun listEntries(sessionId: String): List<FsEntry> {
        val root = workspaceDir(sessionId)
        if (!root.exists()) return emptyList()
        val out = mutableListOf<FsEntry>()
        root.walkTopDown()
            .onEnter { it.name != ".git" }
            .forEach { f ->
                if (f == root) return@forEach
                val rel = f.relativeTo(root).path.replace(File.separatorChar, '/')
                out.add(FsEntry(path = rel, size = if (f.isFile) f.length() else 0L, modified = f.lastModified(), isDir = f.isDirectory))
            }
        return out.sortedBy { it.path.lowercase() }
    }

    /** Pohon folder untuk File Explorer (folder + file, terurut folder dulu). */
    fun tree(sessionId: String): List<FsEntry> {
        val entries = listEntries(sessionId)
        return entries.sortedWith(compareByDescending<FsEntry> { it.isDir }.thenBy { it.path.lowercase() })
    }

    fun getAllKeys(sessionId: String): List<String> = list(sessionId).map { it.first }

    fun totalBytes(sessionId: String): Long = listEntries(sessionId).filterNot { it.isDir }.sumOf { it.size }

    /** Jumlah file di dalam satu folder (untuk UI tree). */
    fun countIn(sessionId: String, folder: String): Int {
        val prefix = folder.trimEnd('/') + "/"
        return list(sessionId).count { it.first.startsWith(prefix) }
    }

    fun deleteSession(sessionId: String) {
        runCatching { File(sessionsDir, sanitizeSessionId(sessionId)).deleteRecursively() }
        runCatching { File(legacyDir, "$sessionId.json").delete() }
    }

    // -------------------------------------------------------------- migration

    /** Migrasi workspace JSON versi lama ke file nyata (sekali per sesi). */
    private fun migrateLegacy(sessionId: String, dir: File) {
        val marker = File(dir, ".migrated")
        if (marker.exists()) return
        val legacy = File(legacyDir, "$sessionId.json")
        if (legacy.isFile) {
            runCatching {
                val parsed = json.decodeFromString<LegacySessionFs>(legacy.readText())
                val ws = File(dir, "workspace").apply { mkdirs() }
                parsed.entries.forEach { (path, content) ->
                    val rel = path.trimStart('/').replace('\\', '/')
                    if (rel.isNotEmpty() && !rel.split('/').contains("..")) {
                        val target = File(ws, rel)
                        target.parentFile?.mkdirs()
                        target.writeText(content)
                    }
                }
                legacy.delete()
            }
        }
        runCatching { marker.writeText("ok") }
    }
}
