package com.playinfinity.app.ui

import android.app.Activity
import android.content.Context
import android.content.ContextWrapper
import android.media.AudioManager
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectVerticalDragGestures
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
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.ArrowBack
import androidx.compose.material.icons.filled.Pause
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
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
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.media3.common.C
import androidx.media3.common.PlaybackException
import androidx.media3.common.Player
import androidx.media3.common.TrackGroup
import androidx.media3.common.TrackSelectionOverride
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.ui.AspectRatioFrameLayout
import androidx.media3.ui.PlayerView
import androidx.media3.common.MediaItem as Media3Item
import kotlinx.coroutines.delay

private val SPEEDS = listOf(0.5f, 0.75f, 1f, 1.25f, 1.5f, 2f)

@Composable
fun PlayerScreen(
    url: String,
    format: String,
    title: String,
    live: Boolean,
    onBack: () -> Unit,
) {
    val context = LocalContext.current
    val activity = remember(context) { context.findActivity() }
    val player = remember { ExoPlayer.Builder(context).build() }
    val audioManager = remember { context.getSystemService(Context.AUDIO_SERVICE) as AudioManager }

    var isPlaying by remember { mutableStateOf(false) }
    var position by remember { mutableLongStateOf(0L) }
    var duration by remember { mutableLongStateOf(0L) }
    var buffered by remember { mutableLongStateOf(0L) }
    var speed by remember { mutableFloatStateOf(1f) }
    var resizeMode by remember { mutableIntStateOf(AspectRatioFrameLayout.RESIZE_MODE_FIT) }
    var showControls by remember { mutableStateOf(true) }
    var showSpeedMenu by remember { mutableStateOf(false) }
    var showTrackMenu by remember { mutableStateOf(false) }
    var audioOptions by remember { mutableStateOf<List<Pair<String, TrackGroup>>>(emptyList()) }
    var subtitlesOff by remember { mutableStateOf(false) }
    var errorMessage by remember { mutableStateOf<String?>(null) }
    var brightness by remember { mutableFloatStateOf(1f) }

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

    Box(modifier = Modifier.fillMaxSize().background(Color.Black)) {
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
                        onTap = { showControls = !showControls },
                        onDoubleTap = { offset ->
                            val width = size.width.toFloat()
                            when {
                                offset.x < width / 3f -> player.seekTo((player.currentPosition - 10_000).coerceAtLeast(0L))
                                offset.x > width * 2f / 3f ->
                                    player.seekTo((player.currentPosition + 10_000).coerceAtMost(duration.coerceAtLeast(0L)))
                                else -> {
                                    if (player.isPlaying) player.pause() else player.play()
                                }
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
                modifier = Modifier.align(Alignment.Center).padding(24.dp),
                horizontalAlignment = Alignment.CenterHorizontally,
            ) {
                Text(
                    text = "This stream can't be played",
                    style = MaterialTheme.typography.titleMedium,
                    fontWeight = FontWeight.Bold,
                    color = Color.White,
                )
                Spacer(Modifier.height(6.dp))
                Text(
                    text = errorMessage ?: "",
                    style = MaterialTheme.typography.bodySmall,
                    color = Color(0xFFA1A1AA),
                )
                Spacer(Modifier.height(16.dp))
                TextButton(onClick = onBack) { Text("Back") }
            }
        }

        if (showControls) {
            Column(modifier = Modifier.fillMaxSize().background(Color.Black.copy(alpha = 0.35f))) {
                Row(
                    modifier = Modifier.fillMaxWidth().padding(8.dp),
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
                        modifier = Modifier.weight(1f),
                    )
                    if (live) {
                        Text(
                            text = "● LIVE",
                            color = Brand,
                            style = MaterialTheme.typography.labelMedium,
                            fontWeight = FontWeight.Bold,
                        )
                    }
                }

                Spacer(Modifier.weight(1f))

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 12.dp),
                    horizontalArrangement = Arrangement.Center,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    IconButton(
                        onClick = {
                            if (player.isPlaying) player.pause() else player.play()
                        },
                        modifier = Modifier.width(72.dp).height(72.dp),
                    ) {
                        Icon(
                            imageVector = if (isPlaying) Icons.Filled.Pause else Icons.Filled.PlayArrow,
                            contentDescription = if (isPlaying) "Pause" else "Play",
                            tint = Color.White,
                            modifier = Modifier.width(44.dp).height(44.dp),
                        )
                    }
                }

                Spacer(Modifier.weight(1f))

                if (!live) {
                    Row(
                        modifier = Modifier.fillMaxWidth().padding(horizontal = 14.dp),
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
                            modifier = Modifier.weight(1f).padding(horizontal = 8.dp),
                        )
                        Text(
                            text = formatTime(duration),
                            color = Color.White,
                            style = MaterialTheme.typography.labelSmall,
                        )
                    }
                    Text(
                        text = "buffered ${formatTime(buffered)}",
                        color = Color(0xFF71717A),
                        style = MaterialTheme.typography.labelSmall,
                        modifier = Modifier.padding(start = 16.dp, bottom = 4.dp),
                    )
                } else {
                    Spacer(Modifier.height(12.dp))
                }

                Row(
                    modifier = Modifier.fillMaxWidth().padding(horizontal = 10.dp, vertical = 6.dp),
                    horizontalArrangement = Arrangement.SpaceBetween,
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Box {
                        TextButton(onClick = { showSpeedMenu = true }) {
                            Text("${speed}x", color = Color.White, fontWeight = FontWeight.SemiBold)
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
                        TextButton(onClick = { showTrackMenu = true }) {
                            Text("Audio / Subs", color = Color.White, fontWeight = FontWeight.SemiBold)
                        }
                        DropdownMenu(expanded = showTrackMenu, onDismissRequest = { showTrackMenu = false }) {
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

                    TextButton(
                        onClick = {
                            resizeMode = when (resizeMode) {
                                AspectRatioFrameLayout.RESIZE_MODE_FIT -> AspectRatioFrameLayout.RESIZE_MODE_FILL
                                AspectRatioFrameLayout.RESIZE_MODE_FILL -> AspectRatioFrameLayout.RESIZE_MODE_ZOOM
                                else -> AspectRatioFrameLayout.RESIZE_MODE_FIT
                            }
                        },
                    ) {
                        val label = when (resizeMode) {
                            AspectRatioFrameLayout.RESIZE_MODE_FIT -> "Fit"
                            AspectRatioFrameLayout.RESIZE_MODE_FILL -> "Fill"
                            else -> "Zoom"
                        }
                        Text(label, color = Color.White, fontWeight = FontWeight.SemiBold)
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
