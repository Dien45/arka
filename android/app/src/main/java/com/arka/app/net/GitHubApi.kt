package com.arka.app.net

import com.arka.app.core.GitHubRepo
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.contentOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonObject
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.util.concurrent.TimeUnit

const val GITHUB_API = "https://api.github.com"

data class GitHubUser(val login: String, val name: String, val scopes: List<String>)

/** [content] == null berarti file dihapus dari repo. */
data class GitHubFilePayload(val path: String, val content: String?)

data class PushResult(val success: Boolean, val message: String)

/** Manifest ekspor/impor sinkronisasi (paritas "SyncManifest" panel GitHub web). */
@Serializable
data class SyncManifest(
    val repoFullName: String = "",
    val branch: String = "main",
    val files: List<String> = emptyList(),
    val exportedAt: Long = System.currentTimeMillis(),
    val app: String = "arka-android",
)

/**
 * Port dari `src/githubApi.ts` — OkHttp + kotlinx.serialization.
 * Push memakai Git Data API (blob → tree → commit → update ref) sama seperti
 * versi web, jadi hasil commit-nya identik.
 */
object GitHubApi {

    private val json = Json { ignoreUnknownKeys = true; encodeDefaults = true }
    private val mediaJson = "application/json; charset=utf-8".toMediaType()

    private val client: OkHttpClient by lazy {
        OkHttpClient.Builder()
            .connectTimeout(20, TimeUnit.SECONDS)
            .readTimeout(60, TimeUnit.SECONDS)
            .writeTimeout(60, TimeUnit.SECONDS)
            .build()
    }

    private data class HttpResult(val code: Int, val body: String, val headers: Map<String, String>)

    private suspend fun call(
        method: String,
        url: String,
        token: String,
        body: JsonObject? = null,
    ): HttpResult = withContext(Dispatchers.IO) {
        val builder = Request.Builder()
            .url(url)
            .header("Authorization", "Bearer $token")
            .header("Accept", "application/vnd.github+json")
            .header("X-GitHub-Api-Version", "2022-11-28")
        when (method) {
            "POST" -> builder.post((body?.toString() ?: "{}").toRequestBody(mediaJson))
            "PATCH" -> builder.patch((body?.toString() ?: "{}").toRequestBody(mediaJson))
            "DELETE" -> builder.delete()
            else -> builder.get()
        }
        client.newCall(builder.build()).execute().use { resp ->
            HttpResult(resp.code, resp.body?.string() ?: "", resp.headers.toMultimap().mapValues { it.value.firstOrNull() ?: "" })
        }
    }

    // ------------------------------------------------------------------- user

    suspend fun getUser(token: String): GitHubUser {
        val res = call("GET", "$GITHUB_API/user", token)
        if (res.code !in 200..299) throw IllegalStateException("Token tidak valid (HTTP ${res.code})")
        val obj = json.parseToJsonElement(res.body).jsonObject
        val scopes = res.headers["X-OAuth-Scopes"]
            ?.split(',')
            ?.map { it.trim() }
            ?.filter { it.isNotEmpty() }
            ?: emptyList()
        return GitHubUser(
            login = obj["login"]?.jsonPrimitive?.contentOrNull ?: "",
            name = obj["name"]?.jsonPrimitive?.contentOrNull ?: "",
            scopes = scopes,
        )
    }

    // ------------------------------------------------------------------ repos

