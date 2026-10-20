package com.rionoh.kakaobanklogger.forward

import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException
import java.util.concurrent.TimeUnit

/**
 * JSON 을 HTTPS POST 로 전송한다.
 *
 * Google Apps Script 웹앱은 POST 에 302 리다이렉트로 응답하므로
 * 리다이렉트를 따라가고, 최종 응답이 2xx 이면 성공으로 본다.
 * 응답 본문이 JSON 이고 ok=false 이면 서버 측 거부로 간주한다.
 */
class WebhookClient(
    private val url: String,
    private val secret: String
) {
    private val http = OkHttpClient.Builder()
        .connectTimeout(15, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(30, TimeUnit.SECONDS)
        .followRedirects(true)
        .followSslRedirects(true)
        .build()

    fun send(payload: JSONObject): Result<String> = runCatching {
        if (!url.startsWith("https://")) throw IOException("웹훅 URL 은 https:// 로 시작해야 합니다")
        val body = payload.toString().toRequestBody(JSON)
        val request = Request.Builder()
            .url(url)
            .post(body)
            .header("Content-Type", "application/json; charset=utf-8")
            .header("X-Logger-Secret", secret)
            .header("User-Agent", "KakaoBankNotiLogger/1")
            .build()

        http.newCall(request).execute().use { resp ->
            val text = resp.body?.string().orEmpty()
            if (!resp.isSuccessful) throw IOException("HTTP ${resp.code} ${text.take(200)}")
            val trimmed = text.trim()
            if (trimmed.startsWith("{")) {
                val json = runCatching { JSONObject(trimmed) }.getOrNull()
                if (json != null && json.has("ok") && !json.optBoolean("ok", true)) {
                    throw IOException("서버 거부: ${json.optString("error", "unknown")}")
                }
            }
            trimmed.take(500)
        }
    }

    companion object {
        private val JSON = "application/json; charset=utf-8".toMediaType()
    }
}
