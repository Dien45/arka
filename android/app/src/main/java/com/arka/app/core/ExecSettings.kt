package com.arka.app.core

/**
 * Konfigurasi backend `run_command` yang dipakai [ExecRunner].
 *
 * - [ExecBackend.NATIVE] : shell Android (`/system/bin/sh`), paling aman & selalu
 *   tersedia, tapi sangat terbatas (toybox, tanpa package manager).
 * - [ExecBackend.PROOT]  : distro Alpine asli (apk, bash, python, git, ...) via
 *   proot tanpa root. Butuh binary proot (dibundel sebagai jniLibs) + rootfs
 *   Alpine yang diunduh sekali dari Settings.
 */
enum class ExecBackend { NATIVE, PROOT;
    companion object {
        fun from(value: String?): ExecBackend =
            if (value.equals("proot", ignoreCase = true)) PROOT else NATIVE
    }
    val id: String get() = name.lowercase()
}

data class ExecSettings(
    val backend: ExecBackend = ExecBackend.NATIVE,
    /** Kosong = pakai allowlist default (semua command diizinkan, tetap lewat gate approval). */
    val allowlist: List<String> = emptyList(),
    val timeoutMs: Long = ExecRunner.DEFAULT_TIMEOUT_MS,
    val distroRootfsUrl: String = DistroManager.DEFAULT_ROOTFS_URL,
    /** proot butuh seccomp dimatikan di sebagian perangkat ARM64. */
    val prootNoSeccomp: Boolean = true,
    /** Bind folder workspace sesi ke /root/workspace di dalam distro. */
    val bindWorkspace: Boolean = true,
)
