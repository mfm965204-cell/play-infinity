package com.playinfinity.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.Api
import com.playinfinity.app.data.Episode
import com.playinfinity.app.data.MediaDetail
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext

@Composable
fun DetailScreen(
    mediaId: Int,
    deviceId: String,
    onBack: () -> Unit,
    onPlay: (url: String, format: String, title: String, live: Boolean) -> Unit,
) {
    val context = LocalContext.current
    var detail by remember { mutableStateOf<MediaDetail?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var expanded by remember { mutableStateOf(false) }
    var season by remember { mutableStateOf(1) }
    var seasonMenu by remember { mutableStateOf(false) }

    LaunchedEffect(mediaId) {
        loading = true
        error = null
        try {
            detail = withContext(Dispatchers.IO) { Api.service.detail(deviceId, mediaId) }
            detail?.episodes?.firstOrNull()?.let { season = it.season }
        } catch (e: Exception) {
            error = e.message ?: "Could not load this title."
        } finally {
            loading = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Ink)) {
        val current = detail
        when {
            loading -> CircularProgressIndicator(color = Brand, modifier = Modifier.align(Alignment.Center))

            current == null -> Column(
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(text = error ?: "Not found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(14.dp))
                Button(onClick = onBack) { Text("Go back") }
            }

            else -> LazyColumn(modifier = Modifier.fillMaxSize()) {
                item(key = "backdrop") {
                    Box(modifier = Modifier.fillMaxWidth().height(280.dp)) {
                        PosterImage(
                            url = current.backdropUrl.ifBlank { current.coverUrl },
                            modifier = Modifier.fillMaxSize(),
                            corner = 0.dp,
                        )
                        Box(
                            modifier = Modifier.fillMaxSize().background(
                                Brush.verticalGradient(0.4f to Color.Transparent, 1f to Ink),
                            ),
                        )
                        Row(modifier = Modifier.fillMaxWidth().padding(4.dp)) {
                            IconButton(onClick = onBack) {
                                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                            }
                            Spacer(Modifier.weight(1f))
                            IconButton(onClick = {
                                copyShareLink(context, current.id)
                            }) {
                                Icon(Icons.Filled.Share, contentDescription = "Share", tint = Color.White)
                            }
                        }
                    }
                }

                item(key = "head") {
                    Column(modifier = Modifier.padding(horizontal = 18.dp)) {
                        Text(
                            text = current.title,
                            style = MaterialTheme.typography.headlineSmall,
                            fontWeight = FontWeight.Black,
                        )
                        Spacer(Modifier.height(6.dp))
                        val meta = buildList {
                            if (current.releaseYear > 0) add(current.releaseYear.toString())
                            if (current.rating > 0) add("★ %.1f".format(current.rating))
                            addAll(current.genres)
                        }.joinToString(" · ")
                        if (meta.isNotBlank()) {
                            Text(
                                text = meta,
                                style = MaterialTheme.typography.bodySmall,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }

                        Spacer(Modifier.height(14.dp))
                        val firstEpisode = current.episodes.firstOrNull()
                        Button(
                            onClick = {
                                when {
                                    current.type == "anime" && firstEpisode != null ->
                                        onPlay(firstEpisode.videoUrl, firstEpisode.format, firstEpisode.title, false)
                                    current.videoUrl.isNotBlank() ->
                                        onPlay(current.videoUrl, current.format, current.title, current.type == "live")
                                }
                            },
                            enabled = current.videoUrl.isNotBlank() || current.episodes.isNotEmpty(),
                        ) {
                            Icon(Icons.Filled.PlayArrow, contentDescription = null)
                            Spacer(Modifier.width(6.dp))
                            Text(if (current.type == "anime") "Play EP 1" else "Play", fontWeight = FontWeight.SemiBold)
                        }

                        if (current.description.isNotBlank()) {
                            Spacer(Modifier.height(16.dp))
                            Text(
                                text = current.description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                                maxLines = if (expanded) 40 else 3,
                                overflow = TextOverflow.Ellipsis,
                            )
                            TextButton(onClick = { expanded = !expanded }) {
                                Text(if (expanded) "Show less" else "More")
                            }
                        }
                        Spacer(Modifier.height(10.dp))
                    }
                }

                if (current.episodes.isNotEmpty()) {
                    val seasons = current.episodes.map { it.season }.distinct().sorted()
                    item(key = "season-picker") {
                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 18.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Text(
                                text = "Episodes",
                                style = MaterialTheme.typography.titleMedium,
                                fontWeight = FontWeight.Bold,
                                modifier = Modifier.weight(1f),
                            )
                            Box {
                                TextButton(onClick = { seasonMenu = true }) {
                                    Text("Season $season ▾")
                                }
                                DropdownMenu(expanded = seasonMenu, onDismissRequest = { seasonMenu = false }) {
                                    seasons.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text("Season $option") },
                                            onClick = {
                                                season = option
                                                seasonMenu = false
                                            },
                                        )
                                    }
                                }
                            }
                        }
                    }

                    items(
                        count = current.episodes.count { it.season == season },
                        key = { index ->
                            current.episodes.filter { it.season == season }.sortedBy { it.episodeNumber }[index].id
                        },
                    ) { index ->
                        val episode = current.episodes
                            .filter { it.season == season }
                            .sortedBy { it.episodeNumber }[index]
                        EpisodeRow(episode = episode) {
                            onPlay(episode.videoUrl, episode.format, episode.title, false)
                        }
                    }
                }

                item(key = "footer") { Spacer(Modifier.height(28.dp)) }
            }
        }
    }
}

@Composable
private fun EpisodeRow(episode: Episode, onPlay: () -> Unit) {
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable { onPlay() }
            .padding(horizontal = 18.dp, vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier.size(42.dp).background(Edge, RoundedCornerShape(10.dp)),
            contentAlignment = Alignment.Center,
        ) {
            Icon(Icons.Filled.PlayArrow, contentDescription = null, tint = Color.White)
        }
        Spacer(Modifier.width(12.dp))
        Column(modifier = Modifier.weight(1f)) {
            Text(
                text = "${episode.label} · ${episode.title}",
                style = MaterialTheme.typography.bodyMedium,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            Text(
                text = episode.format.uppercase(),
                style = MaterialTheme.typography.labelSmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

private fun copyShareLink(context: android.content.Context, id: Int) {
    val link = "${Api.BASE_URL}movie/$id"
    try {
        val clipboard = context.getSystemService(android.content.Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
        clipboard.setPrimaryClip(android.content.ClipData.newPlainText("Play Infinity", link))
        android.widget.Toast.makeText(context, "Link copied", android.widget.Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        android.widget.Toast.makeText(context, link, android.widget.Toast.LENGTH_LONG).show()
    }
}
