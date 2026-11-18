package com.playinfinity.app.ui

import androidx.compose.animation.core.LinearEasing
import androidx.compose.animation.core.RepeatMode
import androidx.compose.animation.core.animateFloat
import androidx.compose.animation.core.infiniteRepeatable
import androidx.compose.animation.core.rememberInfiniteTransition
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import coil.compose.AsyncImage
import com.playinfinity.app.data.MediaItem

@Composable
fun PosterImage(url: String, modifier: Modifier = Modifier, corner: Dp = 14.dp) {
    Box(modifier = modifier.clip(RoundedCornerShape(corner)).background(Edge)) {
        if (url.isNotBlank()) {
            AsyncImage(
                model = url,
                contentDescription = null,
                contentScale = ContentScale.Crop,
                modifier = Modifier.fillMaxSize(),
            )
        }
    }
}

/** Shimmering placeholder used while the catalogue loads. */
@Composable
fun ShimmerBox(modifier: Modifier = Modifier, corner: Dp = 14.dp) {
    val transition = rememberInfiniteTransition(label = "shimmer")
    val shift by transition.animateFloat(
        initialValue = -400f,
        targetValue = 900f,
        animationSpec = infiniteRepeatable(
            animation = tween(durationMillis = 1300, easing = LinearEasing),
            repeatMode = RepeatMode.Restart,
        ),
        label = "shift",
    )
    Box(
        modifier = modifier
            .clip(RoundedCornerShape(corner))
            .background(
                Brush.linearGradient(
                    colors = listOf(Color(0xFF15151D), Color(0xFF262633), Color(0xFF15151D)),
                    start = Offset(shift, 0f),
                    end = Offset(shift + 300f, 300f),
                ),
            ),
    )
}

@Composable
fun SkeletonRow(cardWidth: Dp = 132.dp) {
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Box(modifier = Modifier.padding(horizontal = 20.dp)) {
            ShimmerBox(modifier = Modifier.width(120.dp).height(16.dp), corner = 6.dp)
        }
        Spacer(Modifier.height(12.dp))
        Row(
            modifier = Modifier.fillMaxWidth().padding(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            repeat(4) {
                Column {
                    ShimmerBox(modifier = Modifier.width(cardWidth).height(cardWidth * 1.5f))
                    Spacer(Modifier.height(6.dp))
                    ShimmerBox(modifier = Modifier.width(cardWidth * 0.7f).height(10.dp), corner = 4.dp)
                }
            }
        }
    }
}

@Composable
fun SkeletonHome() {
    Column(modifier = Modifier.fillMaxSize()) {
        ShimmerBox(modifier = Modifier.fillMaxWidth().height(320.dp), corner = 0.dp)
        SkeletonRow()
        SkeletonRow()
    }
}

@Composable
fun MediaCard(
    item: MediaItem,
    onClick: () -> Unit,
    width: Dp = 132.dp,
    locked: Boolean = false,
    progress: Float = 0f,
) {
    Column(modifier = Modifier.width(width).clickable { onClick() }) {
        Box {
            PosterImage(
                url = item.coverUrl.ifBlank { item.backdropUrl },
                modifier = Modifier.fillMaxWidth().height(width * 1.5f),
            )
            if (locked) {
                Box(
                    modifier = Modifier
                        .align(Alignment.TopEnd)
                        .padding(6.dp)
                        .clip(RoundedCornerShape(6.dp))
                        .background(Gold)
                        .padding(horizontal = 5.dp, vertical = 1.dp),
                ) {
                    Text(
                        text = "PREMIUM",
                        color = Color.Black,
                        style = MaterialTheme.typography.labelSmall,
                        fontWeight = FontWeight.Bold,
                    )
                }
            }
            if (progress > 0f) {
                Box(
                    modifier = Modifier
                        .align(Alignment.BottomCenter)
                        .fillMaxWidth()
                        .height(3.dp)
                        .background(Color.White.copy(alpha = 0.25f)),
                ) {
                    Box(
                        modifier = Modifier
                            .fillMaxWidth(progress.coerceIn(0f, 1f))
                            .height(3.dp)
                            .background(Brand),
                    )
                }
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = item.title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFFE4E4E7),
        )
    }
}

@Composable
fun LiveCard(item: MediaItem, onClick: () -> Unit) {
    Column(modifier = Modifier.width(168.dp).clickable { onClick() }) {
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(96.dp)
                .clip(RoundedCornerShape(12.dp))
                .background(Color(0xFF141420)),
            contentAlignment = Alignment.Center,
        ) {
            if (item.coverUrl.isNotBlank()) {
                AsyncImage(
                    model = item.coverUrl,
                    contentDescription = null,
                    contentScale = ContentScale.Fit,
                    modifier = Modifier.fillMaxSize().padding(10.dp),
                )
            } else {
                Text(text = item.title.take(2), color = Color(0xFFA1A1AA))
            }
            Box(
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .padding(6.dp)
                    .clip(RoundedCornerShape(6.dp))
                    .background(Brand)
                    .padding(horizontal = 5.dp, vertical = 1.dp),
            ) {
                Text(
                    text = "LIVE",
                    color = Color.White,
                    style = MaterialTheme.typography.labelSmall,
                    fontWeight = FontWeight.Bold,
                )
            }
        }
        Spacer(Modifier.height(6.dp))
        Text(
            text = item.title,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            style = MaterialTheme.typography.bodySmall,
            color = Color(0xFFE4E4E7),
        )
    }
}

@Composable
fun RowSection(title: String, list: List<MediaItem>, onOpen: (Int) -> Unit) {
    if (list.isEmpty()) return
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Spacer(Modifier.height(10.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(count = list.size, key = { index -> "${list[index].id}-$index" }) { index ->
                val item = list[index]
                MediaCard(item = item, onClick = { onOpen(item.id) })
            }
        }
    }
}

@Composable
fun LiveRowSection(title: String, list: List<MediaItem>, onOpen: (Int) -> Unit) {
    if (list.isEmpty()) return
    Column(modifier = Modifier.padding(top = 20.dp)) {
        Text(
            text = title,
            style = MaterialTheme.typography.titleMedium,
            fontWeight = FontWeight.Bold,
            modifier = Modifier.padding(horizontal = 20.dp),
        )
        Spacer(Modifier.height(10.dp))
        LazyRow(
            contentPadding = PaddingValues(horizontal = 20.dp),
            horizontalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            items(count = list.size, key = { index -> "live-${list[index].id}-$index" }) { index ->
                val item = list[index]
                LiveCard(item = item, onClick = { onOpen(item.id) })
            }
        }
    }
}

@Composable
fun SectionTitle(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        style = MaterialTheme.typography.titleMedium,
        fontWeight = FontWeight.Bold,
        modifier = modifier,
    )
}
