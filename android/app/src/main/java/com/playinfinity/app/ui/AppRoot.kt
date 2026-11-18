package com.playinfinity.app.ui

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.filled.Close
import androidx.compose.material.icons.filled.LiveTv
import androidx.compose.material.icons.filled.Movie
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Star
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
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
    Tab("movies", "Movies", Icons.Filled.Movie),
    Tab("anime", "Anime", Icons.Filled.Star),
    Tab("live", "Live TV", Icons.Filled.LiveTv),
    Tab("search", "Search", Icons.Filled.Search),
    Tab("settings", "Settings", Icons.Filled.Settings),
)

@Composable
fun AppRoot(viewModel: AppViewModel = viewModel()) {
    val state by viewModel.state.collectAsState()
    val navController = rememberNavController()

    val deepLinkId by DeepLink.movieId
    LaunchedEffect(deepLinkId, state.loading) {
        val id = deepLinkId
        if (id != null && !state.loading) {
            navController.navigate("detail/$id")
            DeepLink.movieId.value = null
        }
    }

    when {
        state.loading -> SkeletonGrid(rows = 4)

        state.banned -> BlockingScreen(
            title = "Device blocked",
            message = "This device has been blocked by the administrator. If you think that is a mistake, " +
                "contact support with this device id: ${viewModel.deviceId}",
            actionLabel = "Check again",
            onAction = { viewModel.load() },
        )

        state.settings.isMaintenance -> BlockingScreen(
            title = "We'll be back soon",
            message = state.settings.maintenanceMessage.ifBlank { "Play Infinity is down for maintenance." },
            actionLabel = "Try again",
            onAction = { viewModel.load() },
        )

        state.settings.isUpdateRequired -> BlockingScreen(
            title = "Update required",
            message = state.settings.updateMessage.ifBlank { "A newer version of Play Infinity is available." },
            actionLabel = "Check again",
            onAction = { viewModel.load() },
        )

        state.error != null && state.movies.isEmpty() && state.live.isEmpty() -> BlockingScreen(
            title = "Can't reach Play Infinity",
            message = state.error ?: "Check your connection and try again.",
            actionLabel = "Retry",
            onAction = { viewModel.load() },
        )

        else -> {
            val backStackEntry by navController.currentBackStackEntryAsState()
            val route = backStackEntry?.destination?.route ?: "movies"
            val showBar = tabs.any { it.route == route }

            Scaffold(
                topBar = {
                    val note = state.notification
                    if (note != null && !state.dismissedNotificationIds.contains(note.id)) {
                        BannerCard(
                            title = note.title,
                            body = note.body,
                            onDismiss = { viewModel.dismissNotification(note.id) },
                        )
                    }
                },
                bottomBar = {
                    if (showBar) {
                        GlassBottomBar(current = route, navController = navController)
                    }
                },
                containerColor = Ink,
            ) { padding ->
                NavHost(
                    navController = navController,
                    startDestination = "movies",
                    modifier = Modifier.padding(padding),
                ) {
                    composable("movies") {
                        MoviesScreen(
                            state = state,
                            onOpen = { id -> navController.navigate("detail/$id") },
                            onPlay = { item ->
                                if (item.isAnime) navController.navigate("detail/${item.id}")
                                else navController.navigate(playerRoute(item))
                            },
                            onSettings = { navController.navigate("settings") },
                        )
                    }

                    composable("anime") {
                        AnimeScreen(
                            state = state,
                            onOpen = { id -> navController.navigate("detail/$id") },
                            onPlay = { item -> navController.navigate("detail/${item.id}") },
                            onSettings = { navController.navigate("settings") },
                        )
                    }

                    composable("live") {
                        LiveTvScreen(
                            state = state,
                            onOpen = { id -> navController.navigate("detail/$id") },
                            onSettings = { navController.navigate("settings") },
                        )
                    }

                    composable("search") {
                        SearchScreen(
                            state = state,
                            onSearch = viewModel::search,
                            onOpen = { id -> navController.navigate("detail/$id") },
                            onSettings = { navController.navigate("settings") },
                        )
                    }

                    composable("settings") {
                        SettingsScreen(
                            settings = state.settings,
                            deviceId = viewModel.deviceId,
                            banned = state.banned,
                            lastChecked = state.lastChecked,
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
                            deviceId = viewModel.deviceId,
                            onBack = { navController.popBackStack() },
                            onPlay = { url, format, title, live ->
                                navController.navigate(
                                    "player?id=$id&url=${Uri.encode(url)}&format=$format" +
                                        "&title=${Uri.encode(title)}&live=$live",
                                )
                            },
                        )
                    }

                    composable(
                        route = "player?id={id}&url={url}&format={format}&title={title}&live={live}",
                        arguments = listOf(
                            navArgument("id") { type = NavType.IntType; defaultValue = 0 },
                            navArgument("url") { type = NavType.StringType; defaultValue = "" },
                            navArgument("format") { type = NavType.StringType; defaultValue = "mp4" },
                            navArgument("title") { type = NavType.StringType; defaultValue = "" },
                            navArgument("live") { type = NavType.BoolType; defaultValue = false },
                        ),
                    ) { entry ->
                        val mediaId = entry.arguments?.getInt("id") ?: 0
                        PlayerScreen(
                            mediaId = mediaId,
                            url = entry.arguments?.getString("url") ?: "",
                            format = entry.arguments?.getString("format") ?: "mp4",
                            title = entry.arguments?.getString("title") ?: "",
                            live = entry.arguments?.getBoolean("live") ?: false,
                            onBack = { navController.popBackStack() },
                            onOpenSuggested = { suggestedId -> navController.navigate("detail/$suggestedId") },
                            onPosition = { positionMs -> viewModel.savePosition(mediaId, positionMs) },
                        )
                    }
                }
            }
        }
    }
}

private fun playerRoute(item: MediaItem): String =
    "player?id=${item.id}&url=${Uri.encode(item.videoUrl)}&format=${item.format}" +
        "&title=${Uri.encode(item.title)}&live=${item.isLive}"

@Composable
private fun GlassBottomBar(current: String, navController: NavHostController) {
    NavigationBar(containerColor = Panel.copy(alpha = 0.94f), tonalElevation = 0.dp) {
        tabs.forEach { tab ->
            NavigationBarItem(
                selected = current == tab.route,
                onClick = {
                    if (current != tab.route) {
                        navController.navigate(tab.route) {
                            popUpTo("movies") { saveState = true }
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
            Text(text = "▶", style = MaterialTheme.typography.displaySmall, color = Brand, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(16.dp))
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
            Spacer(Modifier.height(22.dp))
            Button(onClick = onAction) { Text(actionLabel) }
        }
    }
}

@Composable
private fun BannerCard(title: String, body: String, onDismiss: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp)
            .background(Brand.copy(alpha = 0.16f), RoundedCornerShape(14.dp))
            .padding(start = 14.dp, end = 4.dp, top = 10.dp, bottom = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = title,
                style = MaterialTheme.typography.labelLarge,
                fontWeight = FontWeight.Bold,
                color = Color.White,
            )
            if (body.isNotBlank()) {
                Text(
                    text = body,
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFD4D4D8),
                )
            }
        }
        androidx.compose.material3.IconButton(onClick = onDismiss) {
            Icon(
                imageVector = Icons.Filled.Close,
                contentDescription = "Dismiss",
                tint = Color(0xFFA1A1AA),
            )
        }
    }
}
