/**
 * 카뱅 알림 기록기 → Google 스프레드시트 수신기
 *
 * 설치 방법은 같은 폴더의 README.md 를 참고하세요.
 * - 스프레드시트에 "컨테이너 바인딩"된 Apps Script 로 사용합니다.
 * - 스크립트 속성(Project Settings > Script properties)에 SECRET 을 저장합니다.
 *   값은 앱 설정 화면의 "비밀키"와 동일해야 합니다.
 */

var SHEET_NAME = '알림기록';

var HEADERS = [
  'received_at',      // 시트에 기록된 시각 (서버 기준)
  'posted_at',        // 알림 게시 시각 (기기 기준, ISO 8601)
  'tx_type_ko',       // 입금/출금/카드/이체/기타 (추정)
  'amount',           // 거래 금액 (추정)
  'counterparty',     // 상대방 (추정)
  'balance',          // 잔액 (추정)
  'title',            // 알림 제목 원문
  'text',             // 알림 본문 원문
  'big_text',         // 확장 본문 원문
  'package',          // 앱 패키지명
  'device',
  'event',            // notification / test
  'dedupe_key'        // 중복 방지 키
];

function doPost(e) {
  try {
    var secret = PropertiesService.getScriptProperties().getProperty('SECRET');
    if (!secret) {
      return json_({ ok: false, error: 'SECRET script property is not set' });
    }
    if (!e || !e.postData || !e.postData.contents) {
      return json_({ ok: false, error: 'empty body' });
    }
    var body = JSON.parse(e.postData.contents);
    if (body.secret !== secret) {
      return json_({ ok: false, error: 'unauthorized' });
    }

    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      var sheet = getSheet_();
      if (body.dedupe_key && alreadyLogged_(sheet, body.dedupe_key)) {
        return json_({ ok: true, duplicate: true });
      }
      sheet.appendRow([
        new Date(),
        body.posted_at || '',
        body.tx_type_ko || '',
        body.amount === null || body.amount === undefined ? '' : body.amount,
        body.counterparty || '',
        body.balance === null || body.balance === undefined ? '' : body.balance,
        body.title || '',
        body.text || '',
        body.big_text || '',
        body['package'] || '',
        body.device || '',
        body.event || '',
        body.dedupe_key || ''
      ]);
    } finally {
      lock.releaseLock();
    }
    return json_({ ok: true });
  } catch (err) {
    return json_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  return json_({ ok: true, service: 'kakaobank-noti-logger', sheet: SHEET_NAME });
}

function getSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function alreadyLogged_(sheet, key) {
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return false;
  var col = HEADERS.indexOf('dedupe_key') + 1;
  var range = sheet.getRange(2, col, lastRow - 1, 1);
  var found = range.createTextFinder(key).matchEntireCell(true).findNext();
  return found !== null;
}

function json_(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** 편집기에서 직접 실행해 시트/헤더를 미리 만들어 볼 수 있습니다. */
function setupSheet() {
  getSheet_();
}
