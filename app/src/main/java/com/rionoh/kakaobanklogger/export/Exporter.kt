package com.rionoh.kakaobanklogger.export

import android.content.Context
import android.content.Intent
import androidx.core.content.FileProvider
import com.rionoh.kakaobanklogger.data.NotificationRecord
import com.rionoh.kakaobanklogger.forward.Payload
import com.rionoh.kakaobanklogger.parser.TxType
import org.json.JSONArray
import org.json.JSONObject
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

/**
 * 수집 기록을 JSON/CSV 파일로 만들어 공유 시트(Drive, Gmail, 카카오톡 등)로 보낸다.
 * 웹훅을 쓰지 않아도 이 경로로 Claude 에게 파일을 전달할 수 있다.
 */
object Exporter {

    enum class Format(val ext: String, val mime: String) {
        JSON("json", "application/json"),
        CSV("csv", "text/csv")
    }

    fun toJson(records: List<NotificationRecord>): String {
        val arr = JSONArray()
        records.forEach { r ->
            val type = TxType.fromName(r.txType)
            arr.put(JSONObject().apply {
                put("id", r.id)
                put("package", r.packageName)
                put("posted_at", Payload.isoTime(r.postedAt))
                put("captured_at", Payload.isoTime(r.capturedAt))
                put("title", r.title ?: JSONObject.NULL)
                put("text", r.text ?: JSONObject.NULL)
                put("big_text", r.bigText ?: JSONObject.NULL)
                put("sub_text", r.subText ?: JSONObject.NULL)
                put("tx_type", type.name)
                put("tx_type_ko", type.label)
                put("amount", r.amount ?: JSONObject.NULL)
                put("balance", r.balance ?: JSONObject.NULL)
                put("counterparty", r.counterparty ?: JSONObject.NULL)
                put("forwarded_at", r.forwardedAt?.let { Payload.isoTime(it) } ?: JSONObject.NULL)
                put("dedupe_key", r.dedupeKey)
            })
        }
        return arr.toString(2)
    }

    fun toCsv(records: List<NotificationRecord>): String {
        val sb = StringBuilder()
        // Excel 한글 깨짐 방지용 BOM
        sb.append('﻿')
        sb.append(
            listOf(
                "id", "posted_at", "tx_type_ko", "amount", "counterparty", "balance",
                "title", "text", "big_text", "package", "forwarded_at"
            ).joinToString(",")
        ).append("\r\n")
        records.forEach { r ->
            sb.append(
                listOf(
                    r.id.toString(),
                    Payload.isoTime(r.postedAt),
                    TxType.fromName(r.txType).label,
                    r.amount?.toString() ?: "",
                    r.counterparty ?: "",
                    r.balance?.toString() ?: "",
                    r.title ?: "",
                    r.text ?: "",
                    r.bigText ?: "",
                    r.packageName,
                    r.forwardedAt?.let { Payload.isoTime(it) } ?: ""
                ).joinToString(",") { csvEscape(it) }
            ).append("\r\n")
        }
        return sb.toString()
    }

    fun csvEscape(s: String): String {
        val needsQuote = s.any { it == ',' || it == '"' || it == '\n' || it == '\r' }
        val escaped = s.replace("\"", "\"\"")
        return if (needsQuote) "\"$escaped\"" else escaped
    }

    /** 파일을 캐시에 쓰고 공유 인텐트를 띄운다. */
    fun share(context: Context, records: List<NotificationRecord>, format: Format) {
        val content = when (format) {
            Format.JSON -> toJson(records)
            Format.CSV -> toCsv(records)
        }
        val dir = File(context.cacheDir, "exports").apply { mkdirs() }
        val stamp = LocalDateTime.now().format(DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss"))
        val file = File(dir, "kakaobank-notifications-$stamp.${format.ext}")
        file.writeText(content, Charsets.UTF_8)

        val uri = FileProvider.getUriForFile(context, "${context.packageName}.fileprovider", file)
        val send = Intent(Intent.ACTION_SEND).apply {
            type = format.mime
            putExtra(Intent.EXTRA_STREAM, uri)
            putExtra(Intent.EXTRA_SUBJECT, file.name)
            addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)
        }
        val chooser = Intent.createChooser(send, "알림 기록 내보내기").apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        context.startActivity(chooser)
    }
}
