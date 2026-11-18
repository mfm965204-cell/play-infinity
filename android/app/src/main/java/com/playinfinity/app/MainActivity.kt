package com.playinfinity.app

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import com.playinfinity.app.ui.AppRoot
import com.playinfinity.app.ui.PlayInfinityTheme

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            PlayInfinityTheme {
                AppRoot()
            }
        }
    }
}
