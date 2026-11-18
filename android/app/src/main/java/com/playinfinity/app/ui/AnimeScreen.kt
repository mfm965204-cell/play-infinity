package com.playinfinity.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.AppUiState
import com.playinfinity.app.data.MediaItem

@Composable
fun AnimeScreen(
    state: AppUiState,
    onOpen: (Int) -> Unit,
    onPlay: (MediaItem) -> Unit,
    onSettings: () -> Unit,
) {
    val anime = state.anime
    var genre by remember { mutableStateOf("All") }

    if (state.loading) {
        SkeletonGrid()
        return
    }

    val genres = listOf("All") + anime.flatMap { it.genres }
        .filter { it.lowercase() != "anime" }
        .distinct()
        .take(10)

    val filtered = if (genre == "All") anime else anime.filter { it.genres.any { g -> g.equals(genre, true) } }
    val featured = filtered.filter { it.featured }.ifEmpty { filtered }.take(5)
    val latest = filtered.sortedByDescending { it.id }.take(12)
    val popular = filtered.sortedByDescending { it.rating }.take(12)

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item(key = "header") {
            Row(
                modifier = Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Text(
                    text = "Anime",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.weight(1f).padding(top = 6.dp),
                )
                IconButton(onClick = onSettings) {
                    Icon(Icons.Filled.Settings, contentDescription = "Settings")
                }
            }
        }

        item(key = "chips") {
            LazyRow(
                contentPadding = PaddingValues(horizontal = 16.dp),
                horizontalArrangement = Arrangement.spacedBy(8.dp),
                modifier = Modifier.padding(bottom = 8.dp),
            ) {
                items(count = genres.size, key = { genres[it] }) { index ->
                    val name = genres[index]
                    GenreChip(label = name, selected = genre == name, onClick = { genre = name })
                }
            }
        }

        item(key = "hero") {
            HeroBanner(items = featured, onPlay = onPlay, onOpen = onOpen)
        }

        item(key = "latest") { RowSection(title = "Latest", list = latest, onOpen = onOpen) }
        item(key = "popular") { RowSection(title = "Popular", list = popular, onOpen = onOpen) }

        genres.filter { it != "All" }.forEach { g ->
            val row = filtered.filter { it.genres.any { name -> name.equals(g, true) } }
            item(key = "g-$g") { RowSection(title = g, list = row, onOpen = onOpen) }
        }

        if (anime.isEmpty()) {
            item(key = "empty") {
                Text(
                    text = "No anime yet — add titles with type Anime in the studio console.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(20.dp),
                )
            }
        }

        item(key = "footer") { Spacer(Modifier.height(24.dp)) }
    }
}
