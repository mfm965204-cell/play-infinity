package com.playinfinity.app.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.google.gson.Gson
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import retrofit2.HttpException
import java.util.UUID

data class AppUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val settings: AppSettings = AppSettings(),
    val rows: List<HomeRow> = emptyList(),
    val continueWatching: List<MediaItem> = emptyList(),
    val media: List<MediaItem> = emptyList(),
    val searchQuery: String = "",
    val searchResults: List<MediaItem> = emptyList(),
    val searchLoading: Boolean = false,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("play_infinity", 0)
    private val gson = Gson()

    val deviceId: String = prefs.getString("device_id", null)
        ?: UUID.randomUUID().toString().also { prefs.edit().putString("device_id", it).apply() }

    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    private val _myList = MutableStateFlow(readMyList())
    val myList: StateFlow<Set<Int>> = _myList.asStateFlow()

    private val _premiumUnlocked = MutableStateFlow(prefs.getBoolean("premium_unlocked", false))
    val premiumUnlocked: StateFlow<Boolean> = _premiumUnlocked.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val settings = withContext(Dispatchers.IO) { Api.service.settings() }
                val home = withContext(Dispatchers.IO) { Api.service.home(deviceId) }
                val media = home.rows.flatMap { it.items }.distinctBy { it.id }
                _state.value = _state.value.copy(
                    loading = false,
                    settings = settings,
                    rows = home.rows,
                    continueWatching = home.continueWatching,
                    media = media,
                )
            } catch (e: Exception) {
                _state.value = _state.value.copy(
                    loading = false,
                    error = e.message ?: "Could not reach the Play Infinity service.",
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
                val results = withContext(Dispatchers.IO) { Api.service.media(query = query.trim()).items }
                _state.value = _state.value.copy(searchResults = results, searchLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(searchLoading = false)
            }
        }
    }

    fun verifyLicense(key: String, onResult: (Boolean, String) -> Unit) {
        val clean = key.trim().uppercase()
        if (clean.isEmpty()) {
            onResult(false, "Enter the key from your license.")
            return
        }
        viewModelScope.launch {
            try {
                val res = withContext(Dispatchers.IO) {
                    Api.service.verifyLicense(LicenseBody(clean, deviceId))
                }
                if (res.ok) {
                    prefs.edit()
                        .putBoolean("premium_unlocked", true)
                        .putString("license_key", clean)
                        .apply()
                    _premiumUnlocked.value = true
                    onResult(true, "Unlocked on ${res.bound} of ${res.limit} devices")
                } else {
                    onResult(false, res.message ?: res.error ?: "That key was rejected.")
                }
            } catch (e: HttpException) {
                val message = runCatching {
                    val body = e.response()?.errorBody()?.string().orEmpty()
                    gson.fromJson(body, LicenseResponse::class.java)?.message
                }.getOrNull()
                onResult(false, message ?: "That key was rejected.")
            } catch (e: Exception) {
                onResult(false, e.message ?: "Could not reach the server.")
            }
        }
    }

    fun submitRequest(title: String, onDone: (Boolean, String) -> Unit) {
        val clean = title.trim()
        if (clean.isEmpty()) {
            onDone(false, "Type the name of the title you want.")
            return
        }
        viewModelScope.launch {
            try {
                withContext(Dispatchers.IO) { Api.service.requestTitle(RequestBodyDto(deviceId, clean)) }
                onDone(true, "Request sent — we'll look for “$clean”.")
            } catch (e: Exception) {
                onDone(false, e.message ?: "Could not send that request.")
            }
        }
    }

    fun reportProgress(mediaId: Int, seconds: Int) {
        if (mediaId <= 0 || seconds < 0) return
        viewModelScope.launch {
            runCatching {
                withContext(Dispatchers.IO) {
                    Api.service.analytics(AnalyticsBody(deviceId, mediaId, seconds))
                }
            }
        }
    }

    private fun readMyList(): Set<Int> {
        val stored = prefs.getStringSet("my_list", emptySet()) ?: emptySet()
        return stored.mapNotNull { it.toIntOrNull() }.toSet()
    }

    fun isInMyList(id: Int): Boolean = _myList.value.contains(id)

    fun toggleMyList(id: Int) {
        val next = _myList.value.toMutableSet()
        if (!next.add(id)) next.remove(id)
        prefs.edit().putStringSet("my_list", next.map { it.toString() }.toSet()).apply()
        _myList.value = next
    }
}
