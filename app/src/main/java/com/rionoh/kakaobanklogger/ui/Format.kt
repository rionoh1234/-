package com.rionoh.kakaobanklogger.ui

import java.text.NumberFormat
import java.time.Instant
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale

object Format {
    private val won: NumberFormat = NumberFormat.getIntegerInstance(Locale.KOREA)
    private val shortTime: DateTimeFormatter = DateTimeFormatter.ofPattern("MM/dd HH:mm")
    private val fullTime: DateTimeFormatter = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    fun won(amount: Long?): String = if (amount == null) "-" else won.format(amount) + "원"

    fun shortTime(epochMs: Long): String =
        Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).format(shortTime)

    fun fullTime(epochMs: Long): String =
        Instant.ofEpochMilli(epochMs).atZone(ZoneId.systemDefault()).format(fullTime)
}
