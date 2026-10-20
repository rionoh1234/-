package com.rionoh.banknoti

import com.rionoh.banknoti.NotificationParser.TxType
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

// 아래 문구는 실제 카카오뱅크 알림이 아닌, 범용 규칙 검증용 임의 문구다.
class NotificationParserTest {

    @Test fun depositWithBalance() {
        val r = NotificationParser.parse("입금 50,000원", "홍길동 → 내 통장\n잔액 1,250,000원")
        assertEquals(TxType.DEPOSIT, r.type)
        assertEquals(50_000L, r.amount)
        assertEquals(1_250_000L, r.balance)
    }

    @Test fun balanceBeforeAmountIsNotTakenAsAmount() {
        val r = NotificationParser.parse("출금 알림", "잔액: 300,000원 | 출금 20,000원")
        assertEquals(TxType.WITHDRAWAL, r.type)
        assertEquals(20_000L, r.amount)
        assertEquals(300_000L, r.balance)
    }

    @Test fun cancelTakesPrecedence() {
        assertEquals(TxType.CANCEL, NotificationParser.parse("결제 취소", "8,900원").type)
    }

    @Test fun earliestKeywordWins() {
        assertEquals(TxType.DEPOSIT, NotificationParser.parse(null, "입금 완료(출금계좌 확인)").type)
    }

    @Test fun paymentAndNoCommaAmount() {
        val r = NotificationParser.parse("체크카드 승인", "4500원 편의점")
        assertEquals(TxType.PAYMENT, r.type)
        assertEquals(4_500L, r.amount)
        assertNull(r.balance)
    }

    @Test fun unknownTextKeepsNulls() {
        val r = NotificationParser.parse("이벤트 안내", "새로운 혜택을 확인하세요")
        assertEquals(TxType.OTHER, r.type)
        assertNull(r.amount)
        assertNull(r.balance)
    }

    @Test fun csvEscape() {
        assertEquals("\"a\"\"b\"", CsvExporter.escape("a\"b"))
        assertEquals("\"'=SUM(A1)\"", CsvExporter.escape("=SUM(A1)"))
    }
}
