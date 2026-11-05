# @jcurve/receipt-guide — 전자 영수증 화면 공용

영수증 올리기 화면의 **「전자 영수증」 칩 카드**(연동 배지 · 더보기) · **「○○ 연동됨」 시트** · **「○○ 영수증 올리는 법」 단계 안내 재생기** · **긴 영수증 여러 장 이어 붙이기**를 한 패키지에 담았다.
영테크 `src/receiptGuide` 를 그대로 옮겼다(2026-11-05 대표님 「영테크 전자 영수증 화면도 패키지로 만들어 다른 앱이 바로 가져다 쓰게 — 디자인만 앱마다 다르게」). 색 · 글꼴 크기 · 둥글기 · 캐릭터 · 기록은 props 로 받는다 — 앱의 다른 파일을 부르지 않는다.

```json
"@jcurve/receipt-guide": "https://github.com/jxamen/jcurve-packages/releases/download/receipt-guide-v1.0.0/jcurve-receipt-guide-1.0.0.tgz"
```

## 필요한 것(peer)

`react-native` · `expo-image-picker` · `expo-image-manipulator` · `expo-file-system` · `@shopify/react-native-skia`(사진첩 · 이어 붙이기를 쓸 때만)

모두 JS 만 쓰고 새 네이티브 모듈은 없다. 위 다섯이 이미 들어간 빌드라면 OTA 로 나간다. 주문 읽기 · 서버 호출은 `@jcurve/receipt-link`(연동 상태 · 불러오기 화면) 에 있다 — 이 패키지는 화면 조각만.

## 전자 영수증 세 화면 — 한 번에 (대표님이 표시한 세 곳)

```tsx
import { PlatformChooser, ActionMenu, ReceiptGuide, linkGuide, linkedMenuItems, linkedMenuTitle, type LinkChip, type LinkSite } from '@jcurve/receipt-guide';
import { LINK_LABEL, TEST_LINK_PLATFORMS, isConnected } from '@jcurve/receipt-link';

// ① 「전자 영수증」 카드 — 연동 칩(네이버 · 쿠팡 · 마켓컬리 · 무신사, 「연동/미연동」 배지) + 안내 칸(배민 · 쿠팡이츠 …) 여섯 칸부터, 「더보기 ∨」
const linkChips: LinkChip[] = TEST_LINK_PLATFORMS.map((p) => ({ key: p, app: APP[p], name: LINK_LABEL[p], connected: isConnected(state, p) }));
<PlatformChooser remembered={last} onPick={openPopup} onQuick={pick} paper={<MyCameraButtons />} linkChips={linkChips}
  onLinkPick={(key, connected) => connected ? setMenu(key as LinkSite) : startConsent(key)} theme={{ brand: '#4278CF' }} track={track} />

// ② 칩을 누르면 뜨는 「○○ 연동됨」 시트 — 주문 불러오기 · 불러온 주문 보기 · 사용 방법 보기 · (probe 만) 로그인 창 열기 · 연동 해제 · 닫기
{menu ? <ActionMenu title={linkedMenuTitle(LINK_LABEL[menu])} insetBottom={insets.bottom} theme={{ bg: C.bg, card: C.card, radius: 24 }}
  items={linkedMenuItems({ importOrders: () => openImport(menu), showOrders: () => openOrders(menu), showGuide: () => setGuide(menu), openLogin: () => openLogin(menu), withdraw: () => withdraw(menu) }, { probe: state?.probe === true })}
  onClose={() => setMenu(null)} /> : null}

// ③ 「○○ 영수증 올리는 법」 단계 안내 + 맨 아래 「주문 불러오기」(연동 전이면 「동의하고 시작하기」) — 부모 영역을 꽉 채운다
{guide ? <ReceiptGuide platform={APP[guide]} guide={linkGuide(guide)} appName="영테크" theme={{ brand: '#4278CF' }} track={track}
  onClose={() => setGuide(null)} onUpload={() => act(guide)} cta={{ label: isConnected(state, guide) ? '주문 불러오기' : '동의하고 시작하기', onPress: () => act(guide) }} /> : null}
```
`APP` 은 칩 → 안내 앱 이름(`naver: 'naverpay', coupang: 'coupang', kurly: 'kurly', musinsa: 'musinsa'`). 처음 누른 칩은 ③ 부터 보여 주고(`parseLinkSeen` · `markLinkSeen` 으로 본 곳 저장) 그 뒤로는 바로 ②.
시트 색 · 둥글기 · 글자 크기는 `ActionMenuTheme`(bg · card · text · sub · danger · radius · itemRadius · titleSize · itemSize · pad), 카드 · 안내 색은 `GuideTheme` — 빠진 값은 기본값.

## 쓰는 법

