package com.arka.app.net

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.async
import kotlinx.coroutines.awaitAll
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import okhttp3.OkHttpClient
import java.util.concurrent.TimeUnit

/** Satu berkas di dalam sebuah skill (path relatif terhadap folder skill). */
data class RemoteFile(val path: String, val size: Long)

/** Kandidat skill yang ditemukan di sebuah repo GitHub. */
data class SkillCandidate(
    val id: String,
    val name: String,
    /** Path folder skill di dalam repo ("" = root repo). */
    val dir: String,
    val files: List<RemoteFile>,
    val repo: String,
    val ref: String = "HEAD",
    val description: String = "",
    val author: String = "",
    val version: String = "custom",
    /** Body SKILL.md/prompt.md — diisi saat detail diambil (bukan saat discover). */
    val instructions: String = "",
)

/**
 * Menemukan & mengunduh skill dari repo GitHub (M9+).
 *
 * Mendukung dua gaya:
 *  - **Claude Skills / koleksi** (mis. affaan-m/ecc): banyak folder berisi
 *    `SKILL.md` dengan frontmatter YAML (`name`, `description`) + berkas
 *    pendukung (`agents/openai.yaml`, `scripts/…`, dsb).
 *  - **Repo skill tunggal** gaya Arka lama: `skill.json` / `prompt.md` di root.
 *
 * Semua berkas diunduh apa adanya (text-only, dengan batas ukuran) supaya bisa
 * "dipakai" sungguhan: AI membacanya lewat tool `skill`/`read_file` dan bisa
 * menjalankan script-nya lewat `run_command`.
 */
object SkillFetcher {

    private val json = Json { ignoreUnknownKeys = true }

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    const val MAX_FILE_BYTES = 200_000L
    const val MAX_SKILL_BYTES = 1_500_000L
    const val MAX_FILES = 40

    private val TEXT_EXT = setOf(
        "md", "mdx", "markdown", "txt", "rst", "adoc",
        "json", "jsonc", "yaml", "yml", "toml", "ini", "cfg", "conf", "properties", "env", "example",
        "sh", "bash", "zsh", "fish", "ps1", "bat", "cmd",
        "py", "js", "mjs", "cjs", "ts", "tsx", "jsx", "rb", "go", "rs", "kt", "kts", "java", "php", "pl", "lua",
        "sql", "html", "htm", "css", "scss", "csv", "tsv", "graphql", "proto", "tf", "tfvars", "hcl",
        "dockerfile", "makefile", "gitignore", "editorconfig", "hook", "grader", "tool", "xml",
    )

    /** "https://github.com/owner/repo.git" / "owner/repo" → "owner/repo". */
    fun normalizeRepo(input: String): String? {
        var repo = input.trim()
        if (repo.contains("github.com")) {
            repo = Regex("github\\.com[/:]([^/]+/[^/\\s]+)").find(repo)?.groupValues?.get(1) ?: return null
        }
        repo = repo.removeSuffix(".git").trimEnd('/')
        while (repo.endsWith("/")) repo = repo.dropLast(1)
        return if (Regex("^[\\w.-]+/[\\w.-]+$").matches(repo)) repo else null
    }

    private fun rawUrl(repo: String, ref: String, path: String) =
        "https://raw.githubusercontent.com/$repo/$ref/" + path.split('/').joinToString("/") { encodeSegment(it) }

    private fun encodeSegment(segment: String): String =
        java.net.URLEncoder.encode(segment, "UTF-8").replace("+", "%20")

    private fun headers(token: String, accept: String): Map<String, String> = buildMap {
        put("Accept", accept)
        put("User-Agent", "arka-android")
        if (token.isNotBlank()) put("Authorization", "Bearer $token")
    }

    // ---------------------------------------------------------------- discover

