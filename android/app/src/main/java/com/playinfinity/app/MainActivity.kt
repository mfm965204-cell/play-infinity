package com.playinfinity.app

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.playinfinity.app.ui.AppRoot
import com.playinfinity.app.ui.DeepLink
import com.playinfinity.app.ui.PlayInfinityTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        handleDeepLink(intent)
        setContent {
            PlayInfinityTheme {
                AppRoot()
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLink(intent)
    }

    /**
     * Accepts both share formats:
     *   playinfinity://movie/42
     *   https://playinfinity.mfm965204.workers.dev/movie/42
     */
    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        val segments = data.pathSegments ?: return

        val id = when {
            data.scheme == "playinfinity" && data.host == "movie" ->
                segments.firstOrNull()?.toIntOrNull()

            segments.firstOrNull() == "movie" ->
                segments.getOrNull(1)?.toIntOrNull()

            else -> null
        }

        if (id != null && id > 0) {
            DeepLink.movieId.value = id
        }
    }
}
