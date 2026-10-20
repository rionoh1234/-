package com.rionoh.kakaobanklogger.service

import android.app.Notification
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import com.rionoh.kakaobanklogger.data.AppDatabase
import com.rionoh.kakaobanklogger.data.NotificationRecord
import com.rionoh.kakaobanklogger.forward.ForwardScheduler
import com.rionoh.kakaobanklogger.parser.BankNotificationParser
import com.rionoh.kakaobanklogger.settings.SettingsStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel
import kotlinx.coroutines.launch
import java.security.MessageDigest

/**
 * 시스템 알림을 수신하여 설정된 패키지(기본: 카카오뱅크)의 알림만 저장한다.
 *
 * 주의: 이 서비스는 사용자가 "설정 > 알림 접근 허용"에서 직접 켜야 동작한다.
 */
class BankNotificationListener : NotificationListenerService() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    override fun onListenerConnected() {
        super.onListenerConnected()
        ListenerState.setConnected(true)
        Log.i(TAG, "listener connected")
        // 서비스가 꺼져 있던 동안 알림창에 남아 있는 알림을 소급 수집한다(중복은 DB 에서 걸러짐).
        runCatching { activeNotifications }.getOrNull()?.forEach { handle(it) }
    }

    override fun onListenerDisconnected() {
        ListenerState.setConnected(false)
        Log.i(TAG, "listener disconnected")
        super.onListenerDisconnected()
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        handle(sbn)
    }

    private fun handle(sbn: StatusBarNotification) {
        val pkg = sbn.packageName ?: return
        if (pkg == packageName) return // 자기 자신 제외
        ListenerState.setLastSeenPackage(pkg)

        val settings = SettingsStore(this)
        if (!settings.shouldCapture(pkg)) return

        val n = sbn.notification ?: return
        // 그룹 요약 알림은 실제 내용이 없으므로 제외
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val extras = n.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString()?.trim()
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString()?.trim()
        val bigText = extras.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString()?.trim()
        val subText = extras.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString()?.trim()
        val lines = extras.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.joinToString("\n") { it.toString() }
            ?.trim()
        val longText = bigText?.takeIf { it.isNotEmpty() } ?: lines?.takeIf { it.isNotEmpty() }

        if (title.isNullOrEmpty() && text.isNullOrEmpty() && longText.isNullOrEmpty()) return

        val parsed = BankNotificationParser.parse(title, text, longText)
        val now = System.currentTimeMillis()
        val record = NotificationRecord(
            packageName = pkg,
            title = title,
            text = text,
            bigText = longText,
            subText = subText,
            postedAt = sbn.postTime,
            capturedAt = now,
            dedupeKey = dedupeKey(pkg, sbn.postTime, title, text, longText),
            txType = parsed.txType.name,
            amount = parsed.amount,
            balance = parsed.balance,
            counterparty = parsed.counterparty
        )

        scope.launch {
            try {
                val id = AppDatabase.get(applicationContext).notificationDao().insert(record)
                if (id > 0) {
                    Log.i(TAG, "captured id=$id pkg=$pkg type=${record.txType}")
                    if (settings.forwardEnabled) ForwardScheduler.enqueueNow(applicationContext)
                } else {
                    Log.d(TAG, "duplicate ignored pkg=$pkg")
                }
            } catch (t: Throwable) {
                Log.e(TAG, "failed to store notification", t)
            }
        }
    }

    override fun onDestroy() {
        scope.cancel()
        super.onDestroy()
    }

    private fun dedupeKey(pkg: String, postTime: Long, vararg parts: String?): String {
        val raw = buildString {
            append(pkg).append('|').append(postTime)
            parts.forEach { append('|').append(it ?: "") }
        }
        val digest = MessageDigest.getInstance("SHA-256").digest(raw.toByteArray(Charsets.UTF_8))
        return digest.joinToString("") { "%02x".format(it) }
    }

    companion object {
        private const val TAG = "BankNotiListener"
    }
}
