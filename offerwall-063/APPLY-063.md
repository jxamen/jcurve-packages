# @jcurve/offerwall 0.6.3 — `<OfferwallCombos>` 가 `loadSnapPlay` · `onSnapPlayAds` 를 `ComboEntry` 로 넘긴다

**JS 만 · 0.6.2 tgz 와 비교해 멤버 77개 중 5개(README · dist/offerwallCombos.js · .d.ts · src/offerwallCombos.ts · package.json)만 다르고 네이티브 13개 멤버는 바이트까지 같다.** 판 · sha256 · integrity 는 `INTEGRITY-0.6.3.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓰고 손으로 옮기지 말 것). 0.6.2 를 쓰는 곳은 이 판으로 교체하면 된다(0.6.2 의 나머지 동작은 그대로).

**왜**: 에그머니는 `ComboEntry` 를 직접 쓰지 않고 공용 `<OfferwallCombos>` 를 쓰는데, 이 래퍼가 `ComboEntry` prop 을 하나씩 적어 넘기는 방식이라 0.6.2 의 새 prop 이 도중에 사라졌다(찬스2 칩이 안 나옴).
**무엇이 바뀌었나**: `OfferwallCombosProps` 에 `loadSnapPlay` · `onSnapPlayAds` 추가, 받은 그대로 `ComboEntry` 로 전달. `loadSnapPlay` 의 본문은 찬스1 용 「서버가 `display.chance` 를 말해야 칩이 켜진다」 가드를 거치지 않는다(찬스2 는 행이 있으면 켜짐). 안 주면 찬스2 에는 칩이 없다.
**앱 연결(한 줄)**: `<OfferwallCombos … loadSnapPlay={() => <offerwall/combos?source=snapplay 를 부르는 함수 — 파싱된 JSON 본문을 돌려준다>} />`. 서버 설정 `content/config/snapplay` 의 `listPlacement` 와 `source=snapplay` 응답은 0.6.2 때와 같다(`APPLY-062.md`).
**시험**: 386개 통과(4개 추가) — 래퍼에 `loadSnapPlay` 를 주면 찬스2 칩 · 시트가 그 목록을 보이고 행을 누르면 `openAdItem`, 없으면 찬스2 에 칩 없음, `onSnapPlayAds` 전달, 그리고 `ComboEntryProps` 의 모든 prop 이 (`url` · `headers` · `sample` · `onPressMission` · `copyText` · `campaigns` 만 빼고) 래퍼에서 넘어가는지(앞으로 새 prop 을 빠뜨리면 시험이 깨짐).
**못 본 것**: 실기기 — 0.6.2 의 「못 본 것」(`APPLY-062.md`) 그대로다.
