package com.arka.app.core

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.BufferedReader
import java.io.InputStream
import java.io.InputStreamReader
import java.util.concurrent.TimeUnit

/**
 * On-device analog of the server.js exec backend: same semantics
 * (allowlist when non-empty, 15s timeout, ~200KB output cap, merged tool
 * message) but executed via Runtime.exec — no HTTP loopback, no `npm run
 * server` needed on the phone.
 */
data class ExecResult(
    val stdout: String = "",
    val stderr: String = "",
    val exitCode: Int = 0,
    val timedOut: Boolean = false,
)

object ExecRunner {
    const val TIMEOUT_MS = 15_000L
    const val MAX_OUT = 200_000

    private var allowlist: List<String> = emptyList()

    fun setAllowlist(prefixes: List<String>) {
        allowlist = prefixes.map { it.trim() }.filter { it.isNotEmpty() }
    }

    private fun isAllowed(command: String): Boolean {
        if (allowlist.isEmpty()) return true
        return allowlist.any { command.trim().startsWith(it) }
    }

    /**
     * Runs `command`. Throws IllegalStateException for validate/startup
     * failures (mirrors server.js 400/403/500 paths).
     */
    suspend fun run(command: String): ExecResult {
        if (command.isBlank()) throw IllegalStateException("command required")
        if (!isAllowed(command)) throw IllegalStateException("command not in allowlist")

        val cmdArray = if ((System.getProperty("os.name") ?: "").lowercase().contains("win")) {
            arrayOf("cmd.exe", "/C", command)
        } else {
            arrayOf("/bin/sh", "-c", command)
        }

        val process = withContext(Dispatchers.IO) {
            try {
                ProcessBuilder(*cmdArray).redirectErrorStream(false).start()
            } catch (e: Exception) {
                throw IllegalStateException(e.message ?: "failed to start process")
            }
        }

        val stdout = StringBuilder()
        val stderr = StringBuilder()
        val t1 = threadRead(process.inputStream, stdout)
        val t2 = threadRead(process.errorStream, stderr)

        val finished = withContext(Dispatchers.IO) { process.waitFor(TIMEOUT_MS, TimeUnit.MILLISECONDS) }
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
        )
    }

    private fun threadRead(input: InputStream, sink: StringBuilder): Thread {
        val t = Thread {
            try {
                val reader = BufferedReader(InputStreamReader(input))
                val buf = CharArray(8192)
                var s = true
                while (s) {
                    val n = reader.read(buf)
                    if (n < 0) break
                    if (sink.length < MAX_OUT) {
                        sink.append(buf, 0, minOf(n, MAX_OUT - sink.length))
                    }
                    if (sink.length >= MAX_OUT) s = false
                }
            } catch (ignored: Exception) {
                // stream closed on destroy — stop quietly
            }
        }
        t.name = "arka-exec-read"
        t.isDaemon = true
        t.start()
        return t
    }
}