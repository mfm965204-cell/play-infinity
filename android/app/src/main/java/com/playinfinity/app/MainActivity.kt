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

    private fun handleDeepLink(intent: Intent?) {
        val data = intent?.data ?: return
        if (data.scheme == "playinfinity" && data.host == "movie") {
            val id = data.pathSegments.firstOrNull()?.toIntOrNull()
            if (id != null && id > 0) {
                DeepLink.movieId.value = id
            }
        }
    }
}
