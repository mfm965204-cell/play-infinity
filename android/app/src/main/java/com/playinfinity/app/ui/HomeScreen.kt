package com.playinfinity.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Info
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.AppUiState
import com.playinfinity.app.data.MediaItem

@Composable
fun HomeScreen(
    state: AppUiState,
    onOpen: (Int) -> Unit,
    onPlay: (MediaItem) -> Unit,
) {
    val featured = state.media.firstOrNull { it.featured } ?: state.media.firstOrNull()

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Ink),
        contentPadding = androidx.compose.foundation.layout.PaddingValues(bottom = 28.dp),
    ) {
        if (featured != null) {
            item(key = "hero") {
                HeroBanner(
                    item = featured,
                    onPlay = { onPlay(featured) },
                    onInfo = { onOpen(featured.id) },
                )
            }
        } else {
            item(key = "empty") {
                Column(
                    modifier = Modifier.fillMaxWidth().padding(28.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Spacer(Modifier.height(60.dp))
                    Text(
                        text = "Nothing published yet",
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                    )
                    Spacer(Modifier.height(8.dp))
                    Text(
                        text = "Add a title from the studio console and it will show up here.",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }

        item(key = "trending") {
            RowSection("Trending now", state.media.take(20), onOpen)
        }
        item(key = "movies") {
            RowSection("Movies", state.media.filter { it.type == "movie" }, onOpen)
        }
        item(key = "series") {
            RowSection("Series", state.media.filter { it.type == "series" }, onOpen)
        }
        if (state.settings.isLiveEnabled) {
            item(key = "live") {
                LiveRowSection("Live TV · India", state.media.filter { it.type == "live" }, onOpen)
            }
        }
    }
}

@Composable
private fun HeroBanner(item: MediaItem, onPlay: () -> Unit, onInfo: () -> Unit) {
    Box(modifier = Modifier.fillMaxWidth().height(430.dp)) {
        PosterImage(
            url = item.backdropUrl.ifBlank { item.coverUrl },
            modifier = Modifier.fillMaxSize(),
            corner = 0.dp,
        )
        Box(
            modifier = Modifier
                .fillMaxSize()
                .background(
                    Brush.verticalGradient(
                        0.45f to Color.Transparent,
                        0.75f to Ink.copy(alpha = 0.75f),
                        1f to Ink,
                    ),
                ),
        )
        Column(
            modifier = Modifier.align(Alignment.BottomStart).padding(20.dp),
        ) {
            if (item.isLive) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .width(8.dp)
                            .height(8.dp)
                            .background(Brand, androidx.compose.foundation.shape.CircleShape),
                    )
                    Spacer(Modifier.width(6.dp))
                    Text(
                        text = "LIVE",
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                        color = Brand,
                    )
                }
                Spacer(Modifier.height(6.dp))
            }
            Text(
                text = item.title,
                style = MaterialTheme.typography.headlineMedium,
                fontWeight = FontWeight.Black,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            if (item.metaLine.isNotBlank()) {
                Spacer(Modifier.height(6.dp))
                Text(
                    text = item.metaLine,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.height(14.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                Button(onClick = onPlay) {
                    Icon(Icons.Filled.PlayArrow, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("Play", fontWeight = FontWeight.SemiBold)
                }
                OutlinedButton(onClick = onInfo) {
                    Icon(Icons.Filled.Info, contentDescription = null)
                    Spacer(Modifier.width(6.dp))
                    Text("More info")
                }
            }
        }
    }
}
