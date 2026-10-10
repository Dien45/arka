package com.arka.app.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Delete
import androidx.compose.material.icons.filled.Edit
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.arka.app.core.Action
import com.arka.app.core.ArkaLanguage
import com.arka.app.core.I18n
import com.arka.app.core.Key
import com.arka.app.core.MessageRole
import com.arka.app.core.Session
import com.arka.app.core.Store

/**
 * Menu sesi untuk sidebar (drawer): daftar sesi, pindah sesi, ganti nama,
 * hapus, dan buat sesi baru. Dipakai oleh [ArkaRoot] sebagai isi drawer.
 */
@Composable
fun SessionMenu(
    store: Store,
    language: ArkaLanguage,
    defaultModel: String,
    modifier: Modifier = Modifier,
    onSessionSelected: () -> Unit = {},
) {
    val state by store.state.collectAsState()
    val t = { k: String -> I18n.t(language, k) }

    var renameTarget by remember { mutableStateOf<Session?>(null) }
    var renameText by remember { mutableStateOf("") }
    var deleteTarget by remember { mutableStateOf<Session?>(null) }

    fun newSession() {
        store.dispatch(
            Action.AddSession(
                Session(
                    id = "sess_${System.currentTimeMillis()}",
                    title = "Sesi Baru",
                    createdAt = System.currentTimeMillis(),
                    model = defaultModel,
                ),
            ),
        )
        onSessionSelected()
    }

    Column(modifier.fillMaxWidth()) {
        Row(
            Modifier
                .fillMaxWidth()
                .padding(horizontal = 16.dp, vertical = 8.dp),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                t(Key.SESSIONS),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            TextButton(onClick = { newSession() }) {
                Icon(Icons.Default.Add, contentDescription = null, modifier = Modifier.size(18.dp))
                Spacer(Modifier.width(4.dp))
                Text(t(Key.NEW_SESSION))
            }
        }
        if (state.sessions.isEmpty()) {
            Text(
                t(Key.NO_SESSIONS),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                modifier = Modifier.padding(horizontal = 16.dp, vertical = 8.dp),
            )
        } else {
            LazyColumn(Modifier.fillMaxWidth().heightIn(max = 440.dp)) {
                items(state.sessions, key = { it.id }) { session ->
                    val isCurrent = session.id == state.currentSessionId
                    Row(
                        Modifier
                            .fillMaxWidth()
                            .clickable {
                                store.dispatch(Action.SetSession(session.id))
                                onSessionSelected()
                            }
                            .padding(horizontal = 16.dp, vertical = 6.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(
                            session.title,
                            style = MaterialTheme.typography.bodyMedium,
                            fontWeight = if (isCurrent) FontWeight.Bold else FontWeight.Normal,
                            color = if (isCurrent) {
                                MaterialTheme.colorScheme.primary
                            } else {
                                MaterialTheme.colorScheme.onSurface
                            },
                            maxLines = 1,
                            modifier = Modifier.weight(1f),
                        )
                        Spacer(Modifier.width(8.dp))
                        Text(
                            "${session.messages.count { it.role != MessageRole.system }} msg",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        IconButton(onClick = {
                            renameTarget = session
                            renameText = session.title
                        }) {
                            Icon(Icons.Default.Edit, contentDescription = "Rename")
                        }
                        IconButton(onClick = { deleteTarget = session }) {
                            Icon(
                                Icons.Default.Delete,
                                contentDescription = "Delete",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                    HorizontalDivider()
                }
            }
        }
    }

    renameTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { renameTarget = null },
            title = { Text("Rename") },
            text = {
                OutlinedTextField(
                    value = renameText,
                    onValueChange = { renameText = it },
                    singleLine = true,
                )
            },
            confirmButton = {
                TextButton(
                    onClick = {
                        val name = renameText.trim()
                        if (name.isNotEmpty()) {
                            store.dispatch(Action.RenameSession(session.id, name))
                        }
                        renameTarget = null
                    },
                ) { Text(t(Key.SAVE)) }
            },
            dismissButton = {
                TextButton(onClick = { renameTarget = null }) { Text(t(Key.CANCEL)) }
            },
        )
    }

    deleteTarget?.let { session ->
        AlertDialog(
            onDismissRequest = { deleteTarget = null },
            title = { Text(t(Key.DELETE)) },
            text = { Text("Hapus sesi \"${session.title}\"? Workspace-nya ikut terhapus.") },
            confirmButton = {
                TextButton(
                    onClick = {
                        store.dispatch(Action.DeleteSession(session.id))
                        deleteTarget = null
                    },
                ) { Text(t(Key.DELETE), color = MaterialTheme.colorScheme.error) }
            },
            dismissButton = {
                TextButton(onClick = { deleteTarget = null }) { Text(t(Key.CANCEL)) }
            },
        )
    }
}
