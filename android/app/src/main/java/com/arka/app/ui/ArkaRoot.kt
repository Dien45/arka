package com.arka.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import com.arka.app.core.AppView
import com.arka.app.core.ChatController
import com.arka.app.core.MemoryManager
import com.arka.app.core.Persistence
import com.arka.app.core.Store
import com.arka.app.core.Action
import com.arka.app.ui.theme.ArkaTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Composition root (M4). Creates Persistence + Store (+ loading), the
 * ChatController wiring store to AiClient/Tools/Memory, and the shared
 * MemoryManager used by both Settings (memory browser) and the chat loop.
 *
 * Theme + font size are read from prefs: "light"/"dark"/"auto" and
 * "small"/"medium"/"large", applied via ArkaTheme + a scaled Density.
 * Bottom navigation exposes the two MVP screens: Chat and Settings.
 */
@Composable
fun ArkaRoot() {
    val context = androidx.compose.ui.platform.LocalContext.current.applicationContext
    val appScope = remember { CoroutineScope(SupervisorJob() + Dispatchers.IO) }

    val store = remember {
        Store(context, Persistence(context), appScope).also { s ->
            appScope.launch { s.init() }
        }
    }
    val prefs by store.prefs.collectAsState()
    val state by store.state.collectAsState()

    val controller = remember(store) {
        ChatController(context, store, CoroutineScope(SupervisorJob() + Dispatchers.IO))
    }
    val memoryManager = remember { MemoryManager(context) }

    val darkTheme = when (prefs.theme) {
        "dark" -> true
        "light" -> false
        else -> isSystemInDarkTheme()
    }
    val fontScale = when (prefs.fontSize) {
        "small" -> 0.9f
        "large" -> 1.15f
        else -> 1f
    }
    val density = LocalDensity.current
    val scaledDensity = Density(density.density, density.fontScale * fontScale)

    CompositionLocalProvider(LocalDensity provides scaledDensity) {
        ArkaTheme(darkTheme = darkTheme) {
            Scaffold(
                bottomBar = {
                    NavigationBar {
                        NavigationBarItem(
                            selected = state.currentView == AppView.chat,
                            onClick = { store.dispatch(Action.SetView(AppView.chat)) },
                            icon = { Icon(Icons.AutoMirrored.Filled.Chat, contentDescription = "Chat") },
                            label = { Text("Chat") },
                        )
                        NavigationBarItem(
                            selected = state.currentView == AppView.settings,
                            onClick = { store.dispatch(Action.SetView(AppView.settings)) },
                            icon = { Icon(Icons.Default.Settings, contentDescription = "Settings") },
                            label = { Text("Settings") },
                        )
                    }
                },
            ) { padding ->
                val contentModifier = Modifier.padding(padding)
                when (state.currentView) {
                    AppView.chat -> ChatScreen(store, controller, contentModifier)
                    AppView.settings -> SettingsScreen(store, memoryManager, contentModifier)
                    else -> ChatScreen(store, controller, contentModifier)
                }
            }
        }
    }
}