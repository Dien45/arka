package com.arka.app.core

import java.io.File

/**
 * Tulis file atomik + backup, dipakai memory/skills/staged-commits supaya
 * file corrupt (crash di tengah tulis) tidak melenyapkan data diam-diam.
 */
object AtomicFile {
    /** Tulis lewat file temp + rename (sebisa mungkin atomik di filesystem). */
    fun writeText(target: File, text: String) {
        target.parentFile?.mkdirs()
        val tmp = File(target.parentFile, target.name + ".tmp")
        tmp.writeText(text)
        if (!tmp.renameTo(target)) {
            target.delete()
            tmp.renameTo(target)
        }
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
