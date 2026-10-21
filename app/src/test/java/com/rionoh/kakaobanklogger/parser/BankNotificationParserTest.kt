package com.rionoh.kakaobanklogger.parser

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

/**
 * 주의: 아래 문구는 파서의 동작을 검증하기 위한 "가상의" 예시이며,
 * 실제 카카오뱅크 알림 문구와 동일하다고 보장하지 않는다(확인 필요).
 * 실제 기기에서 수집한 원문을 확보하면 그 문구로 테스트를 교체해야 한다.
 */
class BankNotificationParserTest {

    @Test
    fun deposit_with_balance_in_one_line() {
        val p = BankNotificationParser.parse("카카오뱅크", "입금 50,000원 홍길동 잔액 1,234,567원", null)
        assertEquals(TxType.DEPOSIT, p.txType)
        assertEquals(50_000L, p.amount)
        assertEquals(1_234_567L, p.balance)
        assertEquals("홍길동", p.counterparty)
    }

    @Test
    fun withdrawal_with_separators() {
        val p = BankNotificationParser.parse("출금 12,000원", "GS25 강남점 | 잔액 980,000원", null)
        assertEquals(TxType.WITHDRAWAL, p.txType)
        assertEquals(12_000L, p.amount)
        assertEquals(980_000L, p.balance)
        assertEquals("GS25 강남점", p.counterparty)
    }

    @Test
    fun deposit_sentence_style_without_balance() {
        val p = BankNotificationParser.parse("카카오뱅크", "김철수님이 300,000원을 보냈어요", null)
        assertEquals(TxType.UNKNOWN, p.txType) // "입금/출금" 키워드가 없으므로 추정 불가
        assertEquals(300_000L, p.amount)
        assertNull(p.balance)
        assertEquals("김철수", p.counterparty)
    }

    @Test
    fun big_text_is_preferred_over_short_text() {
        val p = BankNotificationParser.parse(
            "카카오뱅크",
            "입금 알림",
            "입금 1,000원\n박영희\n잔액 50,000원"
        )
        assertEquals(TxType.DEPOSIT, p.txType)
        assertEquals(1_000L, p.amount)
        assertEquals(50_000L, p.balance)
        assertEquals("박영희", p.counterparty)
    }

    @Test
    fun amount_is_not_confused_with_balance() {
        val p = BankNotificationParser.parse("카카오뱅크", "잔액 2,000,000원 출금 5,000원 스타벅스", null)
        assertEquals(TxType.WITHDRAWAL, p.txType)
        assertEquals(5_000L, p.amount)
        assertEquals(2_000_000L, p.balance)
        assertEquals("스타벅스", p.counterparty)
    }

    @Test
    fun unparseable_text_still_returns_record_fields() {
        val p = BankNotificationParser.parse("카카오뱅크", "새로운 알림이 도착했습니다", null)
        assertEquals(TxType.UNKNOWN, p.txType)
        assertNull(p.amount)
        assertNull(p.balance)
    }

    @Test
    fun card_payment_keyword() {
        val p = BankNotificationParser.parse("체크카드 승인", "7,900원 커피빈 10/20 14:03", null)
        assertEquals(TxType.CARD, p.txType)
        assertEquals(7_900L, p.amount)
        assertEquals("커피빈", p.counterparty)
    }

    @Test
    fun plain_number_without_commas() {
        val p = BankNotificationParser.parse(null, "입금 1500000원 월세 잔액 3000000원", null)
        assertEquals(1_500_000L, p.amount)
        assertEquals(3_000_000L, p.balance)
        assertEquals("월세", p.counterparty)
    }
}

/**
 * 실기기에서 캡처한 카카오뱅크 알림 형식(2026-10) 기준 테스트.
 * 출금 형식은 아직 캡처되지 않았으므로 해당 테스트는 가정(확인 필요)이다.
 */
class KakaoBankFormatTest {

    @Test
    fun real_deposit_notification_from_device() {
        val p = BankNotificationParser.parse(
            "입금 1,320,000원",
            "고정숙(천미향) → 개인사업자통장(7607)\n잔액 21,750,269원",
            null
        )
        assertEquals(TxType.DEPOSIT, p.txType)
        assertEquals(1_320_000L, p.amount)
        assertEquals(21_750_269L, p.balance)
        assertEquals("고정숙(천미향)", p.counterparty)
        assertEquals("개인사업자통장(7607)", p.account)
    }

    @Test
    fun real_deposit_when_body_arrives_as_big_text() {
        val p = BankNotificationParser.parse(
            "입금 1,320,000원",
            "고정숙(천미향) → 개인사업자통장(7607)",
            "고정숙(천미향) → 개인사업자통장(7607)\n잔액 21,750,269원"
        )
        assertEquals(1_320_000L, p.amount)
        assertEquals(21_750_269L, p.balance)
        assertEquals("고정숙(천미향)", p.counterparty)
        assertEquals("개인사업자통장(7607)", p.account)
    }

    @Test
    fun assumed_withdrawal_format_account_on_left() {
        // 가정: 출금은 "내 계좌 → 상대방" 으로 표시된다 (확인 필요)
        val p = BankNotificationParser.parse(
            "출금 500,000원",
            "개인사업자통장(7607) → 김영수\n잔액 21,250,269원",
            null
        )
        assertEquals(TxType.WITHDRAWAL, p.txType)
        assertEquals(500_000L, p.amount)
        assertEquals(21_250_269L, p.balance)
        assertEquals("김영수", p.counterparty)
        assertEquals("개인사업자통장(7607)", p.account)
    }

    @Test
    fun withdrawal_with_account_hint_on_right_still_resolves_by_hint() {
        // 힌트("통장")가 오른쪽에 있으면 방향과 무관하게 오른쪽을 내 계좌로 본다
        val p = BankNotificationParser.parse(
            "출금 10,000원",
            "GS25 → 입출금통장(1234)\n잔액 100원",
            null
        )
        assertEquals("GS25", p.counterparty)
        assertEquals("입출금통장(1234)", p.account)
    }

    @Test
    fun arrow_without_any_hint_uses_direction() {
        val deposit = BankNotificationParser.parse("입금 1,000원", "홍길동 → 나", null)
        assertEquals("홍길동", deposit.counterparty)
        assertEquals("나", deposit.account)

        val withdrawal = BankNotificationParser.parse("출금 1,000원", "나 → 홍길동", null)
        assertEquals("홍길동", withdrawal.counterparty)
        assertEquals("나", withdrawal.account)
    }
}
