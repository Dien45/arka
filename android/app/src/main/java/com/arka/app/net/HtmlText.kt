package com.arka.app.net

import android.text.Html
import androidx.core.text.HtmlCompat
import java.util.regex.Pattern

/**
 * Sederhana, pure, tanpa dependensi berat: strip HTML → teks bersih.
 * Dipakai web_fetch supaya situs eksternal tidak mengembalikan HTML mentah.
 */
object HtmlText {
    private val SCRIPT_STYLE = Pattern.compile(
        "(?is)<(script|style|head|noscript|iframe|frame|object|embed)[^>]*>.*?</\\1>",
        Pattern.DOTALL,
    )
    private val COMMENTS = Pattern.compile("(?is)<!--.*?-->", Pattern.DOTALL)
    private val TAGS = Pattern.compile("<[^>]+>")
    private val MULTI_WS = Pattern.compile("\\s+")
    private val NBSP = "&nbsp;".toRegex(RegexOption.IGNORE_CASE)
    private val AMP = "&amp;".toRegex(RegexOption.IGNORE_CASE)
    private val LT = "&lt;".toRegex(RegexOption.IGNORE_CASE)
    private val GT = "&gt;".toRegex(RegexOption.IGNORE_CASE)
    private val QUOT = "&quot;".toRegex(RegexOption.IGNORE_CASE)
    private val APOS = "&apos;".toRegex(RegexOption.IGNORE_CASE)

    fun strip(html: String): String {
        if (html.isBlank()) return ""
        var s = html
        // Hapus blok script/style/head
        s = SCRIPT_STYLE.matcher(s).replaceAll(" ")
        s = COMMENTS.matcher(s).replaceAll(" ")
        // Decode entitas dasar dulu (mengurangi artefak)
        s = NBSP.replace(s, " ")
        s = AMP.replace(s, "&")
        s = LT.replace(s, "<")
        s = GT.replace(s, ">")
        s = QUOT.replace(s, "\"")
        s = APOS.replace(s, "'")
        // Strip tag
        s = TAGS.matcher(s).replaceAll(" ")
        // Collapse whitespace
        s = MULTI_WS.matcher(s).replaceAll(" ")
        s = s.trim()
        return s
    }

    /** Versi yang coba pakai Html.fromHtml (Android) untuk hasil lebih bersih. */
    fun stripCompat(html: String): String {
        if (html.isBlank()) return ""
        return try {
            val spanned = HtmlCompat.fromHtml(html, HtmlCompat.FROM_HTML_MODE_LEGACY)
            val text = spanned.toString()
            // Bersihkan whitespace ganda
            MULTI_WS.matcher(text).replaceAll(" ").trim()
        } catch (t: Throwable) {
            strip(html)
        }
    }

    fun isProbablyEmpty(html: String): Boolean {
        if (html.isBlank()) return true
        val stripped = strip(html)
        return stripped.isBlank()
    }
}
