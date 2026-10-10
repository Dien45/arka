package com.arka.app.ui

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.Chat
import androidx.compose.material.icons.filled.Description
import androidx.compose.material.icons.filled.Extension
import androidx.compose.material.icons.filled.Folder
import androidx.compose.material.icons.filled.Menu
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Terminal
import androidx.compose.material3.DrawerValue
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalDrawerSheet
import androidx.compose.material3.ModalNavigationDrawer
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.rememberDrawerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import com.arka.app.core.Action
import com.arka.app.core.AppView
import com.arka.app.core.ChatController
import com.arka.app.core.MemoryManager
import com.arka.app.core.Persistence
import com.arka.app.core.SkillsManager
import com.arka.app.core.Store
import com.arka.app.ui.theme.ArkaTheme
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * Composition root (M10).
 *
 * Navigasi: drawer = menu sesi (pindah / rename / hapus / baru) + bottom bar
 * untuk 6 tujuan utama (termasuk PRD Generator). ChatController & Store dibuat
 * di sini supaya pekerjaan AI yang sedang berjalan tidak terbuang saat pindah
 * layar.
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
    val skillsManager = remember { SkillsManager(context) }

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

    val drawerState = rememberDrawerState(DrawerValue.Closed)
    val uiScope = rememberCoroutineScope()
    val openDrawer: () -> Unit = { uiScope.launch { drawerState.open() } }

    val primaryViews = listOf(
        Triple(AppView.chat, "Chat", Icons.AutoMirrored.Filled.Chat),
        Triple(AppView.files, "Files", Icons.Default.Folder),
        Triple(AppView.prd, "PRD", Icons.Default.Description),
        Triple(AppView.github, "GitHub", Icons.Default.Terminal),
        Triple(AppView.skills, "Skills", Icons.Default.Extension),
        Triple(AppView.settings, "Setelan", Icons.Default.Settings),
    )
    CompositionLocalProvider(LocalDensity provides scaledDensity) {
        ArkaTheme(darkTheme = darkTheme) {
            ModalNavigationDrawer(
                drawerState = drawerState,
                drawerContent = {
                    ModalDrawerSheet {
                        Column(Modifier.padding(16.dp)) {
                            Row(verticalAlignment = Alignment.CenterVertically) {
                                Text("🤖", style = MaterialTheme.typography.headlineSmall)
                                Spacer(Modifier.width(8.dp))
                                Column {
                                    Text("Arka", style = MaterialTheme.typography.titleMedium, fontWeight = FontWeight.Bold)
                                    Text(
                                        "AI Coding Agent · Android",
                                        style = MaterialTheme.typography.labelSmall,
                                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                                    )
                                }
                            }
                        }
                        HorizontalDivider()
                        Spacer(Modifier.height(8.dp))
                        SessionMenu(
                            store = store,
                            language = prefs.language,
                            defaultModel = prefs.selectedModel,
                            onSessionSelected = {
                                store.dispatch(Action.SetView(AppView.chat))
                                uiScope.launch { drawerState.close() }
                            },
                        )
                        Spacer(Modifier.height(8.dp))
                        HorizontalDivider()
                        Text(
                            "run_command: Alpine (proot)",
                            style = MaterialTheme.typography.labelSmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            modifier = Modifier.padding(16.dp),
                        )
                    }
                },
            ) {
                Scaffold(
                    bottomBar = {
                        NavigationBar {
                            primaryViews.forEach { (view, label, icon) ->
                                NavigationBarItem(
                                    selected = state.currentView == view,
                                    onClick = { store.dispatch(Action.SetView(view)) },
                                    icon = { Icon(icon, contentDescription = label) },
                                    label = { Text(label, style = MaterialTheme.typography.labelSmall) },
                                )
                            }
                        }
                    },
                ) { padding ->
                    Box(Modifier.fillMaxSize().padding(padding)) {
                        when (state.currentView) {
                            AppView.chat -> ChatScreen(
                                store = store,
                                controller = controller,
                                onOpenDrawer = openDrawer,
                            )
                            AppView.files -> FileExplorerScreen(store = store, onOpenDrawer = openDrawer)
                            AppView.prd -> PrdScreen(store = store, onOpenDrawer = openDrawer)
                            AppView.skills -> SkillStoreScreen(store = store, onOpenDrawer = openDrawer)
                            AppView.github -> GitHubScreen(store = store, onOpenDrawer = openDrawer)
                            AppView.settings -> SettingsScreen(
                                store = store,
                                memory = memoryManager,
                                skills = skillsManager,
                                onOpenDrawer = openDrawer,
                            )
                        }
                    }
                }
            }
        }
    }
}
