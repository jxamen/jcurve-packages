# @jcurve/mission 만보기 「머리 줄 ↔ 첫 카드」 간격 24 → 12pt (-mc3)

대표님 10/29 09:01(슬랙대표님요청 → 앱보조4): 만보기 화면에서 「‹ 만보기」 머리 줄과 첫 카드 「오늘 걸음」 사이 빈 칸을 줄이기(목표 12pt). 원인: `PageFrame` 본문 `padding: 16` + `StepsPage` `claimCard.marginTop: 8` = **24pt**. 앱 자체 화면(에그머니 · 당근 · 꿀꿀 · 꾹테크)은 앱에서, `@jcurve/mission` `StepsPage` 를 쓰는 머니트리 · 감자밭 · 캐시팡팡은 이 패치 판으로.

**JS 만 · 바뀐 것은 이 한 가지뿐**: 각 `-mc3` 는 같은 이름의 `-mc2` 와 **다른 멤버가 8개**(`package.json`(version 만 — 다른 키 차이 없음) · `src/pages/PageFrame.tsx` · `src/pages/PageFrame.test.ts` · `src/pages/StepsPage.tsx` · `src/pages/StepsPage.test.ts` · `dist/pages/PageFrame.js` · `dist/pages/PageFrame.d.ts` · `dist/pages/StepsPage.js`)이고 **나머지 멤버는 바이트 · tar 헤더까지 동일**(README 포함, 프로그램으로 비교). 이 패키지에는 안드로이드/iOS 네이티브 파일이 없다. 줄바꿈은 -mc2 에 맞췄다(0.4.16 · 0.7.13 은 CRLF, 나머지 LF). 만들기 전에 각 -mc2 멤버가 커밋된 -mc2 원문과 글자까지 같은지 검사했다(다르면 만들지 않음).

## 줄별 판 · sha256 · integrity (iOS 줄 먼저 순서)
| 현재(-mc2) | 새 판 | sha256 | integrity (sha512) | 쓰는 앱 |
|---|---|---|---|---|
| `0.4.19-mc2` | `0.4.19-mc3` | `74144525c338451598d908697e2bdd2905c33934115a9a818cae4deb5112f913` | `sha512-HXG8uFGIJlDpzxI0DQdw3/eUEXQfXDWtb6r/Vod2C1uenPC9+L6sQ1LnXyHjexyZHw9qyCIOQPKdfVaLnP790w==` | 머니트리 iOS 1.0.9/1.0.10 |
| `0.4.17-mc2` | `0.4.17-mc3` | `63e31949fa564052b0abb569441a7f1c987bc561e5abeb253c682fb6bfd7ee27` | `sha512-sE3O0PjWHvnUhkorHgkVTuue7bOwEy/vKWQgwny1lYilvnDH0mN2ALHOnWAO72j+Pcoo4pcSI3FvSD2Sejvj6A==` | 캐시팡팡 iOS 1.0.5/1.0.6 |
| `0.7.14-mc2` | `0.7.14-mc3` | `1effff9db12f22a94fa6f7122385ebbe48764a2e559c5b1c9169f1874fddc16e` | `sha512-iw9jDbi44RQL1CTWhpEzIZnKwUKVgMaOOtfKFH7Cd8slWndHO60FqRm4OhVK2SrtIIEhbRNVH+KvzeeRxga4pw==` | 감자밭 iOS 1.1.5/1.1.7 |
| `0.7.13-mc2` | `0.7.13-mc3` | `a391d939eb8ef081717a00be9b567d0674be42289463e893a949f37c42d49c22` | `sha512-y9xrD/4T9NK7Dq632q3QhS5O6LBaJ5cC0Nlx7S3hxxkSmzcyto1um3Y1QiXMMayLalob21cgimEMJAJNeNZnPg==` | 감자밭 1.1.3/1.1.4 |
| `0.4.16-mc2` | `0.4.16-mc3` | `d937e29a4eff83c199fb7a69e239328191e23f5dca448829b679778d084171f7` | `sha512-az054wdHmqG6MjPXls01U8HSf6+W2X2jUau3UfnjX4u/SsTtLy13RKUIkgZvIA558fsa95JokO97e4Pk62IFxQ==` | 캐시팡팡 iOS 1.0.3 · 안드, 머니트리 1.0.7/1.0.8 |
| `0.4.19-moneytree109.1-mc2` | `0.4.19-moneytree109.1-mc3` | `5ec7a4fbdf9f9145885b4e916fc1a6bebec1c586115ff6e4c7717bb5f0c56319` | `sha512-iI24XlsO6APVBShbsvsedhy/oTyqiA9Zy+3+BWDpdB+sPho/1z9LLHdR50MtDOM14HRKDWLaYLQYCHPY3XUNtQ==` | 머니트리 안드 1.0.9/1.0.10 (안드 전용) |

