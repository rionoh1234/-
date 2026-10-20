package com.rionoh.banknoti

/**
 * 은행 알림 문구에서 거래 구분·금액·잔액을 추출한다.
 *
 * 카카오뱅크 알림의 공식 문구 형식은 확인되지 않았으므로, 특정 형식을 가정하지 않는
 * 범용 규칙만 사용한다. 원문은 항상 별도로 저장되므로 추출 실패 시에도 정보는 남는다.
 */
object NotificationParser {

    enum class TxType(val label: String) {
        DEPOSIT("입금"),
        WITHDRAWAL("출금"),
        PAYMENT("결제"),
        CANCEL("취소"),
        OTHER("기타");

        companion object {
            fun fromName(name: String?): TxType = entries.firstOrNull { it.name == name } ?: OTHER
        }
    }

    data class Result(val type: TxType, val amount: Long?, val balance: Long?)

    private const val NUMBER = """([0-9]{1,3}(?:,[0-9]{3})+|[0-9]+)"""
    private val AMOUNT = Regex("""$NUMBER\s*원""")
    private val BALANCE = Regex("""잔액\s*[:：]?\s*$NUMBER\s*원""")

    // 취소는 다른 키워드와 함께 나오는 경우가 많아(예: "결제 취소") 최우선으로 본다.
    private val KEYWORDS = listOf(
        TxType.DEPOSIT to listOf("입금"),
        TxType.WITHDRAWAL to listOf("출금", "송금", "이체"),
        TxType.PAYMENT to listOf("결제", "승인"),
    )

    fun parse(title: String?, body: String?): Result {
        val text = listOfNotNull(title, body).joinToString("\n")
        return Result(detectType(text), detectAmount(text), detectBalance(text))
    }

    private fun detectType(text: String): TxType {
        if (text.contains("취소")) return TxType.CANCEL
        // 여러 키워드가 섞여 있으면 문장에서 가장 먼저 나온 것을 따른다.
        return KEYWORDS
            .mapNotNull { (type, words) ->
                words.map { text.indexOf(it) }.filter { it >= 0 }.minOrNull()?.let { type to it }
            }
            .minByOrNull { it.second }
            ?.first ?: TxType.OTHER
    }

    private fun detectBalance(text: String): Long? =
        BALANCE.find(text)?.groupValues?.get(1)?.toWon()

    private fun detectAmount(text: String): Long? {
        val balanceRange = BALANCE.find(text)?.range
        return AMOUNT.findAll(text)
            .firstOrNull { m -> balanceRange == null || m.range.first !in balanceRange }
            ?.groupValues?.get(1)?.toWon()
    }

    private fun String.toWon(): Long? = replace(",", "").toLongOrNull()
}
