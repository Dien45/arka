package com.arka.app.net

/**
 * Parser URL GitHub → strategi fetch (pure function, testable).
 * Mendukung: blob/tree/raw/commit/pull/actions, juga bare repo dan file di commit/ref.
 */
data class GitHubFetch(
    val kind: Kind,
    val owner: String,
    val repo: String,
    val ref: String? = null,
    val path: String? = null,
    val pr: Int? = null,
    val runId: Long? = null,
    val workflowFile: String? = null,
    val commitSha: String? = null,
) {
    enum class Kind {
        README,
        FILE_BLOB,
        TREE,
        RAW,
        PR,
        COMMIT,
        ACTIONS_RUN,
        ACTIONS_WORKFLOW,
        UNKNOWN,
    }
}

object GitHubUrl {
    private val RE_BARE = Regex("^github\\.com/([^/?#]+)/([^/?#]+)(?:[/?#].*)?$")
    private val RE_BLOB = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/blob/([^/?#]+)(?:/(.+))?")
    private val RE_TREE = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/tree/([^/?#]+)(?:/(.+))?")
    private val RE_RAW = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/raw/([^/?#]+)(?:/(.+))?")
    private val RE_COMMIT = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/commit/([0-9a-fA-F]{7,40})(?:/(.+))?")
    private val RE_PULL = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/pull/(\\d+)(?:[/?#].*)?$")
    private val RE_ACTIONS_RUN = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/actions/runs/(\\d+)(?:[/?#].*)?$")
    private val RE_ACTIONS_WORKFLOW = Regex("^github\\.com/([^/?#]+)/([^/?#]+)/actions/workflows/([^/?#]+)(?:[/?#].*)?$")

    fun parse(url: String): GitHubFetch? {
        if (url.isBlank()) return null
        val norm = url.trim().removePrefix("http://").removePrefix("https://").trimEnd('/')
        // Actions workflow
        RE_ACTIONS_WORKFLOW.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val wf = m.groupValues[3]
            return GitHubFetch(GitHubFetch.Kind.ACTIONS_WORKFLOW, owner, repo, workflowFile = wf)
        }
        // Actions run
        RE_ACTIONS_RUN.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val run = m.groupValues[3].toLongOrNull() ?: 0L
            return GitHubFetch(GitHubFetch.Kind.ACTIONS_RUN, owner, repo, runId = run)
        }
        // Pull
        RE_PULL.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val pr = m.groupValues[3].toIntOrNull()
            return GitHubFetch(GitHubFetch.Kind.PR, owner, repo, pr = pr)
        }
        // Commit
        RE_COMMIT.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val sha = m.groupValues[3]
            val path = m.groupValues.getOrNull(4)
            return GitHubFetch(GitHubFetch.Kind.COMMIT, owner, repo, ref = sha, path = path, commitSha = sha)
        }
        // Raw
        RE_RAW.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val ref = m.groupValues[3]
            val path = m.groupValues.getOrNull(4)?.trimStart('/')
            return GitHubFetch(GitHubFetch.Kind.RAW, owner, repo, ref = ref, path = path)
        }
        // Blob
        RE_BLOB.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val ref = m.groupValues[3]
            val path = m.groupValues.getOrNull(4)?.trimStart('/')
            return GitHubFetch(GitHubFetch.Kind.FILE_BLOB, owner, repo, ref = ref, path = path)
        }
        // Tree
        RE_TREE.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            val ref = m.groupValues[3]
            val path = m.groupValues.getOrNull(4)?.trimStart('/')
            return GitHubFetch(GitHubFetch.Kind.TREE, owner, repo, ref = ref, path = path)
        }
        // Bare
        RE_BARE.find(norm)?.let { m ->
            val owner = m.groupValues[1]
            val repo = m.groupValues[2]
            return GitHubFetch(GitHubFetch.Kind.README, owner, repo)
        }
        return null
    }
}
