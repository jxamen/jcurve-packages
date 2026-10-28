# @jcurve/mission StepsPage — 「오늘 걸음 카드 하나」가 기본 모양 (-mc2 / 0.7.18)

대표님 10/28 21:5x: 이 화면(`StepsPage`)을 쓰는 영테크 · 머니트리 · 감자밭 · 캐시팡팡을 에그머니(7e8f2a30)와 같은 모양으로, **옵션이 아니라 기본 동작**으로. 앱마다 복사본 없이 공용 패키지에서.
**`-mc1`(옵션, 기본 false)은 이 판들로 대체됐다 — 쓰지 말 것.**

## 바뀐 모양 (기본)
위쪽 큰 걸음 수 + 말풍선 블록이 없어지고, 「남은 횟수」 카드 한 장 안에 순서대로: 「오늘 걸음 N걸음」 → 「남은 횟수 N번」 → 설명 한 줄 → (받을 횟수가 0일 때만) 상태 줄(다음 걸음까지 / 다 받음) → 단추. 앱이 `footer` 로 넣는 광고 자리·「만보기 안내사항」은 그대로 카드 아래.
예전 모양이 필요한 앱이 있으면 `<StepsPage mergedCard={false} …>` 한 줄. 앱 코드를 안 바꾸면 새 모양이 된다.

## 줄별 판 · sha (파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓰고 손으로 옮기지 말 것)
| 지금 쓰는 판 | 새 판 | 파일 | sha256 | integrity (sha512) | 쓰는 앱 |
|---|---|---|---|---|---|
| 0.4.16 | `0.4.16-mc2` | `jcurve-mission-0.4.16-mc2.tgz` | `912dec9d361900a209f2e1c6e42a527141371ceccd0698110237394c189c7262` | `sha512-dVFAE6SMSKEOIG/9io93sO/g7IByLo0v8ek8SSjzOGD+zH0i4ihUYgW0nw9sxPr1/vSetpqo0N0N4VJljT9Vbw==` | 영테크 · 캐시팡팡 · 머니트리 안드(옛 줄) |
| 0.4.19 | `0.4.19-mc2` | `jcurve-mission-0.4.19-mc2.tgz` | `1979f21c9e84a6bd8939aa475cf35a0838a07afeab38fce260c0570b96a391ca` | `sha512-NzRF0Ij4Idr1zlJDbBNCUsfibsCupoSF3bWnLEF/P+4lQhy2Yhc3r2AinBZVkOvu+NxW1LOHNxnXUlRaUohorg==` | 머니트리 iOS |
| 0.7.13 | `0.7.13-mc2` | `jcurve-mission-0.7.13-mc2.tgz` | `5dc222092c488f310b4964ba34f10613739810db4d639da04323adc8b1e286f5` | `sha512-6h6WCn8nOouT3K652AxB262ENLbLhJpVzKgwQ9ny+LmySh2feT/d1IcvybLdTVCYRESU9YpEBHm9fwCQYs0V5g==` | 감자밭 |
| 0.7.14 | `0.7.14-mc2` | `jcurve-mission-0.7.14-mc2.tgz` | `66b1aed2df66000ad4afd3dc48e8884ab8f1ff22ea9c53d4ad3e6b097bf50f31` | `sha512-ye70dXnShYt+F0z1q5OIJwfhIefTA/I7e97Iw53XzcHSv4z5lf3AC+oNVdN4TnFGqTDsds0SHcpQOP7+rmh1cg==` | 감자밭 |
| 0.7.17 (최신 줄) | `0.7.18` | `jcurve-mission-0.7.18.tgz` | `7d2c4d86f79a3b7c6a85c168607fd1330b7ac264456926f08829c7fe2e58de9b` | `sha512-UyIDHkecQlQQOHxSFCuLFAt62bSWMbQJr9J0ZzaWukFz/uxi9heqd/q+U6rIGFePcKIMCAS6toGsu3pnZYFDtw==` | 새 최신 판(0.7.17 위 · npm pack) |

(`INTEGRITY-mc2.txt` 에 같은 값 + 만든 베이스 sha.) **내가 본 운영 줄은 최근 작업 가지에서 읽은 것이다 — 각 앱 운영 맨 위가 실제로 vendor 한 mission 판을 앱 담당이 확인하고, 표에 없는 판(0.5.0 · 0.6.0 · 0.4.17/0.4.18 등)을 쓰는 앱이 있으면 알려 달라: 그 줄의 같은 패치 판을 만든다.** 영테크 · 캐시팡팡 · 머니트리 안드의 0.4.16 은 벤더 tgz 가 바이트까지 같았다(sha256 `3ed54cb5…`).

## 무엇이 다른가 (JS 만 — 네이티브 바이트 동일 → OTA 가능)
각 베이스 tgz 에서 **다섯 멤버만** 바꿨다: `package.json`(버전) · `src/pages/StepsPage.tsx` · `src/pages/StepsPage.test.ts` · `dist/pages/StepsPage.js` · `dist/pages/StepsPage.d.ts`. 나머지 멤버(0.4.16 줄 109개 · 0.4.19 줄 124개 · 0.7.13 줄 109개 · 0.7.14 줄 117개)는 바이트까지 같고, 멤버 목록 · 순서 · 헤더도 같다. 미션 패키지에 안드로이드/iOS 네이티브 파일은 없다. 벤더 tgz 가 CRLF 인 줄(0.4.16 · 0.7.13)은 줄바꿈을 베이스에 맞췄다. 정확한 차이: `mission-0.4.16-mc2.diff`(0.4.16 줄 · 0.4.19 · 0.7.13 · 0.7.14 패치도 StepsPage 4개 파일은 같은 내용), `mission-0.7.18.diff`.
**게이트 5번**: 허용 목록에는 위 표의 sha256(또는 integrity)을 쓰면 된다. 변경 범위는 위 다섯 파일뿐이다.

## 붙이는 법 (앱마다)
`package.json` 의 `@jcurve/mission` → `file:vendor/jcurve-mission-<새 판>.tgz`, 락의 `file:` 주소 · 버전 · integrity(= `npm install` 이 만든 값), 옛 tgz 삭제(vendorGuard 시험이 있으면 시험의 이름도), 앱 소스는 그대로. **화면 모양이 바뀌는 OTA 라서 시뮬레이터/실기기에서 만보기 화면을 한 번 본 뒤 발행**(아래 「본 것 / 못 본 것」).

## 본 것 / 못 본 것 (솔직히)
- 본 것: 다섯 패키지 모두 풀어서 그 안의 `StepsPage.test.ts` 를 돌려 8개 통과(새 모양 순서 · 걸음 수 한 번만 · `mergedCard={false}` 면 예전 모양 · 받을 횟수 0 상태 줄 · 걸음 기능 없는 옛 빌드), 0.7.18 은 mission 전체 시험 294개 통과. dist 는 tsc 가 낸 파일 그대로, 기본값 `mergedCard = true` 확인.
- 못 본 것: **실제 화면에서 눈으로 본 적은 없다**(react-native 렌더 시험은 트리 순서만 본다). 글자 크기 · 간격은 에그머니 7e8f2a30 의 같은 카드를 따라 했지만 이 패키지의 테마(`resolvePageTheme`)로 그려지므로 앱마다 한 번은 봐야 한다.

## 소스
- `jcurve-packages` 가지 `feat/mission-0.4.16-merged-card` @ `6e117f5` (0.4.16 `63a7097` 위) — 0.4.16-mc2 의 소스
- `feat/mission-0.7.18-merged-card` @ `288ec3b` (0.7.17 `22bcc1b` 위) — 0.7.18
