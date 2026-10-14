package com.arka.app.core

import java.io.File
import java.io.IOException

/**
 * Tulis file atomik + backup, dipakai memory/skills/staged-commits supaya
 * file corrupt (crash di tengah tulis) tidak melenyapkan data diam-diam.
 */
object AtomicFile {
    /**
     * Tulis lewat file temp + rename (sebisa mungkin atomik di filesystem).
     * Melempar [IOException] kalau rename final gagal — target bisa saja sudah
     * terhapus, jadi kegagalan TIDAK boleh dilaporkan seperti sukses.
     */
    fun writeText(target: File, text: String) {
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.outputStream().use { out ->
            out.write(text.toByteArray(Charsets.UTF_8))
            out.fd.sync()
        }
        if (tmp.renameTo(target)) return
        target.delete()
        if (!tmp.renameTo(target)) throw IOException("rename final gagal untuk ${target.name}")
    }

    /** Salinan pengaman `<nama>.bak` ( dioverwrite tiap save yang sukses). */
    fun backup(target: File) {
        if (target.isFile) {
            runCatching {
                target.copyTo(File(target.parentFile, target.name + ".bak"), overwrite = true)
            }
        }
    }

    fun backupFileFor(target: File): File = File(target.parentFile, target.name + ".bak")
}
