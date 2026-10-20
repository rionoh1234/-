package com.rionoh.kakaobanklogger.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.CheckCircle
import androidx.compose.material.icons.filled.MoreVert
import androidx.compose.material.icons.filled.Settings
import androidx.compose.material.icons.filled.Warning
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.AssistChip
import androidx.compose.material3.Button
import androidx.compose.material3.Card
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.LifecycleResumeEffect
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.rionoh.kakaobanklogger.data.AppDatabase
import com.rionoh.kakaobanklogger.data.NotificationRecord
import com.rionoh.kakaobanklogger.export.Exporter
import com.rionoh.kakaobanklogger.forward.ForwardScheduler
import com.rionoh.kakaobanklogger.parser.TxType
import com.rionoh.kakaobanklogger.service.ListenerState
import com.rionoh.kakaobanklogger.settings.SettingsStore
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun HomeScreen(onOpenSettings: () -> Unit) {
    val context = LocalContext.current
    val dao = remember { AppDatabase.get(context).notificationDao() }
    val settings = remember { SettingsStore(context) }
    val scope = rememberCoroutineScope()
    val snackbar = remember { SnackbarHostState() }

    val records by dao.observeAll().collectAsStateWithLifecycle(initialValue = emptyList())
    val pendingCount by dao.observePendingCount().collectAsStateWithLifecycle(initialValue = 0)
    val connected by ListenerState.connected.collectAsStateWithLifecycle()
    val lastSeenPackage by ListenerState.lastSeenPackage.collectAsStateWithLifecycle()

    var accessGranted by remember { mutableStateOf(ListenerState.isAccessGranted(context)) }
    var batteryIgnored by remember { mutableStateOf(SystemActions.isIgnoringBatteryOptimizations(context)) }
    var forwardEnabled by remember { mutableStateOf(settings.forwardEnabled) }
    var webhookConfigured by remember { mutableStateOf(settings.isWebhookConfigured()) }
    var captureAll by remember { mutableStateOf(settings.captureAllPackages) }

    // 설정 화면/시스템 설정에서 돌아올 때 상태 갱신
    LifecycleResumeEffect(Unit) {
        accessGranted = ListenerState.isAccessGranted(context)
        batteryIgnored = SystemActions.isIgnoringBatteryOptimizations(context)
        forwardEnabled = settings.forwardEnabled
        webhookConfigured = settings.isWebhookConfigured()
        captureAll = settings.captureAllPackages
        onPauseOrDispose { }
    }

    var menuOpen by remember { mutableStateOf(false) }
    var confirmDeleteAll by remember { mutableStateOf(false) }
    var selected by remember { mutableStateOf<NotificationRecord?>(null) }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("카뱅 알림 기록기") },
                actions = {
                    IconButton(onClick = onOpenSettings) {
                        Icon(Icons.Default.Settings, contentDescription = "설정")
                    }
                    IconButton(onClick = { menuOpen = true }) {
                        Icon(Icons.Default.MoreVert, contentDescription = "메뉴")
                    }
                    DropdownMenu(expanded = menuOpen, onDismissRequest = { menuOpen = false }) {
                        DropdownMenuItem(
                            text = { Text("JSON 으로 내보내기") },
                            onClick = {
                                menuOpen = false
                                scope.launch {
                                    val all = withContext(Dispatchers.IO) { dao.getAllOldestFirst() }
                                    if (all.isEmpty()) snackbar.showSnackbar("내보낼 기록이 없습니다")
                                    else Exporter.share(context, all, Exporter.Format.JSON)
                                }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("CSV 로 내보내기") },
                            onClick = {
                                menuOpen = false
                                scope.launch {
                                    val all = withContext(Dispatchers.IO) { dao.getAllOldestFirst() }
                                    if (all.isEmpty()) snackbar.showSnackbar("내보낼 기록이 없습니다")
                                    else Exporter.share(context, all, Exporter.Format.CSV)
                                }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("미전송 건 재시도 초기화") },
                            onClick = {
                                menuOpen = false
                                scope.launch {
                                    withContext(Dispatchers.IO) { dao.resetAllPending() }
                                    ForwardScheduler.enqueueNow(context)
                                    snackbar.showSnackbar("재전송을 요청했습니다")
                                }
                            }
                        )
                        DropdownMenuItem(
                            text = { Text("전체 삭제") },
                            onClick = { menuOpen = false; confirmDeleteAll = true }
                        )
                    }
                }
            )
        },
        snackbarHost = { SnackbarHost(snackbar) }
    ) { padding ->
        LazyColumn(
            modifier = Modifier.fillMaxSize().padding(padding),
            contentPadding = androidx.compose.foundation.layout.PaddingValues(16.dp),
            verticalArrangement = Arrangement.spacedBy(8.dp)
        ) {
            item {
                StatusCard(
                    accessGranted = accessGranted,
                    connected = connected,
                    batteryIgnored = batteryIgnored,
                    forwardEnabled = forwardEnabled,
                    webhookConfigured = webhookConfigured,
                    pendingCount = pendingCount,
                    totalCount = records.size,
                    captureAll = captureAll,
                    lastSeenPackage = lastSeenPackage,
                    onOpenAccess = { SystemActions.openNotificationAccessSettings(context) },
                    onRebind = {
                        SystemActions.requestRebind(context)
                        scope.launch { snackbar.showSnackbar("재연결을 요청했습니다. 안 되면 알림 접근을 껐다 켜 주세요.") }
                    },
                    onBattery = { SystemActions.requestIgnoreBatteryOptimizations(context) },
                    onForwardNow = {
                        ForwardScheduler.enqueueNow(context)
                        scope.launch { snackbar.showSnackbar("전송 작업을 요청했습니다") }
                    },
                    onOpenSettings = onOpenSettings
                )
            }
            if (records.isEmpty()) {
                item {
                    Text(
                        "아직 수집된 알림이 없습니다.\n알림 접근을 허용한 뒤 카카오뱅크 입출금이 발생하면 여기에 표시됩니다.",
                        style = MaterialTheme.typography.bodyMedium,
                        modifier = Modifier.padding(top = 16.dp)
                    )
                }
            }
            items(records, key = { it.id }) { r ->
                RecordRow(r, showPackage = captureAll, onClick = { selected = r })
                HorizontalDivider()
            }
        }
    }

    selected?.let { r ->
        DetailDialog(
            record = r,
            webhookConfigured = webhookConfigured && forwardEnabled,
            onDismiss = { selected = null },
            onResend = {
                scope.launch {
                    withContext(Dispatchers.IO) { dao.resetForward(r.id) }
                    ForwardScheduler.enqueueNow(context)
                    selected = null
                    snackbar.showSnackbar("재전송을 요청했습니다")
                }
            },
            onDelete = {
                scope.launch {
                    withContext(Dispatchers.IO) { dao.deleteById(r.id) }
                    selected = null
                }
            }
        )
    }

    if (confirmDeleteAll) {
        AlertDialog(
            onDismissRequest = { confirmDeleteAll = false },
            title = { Text("전체 삭제") },
            text = { Text("수집된 알림 ${records.size}건을 모두 삭제합니다. 되돌릴 수 없습니다.") },
            confirmButton = {
                TextButton(onClick = {
                    confirmDeleteAll = false
                    scope.launch { withContext(Dispatchers.IO) { dao.deleteAll() } }
                }) { Text("삭제") }
            },
            dismissButton = { TextButton(onClick = { confirmDeleteAll = false }) { Text("취소") } }
        )
    }
}

