# @jcurve/shopping

제휴 쇼핑 탭 — 대표님 2026-10-19 「쇼핑은 패키지로 제작 한다」. 화면 · 배치는 패키지가, **색 · 이름 · 데이터는 앱이** 넘긴다.

① 머리 「쇼핑」 + 누적 혜택 + 상단 탭(전체 · 제휴처들) ② 전체(맨 위 배너 · 제휴처 두 칸 · 분류 칩 · 2열 상품 · 유의사항)
③ 포인트형 제휴처(적립 안내 · 오늘만 특가 · 2열) ④ 할인권형 제휴처(적립 안내 · 「할인권이란?」 · 2열) ⑤ 할인권 안내(등급 · 이용 방법 · 자주 묻는 질문 · 유의사항 · 아래 고정 버튼)

```tsx
import { ShoppingTab, createHttpShoppingApi } from '@jcurve/shopping';

const api = useMemo(() => createHttpShoppingApi((path, init) => request(path, init)), []);   // 앱 자기 요청 함수(토큰 · 재시도)
<ShoppingTab api={api} topInset={insets.top}
  theme={{ appName: '당근캐시', pointName: '포인트', pointMark: 'P', primary: C.carrot, primarySoft: C.carrotSoft, card: C.bg, text: C.text, sub: C.sub, line: C.line }}
  onOpenUrl={url => Linking.openURL(url)} onEvent={track} />
```

## 지키는 것

- **정책 글을 박지 않는다.** 적립 조건 · 기한 · 한도 · 할인권 등급 · 질문 답은 전부 서버 글(`notice` · `couponInfo`)을 그린다. 우리 정책이 정해지기 전 다른 회사 조건을 옮기지 않게.
- **「○○님이 받았어요」 띠는 실제 기록만.** 서버가 `home.recent` 에 실제 적립(가린 이름 · 금액)을 줄 때만 보이고, 비면 아무것도 안 그린다. 패키지는 지어내지 않는다.
- 이동은 서버가 만든 **추적 링크**(`link`)만 연다 — 앱이 `onOpenUrl` 로 연다. 패키지는 아무 데도 보내지 않는다(계측은 `onEvent`).
- 다른 회사 이름 · 로고 · 문구를 쓰지 않는다. 앱 이름은 `theme.appName`(「{앱}에서 이동해야 적립돼요」).

## 서버(패키지api 설계 중 — 경로는 바뀔 수 있다)

`createHttpShoppingApi` 가 부르는 경로: `shopping/home` · `categories` · `products` · `deals` · `coupon-info` · `notice` (GET, `partner=` · `category=` · `cursor=`), `shopping/link` (POST `{partner, product}` → `{url}`). 모양은 `src/types.ts`.
서버가 붙기 전엔 `createMockShoppingApi()` — 모든 글에 「[목업]」이 붙는다.

## 0.1.1 (2026-10-19) — 패키지api 계약(docs/shopping-package-design §13)에 맞춤

- `partners[].disclosure` — 제휴 활동 고지를 서버 글 그대로 화면 아래에 늘 그린다
- 상품 보상은 **예상**이라 「약 447」로 쓴다(확정 때 수수료 · 하루 상한으로 줄 수 있음)
- `onLinkError(code)` — 이동 링크 실패(signup_required 게스트 · too_often · provider_not_ready · product_not_found)를 앱이 받아 로그인 창 · 안내를 띄운다
- 「○○님이 받았어요」 띠: 서버는 확정 건이 충분할 때만 `recent` 키를 준다(없으면 키가 빠짐) — 패키지는 그대로 없으면 안 그림

## 0.1.0 (2026-10-19)

첫 판. 목업 · 서버 인터페이스 · ①~⑤ 화면.
