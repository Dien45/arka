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
                val bytes = zip.readBytes()
                if (bytes.size > MAX_FILE_BYTES) continue
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
