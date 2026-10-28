# @jcurve/receipt-link

주문내역 연동(로그인 창 · 구조 기록 · 불러오기)의 공용 부분. 영테크 `20defd33` 의 `src/receiptLink` 에서 옮기고 `28c41110` 의 플랫폼 순서 · 이름(컬리)에 맞췄다(0.1.1).
**0.1.0 = core(순수 TS) 뼈대.** 화면(UI)과 사이트별 읽기 규칙(`SiteRule`)은 다음 판 — 읽는 칸은 구조 기록 결과를 본 뒤에 정한다(추측해 넣지 않는다).
JS 전용: `ios/` · `android/` · config plugin 이 없다(OTA 로만 올라간다). 화면 판이 쓸 네이티브는 `react-native-webview` 13.16.1 · `react-native-safe-area-context` 뿐(영테크 최초 커밋부터 있음).

## 들어 있는 것
- `model` — 서버 계약 타입 · `parseLinkState`(서버 `windowDays` · `consentVersion` · `ordersPerRequest` · `amountMax`, 옛 서버는 30 · 50 · 없음) · `cleanOrder`(쿠키 · 수취인 · 주소 · 전화는 어떤 입력에도 버린다, 여섯 칸만) · 묶음 · 결과 합계 · `importMessage`(보상이 들어가는 곳 문구는 앱이 바꾼다)
- `client` — `createReceiptLinkClient({ request })`: `fetchLinkState`(스위치 꺼짐 404 → null) · `consentLink` · `revokeLink` · `postProbe` · `sendOrders`(서버 묶음 크기 · 금액 상한 미리 거르기 · 이 앱에서 주문 가져오기가 아직 안 열렸으면(404) 오류 없이 `disabled: true`)
- `card` — `LOGIN_URL`(사이트 공식 로그인) · `linkStatus` · `consentLines(platform, { appName, viaDeveloperServer })`(앱 이름 주입, 개발자 서버를 지나는 앱은 그 문장을 더한다) · `loadCardState(client)`
- `probe` — 구조 기록: 글자 · 입력값 · 쿠키값을 읽지 않고 이름 · 경로 모양만 만드는 함수와 웹뷰에 넣는 두 스크립트
- `createUseLinkState(client)` — 상태 훅 공장(react 는 호출할 때 읽는다)

## 앱이 주는 것
`request: { get(path), post(path, body) }` 하나. 경로는 상대(`receipt-link` · `receipt-link/revoke` · `receipt-link/probe` · `receipt-orders`) —
베이스 주소 · 인증 헤더 · 접두는 어댑터가 정한다(영테크: 앱 `api`, 사임캐시: 개발자 서버 `bill/server/…` 경유). 오류는 `status` 숫자를 가진 객체.

## 앱에 남는 것
용돈 주머니 화면(`ReceiptSheet` · `Chooser`) · `hide_legacy` 로 옛 안내 칸 숨기기(`legacy.ts`는 영테크의 영수증 안내 데이터에 묶여 있다) · 앱 문구.
쿠팡은 법무 확인 전이라 기본 사이트 목록에 넣지 않는다(앱이 설정으로만).
