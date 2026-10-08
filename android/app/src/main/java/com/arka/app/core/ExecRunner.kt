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
 * Eksekusi command di perangkat, pengganti backend HTTP `server.js` di web.
 *
 * Dua backend:
 *  1. [ExecBackend.NATIVE] — `/system/bin/sh` bawaan Android (toybox).
 *     Selalu tersedia, tanpa setup, tapi fiturnya minim: tidak ada apk/pip,
 *     tidak ada git/node/python (kecuali app lain menyediakannya).
 *  2. [ExecBackend.PROOT] — distro Alpine asli lewat [DistroManager] (proot
 *     tanpa root): `apk add git python3 nodejs ...` benar-benar berfungsi.
 *
 * Catatan fix penting: versi sebelumnya memanggil `/bin/sh`. Di Android tidak
 * ada `/bin`, shell-nya `/system/bin/sh`, sehingga `run_command` gagal dengan
 * "Cannot run program /bin/sh". Sekarang shell dideteksi.
 *
 * Jaminan keamanan tetap sama seperti web: allowlist opsional, timeout,
 * cap output 200 KB, dan approval gate dari UI (5 tool sensitif).
 */
data class ExecResult(
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int = 0,
    val timedOut: Boolean = false,
    val backend: String = "native",
)

class ExecRunner(
    private val context: Context,
    private val distro: DistroManager = DistroManager(context),
) {
    companion object {
        const val DEFAULT_TIMEOUT_MS = 15_000L
        const val PROOT_DEFAULT_TIMEOUT_MS = 60_000L
        const val MAX_OUT = 200_000

        /** Shell Android yang benar-benar ada di device ini. */
        fun shellPath(): String =
            listOf("/system/bin/sh", "/vendor/bin/sh", "/bin/sh")
                .firstOrNull { File(it).exists() }
                ?: "sh"
    }

    private var allowlist: List<String> = emptyList()

    fun setAllowlist(prefixes: List<String>) {
        allowlist = prefixes.map { it.trim() }.filter { it.isNotEmpty() }
    }

    private fun isAllowed(command: String): Boolean {
        if (allowlist.isEmpty()) return true
        return allowlist.any { command.trim().startsWith(it) }
    }

    fun activeBackend(settings: ExecSettings): ExecBackend = settings.backend

    /** Deskripsi backend untuk pesan tool / UI. */
    fun describeBackend(settings: ExecSettings): String = when {
        settings.backend == ExecBackend.PROOT && distro.canRunProot() -> "proot/Alpine"
        settings.backend == ExecBackend.PROOT -> "native (distro proot belum siap)"
        else -> "native (Android shell)"
    }

    suspend fun run(
        command: String,
        sessionId: String? = null,
        settings: ExecSettings = ExecSettings(),
    ): ExecResult {
        if (command.isBlank()) throw IllegalStateException("command required")
        if (!isAllowed(command)) throw IllegalStateException("command not in allowlist")

        val workspace = sessionId?.let { runCatching { VirtualFs(context).workspaceDir(it) }.getOrNull() }

        return if (settings.backend == ExecBackend.PROOT && distro.canRunProot()) {
            runProot(command, workspace, settings)
        } else {
            runNative(command, workspace, settings)
        }
    }

    // ------------------------------------------------------------------ native

    private suspend fun runNative(command: String, workspace: File?, settings: ExecSettings): ExecResult {
        val builder = ProcessBuilder(shellPath(), "-c", command)
        builder.directory(workspace?.takeIf { it.isDirectory } ?: context.filesDir)
        builder.environment().apply {
            this["PATH"] = listOf("/system/bin", "/system/xbin", "/vendor/bin", "/data/local/bin")
                .joinToString(":")
            this["HOME"] = context.filesDir.absolutePath
            this["TMPDIR"] = context.cacheDir.absolutePath
            this["LANG"] = "C.UTF-8"
        }
        return execute(builder, settings.timeoutMs, "native")
    }

    // ------------------------------------------------------------------- proot

    private suspend fun runProot(command: String, workspace: File?, settings: ExecSettings): ExecResult {
        val argv = distro.buildProotCommand(command, workspace, settings)
            ?: return runNative(command, workspace, settings).copy(
                stderr = "Distro proot belum siap, command dijalankan di shell Android.\n",
            )

        val builder = ProcessBuilder(argv)
        builder.directory(context.filesDir)
        builder.environment().apply {
            putAll(distro.prootProcessEnv())
            this["PATH"] = "/system/bin:/system/xbin:/vendor/bin"
            this["HOME"] = context.filesDir.absolutePath
            this["TMPDIR"] = context.cacheDir.absolutePath
        }
        val timeout = if (settings.timeoutMs <= DEFAULT_TIMEOUT_MS) PROOT_DEFAULT_TIMEOUT_MS else settings.timeoutMs
        return execute(builder, timeout, "proot/Alpine")
    }

    // ------------------------------------------------------------------ shared

    private suspend fun execute(builder: ProcessBuilder, timeoutMs: Long, backend: String): ExecResult {
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
        t1.join()
        t2.join()

        val exitCode = if (timedOut) 1 else process.exitValue()
        return ExecResult(
            stdout = stdout.toString().take(MAX_OUT),
            stderr = stderr.toString().take(MAX_OUT),
            exitCode = exitCode,
            timedOut = timedOut,
            backend = backend,
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
