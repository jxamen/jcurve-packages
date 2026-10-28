# @jcurve/offerwall 0.2.3-ut1 — 월의 20초 오류 타이머가 회원(`usn`)이 없는 동안은 돌지 않는다 (0.2.3 에 한 줄)

**JS 만 · 기준 `jcurve-offerwall-0.2.3.tgz`(sha256 `f9c0acc0ca1e8706630ae796427461c0710752c02927f6603750671b2cfaa3b4`, 8줄이 모두 같은 파일, 멤버 16개)와 비교해 다른 멤버는 4개뿐이고 나머지 12개(android · ios · podspec · plugin 등 네이티브 전부)는 바이트까지 같다.** 판 · sha256 · integrity 는 `INTEGRITY-0.2.3-ut1.txt`(파일에서 계산한 값 — 락은 `npm install` 이 만든 값을 쓸 것).

| 다른 멤버 | 무엇이 다른가 |
|---|---|
| `src/OfferwallScreen.ts` | 25줄 `if (loaded) return;` → `if (loaded \|\| !usn) return;` (이 한 줄) |
| `dist/OfferwallScreen.js` | 같은 줄을 컴파일한 17줄 `if (loaded)` → `if (loaded \|\| !usn)` (이 한 줄) |
| `package.json` | `version` 만 `0.2.3` → `0.2.3-ut1` (프로그램으로 비교: 다른 키 없음) |
| `README.md` | 끝에 한 문단 추가(기존 내용은 그대로) |

**버전 이름에 대해**: 요청은 `0.2.4` 였지만 `0.2.4` 가 이미 다른 내용(쉽게 1만P 모으기 칩 · 시트 · 홈 배너, JS만 — `outbox/offerwall-030/jcurve-offerwall-0.2.4.tgz`, sha256 `a8a3a958…`, 멤버 34개)으로 만들어져 있어서, 같은 이름에 다른 바이트가 생기면 락 integrity 가 어긋나고 헷갈린다. 그래서 `0.2.3-ut1`(= 0.2.3 + usn timer 1)로 했다. 꼭 `0.2.4` 가 필요하면 말해 주세요.
**소스**: `jcurve-packages` 가지 `fix/offerwall-023-usn-timer` @ `c036485` — 0.2.3 을 만든 정확한 커밋 `0e555d2`(그 커밋의 16개 파일이 기준 tgz 와 모두 바이트 동일함을 확인) 위의 한 커밋. (`offerwall-v0.2.3` 태그는 이 커밋보다 앞서 있어 OfferwallScreen 이 없으니 쓰지 말 것.)
**시험**: 28개 통과(기존 25 + 3): `usn` 없으면 25초 뒤에도 오류 없음 · `usn` 이 오면 그때부터 20초 · `usn` 이 처음부터 있으면 20초에 오류/로드되면 없음(그대로) · 「다시 시도」 단추 그대로. 규칙을 일부러 깨면 첫 시험이 실패하는 것을 확인했다. **실기기는 못 봤다.**
