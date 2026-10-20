package com.rionoh.banknoti

import android.content.Context

class Prefs(context: Context) {
    private val sp = context.applicationContext.getSharedPreferences("prefs", Context.MODE_PRIVATE)

    var targetPackages: Set<String>
        get() = sp.getStringSet(KEY_TARGETS, null) ?: DEFAULT_TARGETS
        set(value) = sp.edit().putStringSet(KEY_TARGETS, value).apply()

    var testMode: Boolean
        get() = sp.getBoolean(KEY_TEST_MODE, false)
        set(value) = sp.edit().putBoolean(KEY_TEST_MODE, value).apply()

    /** 패키지명 → 마지막 감지 시각. 알림 내용은 저장하지 않는다. */
    fun recentPackages(): List<Pair<String, Long>> =
        sp.getStringSet(KEY_RECENT, emptySet()).orEmpty()
            .mapNotNull { entry ->
                val i = entry.lastIndexOf('|')
                if (i <= 0) null else entry.substring(0, i) to (entry.substring(i + 1).toLongOrNull() ?: 0L)
            }
            .sortedByDescending { it.second }

    fun touchRecentPackage(pkg: String, now: Long) {
        val current = recentPackages().toMap().toMutableMap()
        val last = current[pkg]
        if (last != null && now - last < RECENT_WRITE_INTERVAL_MS) return
        current[pkg] = now
        val trimmed = current.entries.sortedByDescending { it.value }.take(RECENT_MAX)
        sp.edit().putStringSet(KEY_RECENT, trimmed.map { "${it.key}|${it.value}" }.toSet()).apply()
    }

    companion object {
        // 카카오뱅크 Android 앱 패키지명으로 알려진 값. 실제 기기에서 확인 필요(설정 화면의 '최근 알림을 보낸 앱' 참고).
        val DEFAULT_TARGETS = setOf("com.kakaobank.channel")

        private const val KEY_TARGETS = "target_packages"
        private const val KEY_TEST_MODE = "test_mode"
        private const val KEY_RECENT = "recent_packages"
        private const val RECENT_MAX = 30
        private const val RECENT_WRITE_INTERVAL_MS = 60_000L
    }
}