    suspend fun fetchRepos(token: String): List<GitHubRepo> {
        val res = call("GET", "$GITHUB_API/user/repos?sort=updated&per_page=100", token)
        if (res.code !in 200..299) throw IllegalStateException("Gagal mengambil repo (HTTP ${res.code})")
        val arr = runCatching { json.parseToJsonElement(res.body).jsonArray }.getOrElse { JsonArray(emptyList()) }
        return arr.mapNotNull { element ->
            val o = runCatching { element.jsonObject }.getOrNull() ?: return@mapNotNull null
            val full = o["full_name"]?.jsonPrimitive?.contentOrNull ?: return@mapNotNull null
            GitHubRepo(
                id = o["id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L,
                name = o["name"]?.jsonPrimitive?.contentOrNull ?: full.substringAfter('/'),
                fullName = full,
                description = o["description"]?.jsonPrimitive?.contentOrNull,
                isPrivate = o["private"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: false,
                defaultBranch = o["default_branch"]?.jsonPrimitive?.contentOrNull ?: "main",
                updatedAt = o["updated_at"]?.jsonPrimitive?.contentOrNull ?: "",
            )
        }
    }

    suspend fun fetchBranches(token: String, repoFullName: String): List<String> {
        val res = call("GET", "$GITHUB_API/repos/$repoFullName/branches?per_page=100", token)
        if (res.code !in 200..299) throw IllegalStateException("Gagal mengambil branch (HTTP ${res.code})")
        val arr = runCatching { json.parseToJsonElement(res.body).jsonArray }.getOrElse { JsonArray(emptyList()) }
        return arr.mapNotNull { it.jsonObject["name"]?.jsonPrimitive?.contentOrNull }
    }

    suspend fun createRepo(token: String, name: String, isPrivate: Boolean, description: String = ""): GitHubRepo {
        val body = buildJsonObject {
            put("name", name)
            put("private", isPrivate)
            if (description.isNotBlank()) put("description", description)
            put("auto_init", true)
        }
        val res = call("POST", "$GITHUB_API/user/repos", token, body)
        if (res.code !in 200..299) throw IllegalStateException("Gagal membuat repo (HTTP ${res.code}): ${res.body.take(200)}")
        val o = json.parseToJsonElement(res.body).jsonObject
        return GitHubRepo(
            id = o["id"]?.jsonPrimitive?.contentOrNull?.toLongOrNull() ?: 0L,
            name = o["name"]?.jsonPrimitive?.contentOrNull ?: name,
            fullName = o["full_name"]?.jsonPrimitive?.contentOrNull ?: name,
            description = o["description"]?.jsonPrimitive?.contentOrNull,
            isPrivate = o["private"]?.jsonPrimitive?.contentOrNull?.toBoolean() ?: isPrivate,
            defaultBranch = o["default_branch"]?.jsonPrimitive?.contentOrNull ?: "main",
        )
    }

    // ------------------------------------------------------------------- push

    suspend fun pushFiles(
        token: String,
        repoFullName: String,
        branch: String,
        files: List<GitHubFilePayload>,
        commitMessage: String,
    ): PushResult {
        if (files.isEmpty()) return PushResult(false, "Tidak ada file yang dipilih.")
        return try {
            val refRes = call("GET", "$GITHUB_API/repos/$repoFullName/git/ref/heads/$branch", token)
            if (refRes.code !in 200..299) throw IllegalStateException("Branch $branch tidak ditemukan")
            val latestCommitSha = json.parseToJsonElement(refRes.body).jsonObject["object"]
                ?.jsonObject?.get("sha")?.jsonPrimitive?.content
                ?: throw IllegalStateException("Struktur respons ref tidak dikenali")

            val commitRes = call("GET", "$GITHUB_API/repos/$repoFullName/git/commits/$latestCommitSha", token)
            val treeSha = json.parseToJsonElement(commitRes.body).jsonObject["tree"]
                ?.jsonObject?.get("sha")?.jsonPrimitive?.content
                ?: throw IllegalStateException("Struktur respons commit tidak dikenali")

            val treeItems = buildJsonArray {
                files.forEach { file ->
                    if (file.content == null) {
                        add(buildJsonObject {
                            put("path", file.path)
                            put("mode", "100644")
                            put("type", "blob")
                            put("sha", null as String?)
                        })
                    } else {
                        val blobBody = buildJsonObject {
                            put("content", file.content)
                            put("encoding", "utf-8")
                        }
                        val blobRes = call("POST", "$GITHUB_API/repos/$repoFullName/git/blobs", token, blobBody)
                        if (blobRes.code !in 200..299) {
                            throw IllegalStateException("Gagal membuat blob untuk ${file.path}")
                        }
                        val sha = json.parseToJsonElement(blobRes.body).jsonObject["sha"]?.jsonPrimitive?.content
                            ?: throw IllegalStateException("Blob tanpa sha untuk ${file.path}")
                        add(buildJsonObject {
                            put("path", file.path)
                            put("mode", "100644")
                            put("type", "blob")
                            put("sha", sha)
                        })
                    }
                }
            }

            val treeBody = buildJsonObject {
                put("base_tree", treeSha)
                put("tree", treeItems)
            }
            val newTreeRes = call("POST", "$GITHUB_API/repos/$repoFullName/git/trees", token, treeBody)
            if (newTreeRes.code !in 200..299) throw IllegalStateException("Gagal membuat tree")
            val newTreeSha = json.parseToJsonElement(newTreeRes.body).jsonObject["sha"]?.jsonPrimitive?.content
                ?: throw IllegalStateException("Tree tanpa sha")

            val commitBody = buildJsonObject {
                put("message", commitMessage)
                put("tree", newTreeSha)
                putJsonObject("author") {
                    put("name", "Arka AI")
                    put("email", "arka-ai@users.noreply.github.com")
                }
                put("parents", buildJsonArray { add(JsonPrimitive(latestCommitSha)) })
            }
            val newCommitRes = call("POST", "$GITHUB_API/repos/$repoFullName/git/commits", token, commitBody)
            if (newCommitRes.code !in 200..299) throw IllegalStateException("Gagal membuat commit")
            val newCommitSha = json.parseToJsonElement(newCommitRes.body).jsonObject["sha"]?.jsonPrimitive?.content
                ?: throw IllegalStateException("Commit tanpa sha")

            val refUpdateRes = call(
                "PATCH",
                "$GITHUB_API/repos/$repoFullName/git/refs/heads/$branch",
                token,
                buildJsonObject { put("sha", newCommitSha) },
            )
            if (refUpdateRes.code !in 200..299) {
                throw IllegalStateException("Gagal update branch (HTTP ${refUpdateRes.code})")
            }

            val additions = files.count { it.content != null }
            val deletions = files.count { it.content == null }
            val parts = buildList {
                if (additions > 0) add("$additions file ditambah/diupdate")
                if (deletions > 0) add("$deletions file dihapus")
            }
            PushResult(true, "Berhasil push ke $branch: ${parts.joinToString(", ")}.")
        } catch (e: Exception) {
            PushResult(false, e.message ?: "Unknown error occurred")
        }
    }

    // ----------------------------------------------------------------- scopes

    val REQUIRED_GITHUB_SCOPES = listOf("repo")

    fun getExcessiveScopes(scopes: List<String>): List<String> =
        scopes.filter { it !in REQUIRED_GITHUB_SCOPES && it != "public_repo" && it != "workflow" && it != "gist" }
}
