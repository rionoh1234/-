# 카뱅 알림 기록기 (KakaoBank Notification Logger)

안드로이드 폰에 뜨는 **카카오뱅크 입출금 알림을 가로채어 기록**하고,
Google 스프레드시트(웹훅) 또는 파일 내보내기를 통해 **Claude 가 읽을 수 있는 형태로 전달**하는 앱입니다.

> ⚠️ 이 앱은 카카오뱅크와 무관한 개인용 도구입니다. 알림 문구에는 금액·상대방 이름 등
> 금융 정보가 포함되므로 본인 기기·본인 계정에서만 사용하세요.

## 1. 개요

```
[카카오뱅크 앱 알림]
        │  (Android NotificationListenerService)
        ▼
[카뱅 알림 기록기]  ── 로컬 DB(Room) 저장 ── 화면에서 조회 / JSON·CSV 내보내기
        │
        │  (HTTPS POST, JSON, 비밀키 포함)      ← 선택 사항
        ▼
[Google Apps Script 웹앱] ── Google 스프레드시트 "알림기록" 시트에 1행 추가
        │
        ▼
[Claude]  Google Drive 연동으로 시트를 읽어 집계·분석
```

Claude 에게 전달하는 경로는 두 가지입니다.

| 경로 | 방법 | 장점 | 단점 |
|---|---|---|---|
| A. 웹훅(권장) | 앱 → Apps Script → 스프레드시트 → Claude 가 Drive 에서 읽음 | 자동, 실시간에 가까움 | 최초 설정 10분 소요 |
| B. 내보내기 | 앱 메뉴 → JSON/CSV 공유 → Drive·Gmail 로 보냄 → Claude 가 읽음 | 서버 불필요 | 수동 |

## 2. 기능

- 카카오뱅크(`com.kakaobank.channel`) 알림만 선별 수집 (패키지 목록은 설정에서 변경 가능)
- 원문(제목/본문/확장본문) 보존 + 거래유형·금액·잔액·상대방·내 계좌 파싱 (카카오뱅크 실제 형식 기준)
- 중복 수집 방지(해시 기반), 그룹 요약 알림 제외
- 웹훅 전송: WorkManager 로 재시도·15분 주기 보정, 미전송 건 표시·재전송
- JSON / CSV 내보내기(공유 시트)
- 상태 진단: 알림 접근 권한, 리스너 연결, 배터리 최적화, 웹훅 설정 여부
- 테스트 알림 보내기: 카카오뱅크 형식의 가짜 알림으로 수집→저장→전송 경로를 실제 거래 없이 점검 (시트에는 `event=test`)
- 최근 알림을 보낸 앱 목록(앱 이름·패키지명만 기록)에서 탭 한 번으로 수집 대상 추가

## 3. 설치

### 3-1. APK 받기

- 이 저장소의 **GitHub Actions** 에서 최신 빌드의 `kakaobank-noti-logger-debug-apk` 아티팩트를 내려받아 설치합니다.
  (디버그 서명 APK 이므로 "출처를 알 수 없는 앱 설치 허용"이 필요합니다.)
- 또는 Android Studio 로 저장소를 열어 직접 빌드합니다. (`./gradlew assembleDebug`)

### 3-2. 폰에서 설정

1. 앱 실행 → **알림 접근 허용하러 가기** → 목록에서 "카뱅 알림 기록기" 를 켭니다.
2. **배터리 최적화 제외 요청** 을 눌러 허용합니다. (삼성 등 일부 기기는 백그라운드 앱을 강제 종료하므로 필요)
3. 카카오뱅크 앱의 알림(푸시)이 켜져 있어야 합니다. 알림 자체가 오지 않으면 수집할 수 없습니다.

### 3-3. 웹훅(경로 A) 설정

`receiver/google-apps-script/README.md` 의 절차대로 스프레드시트 + Apps Script 웹앱을 만들고,
앱 **설정** 화면에 웹훅 URL 과 비밀키를 입력한 뒤 **테스트 전송** 으로 확인합니다.

## 4. Claude 가 읽는 방법

- 경로 A: Claude 에게 "Google Drive 의 `카카오뱅크 알림기록` 시트를 읽어 이번 달 입금 합계를 정리해줘" 와 같이 요청합니다.
  (Claude 에 Google Drive 연동이 연결되어 있어야 하며, 시트는 같은 Google 계정에 있어야 합니다.)
- 경로 B: 내보낸 JSON/CSV 를 Drive 에 올리거나 Gmail 로 보낸 뒤 같은 방식으로 요청합니다.

시트 열 구성: `received_at, posted_at, tx_type_ko, amount, counterparty, account, balance, title, text, big_text, package, device, event, dedupe_key`

## 5. 알림 형식과 확인이 필요한 사항

**확인된 입금 알림 형식** (2026-10, 실기기 캡처)

```
제목: 입금 1,320,000원
본문: 고정숙(천미향) → 개인사업자통장(7607)
      잔액 21,750,269원
```

파서는 이 형식을 1순위로 처리합니다. 화살표(→) 왼쪽을 상대방, "통장/계좌"가 들어간 쪽을 내 계좌로 기록하고,
금액은 제목에서, 잔액은 본문에서 읽습니다.

**확인 필요**

1. **출금·이체 알림 형식은 아직 캡처되지 않았습니다.** 현재는 "내 계좌 → 상대방" 으로 가정합니다.
   첫 출금 알림이 수집되면 상세 화면의 **원문 복사** 로 문구를 확인해 주세요. 원문은 항상 저장되므로 데이터 유실은 없습니다.
2. 상대방 표기 "고정숙(천미향)" 의 괄호 부분이 입금자 메모인지 상호명인지에 따라 집계 방식이 달라집니다. 현재는 표시된 그대로 저장합니다.
3. 패키지명 `com.kakaobank.channel` 은 Play 스토어 기준입니다. 알림이 전혀 잡히지 않으면
   설정의 **최근 알림을 보낸 앱** 목록에서 "카카오뱅크"를 찾아 탭하면 실제 패키지명이 추가됩니다.

## 6. 보안·개인정보

- 데이터는 기본적으로 기기 내부 DB 에만 저장됩니다. 웹훅을 켜야만 외부로 전송됩니다.
- 웹훅은 HTTPS 만 허용합니다. 비밀키가 일치하지 않는 요청은 Apps Script 가 거부합니다.
- 비밀키는 앱 설정에 평문으로 저장됩니다. 기기 분실 시 Apps Script 의 SECRET 을 바꾸세요.
- 스프레드시트는 본인 계정 전용으로 두고 공유하지 마세요.

## 7. 프로젝트 구조

```
app/src/main/java/com/rionoh/kakaobanklogger/
  service/BankNotificationListener.kt   알림 수신·필터·저장
  parser/BankNotificationParser.kt      문구 파싱(추정)
  data/                                 Room DB (NotificationRecord, DAO)
  forward/                              웹훅 전송 (WorkManager, OkHttp, JSON payload)
  export/Exporter.kt                    JSON/CSV 내보내기
  settings/SettingsStore.kt             설정 저장
  ui/                                   Compose 화면 (홈, 상세, 설정)
receiver/google-apps-script/            스프레드시트 수신기
.github/workflows/android.yml           CI: 단위 테스트 + 디버그 APK 아티팩트
```

## 8. 빌드 환경

- Android Gradle Plugin 8.10.1, Kotlin 2.0.21, Jetpack Compose (BOM 2024.12.01), Room 2.6.1, WorkManager 2.10.0
- minSdk 26 (Android 8.0) / targetSdk 35
- JDK 17 이상
