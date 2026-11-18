package com.playinfinity.app.data

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.GET
import retrofit2.http.Path
import retrofit2.http.Query

interface PlayInfinityApi {
    @GET("api/media")
    suspend fun media(
        @Query("type") type: String? = null,
        @Query("q") query: String? = null,
        @Query("genre") genre: String? = null,
        @Query("limit") limit: Int = 100,
    ): MediaListResponse

    @GET("api/media/{id}")
    suspend fun detail(@Path("id") id: Int): MediaDetail

    @GET("api/settings")
    suspend fun settings(): AppSettings
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