    /** Unduh daftar berkas sebuah repo (sekali request tree API). */
    private suspend fun fetchTree(repo: String, token: String): List<RemoteFile> {
        val url = "https://api.github.com/repos/$repo/git/trees/HEAD?recursive=1"
        val body = SimpleHttp.getAsString(client, url, headers(token, "application/vnd.github+json"))
        val root = json.parseToJsonElement(body).jsonObject
        if (root["tree"] == null) {
            val message = root["message"]?.jsonPrimitive?.contentOrNull ?: "respons tidak dikenali"
            throw IllegalStateException("Gagal membaca repo $repo: $message")
        }
        return root["tree"]!!.jsonArray.mapNotNull { element ->
            val o = element.jsonObject
            if (o["type"]?.jsonPrimitive?.contentOrNull != "blob") return@mapNotNull null
            val path = o["path"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            RemoteFile(path, o["size"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L)
        }
    }

    private fun isTextCandidate(file: RemoteFile): Boolean {
        if (file.size > MAX_FILE_BYTES) return false
        val name = file.path.substringAfterLast('/').lowercase()
        val ext = if (name.contains('.')) name.substringAfterLast('.') else name
        return ext in TEXT_EXT
    }

    /**
     * Cari semua skill di repo. Hasil dibiarkan "ringan" (tanpa isi berkas) —
     * detail `SKILL.md` diambil hanya saat user membuka satu skill.
     */
    suspend fun discover(repoInput: String, token: String = ""): List<SkillCandidate> = withContext(Dispatchers.IO) {
        val repo = normalizeRepo(repoInput)
            ?: throw IllegalStateException("Format repo tidak valid. Gunakan \"username/repo\" atau URL GitHub lengkap.")
        val author = repo.substringBefore('/')
        val tree = fetchTree(repo, token)

        val manifests = tree.filter { file ->
            val lower = file.path.lowercase()
            lower.endsWith("skill.md") || lower.endsWith("skill.json") || lower.endsWith("prompt.md")
        }
        // Folder yang punya SKILL.md atau skill.json (prompt.md hanya dipakai
        // kalau repo tidak punya manifest lain — gaya Arka lama).
        var dirs = manifests
            .filterNot { it.path.lowercase().endsWith("prompt.md") }
            .map { it.path.substringBeforeLast('/', "") }
            .distinct()
        if (dirs.isEmpty()) {
            dirs = manifests.map { it.path.substringBeforeLast('/', "") }.distinct()
        }
        if (dirs.isEmpty()) {
            throw IllegalStateException(
                "Tidak menemukan SKILL.md / skill.json / prompt.md di $repo. " +
                    "Pastikan repo memang berisi skill (contoh: folder dengan SKILL.md).",
            )
        }

        dirs.map { dir ->
            val prefix = if (dir.isEmpty()) "" else "$dir/"
            val files = tree
                .filter { it.path.startsWith(prefix) && isTextCandidate(it) }
                .sortedWith(
                    compareBy(
                        { it.path.substringAfterLast('/').lowercase() != "skill.md" },
                        { it.path.count { c -> c == '/' } },
                        { it.path },
                    ),
                )
                .take(MAX_FILES)
                .map { RemoteFile(it.path.removePrefix(prefix), it.size) }
            val folderName = dir.substringAfterLast('/').ifBlank { repo.substringAfter('/') }
            SkillCandidate(
                id = ("gh-${repo.replace('/', '-')}-${folderName}").take(64) + "-" + dir.hashCode().toUInt().toString(16),
                name = folderName.replace('-', ' ').replace('_', ' ').trim(),
                dir = dir,
                files = files,
                repo = repo,
                description = "",
                author = author,
            )
        }.sortedBy { it.name.lowercase() }
    }

    /** Cari repo GitHub berdasarkan nama (dipakai saat user mengetik nama skill saja). */
    suspend fun searchRepos(query: String, token: String = "", limit: Int = 8): List<String> =
        withContext(Dispatchers.IO) {
            val q = java.net.URLEncoder.encode(query.trim(), "UTF-8")
            val url = "https://api.github.com/search/repositories?q=$q+in:name&sort=stars&order=desc&per_page=$limit"
            val body = SimpleHttp.getAsString(client, url, headers(token, "application/vnd.github+json"))
            val root = json.parseToJsonElement(body).jsonObject
            root["items"]?.jsonArray?.mapNotNull { element ->
                element.jsonObject["full_name"]?.jsonPrimitive?.contentOrNull
            } ?: emptyList()
        }

    /**
     * Ambil isi satu berkas dari skill (untuk pratinjau / menyimpan detail).
     */
    suspend fun fetchFile(candidate: SkillCandidate, relativePath: String, token: String = ""): String =
        withContext(Dispatchers.IO) {
            val full = if (candidate.dir.isEmpty()) relativePath else "${candidate.dir}/$relativePath"
            SimpleHttp.getAsString(
                client,
                rawUrl(candidate.repo, candidate.ref, full),
                headers(token, "text/plain"),
            )
        }

    /** Isi SKILL.md/skill.json/prompt.md + frontmatter, dipakai untuk pratinjau. */
    suspend fun fetchDetail(candidate: SkillCandidate, token: String = ""): SkillCandidate {
        val names = candidate.files.map { it.path }
        val skillMd = names.firstOrNull { it.equals("SKILL.md", true) }
        val skillJson = names.firstOrNull { it.equals("skill.json", true) }
        val promptMd = names.firstOrNull { it.equals("prompt.md", true) }

        var name = candidate.name
        var description = candidate.description
        var version = candidate.version
        var instructions = ""

        if (skillMd != null) {
            val text = runCatching { fetchFile(candidate, skillMd, token) }.getOrElse { "" }
            val (meta, body) = parseFrontmatter(text)
            name = meta["name"]?.takeIf { it.isNotBlank() }?.replace('-', ' ') ?: name
            description = meta["description"] ?: description
            version = meta["version"] ?: version
            instructions = body.ifBlank { text }
        }
        if (skillJson != null) {
            val text = runCatching { fetchFile(candidate, skillJson, token) }.getOrElse { "" }
            runCatching {
                val o = json.parseToJsonElement(text).jsonObject
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: name
                description = o["description"]?.jsonPrimitive?.contentOrNull ?: description
                version = o["version"]?.jsonPrimitive?.contentOrNull ?: version
                val enhancement = o["enhancement"]?.jsonPrimitive?.contentOrNull
                if (!enhancement.isNullOrBlank()) instructions = enhancement
            }
        }
        if (instructions.isBlank() && promptMd != null) {
            instructions = runCatching { fetchFile(candidate, promptMd, token) }.getOrElse { "" }
        }
        if (instructions.isBlank()) {
            instructions = description.ifBlank { "Skill $name dari ${candidate.repo}." }
        }

        return candidate.copy(name = name, description = description, version = version, instructions = instructions)
    }

    /** Unduh semua berkas skill; mengembalikan map path-relatif → isi. */
    suspend fun downloadFiles(
        candidate: SkillCandidate,
        token: String = "",
        onProgress: (done: Int, total: Int) -> Unit = { _, _ -> },
    ): Map<String, String> = withContext(Dispatchers.IO) {
        var totalBytes = 0L
        val result = LinkedHashMap<String, String>()
        var done = 0
        coroutineScope {
            candidate.files.chunked(4).forEach { chunk ->
                val batch = chunk.map { file ->
                    async {
                        val text = runCatching { fetchFile(candidate, file.path, token) }.getOrNull()
                        file to text
                    }
                }.awaitAll()
                batch.forEach { (file, text) ->
                    done++
withContext(Dispatchers.Main) { onProgress(done, candidate.files.size) }
if (text == null) return@forEach
                    if (totalBytes + text.length > MAX_SKILL_BYTES) return@forEach
                    totalBytes += text.length
                    result[file.path] = text
                }
            }
        }
        result
    }

    // ------------------------------------------------------------- frontmatter

    /** Parser YAML frontmatter minimal (`---` di awal file, key: value sederhana). */
    fun parseFrontmatter(markdown: String): Pair<Map<String, String>, String> {
        val text = markdown.replace("\r\n", "\n")
        if (!text.startsWith("---")) return emptyMap<String, String>() to text
        val end = text.indexOf("\n---", startIndex = 3)
        if (end < 0) return emptyMap<String, String>() to text
        val header = text.substring(3, end).trim()
        val body = text.substring(text.indexOf('\n', end + 1).coerceAtLeast(end + 1)).trimStart('\n')
        val meta = LinkedHashMap<String, String>()
        header.lines().forEach { line ->
            val idx = line.indexOf(':')
            if (idx <= 0) return@forEach
            val key = line.substring(0, idx).trim().lowercase()
            var value = line.substring(idx + 1).trim()
            if (value.startsWith(">") || value.startsWith("|")) value = value.drop(1).trim()
            value = value.trim('"', '\'').trim()
            if (value.isNotEmpty() && key in setOf("name", "description", "version", "license", "author", "when_to_use")) {
                meta[key] = value
            }
        }
        return meta to body
    }
}