```tsx
import { PlatformChooser, ReceiptGuide, pickReceiptImages, type GuideApp, type ReceiptPlatform } from '@jcurve/receipt-guide';

// 1) 올리기 화면 첫 자리 — 앱 칸 + 지난번 [바로 올리기] + 종이 영수증 자리(앱의 촬영 버튼을 그대로 넣는다)
<PlatformChooser
  remembered={last}                       // 지난번 고른 곳(앱이 저장 · 계정별로)
  onPick={(app) => openPopup(app)}        // 앱 칸 → 앱의 팝업(영테크: 처음이면 안내부터, 아니면 등록 칸 1장 · 2장)
  onQuick={(app) => pick(app)}            // [바로 올리기] → 안내 없이 사진첩
  quickDisabled={!canUpload}
  paper={<MyCameraButtons />}
  theme={{ brand: '#4278CF' }}
  track={track}
/>

// 2) 안내 재생기 — 부모 영역을 꽉 채운다(안전 영역 여백은 부모가 준다). platform 이 null 이면 안 그린다
<ReceiptGuide
  platform={guide}
  appName="영테크"                         // 글 속 {앱} 자리
  onClose={() => setGuide(null)}
  onUpload={(app) => { setGuide(null); pick(app); }}   // [지금 올리기] · 「건너뛰기」
  cta={{ label: '영수증 등록하기', onPress: (app) => toRegister(app) }}   // 없으면 [지금 올리기] → onUpload
  renderCharacter={(seed, h) => <MyCharacter seed={seed} height={h} />}
  theme={{ brand: '#4278CF' }}
  track={track}
/>

// 3) 사진첩 — 한 장이면 예전 옵션 그대로, 길게 캡처하는 곳이면 3장까지 골라 위 → 아래로 이어 붙인 한 장
//    shots: 1 | 2 — 등록 칸의 「1장으로 올리기」 · 「2장으로 올리기」(고를 수 있는 값은 shotChoices(p, web))
async function pick(platform: ReceiptPlatform, shots?: 1 | 2) {
  const picked = await pickReceiptImages(platform, { track, shots });   // { asset, count } | null
  if (picked) upload(picked.asset, platform);                    // 언제나 사진 한 장(이어 붙였으면 캐시 JPEG)
}
```

처음 말한 「한 덩어리 `<ReceiptGuide open …/>`」 대신 **고르는 칸 · 재생기 · 사진첩 함수 셋**으로 나눴다.
고르는 칸은 올리기 화면 안(스크롤 목록 머리)에 놓이고 재생기는 화면 전체를 덮어야 해서 자리가 다르다.
사진첩을 여는 때(안내를 닫은 뒤 · 캡슐 확인 뒤)도 앱마다 조건이 달라 부르는 쪽에 둔다. 안에서 Modal 을 하나 더 띄우지 않는 것도 이 때문이다 — 아이폰에서 창을 닫는 중에 사진첩을 띄우면 실패할 수 있다.

### 고르는 곳 값(서버 `platform` 칸)

`baemin` · `coupang` · `coupangeats` · `nplus` · `naverpay` · `musinsa` · `kurly` · `kurly_npay` · `kakaopay` · `paper`

화면 순서는 `PLATFORM_ORDER`(종이 영수증이 맨 끝). 이름은 `platformName(p)`.

### 기록(track)

| 이름 | 값 | 언제 |
|---|---|---|
| `receipt_platform_pick` | `{ platform }` | 앱 칸(팝업 열기) · [바로 올리기](종이 영수증 버튼은 부르는 쪽이 기록) |
| `receipt_guide_open` | `{ app }` | 안내가 열릴 때(다른 안내로 옮겨 가도) |
| `receipt_guide_done` | `{ app }` | 첫 바퀴를 다 봤을 때 |
| `receipt_multi_pick` | `{ count }` | 여러 장을 골랐을 때 |

### 색(theme)

`bg · card · line · text · sub · brand · brandSoft · hot(손가락 · 누를 곳) · white · noteBg · noteText` — 빠진 값은 `DEFAULT_THEME`.

## 재생기 동작

- **늘 저절로 넘어간다**: 장면마다 약 2.6초(캡처 장면 3초). 누를 곳이 두꺼운 테두리로 두 번 깜빡이고(살짝 커졌다 작아짐), 손가락이 가서 톡 누르고(물결) 다음 화면으로 간다.
- 마지막 장면 뒤에는 **처음부터 다시** 돈다. 첫 바퀴를 다 보면 `receipt_guide_done`.
- 아래에 **[지금 올리기]** 가 늘 떠 있다. 앱이 `cta`(label · note · disabled · busy · onPress)로 바꿀 수 있다 — 영테크는 「영수증 등록하기」로 같은 팝업의 등록 칸으로 넘긴다(캡슐이 없으면 거기서 「캡슐이 없어서 올릴 수 없어요」, 광고로 잇지 않는다 — 대표님 10-04 12:24). 위에는 작은 장면 막대와 「멈춤/재생」 · 「건너뛰기」(= 맨 아래 버튼과 같다)만. 가짜 화면을 누르면 바로 다음.
- 기기의 움직임 줄이기가 켜져 있어도 **넘어가기는 그대로** 한다 — 손가락 이동 · 깜빡임 · 물결만 빼고 누를 곳은 굵은 테두리로 고정해 둔다(대표님 10-03 23:51).

