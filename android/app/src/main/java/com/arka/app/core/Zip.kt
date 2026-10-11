package com.arka.app.core

import java.io.File
import java.io.InputStream
import java.io.OutputStream
import java.util.zip.ZipEntry
import java.util.zip.ZipInputStream
import java.util.zip.ZipOutputStream

/**
 * Helper ZIP untuk workspace (paritas tombol "Download ZIP" / "Upload ZIP" di web).
 * Memakai java.util.zip standar — tidak menambah dependensi.
 */
object ZipUtil {

    private val skipImportDirs = setOf(
        "__MACOSX", ".git", "node_modules", "build", ".gradle",
        "dist", ".next", "target", "__pycache__",
    )

    /** Tulis seluruh file workspace sesi ke [out] sebagai satu arsip ZIP. */
    fun exportWorkspace(fs: VirtualFs, sessionId: String, out: OutputStream): Int {
        val entries = fs.listEntries(sessionId).filterNot { it.isDir }
        ZipOutputStream(out.buffered()).use { zip ->
            entries.forEach { entry ->
                val bytes = fs.readBytes(sessionId, entry.path) ?: return@forEach
                zip.putNextEntry(ZipEntry(entry.path))
                zip.write(bytes)
                zip.closeEntry()
            }
        }
        return entries.size
    }

    /**
     * Impor isi ZIP ke workspace sesi. Entri berbahaya (path absolut / `..`)
     * dilewati. Return jumlah file yang berhasil ditulis.
     */
    fun importWorkspace(
        fs: VirtualFs,
        sessionId: String,
        input: InputStream,
        maxTotalBytes: Long = MAX_TOTAL_VIRTUAL_BYTES.toLong(),
    ): Int {
        var written = 0
        var total = 0L
        ZipInputStream(input.buffered()).use { zip ->
            while (true) {
                val entry = zip.nextEntry ?: break
                if (entry.isDirectory) continue
                val name = entry.name.replace('\\', '/').removePrefix("./").trimStart('/')
                if (name.isBlank() || name.split('/').any { it == ".." } || name.contains(":")) continue
                if (name.split('/').any { it in skipImportDirs }) continue
                // Inflasi bertahap dengan cap berjalan — jangan readBytes() dulu
                // (zip-bomb kecil bisa meledak jadi GB di RAM sebelum cap dicek).
                val inflated = java.io.ByteArrayOutputStream()
                val buf = ByteArray(8192)
                var entryTotal = 0
                var overCap = false
                while (true) {
                    val n = zip.read(buf)
                    if (n < 0) break
                    entryTotal += n
                    if (entryTotal > MAX_FILE_BYTES) {
                        overCap = true
                        break
                    }
                    inflated.write(buf, 0, n)
                }
                if (overCap) continue
                val bytes = inflated.toByteArray()
                total += bytes.size
                if (total > maxTotalBytes) break
                if (fs.writeBytes(sessionId, name, bytes)) written++
            }
        }
        return written
    }

    fun exportFilesTo(file: File, fs: VirtualFs, sessionId: String): Int =
        file.outputStream().use { exportWorkspace(fs, sessionId, it) }
}
