# @jcurve/offerwall 0.4.3 — 월의 20초 오류 타이머가 회원(`usn`)이 없는 동안은 돌지 않는다 (0.4.x 줄)

**JS 만 · 0.4.2 tgz(`offerwall-040/jcurve-offerwall-0.4.2.tgz`)와 비교해 멤버 68개 중 4개(README · dist/OfferwallScreen.js · src/OfferwallScreen.ts · package.json)만 다르고 네이티브 10개 멤버는 바이트까지 같다.** 판 · sha256 · integrity 는 `INTEGRITY-0.4.3.txt`.
`OfferwallScreen` 의 오류 타이머는 `usn` 이 null 인 동안(앱의 `open()` 이 끝나기 전)에도 돌아 월이 만들어지기 전에 「찬스를 불러오지 못했어요」가 뜰 수 있었다. 이제 `usn` 이 없으면 타이머를 켜지 않고 `usn` 이 오는 순간부터 20초를 센다. `usn` 이 있으면 지금과 똑같다. 이 줄에는 탭 · 숨김이 없어 이것 하나만 해당한다(0.6.4 의 숨김 정지 · 자동 재시도 · 칩 inset 고침은 0.4.x 에 해당 없음).
시험 301개(3개 추가: 회원 없이 25초 뒤 오류 없음·회원이 오면 그때부터 20초, 회원이 처음부터 있으면 그대로, 다시 시도 단추 그대로). 규칙을 일부러 깨면 첫 시험이 실패하는 것을 확인했다. 실기기는 못 봤다.