## 앱 하나 더 넣기 — `data.ts` 만 고친다

1. `types.ts` 의 `GuideApp` 에 값을 더한다(서버 `platform` 값과 같게).
2. `data.ts` 에 `ReceiptGuide` 한 덩어리를 쓰고 `GUIDES` 순서에 넣는다.
3. `npm test` — `data.test.ts` 가 장면마다 누를 곳이 하나인지(캡처 장면은 0), 번호가 1부터 이어지는지, 마지막이 사진첩인지 본다.

```ts
const myshop: ReceiptGuide = {
  app: 'myshop', name: '마이샵', accent: '#3366FF',
  summary: ['아래 탭 「주문내역」', '주문 상세 「영수증」', '「영수증」 화면 캡처', '{앱} 「사진 올리기」'],
  doneSub: '캡처한 영수증을 고르면 돼요',
  // multi: 3, pickHint: '위 → 아래 순서로 2장 골라 주세요',   // 길어서 여러 장일 때만
  // note: '꼭 알아야 할 한 줄',
  steps: [
    { no: 1, say: '아래 탭 「주문내역」을 눌러요', nodes: [{ type: 'bars', n: 6 }, { type: 'nav', items: ['홈', '주문내역', '마이'], tap: 1 }] },
    { no: 2, say: '「영수증」을 눌러요', nodes: [{ type: 'header', title: '주문 상세', back: true }, { type: 'buttons', items: ['영수증'], tap: 0 }] },
    { no: 3, say: '「영수증」 화면을 캡처해요', action: 'capture', toast: '화면을 캡처했어요', nodes: [{ type: 'header', title: '영수증', close: true }, { type: 'rows', rows: [['합계', '18,500원']], strong: 0 }] },
    { no: 4, say: '{앱} 「사진 올리기」로 골라요', nodes: [{ type: 'header', title: '사진첩', close: true }, { type: 'album', pick: [0] }] },
  ],
};
```

가짜 화면 줄(`MockNode`): `header`(back · close · left/right 글자 버튼) · `tabs` · `chips` · `section`(오른쪽 글자 버튼들) · `order`(주문 카드: corner · button · small · more · dim) ·
`rows`(이름 · 값, strong · tap) · `buttons`(solid) · `menu`(아래에서 올라온 창) · `album`(사진첩, 고른 순서 번호) · `bars`(회색 글 줄) · `nav`(아래 탭, `{ icon: 'person' }` 가능).
누를 곳은 그 줄의 `tap`. 장면에 `scrolled`(아래로 내린 화면) · `link`(다른 안내로) · `toast` · `ms` 를 줄 수 있다.

**지킬 것**: 진짜 앱 로고 · 그림 · 캡처는 쓰지 않는다(막대 · 둥근 카드 · 글자만, 앱 색은 옅게). 가게 · 상품 이름과 금액은 지어낸 값(「○○치킨 △△점」 · 18,500원)만 넣는다. 실제 이름 · 전화 · 주소 · 카드번호를 넣지 않는다.

## 2장이 꼭 필요한 곳

`TWO_SHOT`(`needsTwo(p)`) = `nplus` · `naverpay` · `kakaopay` · `kurly_npay` — 영수증이 길어 위 · 아래 2장 캡처를 이어 붙여야 결제 정보가 다 들어간다(대표님 10-03 23:53).

- 고르는 칸 · 안내 맨 위 · [지금 올리기] 위에 「2장」 딱지.
- `pickReceiptImages` 가 2장 미만이면 `need_two_shots`(`NEED_TWO_SHOTS`)를 던진다 — 올리기로 넘기지 말고 `NEED_TWO_TEXT`(「이 영수증은 2장이 필요해요(위 · 아래)」)를 크게 보여 다시 고르게 한다.
- 올릴 때 multipart `shots` = 이어 붙인 원본 장 수(한 장이면 1). 서버도 TWO_SHOT 인데 `shots < 2` 면 422 `need_two_shots`.

## 여러 장 이어 붙이기

- `stitchLayout(sizes)`(순수 함수 · 시험 있음): 폭 = 가장 넓은 사진(최대 1440), 각 사진을 그 폭에 비율대로 맞춰 위 → 아래로 쌓는다. 합친 높이가 8000 을 넘으면 폭째로 줄인다(그래픽 텍스처 한계).
- `stitchReceipts(assets)`: 이미지 조작기로 EXIF 방향을 적용해 풀고 → Skia 오프스크린 화면에 그려 → JPEG(90) 캐시 파일 한 장.
- 겹친 부분은 찾아 지우지 않는다. 고른 순서만 지킨다.

**부르는 쪽이 할 일**: 이어 붙인 사진은 세로로 아주 길다(높이/폭 4~7). 올리기 전에 긴 변 기준으로 줄이면 폭이 수백 px 로 줄어 글자를 못 읽는다.
영테크는 `src/receipt/prepareImage.ts` 에서 높이/폭 > 2.2 이면 **폭 1080** 으로 줄인다(`receiptSize.ts` `TALL_RATIO`). 다른 앱도 같은 규칙을 둬야 한다.
