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
시험 · 미리보기는 `import { createMockShoppingApi } from '@jcurve/shopping/dist/mock'`로 직접 가져온다. 서버가 붙기 전엔 `createMockShoppingApi()` — 모든 글에 「[목업]」이 붙는다.

## 0.1.3 (2026-10-19) — 숫자 · 이름 · 켜짐은 전부 서버 설정값

- 대표님 10-19 「제공 수수료같은것도 어디 설정에서 할 수 있게」: 적립률(`rateText`) · 지급 형태 이름(`rewardLabel`, 새로) · 보여 줄 제휴처(`partners` 목록 = 켜진 것만)는 모두 서버(어드민 설정)에서 받는다. 패키지에 숫자 하드코딩 없음(목업 제외). `rewardLabel` 이 없을 때만 테마 이름(포인트 · 할인권)

## 0.1.2 (2026-10-19)

- 할인권 안내(coupon-info)가 null 이면 「할인권이란?」 링크를 숨긴다(정책 전 서버는 null)

## 0.1.1 (2026-10-19) — 패키지api 계약(docs/shopping-package-design §13)에 맞춤

- `partners[].disclosure` — 제휴 활동 고지를 서버 글 그대로 화면 아래에 늘 그린다
- 상품 보상은 **예상**이라 「약 447」로 쓴다(확정 때 수수료 · 하루 상한으로 줄 수 있음)
- `onLinkError(code)` — 이동 링크 실패(signup_required 게스트 · too_often · provider_not_ready · product_not_found)를 앱이 받아 로그인 창 · 안내를 띄운다
- 「○○님이 받았어요」 띠: 서버는 확정 건이 충분할 때만 `recent` 키를 준다(없으면 키가 빠짐) — 패키지는 그대로 없으면 안 그림

## 0.1.0 (2026-10-19)

첫 판. 목업 · 서버 인터페이스 · ①~⑤ 화면.

## 0.1.4 (2026-10-20) — 주제별 상품 구성

선택 함수 `ShoppingApi.themes(partnerId)`가 `ThemeSection[]`(`id`, `title`, 선택 `subtitle`, `items: Product[]`)을 반환하면 제휴처의 분류 칩·2열 목록 대신 주제 제목과 가로 상품 줄을 표시한다. 실패하거나 빈 배열이면 기존 화면으로 돌아간다. 목업에는 `themes`가 없다. `rewardKind: 'none'`은 보상 없는 쉐어링크 수동 진열용으로, `rateText`만 그대로 표시하고 보상 안내·딱지는 숨긴다(상품도 `none`으로 전달). `partner.disclosure`는 원문 그대로 상품 줄 위에 13pt 본문 색으로 펼쳐 표시한다. 상품 이미지는 크롭 없이 표시하며 자동 넘김·자동 실행은 하지 않는다.

## 0.1.5 (2026-10-20) — 구매 인증

대표님 01:09 「구매 인증으로 지급」: 제휴처 칸의 「구매했다면 인증하고 포인트 받기 ›」에서 주문내역 캡처와 선택 주문번호·결제금액을 보내고 내 인증 내역을 확인한다. 안내와 적립률은 서버 `proof.info`에서 받는다. `rewardKind: 'none'`이어도 구매 인증 버튼은 표시할 수 있다.

앱이 `ShoppingTab`에 `pickImage: () => Promise<PickedImage | null>`을 넘긴다. 결과는 `{ uri, name, type }`, 취소는 `null`이다. 패키지는 사진 모듈을 포함하지 않으며, 사진 모듈 없는 앱에서 `pickImage`를 넘기지 않으면 버튼이 보이지 않는다. `api.proof`가 없거나 info 조회 실패·null·빈 rateText여도 숨긴다.

서버 경로:

- `GET shopping/proof/info?partner=` → `{ info }` (404는 안내 없음)
- `GET shopping/proofs` → `{ items }`
- `POST shopping/proofs` → `{ item }`: FormData `partner`, `image`(uri·name·type), 선택 `orderNo`, `amount`. 앱의 request는 FormData를 JSON으로 변환하거나 Content-Type을 직접 지정하지 않고 fetch에 전달해야 한다.

실패는 기존 request처럼 `Error.code`로 전달한다. `signup_required`, `too_often`, `daily_max`, `bad_image`, `duplicate`는 화면에서 각각 안내한다. 계측은 `onEvent`의 `shop_proof_open`·`shop_proof_submit`(`partner`), `shop_proof_error`(`code`)로 앱에 전달한다. 대가성 문구는 인증 화면 맨 아래에도 표시한다.

목업은 index 에 없다 — 운영 번들에 coupang · [목업] 글이 들어가지 않게

구매 인증 안내의 `subtitle`, `payoutText`, `steps`(title·선택 desc), `faq`(q·a), `notice`, `cta`는 서버 선택 값이다. 없는 구역은 숨기며, `cta`가 있을 때만 사진 선택 고정 버튼을 표시한다. `Notice`의 선택 `title` 기본값은 「상품 상세 설명 및 유의사항」이다.
