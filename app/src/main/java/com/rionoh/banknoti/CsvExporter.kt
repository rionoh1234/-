package com.rionoh.banknoti

import java.io.OutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object CsvExporter {
    private val HEADER = listOf("알림시각", "수신시각", "구분", "금액", "잔액", "제목", "내용", "부가정보", "앱")

    fun write(records: List<BankRecord>, out: OutputStream) {
        val fmt = SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.KOREA)
        out.bufferedWriter(Charsets.UTF_8).use { w ->
            w.write(0xFEFF) // 엑셀에서 한글이 깨지지 않도록 BOM 추가
            w.write(HEADER.joinToString(",") { escape(it) })
            w.write("\r\n")
            records.forEach { r ->
                val row = listOf(
                    fmt.format(Date(r.postTime)),
                    fmt.format(Date(r.receivedAt)),
                    r.type.label,
                    r.amount?.toString().orEmpty(),
                    r.balance?.toString().orEmpty(),
                    r.title,
                    r.body,
                    r.subText,
                    r.packageName,
                )
                w.write(row.joinToString(",") { escape(it) })
                w.write("\r\n")
            }
        }
    }

    fun escape(value: String): String {
        // 수식 주입 방지: 엑셀이 =,+,-,@ 로 시작하는 셀을 수식으로 해석하지 않도록 한다.
        val safe = if (value.isNotEmpty() && value[0] in "=+-@") "'$value" else value
        return "\"" + safe.replace("\"", "\"\"") + "\""
    }
}
