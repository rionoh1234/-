package com.rionoh.kakaobanklogger.service

import android.content.ComponentName
import android.content.Context
import androidx.core.app.NotificationManagerCompat
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow

/** 리스너 서비스의 연결 상태를 UI 에 노출한다. */
object ListenerState {
    private val _connected = MutableStateFlow(false)
    val connected: StateFlow<Boolean> = _connected

    /** 마지막으로 어떤 패키지의 알림을 봤는지(패키지명 확인용) */
    private val _lastSeenPackage = MutableStateFlow<String?>(null)
    val lastSeenPackage: StateFlow<String?> = _lastSeenPackage

    internal fun setConnected(value: Boolean) { _connected.value = value }
    internal fun setLastSeenPackage(pkg: String) { _lastSeenPackage.value = pkg }

    /** 사용자가 "알림 접근 허용"을 켰는지 */
    fun isAccessGranted(context: Context): Boolean =
        NotificationManagerCompat.getEnabledListenerPackages(context).contains(context.packageName)

    fun componentName(context: Context): ComponentName =
        ComponentName(context, BankNotificationListener::class.java)
}
