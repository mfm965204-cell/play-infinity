package com.playinfinity.app.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.AppUiState
import com.playinfinity.app.data.MediaItem

@Composable
fun MoviesScreen(
    state: AppUiState,
    onOpen: (Int) -> Unit,
    onPlay: (MediaItem) -> Unit,
    onSettings: () -> Unit,
) {
    val movies = state.movies
    val featured = movies.filter { it.featured }.ifEmpty { movies }.take(5)
    val genres = movies.flatMap { it.genres }.distinct().take(8)

    if (state.loading) {
        SkeletonGrid()
        return
    }

    LazyColumn(modifier = Modifier.fillMaxSize()) {
        item(key = "header") {
            Column(modifier = Modifier.padding(start = 16.dp, end = 4.dp, top = 8.dp)) {
                androidx.compose.foundation.layout.Row {
                    Text(
                        text = "Movies",
                        style = MaterialTheme.typography.headlineSmall,
                        fontWeight = FontWeight.Black,
                        modifier = Modifier.weight(1f).padding(top = 6.dp),
                    )
                    IconButton(onClick = onSettings) {
                        Icon(Icons.Filled.Settings, contentDescription = "Settings")
                    }
                }
            }
        }

        item(key = "hero") {
            HeroBanner(items = featured, onPlay = onPlay, onOpen = onOpen)
        }

        genres.forEach { genre ->
            val row = movies.filter { it.genres.contains(genre) }
            item(key = "genre-$genre") {
                RowSection(title = genre, list = row, onOpen = onOpen)
            }
        }

        if (movies.isEmpty()) {
            item(key = "empty") {
                Text(
                    text = "No movies yet — add some from the studio console.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(20.dp),
                )
            }
        }

        item(key = "footer") { androidx.compose.foundation.layout.Spacer(Modifier.padding(bottom = 24.dp)) }
    }
}
