package com.playinfinity.app.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.content.pm.ActivityInfo
import android.media.AudioManager
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.grid.GridCells
import androidx.compose.foundation.lazy.grid.LazyVerticalGrid
import androidx.compose.foundation.lazy.grid.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.AspectRatio
import androidx.compose.material.icons.filled.Audiotrack
import androidx.compose.material.icons.filled.Fullscreen
import androidx.compose.material.icons.filled.FullscreenExit
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Speed
import androidx.compose.material.icons.filled.Subtitles
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.media3.common.C
import androidx.media3.common.MediaItem as Media3Item
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import com.playinfinity.app.data.Api
import com.playinfinity.app.data.MediaItem
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)

@Composable
fun PlayerScreen(
    mediaId: Int,
    url: String,
    format: String,
    title: String,
    live: Boolean,
    onBack: () -> Unit,
    onOpenSuggested: (Int) -> Unit,
    onProgress: (Int) -> Unit = {},
) {
    val context = LocalContext.current
    val rootView = LocalView.current
    val activity = remember(context) { context.findActivity() }
    val player = remember { ExoPlayer.Builder(context).build() }
    val audioManager = remember { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }

    var fullscreen by remember { mutableStateOf(false) }
    var isPlaying by remember { mutableStateOf(false) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    var buffered by remember { mutableLongStateOf(0L) }
    var speed by remember { mutableFloatStateOf(1f) }
    var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var controlsVisible by remember { mutableStateOf(true) }
    var showSpeedMenu by remember { mutableStateOf(false) }
    var showTrackMenu by remember { mutableStateOf(false) }
    var audioOptions by remember { mutableStateOf<List<Pair<String, TrackGroup>>>(emptyList()) }
    var subtitlesOff by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var brightness by remember { mutableFloatStateOf(1f) }
    var suggestions by remember { mutableStateOf<List<MediaItem>>(emptyList()) }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onPlayerError(error: PlaybackException) {
                errorMessage = error.errorCodeName
            }
        }
        player.addListener(listener)
        onDispose {
            player.removeListener(listener)
            player.release()
        }
    }

    DisposableEffect(fullscreen) {
        val window = activity?.window
        activity?.requestedOrientation = if (fullscreen) {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        } else {
            ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED
        }
        if (window != null) {
            val controller = WindowCompat.getInsetsController(window, rootView)
            if (fullscreen) {
                controller.systemBarsBehavior =
                    WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
                controller.hide(WindowInsetsCompat.Type.systemBars())
            } else {
                controller.show(WindowInsetsCompat.Type.systemBars())
            }
        }
        onDispose {
            if (window != null) {
                WindowCompat.getInsetsController(window, rootView)
                    .show(WindowInsetsCompat.Type.systemBars())
            }
        }
    }

    LaunchedEffect(url) {
        if (url.isBlank()) {
            errorMessage = "No stream URL for this title."
            return@LaunchedEffect
        }
        try {
            player.setMediaItem(Media3Item.fromUri(url))
            player.prepare()
            player.playWhenReady = true
        } catch (e: Exception) {
            errorMessage = e.message ?: "This stream could not be opened."
        }
    }

    LaunchedEffect(mediaId) {
        try {
            val types = if (live) listOf("live") else listOf("movie", "series")
            val all = withContext(Dispatchers.IO) {
                types.flatMap { type -> Api.service.media(type = type, limit = 12).items }
            }
            suggestions = all.filter { it.id != mediaId }.take(18)
        } catch (_: Exception) {
            suggestions = emptyList()
        }
    }

    LaunchedEffect(player) {
        while (true) {
            isPlaying = player.isPlaying
            position = player.currentPosition.coerceAtLeast(0L)
            duration = player.duration.coerceAtLeast(0L)
            buffered = player.bufferedPosition.coerceAtLeast(0L)
            audioOptions = player.currentTracks.groups
                .filter { it.type == C.TRACK_TYPE_AUDIO }
                .mapIndexed { index, group ->
                    val fmt = group.getTrackFormat(0)
                    val label = fmt.label ?: fmt.language ?: "Audio ${index + 1}"
                    label to group.mediaTrackGroup
                }
            delay(500)
        }
    }

    LaunchedEffect(mediaId, url) {
        if (mediaId <= 0 || url.isBlank()) return@LaunchedEffect
        while (true) {
            delay(5000)
            val seconds = (player.currentPosition / 1000).toInt()
            if (seconds > 5 && player.isPlaying) onProgress(seconds)
        }
    }

    LaunchedEffect(controlsVisible, isPlaying) {
        if (controlsVisible && isPlaying) {
            delay(3500)
            controlsVisible = false
        }
    }

    val videoModifier = if (fullscreen) {
        Modifier.fillMaxSize()
    } else {
        Modifier.fillMaxWidth().aspectRatio(16f / 9f)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(Ink)
            .then(if (fullscreen) Modifier else Modifier.statusBarsPadding()),
    ) {
        Box(modifier = videoModifier.background(Color.Black)) {
            AndroidView(
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        useController = false
                        this.player = player
                        resizeMode = AspectRatioFrameLayout.RESIZE_MODE_FIT
                    }
                },
                update = { view ->
                    view.player = player
                    view.resizeMode = resizeMode
                },
                modifier = Modifier.fillMaxSize(),
            )

            Box(
                modifier = Modifier
                    .fillMaxSize()
                    .pointerInput(Unit) {
                        detectTapGestures(
                            onTap = { controlsVisible = !controlsVisible },
                            onDoubleTap = { offset ->
                                val width = size.width.toFloat()
                                when {
                                    offset.x < width / 3f ->
                                        player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0L))
                                    offset.x > width * 2f / 3f ->
                                        player.seekTo((player.currentPosition + 10_000).coerceAtMost(duration.coerceAtLeast(0L)))
                                    else -> if (player.isPlaying) player.pause() else player.play()
                                }
                            },
                        )
                    }
                    .pointerInput(Unit) {
                        detectVerticalDragGestures { change, dragAmount ->
                            change.consume()
                            val left = change.position.x < size.width / 2f
                            if (left) {
                                brightness = (brightness - dragAmount / 700f).coerceIn(0.05f, 1f)
                                activity?.window?.let { window ->
                                    val attrs = window.attributes
                                    attrs.screenBrightness = brightness
                                    window.attributes = attrs
                                }
                            } else {
                                val max = audioManager.getStreamMaxVolume(AudioManager.STREAM_MUSIC)
                                val current = audioManager.getStreamVolume(AudioManager.STREAM_MUSIC)
                                val next = (current - (dragAmount / 80f).toInt()).coerceIn(0, max)
                                audioManager.setStreamVolume(AudioManager.STREAM_MUSIC, next, 0)
                            }
                        }
                    },
            )

            if (errorMessage != null) {
                Column(
                    modifier = Modifier.align(Alignment.Center).padding(20.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Text(
                        text = "This stream can't be played",
                        style = MaterialTheme.typography.titleSmall,
                        fontWeight = FontWeight.Bold,
                        color = Color.White,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = errorMessage ?: "",
                        style = MaterialTheme.typography.labelSmall,
                        color = Color(0xFFA1A1AA),
                    )
                }
            }

            if (controlsVisible) {
                Box(
                    modifier = Modifier
                        .fillMaxSize()
                        .background(
                            Brush.verticalGradient(
                                0f to Color.Black.copy(alpha = 0.65f),
                                0.35f to Color.Transparent,
                                0.7f to Color.Transparent,
                                1f to Color.Black.copy(alpha = 0.75f),
                            ),
                        ),
                ) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 4.dp, vertical = 4.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(onClick = onBack) {
                            Icon(Icons.Filled.ArrowBack, contentDescription = "Back", tint = Color.White)
                        }
                        Text(
                            text = title,
                            color = Color.White,
                            style = MaterialTheme.typography.titleSmall,
                            fontWeight = FontWeight.SemiBold,
                            maxLines = 1,
                            overflow = TextOverflow.Ellipsis,
                            modifier = Modifier.weight(1f),
                        )
                        if (live) {
                            Row(
                                verticalAlignment = Alignment.CenterVertically,
                                modifier = Modifier.padding(end = 10.dp),
                            ) {
                                Box(Modifier.size(7.dp).background(Brand, CircleShape))
                                Spacer(Modifier.width(5.dp))
                                Text(
                                    text = "LIVE",
                                    color = Brand,
                                    style = MaterialTheme.typography.labelMedium,
                                    fontWeight = FontWeight.Bold,
                                )
                            }
                        }
                    }

                    Box(
                        modifier = Modifier
                            .align(Alignment.Center)
                            .size(64.dp)
                            .background(Color.Black.copy(alpha = 0.45f), CircleShape)
                            .clickable {
                                if (player.isPlaying) player.pause() else player.play()
                            },
                        contentAlignment = Alignment.Center,
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.size(38.dp),
                        )
                    }

                    Column(modifier = Modifier.align(Alignment.BottomCenter).fillMaxWidth()) {
                        if (!live) {
                            Row(
                                modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                                verticalAlignment = Alignment.CenterVertically,
                            ) {
                                Text(
                                    text = formatTime(position),
                                    color = Color.White,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                                Slider(
                                    value = if (duration > 0) position.toFloat() else 0f,
                                    onValueChange = { player.seekTo(it.toLong()) },
                                    valueRange = 0f..(if (duration > 0) duration.toFloat() else 1f),
                                    colors = SliderDefaults.colors(
                                        thumbColor = Brand,
                                        activeTrackColor = Brand,
                                        inactiveTrackColor = Color.White.copy(alpha = 0.35f),
                                    ),
                                    modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                                )
                                Text(
                                    text = formatTime(duration),
                                    color = Color.White,
                                    style = MaterialTheme.typography.labelSmall,
                                )
                            }
                        }

                        Row(
                            modifier = Modifier.fillMaxWidth().padding(horizontal = 6.dp),
                            verticalAlignment = Alignment.CenterVertically,
                        ) {
                            Box {
                                IconButton(onClick = { showSpeedMenu = true }) {
                                    Icon(Icons.Filled.Speed, contentDescription = "Speed", tint = Color.White)
                                }
                                DropdownMenu(expanded = showSpeedMenu, onDismissRequest = { showSpeedMenu = false }) {
                                    SPEEDS.forEach { option ->
                                        DropdownMenuItem(
                                            text = { Text("${option}x") },
                                            onClick = {
                                                speed = option
                                                player.setPlaybackSpeed(option)
                                                showSpeedMenu = false
                                            },
                                        )
                                    }
                                }
                            }

                            Box {
                                IconButton(onClick = { showTrackMenu = true }) {
                                    Icon(Icons.Filled.Audiotrack, contentDescription = "Audio and subtitles", tint = Color.White)
                                }
                                DropdownMenu(expanded = showTrackMenu, onDismissRequest = { showTrackMenu = false }) {
                                    if (audioOptions.isEmpty()) {
                                        DropdownMenuItem(text = { Text("Single audio track") }, onClick = { showTrackMenu = false })
                                    }
                                    audioOptions.forEach { (label, group) ->
                                        DropdownMenuItem(
                                            text = { Text(label) },
                                            onClick = {
                                                val params = player.trackSelectionParameters.buildUpon()
                                                params.setOverrideForType(TrackSelectionOverride(group, 0))
                                                player.trackSelectionParameters = params.build()
                                                showTrackMenu = false
                                            },
                                        )
                                    }
                                    DropdownMenuItem(
                                        text = { Text(if (subtitlesOff) "Subtitles on" else "Subtitles off") },
                                        onClick = {
                                            subtitlesOff = !subtitlesOff
                                            val params = player.trackSelectionParameters.buildUpon()
                                            params.setTrackTypeDisabled(C.TRACK_TYPE_TEXT, subtitlesOff)
                                            player.trackSelectionParameters = params.build()
                                            showTrackMenu = false
                                        },
                                    )
                                }
                            }

                            IconButton(
                                onClick = {
                                    resizeMode = when (resizeMode) {
                                        AspectRatioFrameLayout.RESIZE_MODE_FIT -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                                        AspectRatioFrameLayout.RESIZE_MODE_FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                        else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                                    }
                                },
                            ) {
                                Icon(Icons.Filled.AspectRatio, contentDescription = "Aspect ratio", tint = Color.White)
                            }

                            Text(
                                text = when (resizeMode) {
                                    AspectRatioFrameLayout.RESIZE_MODE_FIT -> "Fit"
                                    AspectRatioFrameLayout.RESIZE_MODE_FILL -> "Fill"
                                    else -> "Zoom"
                                },
                                color = Color.White.copy(alpha = 0.85f),
                                style = MaterialTheme.typography.labelSmall,
                            )

                            Spacer(Modifier.weight(1f))

                            Text(
                                text = "${speed}x",
                                color = Color.White.copy(alpha = 0.85f),
                                style = MaterialTheme.typography.labelSmall,
                                modifier = Modifier.padding(end = 8.dp),
                            )

                            IconButton(onClick = { fullscreen = !fullscreen }) {
                                Icon(
                                    imageVector = if (fullscreen) Icons.Filled.FullscreenExit else Icons.Filled.Fullscreen,
                                    contentDescription = if (fullscreen) "Exit full screen" else "Full screen",
                                    tint = Color.White,
                                )
                            }
                        }
                    }
                }
            }
        }

        if (!fullscreen) {
            Column(modifier = Modifier.weight(1f)) {
                Column(modifier = Modifier.padding(horizontal = 18.dp, vertical = 14.dp)) {
                    Text(
                        text = title,
                        style = MaterialTheme.typography.titleMedium,
                        fontWeight = FontWeight.Bold,
                        maxLines = 2,
                        overflow = TextOverflow.Ellipsis,
                    )
                    Spacer(Modifier.height(4.dp))
                    Text(
                        text = if (live) "Live channel · tap the full-screen icon for a bigger picture" else "Playing now",
                        style = MaterialTheme.typography.labelSmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }

                Text(
                    text = "More like this",
                    style = MaterialTheme.typography.titleSmall,
                    fontWeight = FontWeight.Bold,
                    modifier = Modifier.padding(horizontal = 18.dp, vertical = 6.dp),
                )

                LazyVerticalGrid(
                    columns = GridCells.Fixed(3),
                    contentPadding = PaddingValues(horizontal = 18.dp, vertical = 8.dp),
                    horizontalArrangement = Arrangement.spacedBy(10.dp),
                    verticalArrangement = Arrangement.spacedBy(14.dp),
                    modifier = Modifier.weight(1f),
                ) {
                    items(suggestions, key = { it.id }) { item ->
                        MediaCard(item = item, onClick = { onOpenSuggested(item.id) }, width = 104.dp)
                    }
                }
            }
        }
    }
}

private fun formatTime(millis: Long): String {
    if (millis <= 0) return "0:00"
    val totalSeconds = millis / 1000
    val hours = totalSeconds / 3600
    val minutes = (totalSeconds % 3600) / 60
    val seconds = totalSeconds % 60
    return if (hours > 0) {
        "%d:%02d:%02d".format(hours, minutes, seconds)
    } else {
        "%d:%02d".format(minutes, seconds)
    }
}

private fun Context.findActivity(): Activity? {
    var context: Context? = this
    while (context is ContextWrapper) {
        if (context is Activity) return context
        context = context.baseContext
    }
    return null
}
