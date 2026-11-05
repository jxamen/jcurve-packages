# @jcurve/receipt-link

쇼핑몰 주문 · 영수증 수집 — **네이버 쇼핑 + 네이버페이 · 쿠팡 · 무신사 · 마켓컬리**, 최근 1년.
앱의 숨은 웹뷰(사용자가 직접 로그인한 세션)에서 돈다. 화면 · 서버 호출은 앱마다(이 패키지에 없음).

```json
"@jcurve/receipt-link": "https://github.com/jxamen/jcurve-packages/releases/download/receipt-link-v1.0.0/jcurve-receipt-link-1.0.0.tgz"
```
```ts
import { createFlowDriver, FLOW_FACTORIES, FLOW_HOSTS, type FlowSite } from '@jcurve/receipt-link';
```

## 붙이는 법 (1.1.3 — 한 장)

로그인 · 목록 · 영수증 읽기 · 서버 보내기 · 실패 기록 · 진행 줄이 전부 패키지 안에 있다. 앱이 할 일은 **설정 하나 + 화면 호출 하나**.

**1. 설치** — `package.json`
```json
"@jcurve/receipt-link": "https://github.com/jxamen/jcurve-packages/releases/download/receipt-link-v1.1.3/jcurve-receipt-link-1.1.3.tgz"
```
같이 필요한 것: `react-native-webview`(읽기 웹뷰), 앱의 서버 호출기(`get` · `post`, 경로는 `https://api.j-curve.co.kr/v1/{앱}/` 뒤).

