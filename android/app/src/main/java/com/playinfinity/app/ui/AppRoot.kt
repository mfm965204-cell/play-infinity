package com.playinfinity.app.ui

import android.net.Uri
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import com.playinfinity.app.data.AppViewModel
import com.playinfinity.app.data.MediaItem

private data class Tab(val route: String, val label: String, val icon: ImageVector)

private val tabs = listOf(
    Tab("home", "Home", Icons.Filled.Home),
    Tab("search", "Search", Icons.Filled.Search),
    Tab("mylist", "My List", Icons.Filled.Favorite),
    Tab("settings", "Settings", Icons.Filled.Settings),
)

@Composable
fun AppRoot(viewModel: AppViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val myList by viewModel.myList.collectAsState()
    val navController = rememberNavController()

    when {
        state.loading -> LoadingScreen()

        state.settings.isMaintenance -> BlockingScreen(
            title = "We'll be back soon",
            message = state.settings.maintenanceMessage.ifBlank {
                "Play Infinity is down for maintenance."
            },
            actionLabel = "Try again",
            onAction = { viewModel.load() },
        )

        state.settings.isUpdateRequired -> BlockingScreen(
            title = "Update required",
            message = state.settings.updateMessage.ifBlank {
                "A newer version of Play Infinity is available."
            },
            actionLabel = "Check again",
            onAction = { viewModel.load() },
        )

        state.error != null && state.media.isEmpty() -> BlockingScreen(
            title = "Can't reach Play Infinity",
            message = state.error ?: "Check your connection and try again.",
            actionLabel = "Retry",
            onAction = { viewModel.load() },
        )

        else -> {
            val backStackEntry by navController.currentBackStackEntryAsState()
            val route = backStackEntry?.destination?.route ?: "home"
            val showBar = tabs.any { it.route == route }

            Scaffold(
                bottomBar = {
                    if (showBar) {
                        BottomBar(current = route, navController = navController)
                    }
                },
                containerColor = Ink,
            ) { padding ->
                NavHost(
                    navController = navController,
                    startDestination = "home",
                    modifier = Modifier.padding(padding),
                ) {
                    composable("home") {
                        HomeScreen(
                            state = state,
                            onOpen = { id -> navController.navigate("detail/$id") },
                            onPlay = { item ->
                                if (item.isSeries) {
                                    navController.navigate("detail/${item.id}")
                                } else {
                                    navController.navigate(playerRoute(item))
                                }
                            },
                        )
                    }

                    composable("search") {
                        SearchScreen(
                            state = state,
                            onQuery = viewModel::search,
                            onOpen = { id -> navController.navigate("detail/$id") },
                        )
                    }

                    composable("mylist") {
                        MyListScreen(
                            state = state,
                            myList = myList,
                            onOpen = { id -> navController.navigate("detail/$id") },
                        )
                    }

                    composable("settings") {
                        SettingsScreen(
                            settings = state.settings,
                            onRefresh = { viewModel.load() },
                        )
                    }

                    composable(
                        route = "detail/{id}",
                        arguments = listOf(navArgument("id") { type = NavType.IntType }),
                    ) { entry ->
                        val id = entry.arguments?.getInt("id") ?: 0
                        DetailScreen(
                            mediaId = id,
                            downloadsEnabled = state.settings.isDownloadsEnabled,
                            inMyList = myList.contains(id),
                            onToggleMyList = { viewModel.toggleMyList(id) },
                            onBack = { navController.popBackStack() },
                            onPlay = { url, format, title, live ->
                                navController.navigate(
                                    "player?url=${Uri.encode(url)}&format=$format" +
                                        "&title=${Uri.encode(title)}&live=$live",
                                )
                            },
                        )
                    }

                    composable(
                        route = "player?url={url}&format={format}&title={title}&live={live}",
                        arguments = listOf(
                            navArgument("url") { type = NavType.StringType; defaultValue = "" },
                            navArgument("format") { type = NavType.StringType; defaultValue = "mp4" },
                            navArgument("title") { type = NavType.StringType; defaultValue = "" },
                            navArgument("live") { type = NavType.BoolType; defaultValue = false },
                        ),
                    ) { entry ->
                        PlayerScreen(
                            url = entry.arguments?.getString("url") ?: "",
                            format = entry.arguments?.getString("format") ?: "mp4",
                            title = entry.arguments?.getString("title") ?: "",
                            live = entry.arguments?.getBoolean("live") ?: false,
                            onBack = { navController.popBackStack() },
                        )
                    }
                }
            }
        }
    }
}

private fun playerRoute(item: MediaItem): String =
    "player?url=${Uri.encode(item.videoUrl)}&format=${item.format}" +
        "&title=${Uri.encode(item.title)}&live=${item.isLive}"

@Composable
private fun BottomBar(current: String, navController: NavHostController) {
    NavigationBar(containerColor = Panel) {
        tabs.forEach { tab ->
            NavigationBarItem(
                selected = current == tab.route,
                onClick = {
                    if (current != tab.route) {
                        navController.navigate(tab.route) {
                            popUpTo("home") { saveState = true }
                            launchSingleTop = true
                            restoreState = true
                        }
                    }
                },
                icon = { Icon(tab.icon, contentDescription = tab.label) },
                label = { Text(tab.label) },
            )
        }
    }
}

@Composable
private fun LoadingScreen() {
    Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
        CircularProgressIndicator(color = Brand)
    }
}

@Composable
private fun BlockingScreen(
    title: String,
    message: String,
    actionLabel: String,
    onAction: () -> Unit,
) {
    Box(modifier = Modifier.fillMaxSize().padding(28.dp), contentAlignment = Alignment.Center) {
        Column(
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Text(
                text = "▶",
                style = MaterialTheme.typography.displaySmall,
                color = Brand,
                fontWeight = FontWeight.Black,
            )
            Spacer(Modifier.height(18.dp))
            Text(
                text = title,
                style = MaterialTheme.typography.headlineSmall,
                fontWeight = FontWeight.Bold,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(10.dp))
            Text(
                text = message,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}
