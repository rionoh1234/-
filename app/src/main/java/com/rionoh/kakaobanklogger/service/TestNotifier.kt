package com.rionoh.kakaobanklogger.service

import android.Manifest
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.content.ContextCompat
import com.rionoh.kakaobanklogger.R

/**
 * 카카오뱅크 알림과 같은 형식의 "테스트 알림"을 이 앱이 직접 띄운다.
 * 리스너 → DB → 웹훅까지 전체 경로를 실제 거래 없이 점검하는 용도.
 * 리스너는 이 채널의 자기 알림만 수집한다.
 */
object TestNotifier {
    const val CHANNEL_ID = "test"
    private const val NOTIFICATION_ID = 1001

    fun hasPermission(context: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            ContextCompat.checkSelfPermission(context, Manifest.permission.POST_NOTIFICATIONS) ==
            PackageManager.PERMISSION_GRANTED

    fun send(context: Context): Boolean {
        if (!hasPermission(context)) return false
        val nm = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(CHANNEL_ID, "테스트 알림", NotificationManager.IMPORTANCE_DEFAULT)
        )
        val amount = 1_000L + (System.currentTimeMillis() % 1000)
        val body = "테스트입금자 → 입출금통장(0000)\n잔액 1,234,567원"
        val notification = NotificationCompat.Builder(context, CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_launcher_foreground)
            .setContentTitle("입금 ${"%,d".format(amount)}원")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .build()
        return try {
            NotificationManagerCompat.from(context).notify(NOTIFICATION_ID, notification)
            true
        } catch (e: SecurityException) {
            false
        }
    }
}
