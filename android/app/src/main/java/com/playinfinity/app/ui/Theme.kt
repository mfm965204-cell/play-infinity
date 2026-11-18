package com.playinfinity.app.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

val Ink = Color(0xFF07070A)
val Panel = Color(0xFF101018)
val Edge = Color(0xFF1F1F2B)
val Brand = Color(0xFFE11D48)
val Gold = Color(0xFFF5B301)

private val PlayInfinityColors = darkColorScheme(
    primary = Brand,
    onPrimary = Color.White,
    primaryContainer = Color(0xFF3B0A16),
    onPrimaryContainer = Color.White,
    secondary = Gold,
    onSecondary = Color.Black,
    background = Ink,
    onBackground = Color(0xFFF4F4F5),
    surface = Panel,
    onSurface = Color(0xFFF4F4F5),
    surfaceVariant = Edge,
    onSurfaceVariant = Color(0xFFA1A1AA),
    outline = Color(0xFF3F3F46),
)

@Composable
fun PlayInfinityTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = PlayInfinityColors, content = content)
}
