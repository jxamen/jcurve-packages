## 0.1.13 — 2026-10-21 쿠팡 쇼핑·방문 수정

쇼핑 시안 공통 여백 20·간격 24, 앱별 header 테마, 서버 허용 쿠팡 탭, 공통 PartnerCard/Chips/ProductGrid/EmptyProducts. 파트너스 고지는 쿠팡 탭 맨 아래에만 표시합니다.

## 0.1.12 — 쿠팡 상품 칸 준비 (미발행)

- `ShoppingTab` 전체 칸 상단에 쿠팡 상품 칸. `createHttpShoppingApi(request)`가 `api.coupang`을 제공한다. 사용자 정의 어댑터는 `createCoupangApi(request)` 또는 `CoupangApi`를 연결한다. 미연결이면 숨김.
- 인증된 `GET coupang/config` 응답 전·실패·404·enabled=false는 칸 전체 숨김. test_only 회원 판정은 서버에서 한다. 복귀 시 다시 확인하고 요청 함수/계정이 바뀌면 이전 응답을 버린다(계정별 api identity/key 사용).
- `GET coupang/products?keyword=&category=` 목록·검색·카테고리. 기본 분류는 여성패션(1001)·남성패션(1002)·식품(1012); 서버 `config.categories`가 있으면 대체. 첫 분류로 초기 목록 조회. 검색은 전체 분류, 분류 선택은 검색어를 비운다.
- 상품은 서버 `deep_link`로 Linking.openURL. `POST coupang/products/click {product_id}`는 클릭 통계만 기록한다. 키 없음은 서버의 「설정 필요」를 표시. 늦은 이전 검색 응답은 폐기.
- 필수 문구는 목록 위에 항상 줄임 없이 표시: 이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.
- 새 네이티브 의존·비밀 키·설정 변경·발행·앱 반영·OTA 없음. 실제 파트너스 키/실기기 연동은 미검증. 테스트는 모의 응답 사용.

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

## 서버(패키지api 확정 계약)

`createHttpShoppingApi` 가 부르는 경로: `shopping/home` · `categories` · `products` · `themes` · `deals` · `coupon-info` · `notice` (GET, `partner=` · `category=` · `cursor=`), `shopping/link` (POST `{partner, product}` → `{url}`). 모양은 `src/types.ts`.
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

선택 함수 `ShoppingApi.themes(partnerId)`가 `ThemeSection[]`(`id`, `title`, 선택 `subtitle`, `items: Product[]`)을 반환하면 제휴처의 분류 칩·2열 목록 대신 주제 제목과 가로 상품 줄을 표시한다. 실패하거나 빈 배열이면 기존 화면으로 돌아간다. 목업에는 `themes`가 없다. `rewardKind: 'none'`은 보상 없는 쉐어링크 수동 진열용으로, `rateText`만 그대로 표시하고 보상 안내·딱지는 숨긴다(상품도 `none`으로 전달). `partner.disclosure`는 원문 그대로 상품 줄 위에 읽기 쉬운 글로 펼쳐 표시한다. 상품 이미지는 크롭 없이 표시하며 자동 넘김·자동 실행은 하지 않는다.

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

## 0.1.6 (2026-10-20) — 서버 패키지api 확정 계약

- 인증 상태 6개: `received` 접수 · `checked` 확인 중 · `waiting` 확정 대기 D-n · `paid` 지급 · `rejected` 반려 · `revoked` 회수. 확인 중은 대시보드 반영으로 며칠 머물 수 있다. 회수는 지급 뒤 취소·환불로 회수된 상태이며, 반려·회수의 `reason`은 칩 아래 빨간 계열 글로 표시한다.
- 인증 오류 `off`는 「지금은 인증을 받지 않아요」, `provider_not_ready`·`ocr_not_enabled`는 「잠시 후 다시 시도해 주세요」로 표시한다.
- `Product.price?: number | null`: 서버 수동 목록은 가격 키를 생략할 수 있다. 가격이 없거나 유효한 숫자가 아니면 가격 줄·할인율·접근성 가격 문구를 숨긴다.
- `GET shopping/themes?partner=` → `{ ok: true, themes }`, `body.themes ?? []`를 반환한다. 성공 응답의 `ok: true`와 함께 기존 `home`·`items`·`next`·`deals`·`info`·`sections`·`item` 키를 그대로 읽는다. `notice`·`coupon-info`의 404는 각각 `[]`·`null`로 처리하고 다른 오류는 전달한다.


