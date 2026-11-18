package com.playinfinity.app.data

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.UUID

data class AppUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val banned: Boolean = false,
    val settings: AppSettings = AppSettings(),
    val movies: List<MediaItem> = emptyList(),
    val anime: List<MediaItem> = emptyList(),
    val live: List<MediaItem> = emptyList(),
    val searchQuery: String = "",
    val searchResults: List<MediaItem> = emptyList(),
    val searchLoading: Boolean = false,
    val lastChecked: String = "",
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("play_infinity", 0)

    val deviceId: String = prefs.getString("device_id", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("device_id", it).apply() }

    private val appVersion: String = runCatching {
        application.packageManager.getPackageInfo(application.packageName, 0).versionName ?: "2.0.0"
    }.getOrDefault("2.0.0")

    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    /** deviceId -> mediaId -> position in ms */
    private val progressStore = prefs

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val registered = withContext(Dispatchers.IO) {
                    Api.service.register(
                        RegisterBody(
                            deviceId = deviceId,
                            model = Build.MODEL ?: "",
                            manufacturer = Build.MANUFACTURER ?: "",
                            appVersion = appVersion,
                        ),
                    )
                }

                if (registered.banned) {
                    _state.value = _state.value.copy(loading = false, banned = true)
                    return@launch
                }

                val settings = withContext(Dispatchers.IO) { Api.service.settings(deviceId) }
                val movies = withContext(Dispatchers.IO) {
                    Api.service.media(deviceId = deviceId, type = "movie", limit = 200).items
                }
                val anime = withContext(Dispatchers.IO) {
                    Api.service.media(deviceId = deviceId, type = "anime", limit = 200).items
                }
                val live = withContext(Dispatchers.IO) {
                    Api.service.media(deviceId = deviceId, type = "live", limit = 400).items
                }

                val stamp = SimpleDateFormat("dd MMM yyyy, HH:mm", Locale.getDefault()).format(Date())

                _state.value = _state.value.copy(
                    loading = false,
                    banned = false,
                    settings = settings,
                    movies = movies,
                    anime = anime,
                    live = live,
                    lastChecked = stamp,
                )
            } catch (e: Exception) {
                val message = e.message ?: "Could not reach Play Infinity."
                val banned = message.contains("403") || message.contains("device_banned")
                _state.value = _state.value.copy(
                    loading = false,
                    banned = banned,
                    error = if (banned) null else message,
                )
            }
        }
    }

    fun search(query: String) {
        _state.value = _state.value.copy(searchQuery = query)
        if (query.isBlank()) {
            _state.value = _state.value.copy(searchResults = emptyList(), searchLoading = false)
            return
        }
        viewModelScope.launch {
            _state.value = _state.value.copy(searchLoading = true)
            try {
                val results = withContext(Dispatchers.IO) {
                    Api.service.media(deviceId = deviceId, query = query.trim(), limit = 60).items
                }
                _state.value = _state.value.copy(searchResults = results, searchLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(searchLoading = false)
            }
        }
    }

    /* -------- local playback position (per episode / title) -------- */

    fun savePosition(mediaId: Int, positionMs: Long) {
        if (mediaId <= 0) return
        progressStore.edit().putLong("pos_$mediaId", positionMs).apply()
    }

    fun positionOf(mediaId: Int): Long = progressStore.getLong("pos_$mediaId", 0L)
}
