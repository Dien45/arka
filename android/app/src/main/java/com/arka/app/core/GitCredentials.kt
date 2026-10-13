package com.arka.app.core

import android.content.Context
import java.io.File

/**
 * Menjembatani PAT GitHub milik user (disimpan di EncryptedSharedPreferences
 * via panel GitHub) ke dalam distro proot, supaya `git clone/push/pull`
 * lewat run_command langsung terautentikasi — AI tidak perlu (dan tidak
 * boleh) meminta PAT di chat.
 *
 * Mekanisme: file `/root/.git-credentials` di rootfs + `credential.helper =
 * store` di `/root/.gitconfig` global. Format tanpa username
 * (`x-access-token`) sehingga tidak perlu tahu login user. File diberi izin
 * owner-only; system prompt melarang AI mencetak/mengekspos isinya.
 */
object GitCredentials {
    private const val CRED_PATH = "root/.git-credentials"
    private const val CONFIG_PATH = "root/.gitconfig"

    private fun rootfsDir(context: Context): File =
        File(File(context.filesDir, "distro"), "alpine")

    /** Sinkronkan kredensial proot dengan [token] (kosong = cabut). */
    fun sync(context: Context, token: String) {
        runCatching {
            val root = rootfsDir(context)
            // Rootfs belum dipasang / sudah dihapus → tidak ada yang disinkron.
            if (!File(root, "etc/alpine-release").isFile && !File(root, "bin/busybox").isFile) return
            val clean = token.trim()
            val cred = File(root, CRED_PATH)
            if (clean.isEmpty()) {
                cred.delete()
                return
            }
            // Tolak token berkarakter aneh (baris baru dsb.) demi keamanan URL.
            if (clean.any { it.isWhitespace() || it < ' ' }) return
            File(root, "root").mkdirs()
            cred.writeText("https://x-access-token:$clean@github.com\n")
            cred.setReadable(false, false)
            cred.setReadable(true, true)
            cred.setWritable(false, false)
            cred.setWritable(true, true)
            cred.setExecutable(false, false)
            ensureGitconfig(root)
        }
    }

    /** Tambahkan section yang kurang ke .gitconfig global (tanpa menimpa milik user). */
    private fun ensureGitconfig(root: File) {
        val cfg = File(root, CONFIG_PATH)
        val current = runCatching { cfg.readText() }.getOrDefault("")
        val sb = StringBuilder(current)
        if (!current.contains("helper = store")) {
            if (sb.isNotEmpty() && !sb.endsWith("\n")) sb.append("\n")
            sb.append("[credential]\n\thelper = store\n")
        }
        if (!current.contains("[user]")) {
            sb.append("[user]\n\tname = arka\n\temail = arka@local\n")
        }
        if (sb.toString() != current) {
            runCatching { cfg.writeText(sb.toString()) }
        }
    }
}
