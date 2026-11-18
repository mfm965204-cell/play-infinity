package com.playinfinity.app.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.rememberLazyGridState
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Search
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import com.playinfinity.app.data.AppUiState

@Composable
fun LiveTvScreen(
    state: AppUiState,
    onOpen: (Int) -> Unit,
    onSettings: () -> Unit,
) {
    val channels = state.live
    var category by remember { mutableStateOf("All") }
    var query by remember { mutableStateOf("") }
    var visible by remember { mutableStateOf(45) }

    if (state.loading) {
        SkeletonGrid(rows = 4)
        return
    }

    val categories = listOf("All") + channels
        .mapNotNull { it.genres.getOrNull(1) }
        .filter { it.isNotBlank() }
        .distinct()
        .sorted()
        .take(12)

    val filtered = channels
        .filter { category == "All" || it.genres.any { g -> g.equals(category, true) } }
        .filter { query.isBlank() || it.title.contains(query, ignoreCase = true) }

    val gridState = rememberLazyGridState()

    LaunchedEffect(gridState.layoutInfo.visibleItemsInfo.size, filtered.size, visible) {
        val last = gridState.layoutInfo.visibleItemsInfo.lastOrNull()?.index ?: 0
        if (last >= visible - 12 && visible < filtered.size) {
            visible = (visible + 45).coerceAtMost(filtered.size)
        }
    }

    LaunchedEffect(category, query) {
        visible = 45
        gridState.scrollToItem(0)
    }

    LazyVerticalGrid(
        columns = GridCells.Fixed(3),
        state = gridState,
        contentPadding = PaddingValues(horizontal = 16.dp, vertical = 12.dp),
        horizontalArrangement = Arrangement.spacedBy(12.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
        modifier = Modifier.fillMaxSize(),
    ) {
        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    text = "Live TV",
                    style = MaterialTheme.typography.headlineSmall,
                    fontWeight = FontWeight.Black,
                    modifier = Modifier.weight(1f),
                )
                Text(
                    text = "${filtered.size} channels",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                IconButton(onClick = onSettings) {
                    Icon(Icons.Filled.Settings, contentDescription = "Settings")
                }
            }
        }

        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
            OutlinedTextField(
                value = query,
                onValueChange = { query = it },
                modifier = Modifier.fillMaxWidth(),
                singleLine = true,
                placeholder = { Text("Search channels") },
                leadingIcon = { Icon(Icons.Filled.Search, contentDescription = null) },
            )
        }

        item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
            Column {
                LazyRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(count = categories.size, key = { categories[it] }) { index ->
                        val name = categories[index]
                        GenreChip(label = name, selected = category == name, onClick = { category = name })
                    }
                }
                Spacer(Modifier.height(8.dp))
            }
        }

        items(count = filtered.take(visible).size, key = { filtered[it].id }) { index ->
            val channel = filtered[index]
            ChannelCard(item = channel, onClick = { onOpen(channel.id) })
        }

        if (filtered.isEmpty()) {
            item(span = { androidx.compose.foundation.lazy.grid.GridItemSpan(maxLineSpan) }) {
                Text(
                    text = "No channels match. Import an IPTV provider from the studio console.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(vertical = 20.dp),
                )
            }
        }
    }
}
