package com.arka.app.net

import java.net.InetAddress
import java.net.URI
import java.util.Locale

/**
 * Validasi URL publik untuk web_fetch (anti-SSRF). Mengecek skema, bentuk
 * host, sufiks internal, lalu me-resolve DNS dan menolak semua hasil yang
 * bukan IP publik (loopback, site-local, link-local, multicast, CGNAT).
 * Dipakai [Tools.assertSafeFetchTarget] dan redirect manual [SimpleHttp].
 */
object NetGuard {
    private val blockedExact = setOf("localhost", "0.0.0.0", "::1", "[::1]", "169.254.169.254")
    private val dottedQuad = Regex("^(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})\\.(\\d{1,3})$")
    private val integerForm = Regex("^\\d+$")

    fun checkPublicUrl(rawUrl: String): URI {
        val uri = try {
            URI(rawUrl)
        } catch (e: Exception) {
            throw IllegalArgumentException("URL tidak valid.")
        }
        val scheme = uri.scheme?.lowercase(Locale.ROOT)
        if (scheme != "http" && scheme != "https") {
            throw IllegalArgumentException("Skema URL tidak diizinkan. Hanya http/https.")
        }
        val host = uri.host?.lowercase(Locale.ROOT) ?: throw IllegalArgumentException("URL tidak valid.")
        if (host in blockedExact) {
            throw IllegalArgumentException("Fetch ke alamat internal/loopback/metadata diblokir untuk mencegah SSRF.")
        }
        // Bentuk IP non-standar (desimal utuh, heksa, oktal) — selalu curiga.
        if (integerForm.matches(host) || "0x" in host) {
            throw IllegalArgumentException("Bentuk IP non-standar diblokir untuk mencegah SSRF.")
        }
        val ipv4 = dottedQuad.find(host)
        if (ipv4 != null) {
            val a = ipv4.groupValues[1].toInt()
            val b = ipv4.groupValues[2].toInt()
            val isPrivate = a == 10 ||
                (a == 172 && b in 16..31) ||
                (a == 192 && b == 168) ||
                a == 127 ||
                (a == 169 && b == 254)
            if (isPrivate) {
                throw IllegalArgumentException("Fetch ke rentang IP privat/link-local diblokir untuk mencegah SSRF.")
            }
        }
        if (host.endsWith(".local") || host.endsWith(".internal")) {
            throw IllegalArgumentException("Fetch ke host internal (.local/.internal) diblokir.")
        }
        // Jaring pengaman utama: resolve DNS lalu tolak hasil non-publik.
        // Ini menangkap oktet ber-leading-zero (diartikan oktal), IPv6 aneh,
        // dan DNS rebinding (evil.com -> IP privat).
        val addrs = try {
            InetAddress.getAllByName(host)
        } catch (e: Exception) {
            throw IllegalArgumentException("Host tidak bisa di-resolve: $host")
        }
        for (a in addrs) {
            if (a.isLoopbackAddress || a.isSiteLocalAddress || a.isLinkLocalAddress || a.isMulticastAddress) {
                throw IllegalArgumentException("Fetch ke alamat non-publik diblokir untuk mencegah SSRF.")
            }
            val ip = (a.hostAddress ?: "").lowercase(Locale.ROOT)
            if (ip.startsWith("100.64.") || ip.startsWith("192.0.0.") ||
                ip.startsWith("::ffff:127.") || ip.startsWith("::ffff:10.") ||
                ip.startsWith("::ffff:192.168.") || ip.startsWith("::ffff:169.254.")
            ) {
                throw IllegalArgumentException("Fetch ke alamat non-publik diblokir untuk mencegah SSRF.")
            }
        }
        return uri
    }
}
