package com.rionoh.kakaobanklogger.ui

import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.unit.dp
import com.rionoh.kakaobanklogger.data.NotificationRecord
import com.rionoh.kakaobanklogger.parser.TxType

@Composable
fun DetailDialog(
    record: NotificationRecord,
    webhookConfigured: Boolean,
    onDismiss: () -> Unit,
    onResend: () -> Unit,
    onDelete: () -> Unit
) {
    val clipboard = LocalClipboardManager.current
    val type = TxType.fromName(record.txType)
    val raw = buildString {
        appendLine("package: ${record.packageName}")
        appendLine("posted_at: ${Format.fullTime(record.postedAt)}")
        appendLine("title: ${record.title ?: ""}")
        appendLine("text: ${record.text ?: ""}")
        appendLine("big_text: ${record.bigText ?: ""}")
        appendLine("sub_text: ${record.subText ?: ""}")
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("${type.label} ${Format.won(record.amount)}") },
        text = {
            Column(modifier = Modifier.verticalScroll(rememberScrollState())) {
                Field("시각", Format.fullTime(record.postedAt))
                Field("상대방", record.counterparty ?: "-")
                Field("내 계좌", record.account ?: "-")
                Field("잔액", Format.won(record.balance))
                Field(
                    "전송 상태",
                    when {
                        record.forwardedAt != null -> "전송됨 (${Format.fullTime(record.forwardedAt)})"
                        record.lastError != null -> "실패 ${record.forwardAttempts}회: ${record.lastError}"
                        else -> "미전송"
                    }
                )
                Spacer(Modifier.height(8.dp))
                Text("원문", style = MaterialTheme.typography.labelLarge)
                Text(raw, style = MaterialTheme.typography.bodySmall)
                Spacer(Modifier.height(4.dp))
                Text(
                    "※ 유형·금액·상대방·계좌는 알림 문구에서 추출한 값입니다. 원문을 기준으로 확인하세요.",
                    style = MaterialTheme.typography.labelSmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant
                )
            }
        },
        confirmButton = {
            Row {
                TextButton(onClick = { clipboard.setText(AnnotatedString(raw)) }) { Text("원문 복사") }
                if (webhookConfigured) TextButton(onClick = onResend) { Text("재전송") }
                TextButton(onClick = onDelete) { Text("삭제") }
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("닫기") } }
    )
}

@Composable
private fun Field(label: String, value: String) {
    Text(label, style = MaterialTheme.typography.labelLarge)
    Text(value, style = MaterialTheme.typography.bodyMedium)
    Spacer(Modifier.height(6.dp))
}