(`INTEGRITY-mc3.txt` 에 같은 값. **락은 `npm install` 이 만든 값을 쓰고 손으로 옮기지 말 것.**)

## 무엇이 달라지나 (그 밖은 모두 불변)
- `PageFrame` 에 **선택 prop `topGap?: number`** 하나. 안 주면 지금 그대로(본문 위 16). 0 이상의 숫자를 주면 위쪽 padding 만 그 값으로 바뀐다(옆 16 · 아래 40 · 줄 사이 12 는 그대로; NaN · 음수 · 글자는 무시하고 16). **다른 PageFrame 페이지는 prop 을 안 줘서 불변.**
- `StepsPage` 는 **합친 카드(`mergedCard`, 기본)이면서 카드가 맨 위일 때**(`stepsAvailable && !failed`)만 `topGap={4}` 를 준다 → 본문 위 4 + 카드 marginTop 8 = **12pt**. 그 밖에는 모두 그대로 16 → 24:
  - 안 합친 옛 모양(`mergedCard={false}`) — 그대로.
  - 카드 위에 다른 줄이 있을 때: 걸음 기능이 없는 옛 빌드의 「업데이트하기」 안내가 맨 위일 때, 광고 받기 실패 안내(「광고 확인이 늦어지고 있어요…」)가 맨 위일 때 — 그 줄이 머리 줄에 4pt 로 붙지 않게 그대로 둔다(실패 안내가 사라지면 다시 12).
  - 오늘 카드 ↔ 광고 자리(위 4) ↔ 「만보기 안내사항」 사이는 그대로(줄 사이 12 불변).
- 새 export · 새 prop 은 `PageFrame.topGap` 하나뿐.

## 시험 · 못 본 것
시험: pages 90개(`PageFrame.test.ts` 에 topGap 3개, `StepsPage.test.ts` 에 간격 5개 추가; 기존 시험은 그대로 통과), mission 전체 289개. 여섯 tgz 를 각각 풀어 안의 `PageFrame.test.ts` · `StepsPage.test.ts` 21개가 통과하는 것도 확인했다. 새 시험은 「합친 카드 12 · 옛 모양 16(+8 은 옛 모양에서 카드가 맨 위가 아님) 불변 · 업데이트 안내/실패 안내가 맨 위면 16 · 다른 PageFrame 기본 16 · 광고/안내 사이 불변」이다.
**못 본 것**: 실제 화면(눈으로) — 렌더 시험은 스타일 값만 본다. 12pt 가 실제 기기에서 머리 줄과 첫 카드 사이로 보이는지는 앱마다 한 번 봐야 한다(iOS 먼저). 화면이 바뀌는 OTA 이므로 시뮬/실기기 확인 뒤 발행.

## 소스
`jcurve-packages` 가지 `feat/mission-0.4.16-merged-card` @ `9134ca7`(0.4.16-mc2 `6e117f5` 위 한 커밋). 다른 줄(0.4.17 · 0.4.19 · 0.4.19-moneytree109.1 · 0.7.13 · 0.7.14)은 -mc2 때와 같이 그 베이스 tgz 에 같은 파일을 얹어 만들었다(소스 가지 없음).
