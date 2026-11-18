package com.playinfinity.app.ui

import android.app.DownloadManager
import android.content.Context
import android.net.Uri
import android.os.Environment
import android.widget.Toast
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
import androidx.compose.material.icons.filled.Check
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Favorite
import androidx.compose.material.icons.filled.FavoriteBorder
import androidx.compose.material.icons.filled.Lock
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Share
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
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
    downloadsEnabled: Boolean,
    premiumEnabled: Boolean = false,
    premiumUnlocked: Boolean = true,
    inMyList: Boolean,
    onToggleMyList: () -> Unit,
    onRequireLicense: () -> Unit = {},
    onBack: () -> Unit,
    onPlay: (url: String, format: String, title: String, live: Boolean) -> Unit,
) {
    val context = LocalContext.current
    var detail by remember { mutableStateOf<MediaDetail?>(null) }
    var loading by remember { mutableStateOf(true) }
    var error by remember { mutableStateOf<String?>(null) }
    var openSeason by remember { mutableStateOf(1) }

    LaunchedEffect(mediaId) {
        loading = true
        error = null
        try {
            detail = withContext(Dispatchers.IO) { Api.service.detail(mediaId) }
        } catch (e: Exception) {
            error = e.message ?: "Could not load this title."
        } finally {
            loading = false
        }
    }

    Box(modifier = Modifier.fillMaxSize().background(Ink)) {
        val current = detail
        if (loading) {
            CircularProgressIndicator(color = Brand, modifier = Modifier.align(Alignment.Center))
        } else if (current == null) {
            Column(
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(text = error ?: "Not found", color = MaterialTheme.colorScheme.onSurfaceVariant)
                Spacer(Modifier.height(16.dp))
                Button(onClick = onBack) { Text("Go back") }
            }
        } else {
            LazyColumn(modifier = Modifier.fillMaxSize()) {
                item(key = "backdrop") {
                    Box(modifier = Modifier.fillMaxWidth().height(300.dp)) {
                        PosterImage(
                            url = current.backdropUrl.ifBlank { current.coverUrl },
                            modifier = Modifier.fillMaxSize(),
                            corner = 0.dp,
                        )
                        Box(
                            modifier = Modifier
                                .fillMaxSize()
                                .background(
                                    Brush.verticalGradient(
                                        0.4f to Color.Transparent,
                                        1f to Ink,
                                    ),
                                ),
                        )
                        Row(modifier = Modifier.fillMaxWidth().padding(4.dp)) {
                            IconButton(onClick = onBack) {
                                Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                            }
                            Spacer(Modifier.weight(1f))
                            IconButton(
                                onClick = {
                                    val link = "${Api.BASE_URL}movie/${current.id}"
                                    try {
                                        val clipboard =
                                            context.getSystemService(Context.CLIPBOARD_SERVICE) as android.content.ClipboardManager
                                        clipboard.setPrimaryClip(
                                            android.content.ClipData.newPlainText("Play Infinity", link),
                                        )
                                        Toast.makeText(context, "Link copied", Toast.LENGTH_SHORT).show()
                                    } catch (e: Exception) {
                                        Toast.makeText(context, link, Toast.LENGTH_LONG).show()
                                    }
                                },
                            ) {
                                Icon(Icons.Filled.Share, contentDescription = "Share", tint = Color.White)
                            }
                        }
                    }
                }

                item(key = "head") {
                    Column(modifier = Modifier.padding(horizontal = 20.dp)) {
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

                        val locked = premiumEnabled && !premiumUnlocked && current.category?.isPremium == true

                        Spacer(Modifier.height(16.dp))
                        Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                            val firstEpisode: Episode? = current.episodes.firstOrNull()
                            Button(
                                onClick = {
                                    if (locked) {
                                        onRequireLicense()
                                        return@Button
                                    }
                                    when {
                                        current.type == "series" && firstEpisode != null ->
                                            onPlay(firstEpisode.videoUrl, firstEpisode.format, firstEpisode.title, false)
                                        current.videoUrl.isNotBlank() ->
                                            onPlay(current.videoUrl, current.format, current.title, current.type == "live")
                                    }
                                },
                                enabled = locked || current.videoUrl.isNotBlank() || current.episodes.isNotEmpty(),
                            ) {
                                Icon(
                                    imageVector = if (locked) Icons.Filled.Lock else Icons.Filled.PlayArrow,
                                    contentDescription = null,
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(if (locked) "Unlock" else "Play", fontWeight = FontWeight.SemiBold)
                            }

                            OutlinedButton(onClick = onToggleMyList) {
                                Icon(
                                    imageVector = if (inMyList) Icons.Filled.Check else Icons.Filled.FavoriteBorder,
                                    contentDescription = null,
                                )
                                Spacer(Modifier.width(6.dp))
                                Text(if (inMyList) "Saved" else "My List")
                            }

                            if (downloadsEnabled && current.type != "series") {
                                OutlinedButton(
                                    onClick = { enqueueDownload(context, current) },
                                    enabled = current.videoUrl.isNotBlank(),
                                ) {
                                    Icon(Icons.Filled.Download, contentDescription = null)
                                }
                            }
                        }

                        if (current.description.isNotBlank()) {
                            Spacer(Modifier.height(18.dp))
                            Text(
                                text = current.description,
                                style = MaterialTheme.typography.bodyMedium,
                                color = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                        Spacer(Modifier.height(22.dp))
                    }
                }

                if (current.episodes.isNotEmpty()) {
                    val seasons = current.episodes.map { it.season }.distinct().sorted()
                    items(seasons.size, key = { "season-${seasons[it]}" }) { index ->
                        val season = seasons[index]
                        val expanded = openSeason == season
                        Column(modifier = Modifier.padding(horizontal = 20.dp)) {
                            Row(
                                modifier = Modifier
                                    .fillMaxWidth()
                                    .clickable { openSeason = if (expanded) -1 else season }
                                    .padding(vertical = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = "Season $season",
                                    style = MaterialTheme.typography.titleMedium,
                                    fontWeight = FontWeight.Bold,
                                    modifier = Modifier.weight(1f),
                                )
                                Text(
                                    text = if (expanded) "▲" else "▼",
                                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                                )
                            }
                            if (expanded) {
                                current.episodes
                                    .filter { it.season == season }
                                    .sortedBy { it.episodeNumber }
                                    .forEach { episode ->
                                        EpisodeRow(episode = episode, onPlay = {
                                            onPlay(episode.videoUrl, episode.format, episode.title, false)
                                        })
                                    }
                            }
                            Spacer(Modifier.height(6.dp))
                        }
                    }
                }

                item(key = "footer") { Spacer(Modifier.height(30.dp)) }
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
            .padding(vertical = 10.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Box(
            modifier = Modifier
                .size(40.dp)
                .background(Edge, RoundedCornerShape(10.dp)),
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
        Icon(Icons.Filled.Favorite, contentDescription = null, tint = Color.Transparent)
    }
}

private fun enqueueDownload(context: Context, detail: MediaDetail) {
    try {
        val extension = if (detail.format == "mp4") "mp4" else "m3u8"
        val safeName = detail.title.replace(Regex("[^A-Za-z0-9 _-]"), "").trim().ifBlank { "playinfinity" }
        val request = DownloadManager.Request(Uri.parse(detail.videoUrl))
            .setTitle(detail.title)
            .setDescription("Play Infinity download")
            .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
            .setDestinationInExternalPublicDir(
                Environment.DIRECTORY_DOWNLOADS,
                "$safeName.$extension",
            )
        val manager = context.getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager
        manager.enqueue(request)
        Toast.makeText(context, "Download queued", Toast.LENGTH_SHORT).show()
    } catch (e: Exception) {
        Toast.makeText(context, "Download failed: ${e.message}", Toast.LENGTH_LONG).show()
    }
}
