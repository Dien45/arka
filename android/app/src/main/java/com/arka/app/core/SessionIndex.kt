package com.arka.app.core

import android.content.ContentValues
import android.content.Context
import android.database.Cursor
import android.database.sqlite.SQLiteDatabase
import android.database.sqlite.SQLiteOpenHelper

data class SessionSearchResult(
    val sessionId: String,
    val messageId: String,
    val role: String,
    val content: String,
    val timestamp: Long,
)

/**
 * SQLite-based full-text index over all chat messages across sessions.
 * Uses FTS5 when the device's SQLite supports it, falling back to a regular
 * table with LIKE search otherwise. Singleton — shared across ToolRegistry,
 * Store dispatch hook, and any other callers.
 */
class SessionIndex private constructor(context: Context) :
    SQLiteOpenHelper(context, "arka_session_index.db", null, DATABASE_VERSION) {

    companion object {
        private const val DATABASE_VERSION = 1
        private const val TABLE = "messages"
        private const val MAX_CONTENT_CHARS = 2000

        @Volatile
        private var instance: SessionIndex? = null

        fun getInstance(context: Context): SessionIndex =
            instance ?: synchronized(this) {
                instance ?: SessionIndex(context.applicationContext).also { instance = it }
            }
    }

    private var useFts = false

    override fun onCreate(db: SQLiteDatabase) {
        try {
            db.execSQL(
                "CREATE VIRTUAL TABLE IF NOT EXISTS $TABLE USING fts5(" +
                    "content, session_id UNINDEXED, message_id UNINDEXED, role UNINDEXED, timestamp UNINDEXED)",
            )
            useFts = true
        } catch (e: Exception) {
            db.execSQL(
                "CREATE TABLE IF NOT EXISTS $TABLE (" +
                    "id INTEGER PRIMARY KEY AUTOINCREMENT, " +
                    "content TEXT, session_id TEXT, message_id TEXT, role TEXT, timestamp INTEGER)",
            )
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_session ON $TABLE(session_id)")
            db.execSQL("CREATE INDEX IF NOT EXISTS idx_timestamp ON $TABLE(timestamp)")
            useFts = false
        }
    }

    override fun onUpgrade(db: SQLiteDatabase, oldVersion: Int, newVersion: Int) {
        db.execSQL("DROP TABLE IF EXISTS $TABLE")
        onCreate(db)
    }

    fun indexMessage(sessionId: String, messageId: String, role: String, content: String, timestamp: Long) {
        if (content.isBlank()) return
        val truncated = content.take(MAX_CONTENT_CHARS)
        val values = ContentValues().apply {
            put("content", truncated)
            put("session_id", sessionId)
            put("message_id", messageId)
            put("role", role)
            put("timestamp", timestamp)
        }
        runCatching { writableDatabase.insert(TABLE, null, values) }
    }

    fun search(query: String, limit: Int = 10): List<SessionSearchResult> {
        if (query.isBlank()) return emptyList()
        val results = mutableListOf<SessionSearchResult>()
        runCatching {
            val db = readableDatabase
            if (useFts) {
                val terms = query.split(Regex("\\s+")).filter { it.isNotBlank() }
                    .map { "\"" + it.replace("\"", "\"\"") + "\"" }
                val ftsQuery = terms.joinToString(" OR ")
                db.rawQuery(
                    "SELECT session_id, message_id, role, content, timestamp FROM $TABLE " +
                        "WHERE $TABLE MATCH ? ORDER BY timestamp DESC LIMIT ?",
                    arrayOf(ftsQuery, limit.toString()),
                ).use { cursor -> while (cursor.moveToNext()) results.add(readResult(cursor)) }
            } else {
                db.rawQuery(
                    "SELECT session_id, message_id, role, content, timestamp FROM $TABLE " +
                        "WHERE content LIKE ? ORDER BY timestamp DESC LIMIT ?",
                    arrayOf("%$query%", limit.toString()),
                ).use { cursor -> while (cursor.moveToNext()) results.add(readResult(cursor)) }
            }
        }
        return results
    }

    private fun readResult(cursor: Cursor): SessionSearchResult = SessionSearchResult(
        sessionId = cursor.getString(0),
        messageId = cursor.getString(1),
        role = cursor.getString(2),
        content = cursor.getString(3),
        timestamp = cursor.getLong(4),
    )

    fun deleteSession(sessionId: String) {
        runCatching { writableDatabase.delete(TABLE, "session_id = ?", arrayOf(sessionId)) }
    }

    /** Backfill dari sessions yang sudah ada — hanya sekali saat tabel masih kosong. */
    fun backfill(sessions: List<Session>) {
        val count = runCatching {
            readableDatabase.rawQuery("SELECT COUNT(*) FROM $TABLE", null).use { c ->
                if (c.moveToFirst()) c.getInt(0) else 0
            }
        }.getOrDefault(0)
        if (count > 0) return
        for (session in sessions) {
            for (msg in session.messages) {
                indexMessage(session.id, msg.id, msg.role.name, msg.content, msg.timestamp)
            }
        }
    }
}
