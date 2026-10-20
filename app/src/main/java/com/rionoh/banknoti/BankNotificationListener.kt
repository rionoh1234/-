package com.rionoh.banknoti

import android.app.Notification
import android.content.ComponentName
import android.content.Context
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.util.concurrent.Executors

class BankNotificationListener : NotificationListenerService() {

    private val io = Executors.newSingleThreadExecutor()

    override fun onListenerConnected() {
        // 서비스가 끊겨 있던 동안 올라와 아직 떠 있는 알림을 회수한다. 중복은 DB 제약으로 걸러진다.
        val active = runCatching { activeNotifications }.getOrNull().orEmpty()
        active.forEach { handle(it, touchRecent = false) }
    }

    override fun onListenerDisconnected() {
        requestRebind(ComponentName(this, BankNotificationListener::class.java))
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) = handle(sbn, touchRecent = true)

    override fun onDestroy() {
        io.shutdown()
        super.onDestroy()
    }

    private fun handle(sbn: StatusBarNotification, touchRecent: Boolean) {
        val prefs = Prefs(this)
        val now = System.currentTimeMillis()
        if (touchRecent) prefs.touchRecentPackage(sbn.packageName, now)

        val isTarget = sbn.packageName in prefs.targetPackages ||
            (prefs.testMode && sbn.packageName == packageName)
        if (!isTarget) return

        val n = sbn.notification
        // 묶음 요약 알림은 개별 알림과 내용이 겹치므로 제외한다.
        if (n.flags and Notification.FLAG_GROUP_SUMMARY != 0) return

        val content = extractContent(n)
        if (content.title.isBlank() && content.body.isBlank()) return

        val parsed = NotificationParser.parse(content.title, content.body)
        val record = BankRecord(
            receivedAt = now,
            postTime = sbn.postTime,
            packageName = sbn.packageName,
            notificationKey = sbn.key,
            title = content.title,
            body = content.body,
            subText = content.subText,
            type = parsed.type,
            amount = parsed.amount,
            balance = parsed.balance,
        )
        val ctx: Context = applicationContext
        io.execute {
            runCatching { RecordDb.get(ctx).insert(record) }
                .onFailure { Log.e(TAG, "기록 저장 실패", it) }
        }
    }

    private data class Content(val title: String, val body: String, val subText: String)

    private fun extractContent(n: Notification): Content {
        val e = n.extras
        val title = e.getCharSequence(Notification.EXTRA_TITLE)?.toString().orEmpty()
        val text = e.getCharSequence(Notification.EXTRA_TEXT)?.toString().orEmpty()
        val bigText = e.getCharSequence(Notification.EXTRA_BIG_TEXT)?.toString().orEmpty()
        val lines = e.getCharSequenceArray(Notification.EXTRA_TEXT_LINES)
            ?.joinToString("\n") { it.toString() }.orEmpty()
        val subText = e.getCharSequence(Notification.EXTRA_SUB_TEXT)?.toString().orEmpty()

        // 펼친 본문(bigText)이 있으면 그것이 가장 완전하다. 없으면 InboxStyle 줄, 마지막으로 기본 본문.
        val body = when {
            bigText.isNotBlank() -> bigText
            lines.isNotBlank() -> lines
            else -> text
        }
        return Content(title.trim(), body.trim(), subText.trim())
    }

    companion object {
        private const val TAG = "BankNotiListener"
    }
}
