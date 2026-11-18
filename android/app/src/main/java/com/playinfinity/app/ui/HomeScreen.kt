package com.playinfinity.app.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
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
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.AppUiState
import com.playinfinity.app.data.HomeRow
import com.playinfinity.app.data.MediaItem

@Composable
fun HomeScreen(
    state: AppUiState,
    premiumUnlocked: Boolean,
    onOpen: (id: Int, locked: Boolean) -> Unit,
    onPlay: (MediaItem) -> Unit,
) {
    if (state.loading) {
        SkeletonHome()
        return
    }

    val featured = state.rows.firstOrNull()?.items?.firstOrNull()
    val featuredLocked = state.rows.firstOrNull()?.category?.isPremium == true &&
        state.settings.isPremiumEnabled && !premiumUnlocked

    LazyColumn(
        modifier = Modifier.fillMaxSize().background(Ink),
        contentPadding = PaddingValues(bottom = 28.dp),
    ) {
        if (featured != null) {
            item(key = "hero") {
                HeroBanner(
                    item = featured,
                    locked = featuredLocked,
                    onPlay = { if (featuredLocked) onOpen(featured.id, true) else onPlay(featured) },
                    onInfo = { onOpen(featured.id, featuredLocked) },
                )
            }
        }

        if (state.continueWatching.isNotEmpty()) {
            item(key = "continue") {
                ContinueWatchingRow(
                    items = state.continueWatching,
                    onOpen = { onOpen(it, false) },
                )
            }
        }

        state.rows.forEach { row ->
            item(key = "row-${row.category.id}") {
                val locked = row.category.isPremium && state.settings.isPremiumEnabled && !premiumUnlocked
                CategoryRow(row = row, locked = locked, onOpen = onOpen)
            }
        }

        if (state.rows.isEmpty()) {
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
    }
}

@Composable
private fun CategoryRow(row: HomeRow, locked: Boolean, onOpen: (Int, Boolean) -> Unit) {
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(
                text = row.category.name,
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.Bold,
            )
            if (row.category.isPremium) {
                Spacer(Modifier.width(8.dp))
                Box(
                    modifier = Modifier
                        .clip(RoundedCornerShape(6.dp))
                        .background(Gold)
                        .padding(horizontal = 6.dp, vertical = 1.dp),
                ) {
                    Text(
                        text = "PREMIUM",
                        color = Color.Black,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
        }
        Spacer(Modifier.height(10.dp))
        if (row.category.slug == "live") {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(count = row.items.size, key = { "live-${row.items[it].id}-$it" }) { index ->
                    val item = row.items[index]
                    LiveCard(item = item, onClick = { onOpen(item.id, locked) })
                }
            }
        } else {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 20.dp),
                horizontalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                items(count = row.items.size, key = { "${row.items[it].id}-$it" }) { index ->
                    val item = row.items[index]
                    MediaCard(
                        item = item,
                        locked = locked,
                        onClick = { onOpen(item.id, locked) },
                    )
                }
            }
        }
    }
}

@Composable
private fun ContinueWatchingRow(items: List<MediaItem>, onOpen: (Int) -> Unit) {
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Text(
            text = "Continue watching",
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Spacer(Modifier.height(10.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(count = items.size, key = { "cw-${items[it].id}-$it" }) { index ->
                val item = items[index]
                MediaCard(
                    item = item,
                    progress = (item.progressSeconds / 5400f).coerceIn(0.04f, 0.95f),
                    onClick = { onOpen(item.id) },
                )
            }
        }
    }
}

@Composable
private fun HeroBanner(
    item: MediaItem,
    locked: Boolean,
    onPlay: () -> Unit,
    onInfo: () -> Unit,
) {
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
        Column(modifier = Modifier.align(Alignment.BottomStart).padding(20.dp)) {
            if (item.isLive) {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Box(
                        modifier = Modifier
                            .width(8.dp)
                            .height(8.dp)
                            .background(Brand, RoundedCornerShape(50)),
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
                    Text(if (locked) "Unlock" else "Play", fontWeight = FontWeight.SemiBold)
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
