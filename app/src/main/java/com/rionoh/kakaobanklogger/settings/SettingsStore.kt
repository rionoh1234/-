package com.rionoh.kakaobanklogger.settings

import android.content.Context
import android.content.SharedPreferences
import java.security.SecureRandom

/** 최근 알림을 보낸 앱(패키지명 확인용). 알림 내용은 저장하지 않는다. */
data class RecentPackage(val packageName: String, val label: String, val lastSeen: Long)

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

    /** 기본값 ON. URL/비밀키가 비어 있으면 Worker 가 아무것도 하지 않는다. */
    var forwardEnabled: Boolean
        get() = prefs.getBoolean(KEY_FORWARD_ENABLED, true)
        set(value) = prefs.edit().putBoolean(KEY_FORWARD_ENABLED, value).apply()

    /** 쉼표/줄바꿈으로 구분한 패키지명 목록 */
    var packageFilter: String
        get() = prefs.getString(KEY_PACKAGE_FILTER, DEFAULT_PACKAGES) ?: DEFAULT_PACKAGES
        set(value) = prefs.edit().putString(KEY_PACKAGE_FILTER, value.trim()).apply()

    fun packages(): Set<String> =
        packageFilter.split(',', '\n', ' ').map { it.trim() }.filter { it.isNotEmpty() }.toSet()

    fun shouldCapture(packageName: String): Boolean = packages().contains(packageName)

    fun isWebhookConfigured(): Boolean =
        webhookUrl.startsWith("https://") && webhookSecret.isNotBlank()

    /** 비밀키가 없으면 생성한다. */
    fun ensureSecret(): String {
        val current = webhookSecret
        if (current.isNotBlank()) return current
        return generateSecret().also { webhookSecret = it }
    }

    // ---- 최근 알림을 보낸 앱 ----

    fun recentPackages(): List<RecentPackage> =
        (prefs.getString(KEY_RECENT, "") ?: "")
            .split('\n')
            .mapNotNull { line ->
                val parts = line.split('\t')
                if (parts.size < 3) null
                else RecentPackage(parts[0], parts[1], parts[2].toLongOrNull() ?: 0L)
            }
            .sortedByDescending { it.lastSeen }

    /** 같은 패키지는 1분에 한 번만 갱신해 저장 비용을 줄인다. */
    fun touchRecentPackage(packageName: String, label: String, now: Long = System.currentTimeMillis()) {
        val list = recentPackages()
        val existing = list.firstOrNull { it.packageName == packageName }
        if (existing != null && now - existing.lastSeen < 60_000L) return
        val updated = (listOf(RecentPackage(packageName, label, now)) + list.filter { it.packageName != packageName })
            .take(MAX_RECENT)
        val encoded = updated.joinToString("\n") {
            listOf(it.packageName, it.label.replace('\t', ' ').replace('\n', ' '), it.lastSeen.toString())
                .joinToString("\t")
        }
        prefs.edit().putString(KEY_RECENT, encoded).apply()
    }

    companion object {
        private const val PREFS = "settings"
        private const val KEY_WEBHOOK_URL = "webhook_url"
        private const val KEY_WEBHOOK_SECRET = "webhook_secret"
        private const val KEY_FORWARD_ENABLED = "forward_enabled"
        private const val KEY_PACKAGE_FILTER = "package_filter"
        private const val KEY_RECENT = "recent_packages"
        private const val MAX_RECENT = 20

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
