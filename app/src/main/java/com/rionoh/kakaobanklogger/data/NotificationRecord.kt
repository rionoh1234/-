package com.rionoh.kakaobanklogger.data

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

/**
 * 수집된 알림 1건.
 *
 * 원문(title/text/bigText)은 항상 그대로 보관하고,
 * 파싱 결과(txType/amount/balance/counterparty)는 보조 정보로만 취급한다.
 */
@Entity(
    tableName = "notifications",
    indices = [Index(value = ["dedupeKey"], unique = true), Index(value = ["postedAt"])]
)
data class NotificationRecord(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val packageName: String,
    val title: String?,
    val text: String?,
    val bigText: String?,
    val subText: String?,
    /** 알림이 게시된 시각 (epoch ms, 기기 시계 기준) */
    val postedAt: Long,
    /** 앱이 알림을 수집한 시각 (epoch ms) */
    val capturedAt: Long,
    /** 중복 수집 방지용 해시 */
    val dedupeKey: String,
    /** DEPOSIT / WITHDRAWAL / CARD / TRANSFER / UNKNOWN */
    val txType: String,
    val amount: Long?,
    val balance: Long?,
    val counterparty: String?,
    /** 내 계좌 표시명(추정). 예: "개인사업자통장(7607)" */
    val account: String? = null,
    /** 웹훅 전송 완료 시각. null 이면 미전송 */
    val forwardedAt: Long? = null,
    val forwardAttempts: Int = 0,
    val lastError: String? = null
)
