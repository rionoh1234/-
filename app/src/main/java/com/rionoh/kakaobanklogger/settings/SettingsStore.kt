package com.rionoh.kakaobanklogger.settings

import android.content.Context
import android.content.SharedPreferences
import java.security.SecureRandom

/**
 * 앱 설정. 단순한 값이므로 SharedPreferences 를 사용한다.
 * (리스너 서비스와 Worker 는 별도 프로세스가 아니므로 즉시 반영된다.)
 */
class SettingsStore(context: Context) {

    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences(PREFS, Context.MODE_PRIVATE)

    var webhookUrl: String
        get() = prefs.getString(KEY_WEBHOOK_URL, "") ?: ""
        set(value) = prefs.edit().putString(KEY_WEBHOOK_URL, value.trim()).apply()

    var webhookSecret: String
        get() = prefs.getString(KEY_WEBHOOK_SECRET, "") ?: ""
        set(value) = prefs.edit().putString(KEY_WEBHOOK_SECRET, value.trim()).apply()

    var forwardEnabled: Boolean
        get() = prefs.getBoolean(KEY_FORWARD_ENABLED, false)
        set(value) = prefs.edit().putBoolean(KEY_FORWARD_ENABLED, value).apply()

    /** 쉼표로 구분한 패키지명 목록 */
    var packageFilter: String
        get() = prefs.getString(KEY_PACKAGE_FILTER, DEFAULT_PACKAGES) ?: DEFAULT_PACKAGES
        set(value) = prefs.edit().putString(KEY_PACKAGE_FILTER, value.trim()).apply()

    /** 디버그용: 모든 앱의 알림을 수집(패키지명 확인 목적) */
    var captureAllPackages: Boolean
        get() = prefs.getBoolean(KEY_CAPTURE_ALL, false)
        set(value) = prefs.edit().putBoolean(KEY_CAPTURE_ALL, value).apply()

    fun packages(): Set<String> =
        packageFilter.split(',', '\n', ' ').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    fun shouldCapture(packageName: String): Boolean =
        captureAllPackages || packages().contains(packageName)

    fun isWebhookConfigured(): Boolean =
        webhookUrl.startsWith("https://") && webhookSecret.isNotBlank()

    /** 비밀키가 없으면 생성한다. */
    fun ensureSecret(): String {
        val current = webhookSecret
        if (current.isNotBlank()) return current
        return generateSecret().also { webhookSecret = it }
    }

    companion object {
        private const val PREFS = "settings"
        private const val KEY_WEBHOOK_URL = "webhook_url"
        private const val KEY_WEBHOOK_SECRET = "webhook_secret"
        private const val KEY_FORWARD_ENABLED = "forward_enabled"
        private const val KEY_PACKAGE_FILTER = "package_filter"
        private const val KEY_CAPTURE_ALL = "capture_all"

        /** 카카오뱅크 Play 스토어 패키지명 */
        const val KAKAOBANK_PACKAGE = "com.kakaobank.channel"
        const val DEFAULT_PACKAGES = KAKAOBANK_PACKAGE

        private const val ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789"

        fun generateSecret(length: Int = 32): String {
            val rnd = SecureRandom()
            return buildString(length) {
                repeat(length) { append(ALPHABET[rnd.nextInt(ALPHABET.length)]) }
            }
        }
    }
}
