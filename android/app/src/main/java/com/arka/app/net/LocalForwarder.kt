package com.arka.app.net

import okhttp3.HttpUrl.Companion.toHttpUrlOrNull
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.ConcurrentHashMap
import kotlin.concurrent.thread

/**
 * Penerus (relay) TCP loopback untuk server **http** di IP privat
 * (Tailscale `100.x`/`fd7a::/48`, LAN RFC1918, link-local).
 *
 * Kenapa ada: `network_security_config` melarang cleartext ke host non-loopback
 * dan tidak mendukung CIDR, sehingga `http://100.x.x.x:11434` (Ollama via
 * Tailscale) ditolak OkHttp dengan
 * `UnknownServiceException: CLEARTEXT ... not permitted`. Kebijakan cleartext
 * hanya ditegakkan oleh stack HTTP (OkHttp/HttpURLConnection/WebView), BUKAN
 * oleh kernel — jadi socket TCP mentah ke `100.x` tetap diizinkan.
 *
 * Penerus ini listen di `127.0.0.1` (yang di-allowlist) lalu menyambung ke host
 * asli memakai socket mentah, sehingga:
 *   - NSC tetap KETAT: base-config `cleartextTrafficPermitted="false"`, allowlist
 *     hanya loopback — tidak ada pelemahan kebijakan global;
 *   - hanya host yang **privat** yang diteruskan; http ke host publik
 *     (`example.com`) tetap diblokir seperti sebelumnya.
 *
 * Pemetaan dilakukan di choke point URL (ModelFetcher.request & AiClient.httpJson)
 * sehingga Base URL yang ditampilkan/disimpan ke user tetap URL asli.
 */
object LocalForwarder {

    private data class Target(val host: String, val port: Int)

    /** host asli -> port loopback lokal. */
    private val forwards = ConcurrentHashMap<Target, Int>()

    private val loopbackHosts = setOf("localhost", "127.0.0.1", "::1", "[::1]", "10.0.2.2")

    /**
     * Kalau [url] memakai skema http dan host-nya privat (bukan loopback), ganti
     * host:port menjadi `127.0.0.1:<portLokal>` yang meneruskan ke host asli.
     * Selain itu kembalikan [url] apa adanya.
     */
    fun localize(url: String): String {
        val parsed = url.toHttpUrlOrNull() ?: return url
        if (parsed.scheme != "http") return url
        val host = parsed.host
        if (host in loopbackHosts) return url
        if (!isPrivateHost(host)) return url
        val localPort = ensure(host, parsed.port)
        return parsed.newBuilder().host("127.0.0.1").port(localPort).build().toString()
    }

    /** Mulai (sekali per host:port) server relay loopback; kembalikan port lokal. */
    @Synchronized
    private fun ensure(host: String, port: Int): Int {
        val key = Target(host, port)
        forwards[key]?.let { return it }
        val server = ServerSocket(0, 50, InetAddress.getLoopbackAddress())
        forwards[key] = server.localPort
        thread(name = "arka-relay-$host:$port", isDaemon = true) {
            while (!server.isClosed) {
                val client = try {
                    server.accept()
                } catch (_: Exception) {
                    break
                }
                thread(name = "arka-relay-conn", isDaemon = true) { bridge(client, host, port) }
            }
        }
        return server.localPort
    }

    private fun bridge(client: Socket, host: String, port: Int) {
        val upstream = try {
            Socket().apply { connect(InetSocketAddress(host, port), 15_000) }
        } catch (_: Exception) {
            runCatching { client.close() }
            return
        }
        try {
            client.tcpNoDelay = true
            upstream.tcpNoDelay = true
            val back = thread(name = "arka-relay-up", isDaemon = true) { pump(client, upstream) }
            pump(upstream, client)
            back.join(1_000)
        } catch (_: Exception) {
            // koneksi ditutup — tidak apa-apa
        } finally {
            runCatching { client.close() }
            runCatching { upstream.close() }
        }
    }

    private fun pump(from: Socket, to: Socket) {
        try {
            val buf = ByteArray(16 * 1024)
            val ins = from.getInputStream()
            val out = to.getOutputStream()
            while (true) {
                val n = ins.read(buf)
                if (n < 0) break
                out.write(buf, 0, n)
                out.flush()
            }
        } catch (_: Exception) {
            // EOF/reset — normal saat koneksi berakhir
        } finally {
            runCatching { to.shutdownOutput() }
        }
    }

    /**
     * Host privat: literal IPv4/IPv6 dalam rentang privat, atau hostname lokal
     * (tanpa titik, atau berakhiran `.local`/`.ts.net`/`.internal`/`.lan`).
     * Tanpa resolusi DNS (tidak blocking); host dengan titik publik seperti
     * `example.com` sengaja TIDAK diteruskan agar cleartext ke internet tetap
     * diblokir.
     */
    private fun isPrivateHost(host: String): Boolean {
        if (host.isEmpty()) return false
        if (host.contains(':')) return isPrivateIpv6(host)
        val parts = host.split('.')
        if (parts.size == 4) {
            val nums = parts.map { it.toIntOrNull() }
            if (nums.all { it != null && it in 0..255 }) {
                val a = nums[0]!!
                val b = nums[1]!!
                return a == 10 || a == 127 ||
                    (a == 172 && b in 16..31) ||
                    (a == 192 && b == 168) ||
                    (a == 100 && b in 64..127) ||
                    (a == 169 && b == 254)
            }
        }
        val h = host.lowercase()
        return !h.contains('.') ||
            h.endsWith(".local") || h.endsWith(".ts.net") ||
            h.endsWith(".internal") || h.endsWith(".lan")
    }

    private fun isPrivateIpv6(host: String): Boolean {
        val h = host.removePrefix("[").removeSuffix("]").lowercase()
        if (h == "::1") return true
        // fc00::/7 (ULA) & fe80::/10 (link-local) mencakup fd7a:: (Tailscale)
        return h.startsWith("fc") || h.startsWith("fd") ||
            h.startsWith("fe8") || h.startsWith("fe9") ||
            h.startsWith("fea") || h.startsWith("feb")
    }
}
