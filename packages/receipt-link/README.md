# @jcurve/receipt-link

쇼핑몰 주문 · 영수증 수집 — **네이버 쇼핑 + 네이버페이 · 쿠팡 · 무신사 · 마켓컬리**, 최근 1년.
앱의 숨은 웹뷰(사용자가 직접 로그인한 세션)에서 돈다. 화면 · 서버 호출은 앱마다(이 패키지에 없음).

```json
"@jcurve/receipt-link": "https://github.com/jxamen/jcurve-packages/releases/download/receipt-link-v1.0.0/jcurve-receipt-link-1.0.0.tgz"
```
```ts
import { createFlowDriver, FLOW_FACTORIES, FLOW_HOSTS, type FlowSite } from '@jcurve/receipt-link';
```

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