**판 점검(설치 뒤 · 빌드마다)** — 깔린 @jcurve/* 가 최신 릴리스보다 낮으면 표로 알려 주고 실패한다(2026-11-05, 자세한 것은 `@jcurve/kitcheck` README)
```sh
npx -y https://github.com/jxamen/jcurve-packages/releases/download/kitcheck-v1.0.0/jcurve-kitcheck-1.0.0.tgz
```
패키지 자신도 실행 끝 보고(`receipt-link/run-end`) · 실패 기록(`receipt-link/fails`)에 자기 판 `pkg` 를 실어 보내고, 서버는 옛 판이면 `receipt_link.pkg_old` 로그 · 실패 기록 `info.pkg_old` 로 남긴다.

**2. 설정** — 앱마다 다른 것만 넘긴다(`src/receiptLink/screen.tsx` 같은 파일 하나)
```tsx
import { createReceiptLinkApi } from '@jcurve/receipt-link';
import { defineReceiptLinkScreen } from '@jcurve/receipt-link/screen';
import { WebView } from 'react-native-webview';
import { api } from '../api';            // get(path) · post(path, body) — 토큰은 이 안에서
import { Button } from '../ui/kit';      // { label, onPress, compact?, tone?: 'ghost' } 를 받는 단추
import { C, S } from '../ui/theme';

export const link = createReceiptLinkApi(api);
export const receiptScreen = defineReceiptLinkScreen({
  api: link,
  WebView,
  Button,
  theme: { bg: C.bg, text: C.text, sub: C.sub, brandDark: C.brandDark, space: S },
  // 선택: updateId(OTA 판, 실패 기록에 실림) · claimLine(보상이 있는 앱만) · renderOrders(화면 안 주문 목록을 앱이 그릴 때)
});
```

**3. 화면 호출** — 연동 칩의 「주문 불러오기」가 열 때
```tsx
import { ReceiptImportScreen } from '@jcurve/receipt-link/screen';
<ReceiptImportScreen config={receiptScreen} platform="naver" onClose={close} coupangRead={state?.coupangRead === true} />
```
`platform`: `naver` · `coupang` · `kurly` · `musinsa`. 연동 상태(`link.fetchLinkState()`) · 동의(`consentLink`) · 철회(`revokeLink`) · 목록(`listOrders`)도 `link` 에 있다.

**3-b. 영수증 올리기 화면의 전자 영수증 세 조각** — `@jcurve/receipt-guide`(2026-11-05, 대표님 「화면도 패키지로 · 디자인만 앱마다」)
```json
"@jcurve/receipt-guide": "https://github.com/jxamen/jcurve-packages/releases/download/receipt-guide-v1.0.2/jcurve-receipt-guide-1.0.2.tgz"
```
| 조각 | 컴포넌트 | 앱이 넘기는 것 |
|---|---|---|
| ① 「전자 영수증」 카드 — 칩 6칸(네이버 · 쿠팡 · 마켓컬리 · 무신사 · 배민 · 쿠팡이츠 …) · 「연동/미연동」 배지 · 「더보기 ∨」 | `PlatformChooser` | `linkChips`(연동 상태는 `link.fetchLinkState()` + `isConnected`) · `onLinkPick` · `theme`(색) |
| ② 칩을 누르면 뜨는 「○○ 연동됨」 시트 — 주문 불러오기 · 불러온 주문 보기 · 사용 방법 보기 · (probe 만) 로그인 창 열기 · 연동 해제 · 닫기 | `ActionMenu` + `linkedMenuItems` · `linkedMenuTitle` | 다섯 동작 함수 · `theme`(색 · 둥글기 · 글자 크기 · 여백) · `insetBottom` |
| ③ 「○○ 영수증 올리는 법」 단계 안내 + 맨 아래 「주문 불러오기」 | `ReceiptGuide` + `linkGuide(site)` | `appName` · `cta` · `theme` · `renderCharacter`(선택) |

붙이는 예(세 조각 한 번에)와 색 이름은 `@jcurve/receipt-guide` README 에 있다. 「주문 불러오기」가 여는 화면은 위 3 의 `ReceiptImportScreen`.

**4. 서버(jcurve-api) 끝점** — 앱마다 같은 경로, 앱 DB(`jc_{앱}`)에 따로 저장
| 경로 | 하는 일 |
|---|---|
| `GET/POST receipt-link` · `POST receipt-link/revoke` | 연동 상태 · 동의 · 철회 |
| `POST receipt-orders` | 읽은 주문 보내기(50건씩, `kind`: card · purchase · list · none) |
| `GET receipt-orders` · `GET receipt-orders/{id}` | 목록 · 영수증 한 건 |
| `POST receipt-orders/{id}/claim` | 적립(보상이 있는 앱만) |
| `POST receipt-link/run-end` · `POST receipt-link/fails` | 실행 끝 요약 · 못 받은 줄 기록(어드민 「실패 기록」) |
| `POST receipt-link/probe` | 구조 기록 — 어드민 설정 `{앱}.receipt_link_members` 에 적힌 회원만 |

서버에서 앱을 여는 것은 우리가 한다(`ReceiptLinkController::APPS` + `php83 artisan receipts:add-link-tables --app={앱}`). 2026-11-04 기준 열린 앱: youngtech · bill.

**5. 확인** — 앱에서 한 번 불러온 뒤 서버 `receipt_link_orders` 건수가 늘면 끝. 쿠키 · 토큰 · 카드번호는 패키지가 읽지도 보내지도 않는다.

## 길 (2026-11-02 대표님과 PC 크롬 실측)

| 몰 | 목록 | 영수증 |
|---|---|---|
| 네이버 | 결제 내역 1쪽(buildId) → `_next/data` 쪽 넘김(HTTP) | 간편결제 · 외부몰: `orderApi/payment/detail/info` → `web-api/receipts/card-single`(A형) / 쇼핑 · 오프라인: `receipts/issue-history` → card-single(B형) |
| 쿠팡 | `search-by-month` 페이지 한 번 열기 → `ssr/api/myorders/model/find-over`(size 10) | `payment.coupang.com/v2/card-receipt/view`(HTTP, HTML) |
| 무신사 | `api2/claim/store/mypage/integration/order` + meta offset | `order-service/my/order/get_order_view`(payment_key · tno) → `pay.musinsapayments.com/mps/receipt`(영수증 도메인 안에서, HTML) |
| 컬리 | 기본 배송지 API → `order-external/v4/mypage/orders`(배송지 필수) → v3 상세 | `receipt.creditCardUrl` 페이지 열기 → 스크립트 `var data = [...]` |

- 페이지 읽기는 화면 글자(innerText)에 더해 `var data = [...]` 스크립트를 싣는다(컬리 매출전표).
- 로그인 정보는 받지도 저장하지도 않는다. 주문 내용은 로그에 넣지 않는다(건수만).
- 실측(앱 코드, 2026-11-02): 네이버 주문 210 · 영수증 164 / 쿠팡 118 · 118 / 무신사 23 · 10.

## 시험 · 빌드
```
npx tsc -p tsconfig.json && npx vitest run      # 520건
npm pack && gh release create receipt-link-v<버전> jcurve-receipt-link-<버전>.tgz
```
