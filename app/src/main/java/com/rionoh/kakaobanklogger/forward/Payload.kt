package com.rionoh.kakaobanklogger.forward

import android.os.Build
import com.rionoh.kakaobanklogger.BuildConfig
import com.rionoh.kakaobanklogger.data.NotificationRecord
import com.rionoh.kakaobanklogger.parser.TxType
import org.json.JSONObject
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter

/** 웹훅으로 보낼 JSON 본문을 만든다. */
object Payload {

    private val ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME

    fun isoTime(epochMs: Long): String =
        Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).format(ISO)

    fun fromRecord(record: NotificationRecord, secret: String): JSONObject {
        val type = TxType.fromName(record.txType)
        return JSONObject().apply {
            put("secret", secret)
            put("source", "android-notification-listener")
            put("event", "notification")
            put("id", record.id)
            put("dedupe_key", record.dedupeKey)
            put("package", record.packageName)
            put("posted_at", isoTime(record.postedAt))
            put("posted_at_epoch_ms", record.postedAt)
            put("captured_at", isoTime(record.capturedAt))
            put("title", record.title ?: JSONObject.NULL)
            put("text", record.text ?: JSONObject.NULL)
            put("big_text", record.bigText ?: JSONObject.NULL)
            put("sub_text", record.subText ?: JSONObject.NULL)
            put("tx_type", type.name)
            put("tx_type_ko", type.label)
            put("amount", record.amount ?: JSONObject.NULL)
            put("balance", record.balance ?: JSONObject.NULL)
            put("counterparty", record.counterparty ?: JSONObject.NULL)
            put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("app_version", BuildConfig.VERSION_NAME)
        }
    }

    /** 설정 화면의 "테스트 전송"용 */
    fun test(secret: String): JSONObject {
        val now = System.currentTimeMillis()
        return JSONObject().apply {
            put("secret", secret)
            put("source", "android-notification-listener")
            put("event", "test")
            put("id", 0)
            put("dedupe_key", "test-$now")
            put("package", "test")
            put("posted_at", isoTime(now))
            put("posted_at_epoch_ms", now)
            put("captured_at", isoTime(now))
            put("title", "테스트")
            put("text", "웹훅 연결 테스트 메시지입니다.")
            put("big_text", JSONObject.NULL)
            put("sub_text", JSONObject.NULL)
            put("tx_type", "UNKNOWN")
            put("tx_type_ko", "기타")
            put("amount", JSONObject.NULL)
            put("balance", JSONObject.NULL)
            put("counterparty", JSONObject.NULL)
            put("device", "${Build.MANUFACTURER} ${Build.MODEL}")
            put("app_version", BuildConfig.VERSION_NAME)
        }
    }
}
