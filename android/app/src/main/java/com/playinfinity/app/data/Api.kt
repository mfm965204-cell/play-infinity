package com.playinfinity.app.data

import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.Header
import retrofit2.http.POST
import retrofit2.http.Path
import retrofit2.http.Query

interface PlayInfinityApi {
    @GET("api/media")
    suspend fun media(
        @Header("X-Device-Id") deviceId: String,
        @Query("type") type: String? = null,
        @Query("q") query: String? = null,
        @Query("genre") genre: String? = null,
        @Query("limit") limit: Int = 200,
    ): MediaListResponse

    @GET("api/media/{id}")
    suspend fun detail(
        @Header("X-Device-Id") deviceId: String,
        @Path("id") id: Int,
    ): MediaDetail

    @GET("api/settings")
    suspend fun settings(@Header("X-Device-Id") deviceId: String): AppSettings

    @POST("api/register")
    suspend fun register(@Body body: RegisterBody): RegisterResponse
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
