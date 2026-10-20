package com.rionoh.banknoti

data class BankRecord(
    val id: Long = 0,
    val receivedAt: Long,
    val postTime: Long,
    val packageName: String,
    val notificationKey: String,
    val title: String,
    val body: String,
    val subText: String,
    val type: NotificationParser.TxType,
    val amount: Long?,
    val balance: Long?,
)
