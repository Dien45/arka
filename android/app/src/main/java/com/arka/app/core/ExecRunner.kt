package com.arka.app.core

import android.content.Context
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.File
import java.io.InputStream
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * Eksekusi command `run_command` di dalam distro Alpine asli via proot (tanpa root).
 *
 * Backend shell Android (`/system/bin/sh`, toybox) sudah dihapus: tidak ada
 * package manager dan tidak cukup untuk pekerjaan coding. Sekarang kalau distro
 * belum siap, [run] melempar error yang menjelaskan langkah perbaikannya — bukan
 * diam-diam menjalankan command di shell Android.
 *
 * Jaminan keamanan tetap: allowlist opsional, timeout, cap output 200 KB, dan
 * approval gate dari UI (5 tool sensitif).
 */
data class ExecResult(
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int = 0,
    val timedOut: Boolean = false,
    val backend: String = "proot/Alpine",
)

class ExecRunner(
    private val context: Context,
    private val distro: DistroManager = DistroManager(context),
) {
    companion object {
        /** Timeout default satu command di distro (apk add bisa lama). */
        const val PROOT_DEFAULT_TIMEOUT_MS = 60_000L
        const val MAX_OUT = 200_000

        /** Metachar shell yang dilarang saat allowlist aktif (command dijalankan via `sh -c`). */
        private val SHELL_METACHARS = setOf(';', '|', '&', '$', '`', '(', ')', '<', '>', '\\', '\n', '\r')
    }

    private fun isAllowed(command: String, allowlist: List<String>): Boolean {
        val prefixes = allowlist.map { it.trim() }.filter { it.isNotEmpty() }
        if (prefixes.isEmpty()) return true
        val trimmed = command.trim()
        // Tolak metachar shell di mana pun, bukan hanya token pertama: command
        // dijalankan lewat `sh -c`, jadi "git status; rm -rf /" tetap bisa jalan
        // walau "git" ada di allowlist.
        if (trimmed.any { it in SHELL_METACHARS }) return false
        // Prefix match hanya pada batas token ("git" tidak meloloskan "github-cli").
        return prefixes.any { entry ->
            trimmed.startsWith(entry) && (trimmed.length == entry.length || trimmed[entry.length].isWhitespace())
        }
    }

    /** Alasan distro belum siap (cek ringan, tanpa menghitung ukuran rootfs); null = siap. */
    fun notReadyReason(): String? = when {
        distro.prootBinary() == null || distro.loaderBinary() == null ->
            "binary proot tidak ada di APK ini (build ulang dengan jaringan agar task downloadProotBinaries berhasil)"
        !distro.isInstalled() ->
            "distro Alpine belum dipasang (Settings → Command & Distro → Unduh & pasang)"
        else -> null
    }

    suspend fun run(
        command: String,
        sessionId: String? = null,
        settings: ExecSettings = ExecSettings(),
    ): ExecResult {
        if (command.isBlank()) throw IllegalStateException("command required")
        if (!isAllowed(command, settings.allowlist)) throw IllegalStateException("command not in allowlist")

        notReadyReason()?.let { reason ->
            throw IllegalStateException("Distro Alpine belum siap: $reason.")
        }

        val fs = VirtualFs(context)
        val prootWorkspace = runCatching { fs.prootWorkspaceDir() }.getOrNull()
        val sessionWorkspace = sessionId?.let { runCatching { fs.workspaceDir(it) }.getOrNull() }
        return runProot(command, prootWorkspace, sessionWorkspace, settings)
    }

    // ------------------------------------------------------------------- proot

    private suspend fun runProot(
        command: String,
        prootWorkspace: File?,
        sessionWorkspace: File?,
        settings: ExecSettings,
    ): ExecResult {
        val argv = distro.buildProotCommand(command, prootWorkspace, sessionWorkspace, settings)
            ?: throw IllegalStateException("Distro Alpine belum siap (rootfs atau binary proot tidak lengkap).")

        val builder = ProcessBuilder(argv)
        builder.directory(context.filesDir)
        builder.environment().apply {
            putAll(distro.prootProcessEnv())
            this["PATH"] = "/system/bin:/system/xbin:/vendor/bin"
            this["HOME"] = context.filesDir.absolutePath
            this["TMPDIR"] = context.cacheDir.absolutePath
        }
        val timeout = settings.timeoutMs.takeIf { it > 0 } ?: PROOT_DEFAULT_TIMEOUT_MS
        return execute(builder, timeout)
    }

    // ------------------------------------------------------------------ shared

    private suspend fun execute(builder: ProcessBuilder, timeoutMs: Long): ExecResult {
        val process = withContext(Dispatchers.IO) {
            try {
                builder.redirectErrorStream(false).start()
            } catch (e: Exception) {
                throw IllegalStateException(e.message ?: "failed to start process")
            }
        }

        val stdout = StringBuilder()
        val stderr = StringBuilder()
        val t1 = threadRead(process.inputStream, stdout)
        val t2 = threadRead(process.errorStream, stderr)

        val finished = withContext(Dispatchers.IO) { process.waitFor(timeoutMs, TimeUnit.MILLISECONDS) }
        var timedOut = false
        if (!finished) {
            timedOut = true
            process.destroy()
            withContext(Dispatchers.IO) { process.waitFor(2, TimeUnit.SECONDS) }
            process.destroyForcibly()
        }
        try {
            withContext(Dispatchers.IO) {
                t1.join(3000)
                t2.join(3000)
            }
        } finally {
            // Pastikan tidak ada proses nyangkut (mis. coroutine di-cancel saat waitFor).
            runCatching { process.destroy() }
            runCatching { process.destroyForcibly() }
        }

        val exitCode = if (timedOut) {
            1
        } else {
            try {
                if (process.isAlive) 1 else process.exitValue()
            } catch (e: Exception) {
                1
            }
        }
        return ExecResult(
            stdout = stdout.toString().take(MAX_OUT),
            stderr = stderr.toString().take(MAX_OUT),
            exitCode = exitCode,
            timedOut = timedOut,
            backend = "proot/Alpine",
        )
    }

    private fun threadRead(input: InputStream, sink: StringBuilder): Thread {
        val t = Thread {
            try {
                val reader = BufferedReader(InputStreamReader(input))
                val buf = CharArray(8192)
                var keepReading = true
                while (keepReading) {
                    val n = reader.read(buf)
                    if (n < 0) break
                    if (sink.length < MAX_OUT) {
                        sink.append(buf, 0, minOf(n, MAX_OUT - sink.length))
                    }
                    if (sink.length >= MAX_OUT) keepReading = false
                }
            } catch (ignored: Exception) {
                // stream ditutup saat destroy — berhenti diam-diam
            }
        }
        t.name = "arka-exec-read"
        t.isDaemon = true
        t.start()
        return t
    }
}