## 테마

`ShoppingTheme`의 색은 앱이 지정한다. 화면 바탕은 `bg`, `thumbBg`는 호환성을 위해 유지하며 상품 사진 바탕은 투명하게 표시한다. 안내 줄·비선택 칩·입력칸 바탕은 선택 값 `chipBg`를 쓴다. `chipBg` 기본값은 `#F2F4F6`이다. 기존 `card`는 기타 안내 영역 바탕으로 유지한다.

## 0.1.7 (2026-10-20) — 디자인 다듬기

탭·제휴처 안내·광고 고지·상품 카드·칩·히어로와 구매 인증 화면의 간격·서체·색·모서리를 정리했다. 상품 이미지는 안쪽 여백을 두고 contain으로 표시하며, 2열 카드 폭은 화면 너비로 계산한다. 구매 인증과 쿠폰 안내는 공용 `StepList`를 쓴다. 서버 계약과 이동·사진 선택·인증 제출 동작은 유지한다.

## 0.1.8 (2026-10-20) — 하루특가 줄

서버는 앱관리가 매일 한국 시각 00:05에 교체하는 맨 위 주제를 기존 `api.deals(partnerId)`의 `{ title?, endsAt?, items }`로 전달한다. `endsAt`이 없거나 유효한 숫자가 아니거나 이미 지났으면 응답을 받은 시점의 다음 한국 시각(UTC+9) 자정으로 확정한다. 제목이 없으면 「오늘만 이 가격에 살 수 있는 하루특가」를 표시한다.

전체 탭은 제휴처 순서에서 상품이 있는 첫 하루특가를 히어로 위에, 제휴처 탭은 안내·대가성 문구 아래에 표시한다. 카드 폭은 156px이며 수동으로 넘긴다. 하루특가가 있을 때만 1초마다 남은 시간을 갱신하고, 탭을 바꾸거나 안내 화면으로 이동하면 멈춘다. 만료 시 줄을 숨기고 deals를 다시 조회한다. 주제 줄과의 상품 중복은 서버에서 처리한다.

## 0.1.9 (2026-10-20) — 쇼핑 간격 · 다음 쪽 · 이미지

주요 블록 사이를 16으로 통일하고 칩 위아래 여백을 대칭으로 맞췄다. 전체·제휴처 상품 격자는 끝에서 400 이내로 스크롤하면 `next` 커서로 이어 받으며 중복 요청·이전 분류 응답을 막고 하단 로딩 표시를 낸다. 확인된 토스 CDN 이미지는 썸네일 폭 × 화면 밀도(2~3배, 기존 해상도 유지 이상)로 요청한다. 문구·카드 크기·contain·안쪽 여백·의존성은 유지한다.

## 0.1.10 (2026-10-20) — 상품 사진

상품 사진을 1:1·cover·안쪽 여백 0으로 채우고 별도 회색 바탕·테두리를 제거해 카드 위쪽 모서리(12)와 하나로 이어지게 했다. 하루특가·주제 줄의 폭, 문구·동작·계약·이미지 요청 폭 규칙·의존성은 유지한다.

## 머리 제목 정하기 (0.1.11)

`ShoppingTab` 머리의 「쇼핑」 제목을 앱이 정할 수 있다 — **기본값은 지금 그대로**(왼쪽 · 26 · 800 · `theme.title ?? '쇼핑'`)라 안 넘기는 앱은 화면이 바뀌지 않는다.
```tsx
<ShoppingTab … title="쇼핑" titleAlign="center" titleStyle={{ fontSize: 20, fontWeight: '700' }} />
```
- `title?: string` — 제목 글자. 우선순위 `title` → `theme.title` → 「쇼핑」(빈 글자는 무시)
- `titleAlign?: 'left' | 'center'` — 기본 `'left'`. `'center'` 면 머리 줄 전체 폭의 가운데(오른쪽 「누적 혜택」 알약과 겹치지 않고 누르는 것을 막지 않는다)
- `titleStyle?: TextStyle` — 기본(26 · 800 · 제목 색) 위에 덮는다. 다른 탭 제목(예 꼬꼬 탭)과 크기를 맞출 때 `fontSize` · `fontWeight` 를 준다