@Composable
private fun StatusCard(
    accessGranted: Boolean,
    connected: Boolean,
    batteryIgnored: Boolean,
    forwardEnabled: Boolean,
    webhookConfigured: Boolean,
    pendingCount: Int,
    totalCount: Int,
    captureAll: Boolean,
    lastSeenPackage: String?,
    onOpenAccess: () -> Unit,
    onRebind: () -> Unit,
    onBattery: () -> Unit,
    onForwardNow: () -> Unit,
    onOpenSettings: () -> Unit
) {
    Card(modifier = Modifier.fillMaxWidth()) {
        Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
            Text("상태", style = MaterialTheme.typography.titleMedium)

            StatusLine(
                ok = accessGranted,
                label = if (accessGranted) "알림 접근 권한: 허용됨" else "알림 접근 권한: 미허용"
            )
            if (!accessGranted) {
                Button(onClick = onOpenAccess) { Text("알림 접근 허용하러 가기") }
            } else {
                StatusLine(
                    ok = connected,
                    label = if (connected) "리스너 연결: 연결됨" else "리스너 연결: 끊김"
                )
                if (!connected) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        OutlinedButton(onClick = onRebind) { Text("재연결 요청") }
                        OutlinedButton(onClick = onOpenAccess) { Text("권한 화면 열기") }
                    }
                }
            }

            StatusLine(
                ok = batteryIgnored,
                label = if (batteryIgnored) "배터리 최적화: 제외됨" else "배터리 최적화: 적용 중(백그라운드 중단 가능)"
            )
            if (!batteryIgnored) {
                OutlinedButton(onClick = onBattery) { Text("배터리 최적화 제외 요청") }
            }

            val forwardLabel = when {
                !forwardEnabled -> "웹훅 전송: 꺼짐 (기록만 보관)"
                !webhookConfigured -> "웹훅 전송: 켜짐이나 URL/비밀키 미설정"
                else -> "웹훅 전송: 켜짐 · 미전송 ${pendingCount}건"
            }
            StatusLine(ok = !forwardEnabled || webhookConfigured, label = forwardLabel)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                if (forwardEnabled && webhookConfigured) {
                    OutlinedButton(onClick = onForwardNow) { Text("지금 전송") }
                }
                OutlinedButton(onClick = onOpenSettings) { Text("전송 설정") }
            }

            Text("총 수집 ${totalCount}건", style = MaterialTheme.typography.bodyMedium)
            if (captureAll) {
                Text(
                    "⚠ 모든 앱 알림 수집(디버그) 모드가 켜져 있습니다. 마지막 수신 패키지: ${lastSeenPackage ?: "-"}",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun StatusLine(ok: Boolean, label: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Icon(
            imageVector = if (ok) Icons.Default.CheckCircle else Icons.Default.Warning,
            contentDescription = null,
            tint = if (ok) MaterialTheme.colorScheme.primary else MaterialTheme.colorScheme.error
        )
        Spacer(Modifier.width(8.dp))
        Text(label, style = MaterialTheme.typography.bodyMedium)
    }
}

@Composable
private fun RecordRow(r: NotificationRecord, showPackage: Boolean, onClick: () -> Unit) {
    val type = TxType.fromName(r.txType)
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(vertical = 8.dp)
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            AssistChip(onClick = onClick, label = { Text(type.label) })
            Spacer(Modifier.width(8.dp))
            Text(
                Format.won(r.amount),
                style = MaterialTheme.typography.titleMedium,
                fontWeight = FontWeight.SemiBold
            )
            Spacer(Modifier.weight(1f))
            Text(Format.shortTime(r.postedAt), style = MaterialTheme.typography.bodySmall)
            Spacer(Modifier.width(6.dp))
            when {
                r.forwardedAt != null -> Icon(
                    Icons.Default.CheckCircle, contentDescription = "전송됨",
                    tint = MaterialTheme.colorScheme.primary
                )
                r.lastError != null -> Icon(
                    Icons.Default.Warning, contentDescription = "전송 실패",
                    tint = MaterialTheme.colorScheme.error
                )
            }
        }
        Spacer(Modifier.height(4.dp))
        val line = listOfNotNull(
            r.counterparty,
            r.balance?.let { "잔액 ${Format.won(it)}" }
        ).joinToString(" · ")
        if (line.isNotEmpty()) Text(line, style = MaterialTheme.typography.bodyMedium)
        val preview = (r.bigText ?: r.text ?: r.title ?: "").replace('\n', ' ')
        if (preview.isNotEmpty()) {
            Text(
                preview.take(80),
                style = MaterialTheme.typography.bodySmall,
                color = MaterialTheme.colorScheme.onSurfaceVariant
            )
        }
        if (showPackage) {
            Text(r.packageName, style = MaterialTheme.typography.labelSmall)
        }
    }
}
