package com.playinfinity.app.data

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface PlayInfinityApi {
    @GET("api/media")
    suspend fun media(
        @Query("type") type: String? = null,
        @Query("q") query: String? = null,
        @Query("genre") genre: String? = null,
        @Query("category") category: String? = null,
        @Query("limit") limit: Int = 100,
    ): MediaListResponse

    @GET("api/media/{id}")
    suspend fun detail(@Path("id") id: Int): MediaDetail

    @GET("api/settings")
    suspend fun settings(): AppSettings

    @GET("api/categories")
    suspend fun categories(): CategoryListResponse

    @GET("api/home")
    suspend fun home(@Query("device_id") deviceId: String): HomeResponse

    @GET("api/continue")
    suspend fun continueWatching(@Query("device_id") deviceId: String): MediaListResponse

    @POST("api/analytics")
    suspend fun analytics(@Body body: AnalyticsBody): SimpleResponse

    @POST("api/request")
    suspend fun requestTitle(@Body body: RequestBodyDto): SimpleResponse

    @POST("api/verify_license")
    suspend fun verifyLicense(@Body body: LicenseBody): LicenseResponse
}

object Api {
    const val BASE_URL = "https://playinfinity.mfm965204.workers.dev/"

    val service: PlayInfinityApi by lazy {
        Retrofit.Builder()
            .baseUrl(BASE_URL)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
            .create(PlayInfinityApi::class.java)
    }
}
