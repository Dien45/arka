package com.arka.app.ui

import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.platform.LocalContext
import com.arka.app.core.ChatController
import com.arka.app.core.Persistence
import com.arka.app.core.Store
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Composition root (M0/M1 placeholder → M3 live MVP). Instantiates
 * Persistence + Store, loads persisted state, builds the ChatController that
 * wires the store to AiClient/Tools/Memory, and renders the Chat screen.
 */
@Composable
fun ArkaRoot() {
    val context = LocalContext.current.applicationContext
    val appScope = remember { CoroutineScope(SupervisorJob() + Dispatchers.IO) }

    val store = remember {
        Store(context, Persistence(context), appScope).also { s ->
            appScope.launch { s.init() }
        }
    }
    // ChatController runs on its own scope so network/tool work doesn't block
    // the compact store scope above.
    val controller = remember(store) {
        ChatController(context, store, CoroutineScope(SupervisorJob() + Dispatchers.IO))
    }

    ChatScreen(store = store, controller = controller)
}