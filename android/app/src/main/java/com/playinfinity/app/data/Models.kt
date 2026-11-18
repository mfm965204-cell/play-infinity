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
    @SerializedName("category_id") val categoryId: Int? = null,
    @SerializedName("progress_seconds") val progressSeconds: Int = 0,
    @SerializedName("last_updated") val lastUpdated: String = "",
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
    val isSeries: Boolean get() = type == "series"
}

data class Category(
    val id: Int = 0,
    val name: String = "",
    val slug: String = "",
    @SerializedName("is_premium") val isPremium: Boolean = false,
    @SerializedName("is_enabled") val isEnabled: Boolean = true,
    @SerializedName("sort_order") val sortOrder: Int = 0,
    @SerializedName("media_count") val mediaCount: Int = 0,
)

data class HomeRow(
    val category: Category = Category(),
    val items: List<MediaItem> = emptyList(),
)

data class PremiumState(val enabled: Boolean = false)

data class HomeResponse(
    val rows: List<HomeRow> = emptyList(),
    @SerializedName("continue_watching") val continueWatching: List<MediaItem> = emptyList(),
    val premium: PremiumState = PremiumState(),
)

data class Episode(
    val id: Int = 0,
    @SerializedName("media_id") val mediaId: Int = 0,
    val season: Int = 1,
    @SerializedName("episode_number") val episodeNumber: Int = 1,
    val title: String = "",
    @SerializedName("video_url") val videoUrl: String = "",
    val format: String = "mp4",
) {
    val label: String get() = "S${season}E$episodeNumber"
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
    @SerializedName("category_id") val categoryId: Int? = null,
    val category: Category? = null,
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
        categoryId = categoryId,
    )
}

data class MediaListResponse(val items: List<MediaItem> = emptyList())

data class CategoryListResponse(val items: List<Category> = emptyList())

data class SimpleResponse(val ok: Boolean = false)

data class AnalyticsBody(
    @SerializedName("device_id") val deviceId: String,
    @SerializedName("media_id") val mediaId: Int,
    @SerializedName("progress_seconds") val progressSeconds: Int,
)

data class RequestBodyDto(
    @SerializedName("device_id") val deviceId: String,
    val title: String,
)

data class LicenseBody(
    val key: String,
    @SerializedName("device_id") val deviceId: String,
)

data class LicenseResponse(
    val ok: Boolean = false,
    val bound: Int = 0,
    val limit: Int = 0,
    val expiry: String = "",
    @SerializedName("already_bound") val alreadyBound: Boolean = false,
    val error: String? = null,
    val message: String? = null,
)

data class AppSettings(
    val maintenance: String = "0",
    @SerializedName("maintenance_message") val maintenanceMessage: String = "",
    @SerializedName("live_tv_enabled") val liveTvEnabled: String = "1",
    @SerializedName("downloads_enabled") val downloadsEnabled: String = "1",
    @SerializedName("update_required") val updateRequired: String = "0",
    @SerializedName("update_message") val updateMessage: String = "",
    @SerializedName("app_version") val appVersion: String = "1.0.0",
    @SerializedName("privacy_policy") val privacyPolicy: String = "",
    @SerializedName("terms_conditions") val termsConditions: String = "",
    @SerializedName("developer_name") val developerName: String = "Mohammad Fahad Mir",
    @SerializedName("developer_portfolio") val developerPortfolio: String = "https://portfolio.mfm965204.workers.dev/",
    @SerializedName("developer_instagram") val developerInstagram: String = "https://www.instagram.com/fahad0101r",
    @SerializedName("premium_enabled") val premiumEnabled: String = "0",
) {
    val isMaintenance: Boolean get() = maintenance == "1"
    val isLiveEnabled: Boolean get() = liveTvEnabled == "1"
    val isDownloadsEnabled: Boolean get() = downloadsEnabled == "1"
    val isUpdateRequired: Boolean get() = updateRequired == "1"
    val isPremiumEnabled: Boolean get() = premiumEnabled == "1"
}
