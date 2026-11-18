package com.playinfinity.app.ui

import androidx.compose.runtime.mutableStateOf

/** Set by MainActivity when the app is opened through playinfinity://movie/{id}. */
object DeepLink {
    val movieId = mutableStateOf<Int?>(null)
}
