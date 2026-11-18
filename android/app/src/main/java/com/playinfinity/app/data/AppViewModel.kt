package com.playinfinity.app.data

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

data class AppUiState(
    val loading: Boolean = true,
    val error: String? = null,
    val settings: AppSettings = AppSettings(),
    val media: List<MediaItem> = emptyList(),
    val searchQuery: String = "",
    val searchResults: List<MediaItem> = emptyList(),
    val searchLoading: Boolean = false,
)

class AppViewModel(application: Application) : AndroidViewModel(application) {

    private val prefs = application.getSharedPreferences("play_infinity", 0)

    private val _state = MutableStateFlow(AppUiState())
    val state: StateFlow<AppUiState> = _state.asStateFlow()

    private val _myList = MutableStateFlow(readMyList())
    val myList: StateFlow<Set<Int>> = _myList.asStateFlow()

    init {
        load()
    }

    fun load() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            try {
                val settings = Api.service.settings()
                val media = Api.service.media().items
                _state.value = _state.value.copy(loading = false, settings = settings, media = media)
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
                val results = Api.service.media(query = query.trim()).items
                _state.value = _state.value.copy(searchResults = results, searchLoading = false)
            } catch (e: Exception) {
                _state.value = _state.value.copy(searchLoading = false)
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
