package com.playinfinity.app.data

import com.google.gson.annotations.SerializedName

data class MediaItem(
    val id: Int = 0,
    val title: String = "",
    val description: String = "",
    @SerializedName("cover_url") val coverUrl: String = "",
    @SerializedName("backdrop_url") val backdropUrl: String = "",
    val type: String = "movie",
    @SerializedName("release_year") val releaseYear: Int = 0,
    val genres: List<String> = emptyList(),
    val rating: Double = 0.0,
    @SerializedName("video_url") val videoUrl: String = "",
    val format: String = "mp4",
    val featured: Boolean = false,
) {
    val metaLine: String
        get() {
            val parts = mutableListOf<String>()
            if (releaseYear > 0) parts.add(releaseYear.toString())
            if (rating > 0) parts.add("★ %.1f".format(rating))
            if (genres.isNotEmpty()) parts.add(genres.take(2).joinToString(", "))
            return parts.joinToString(" · ")
        }

    val isLive: Boolean get() = type == "live"
    val isAnime: Boolean get() = type == "anime"
}

data class Episode(
    val id: Int = 0,
    @SerializedName("media_id") val mediaId: Int = 0,
    val season: Int = 1,
    @SerializedName("episode_number") val episodeNumber: Int = 1,
    val title: String = "",
    @SerializedName("video_url") val videoUrl: String = "",
    val format: String = "mp4",
) {
    val label: String get() = "EP $episodeNumber"
}

data class MediaDetail(
    val id: Int = 0,
    val title: String = "",
    val description: String = "",
    @SerializedName("cover_url") val coverUrl: String = "",
    @SerializedName("backdrop_url") val backdropUrl: String = "",
    val type: String = "movie",
    @SerializedName("release_year") val releaseYear: Int = 0,
    val genres: List<String> = emptyList(),
    val rating: Double = 0.0,
    @SerializedName("video_url") val videoUrl: String = "",
    val format: String = "mp4",
    val featured: Boolean = false,
    val episodes: List<Episode> = emptyList(),
) {
    fun toItem(): MediaItem = MediaItem(
        id = id,
        title = title,
        description = description,
        coverUrl = coverUrl,
        backdropUrl = backdropUrl,
        type = type,
        releaseYear = releaseYear,
        genres = genres,
        rating = rating,
        videoUrl = videoUrl,
        format = format,
        featured = featured,
    )
}

data class MediaListResponse(val items: List<MediaItem> = emptyList())

data class RegisterBody(
    @SerializedName("device_id") val deviceId: String,
    val model: String,
    val manufacturer: String,
    @SerializedName("app_version") val appVersion: String,
)

data class RegisterResponse(
    val ok: Boolean = false,
    @SerializedName("device_id") val deviceId: String = "",
    val banned: Boolean = false,
)

data class NotificationItem(
    val id: Int = 0,
    val title: String = "",
    val body: String = "",
    @SerializedName("created_at") val createdAt: String = "",
)

data class UpdatesResponse(
    val banned: Boolean = false,
    @SerializedName("media_count") val mediaCount: Int = 0,
    @SerializedName("latest_media_id") val latestMediaId: Int = 0,
    val notification: NotificationItem? = null,
    @SerializedName("app_version") val appVersion: String = "2.1.0",
)

data class AppSettings(
    val maintenance: String = "0",
    @SerializedName("maintenance_message") val maintenanceMessage: String = "",
    @SerializedName("live_tv_enabled") val liveTvEnabled: String = "1",
    @SerializedName("update_required") val updateRequired: String = "0",
    @SerializedName("update_message") val updateMessage: String = "",
    @SerializedName("app_version") val appVersion: String = "2.0.0",
    @SerializedName("privacy_policy") val privacyPolicy: String = "",
    @SerializedName("terms_conditions") val termsConditions: String = "",
    @SerializedName("developer_name") val developerName: String = "Mohammad Fahad Mir",
    @SerializedName("developer_portfolio") val developerPortfolio: String = "https://portfolio.mfm965204.workers.dev/",
    @SerializedName("developer_instagram") val developerInstagram: String = "https://www.instagram.com/fahad0101r",
) {
    val isMaintenance: Boolean get() = maintenance == "1"
    val isLiveEnabled: Boolean get() = liveTvEnabled == "1"
    val isUpdateRequired: Boolean get() = updateRequired == "1"
}
