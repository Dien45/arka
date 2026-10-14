package com.arka.app.core

import android.content.Context
import android.system.Os
import android.system.OsConstants
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
 *
 * **Penempatan & hardening izin:** file berada di `<filesDir>/distro/alpine/
 * root/` — di LUAR workspace AI (`<filesDir>/workspace/`, yang di-bind ke
 * `/root/workspace` di dalam proot), jadi tidak tampil di File Explorer dan
 * tidak ikut ter-ekspos lewat bind workspace. Direktori `$HOME` rootfs
 * dikunci 0700 dan file kredensial 0600 (bit eksak, dipasang sebelum token
 * ditulis). Backup Auto Backup juga mengecualikan seluruh folder `distro/`.
 *
 * **RISIKO SISA (residual):** file tetap berada DI DALAM rootfs proot, jadi
 * setiap perintah `run_command` (shell agent) secara teknis masih BISA
 * membaca `/root/.git-credentials` — permission + larangan di system prompt
 * hanyalah pertahanan berlapis, BUKAN isolasi. Egress juga wajib TLS
 * (`network_security_config` memblokir cleartext) agar token tidak
 * terkirim plaintext lewat jaringan.
 *
 * **PERBAIKAN ARSITEKTURAL YANG DITUNDA:** credential-helper `GIT_ASKPASS`
 * yang membaca PAT dari EncryptedSharedPreferences pada saat runtime (PAT
 * tidak pernah tersimpan plaintext di disk). Butuh dukungan di sisi launcher
 * proot (bind/env helper — berkas DistroManager/ExecRunner, di luar cakupan
 * berkas ini) dan berisiko memutus alur `git push/pull` bila tidak diuji
 * menyeluruh, sehingga belum diterapkan.
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
            // Hardening (lihat KDoc object ini untuk risiko sisa):
            //  - $HOME rootfs dikunci 0700, file kredensial 0600 — bit eksak
            //    lewat Os.chmod (set* versi lama hanya toggle bit owner dan
            //    bisa gagal diam-diam).
            //  - File dibuat + di-chmod SEBELUM token ditulis, supaya token
            //    tidak pernah tersentuh dengan permission default (0644).
            //  - chmod dibungkus runCatching per langkah: kegagalan permission
            //    TIDAK boleh menggagalkan sync, karena itu akan memutus alur
            //    git push/pull (kredensial hilang).
            val home = File(root, "root")
            home.mkdirs()
            runCatching { Os.chmod(home.path, OsConstants.S_IRWXU) } // 0700
            if (!cred.exists()) runCatching { cred.createNewFile() }
            runCatching { Os.chmod(cred.path, OsConstants.S_IRUSR or OsConstants.S_IWUSR) } // 0600
            cred.writeText("https://x-access-token:$clean@github.com\n")
            // writeText bisa membuat ulang file (bila terhapus di tengah jalan)
            // dengan mode default → ulangi chmod sebagai jaring pengaman.
            runCatching { Os.chmod(cred.path, OsConstants.S_IRUSR or OsConstants.S_IWUSR) } // 0600
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
