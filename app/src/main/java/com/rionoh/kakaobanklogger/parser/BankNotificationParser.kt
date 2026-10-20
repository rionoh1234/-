package com.rionoh.kakaobanklogger.parser

/**
 * 거래 유형.
 * 알림 문구의 키워드로만 추정하므로 "확정" 정보가 아니다. 원문을 함께 보관한다.
 */
enum class TxType(val label: String) {
    DEPOSIT("입금"),
    WITHDRAWAL("출금"),
    CARD("카드"),
    TRANSFER("이체"),
    UNKNOWN("기타");

    companion object {
        fun fromName(name: String?): TxType =
            entries.firstOrNull { it.name == name } ?: UNKNOWN
    }
}

data class ParsedTransaction(
    val txType: TxType,
    val amount: Long?,
    val balance: Long?,
    val counterparty: String?
)

/**
 * 은행 알림 문구를 느슨하게 파싱한다.
 *
 * 설계 원칙
 * 1. 카카오뱅크 알림의 정확한 문구 형식은 기기에서 수집한 원문으로 확인해야 한다(확인 필요).
 *    따라서 특정 형식을 가정하지 않고 "금액(원)", "잔액", "입금/출금" 같은 보편적 토큰만 사용한다.
 * 2. 파싱에 실패해도 수집 자체는 실패하지 않는다(모든 필드는 nullable, 유형은 UNKNOWN).
 */
object BankNotificationParser {

    // "50,000원", "50000원", "50,000 원"
    private val AMOUNT = Regex("""(?<![\d,])(\d{1,3}(?:,\d{3})+|\d+)\s*원""")

    // "잔액 1,234,567원", "잔액: 1,234,567원", "잔액1234567원"
    private val BALANCE = Regex("""잔액\s*[:：]?\s*(\d{1,3}(?:,\d{3})+|\d+)\s*원""")

    private val SEPARATORS = Regex("""[\n|/·•→←>]+""")

    // 상대방 후보 토큰에서 제거할 접미사/키워드 (긴 단어를 먼저 둔다)
    private val STRIP_WORDS = listOf(
        "카카오뱅크", "입출금통장", "내 계좌", "체크카드", "입금", "출금", "이체", "송금", "결제", "승인", "취소",
        "카드", "잔액", "통장", "알림",
        "보냈어요", "보냈습니다", "받았어요", "받았습니다", "되었습니다", "됐습니다", "됐어요",
        "했어요", "했습니다", "완료", "님이", "님께서", "님께", "님"
    )

    // 단독 토큰으로 남은 조사는 버린다
    private val STOP_TOKENS = setOf("을", "를", "이", "가", "은", "는", "에", "에서", "으로", "로", "의", "및", "과", "와")

    fun parse(title: String?, text: String?, bigText: String?): ParsedTransaction {
        // bigText 가 text 를 포함하는 경우가 많으므로 가장 긴 본문을 우선 사용
        val body = listOfNotNull(bigText, text).maxByOrNull { it.length } ?: ""
        val all = listOfNotNull(title, body).joinToString("\n")

        val balanceMatch = BALANCE.find(all)
        val balance = balanceMatch?.groupValues?.get(1)?.toAmountOrNull()

        // 잔액 구간과 겹치지 않는 첫 번째 금액을 거래 금액으로 본다
        val amount = AMOUNT.findAll(all)
            .firstOrNull { m -> balanceMatch == null || !m.range.overlaps(balanceMatch.range) }
            ?.groupValues?.get(1)?.toAmountOrNull()

        val txType = detectType(all)
        val counterparty = extractCounterparty(all, balanceMatch)

        return ParsedTransaction(txType, amount, balance, counterparty)
    }

    fun detectType(s: String): TxType = when {
        s.contains("입금") -> TxType.DEPOSIT
        s.contains("출금") -> TxType.WITHDRAWAL
        Regex("""체크카드|카드\s*결제|결제|승인""").containsMatchIn(s) -> TxType.CARD
        Regex("""이체|송금""").containsMatchIn(s) -> TxType.TRANSFER
        else -> TxType.UNKNOWN
    }

    private fun extractCounterparty(all: String, balanceMatch: MatchResult?): String? {
        var s = all
        if (balanceMatch != null) s = s.replace(balanceMatch.value, " ")
        s = AMOUNT.replace(s, " ")
        // 날짜/시간 토큰 제거 (예: 10/20 14:03, 2026.10.20)
        s = s.replace(Regex("""\d{1,4}[./-]\d{1,2}([./-]\d{1,4})?"""), " ")
        s = s.replace(Regex("""\d{1,2}:\d{2}(:\d{2})?"""), " ")
        s = s.replace(Regex("""[\[\]()【】]"""), " ")

        val candidates = s.split(SEPARATORS)
            .map { tok ->
                var t = tok.trim()
                for (w in STRIP_WORDS) t = t.replace(w, " ")
                t.split(' ')
                    .map { it.trim('-', ':', ',', '.', ' ') }
                    .filter { it.isNotEmpty() && it !in STOP_TOKENS }
                    .joinToString(" ")
            }
            .filter { it.isNotBlank() && it.any { c -> c.isLetter() } }

        // 가장 짧고 의미 있는(2~30자) 토큰을 상대방으로 추정
        return candidates
            .filter { it.length in 2..30 }
            .minByOrNull { it.length }
            ?: candidates.firstOrNull()?.take(40)
    }

    private fun String.toAmountOrNull(): Long? = replace(",", "").toLongOrNull()

    private fun IntRange.overlaps(other: IntRange): Boolean =
        first <= other.last && other.first <= last
}
