# @jcurve/kitcheck

공용 패키지(`@jcurve/*`) **판 점검** — 이 저장소에 깔린 판과 최신 릴리스를 견줘 옛 판이 있으면 표로 보여 주고 실패(exit 1)한다.
저장소가 우리 것이든 외부 것이든 같다(2026-11-05 대표님 「저장소가 달라도 패키지 최신 버전 점검하는 건 기능을 설치하면 되는 거 아냐」).

## 한 줄로 돌리기 (설치 없이)
```sh
npx -y https://github.com/jxamen/jcurve-packages/releases/download/kitcheck-v1.0.0/jcurve-kitcheck-1.0.0.tgz
```
저장소 뿌리(package.json 이 있는 곳)에서 돌린다. 결과 예:
```
jcurve-kitcheck (최신 판 표: api.j-curve.co.kr)
@jcurve/receipt-link  깔린 판 1.1.2    최신 1.1.3    옛 판 ✗
@jcurve/updates       깔린 판 2.6.3    최신 2.6.3    최신 ✓
옛 판 1개 — package.json 의 주소를 최신 판으로 바꾸고 npm install 하세요 (https://github.com/jxamen/jcurve-packages/releases)
```

## 저장소에 설치해 두기 (빌드 · CI 마다)
`package.json`
```json
"devDependencies": { "@jcurve/kitcheck": "https://github.com/jxamen/jcurve-packages/releases/download/kitcheck-v1.0.0/jcurve-kitcheck-1.0.0.tgz" },
"scripts": { "kitcheck": "jcurve-kitcheck" }
```
```sh
npm run kitcheck            # 옛 판이 있으면 exit 1 — CI 를 멈춘다
npx jcurve-kitcheck --warn  # 보여만 주고 exit 0
npx jcurve-kitcheck --json  # 기계용
```

## 어디서 최신 판을 읽나
1. `GET https://api.j-curve.co.kr/v1/packages/latest` (공개 · 자격 없음 · 10분 캐시). `?have=receipt-link@1.1.2,updates@2.6.3` 을 붙이면 옛 판만 `old` 로 돌려준다.
2. 안 되면 GitHub 릴리스 목록(`jxamen/jcurve-packages`, 태그 `<이름>-v<판>`).

깔린 판은 `node_modules/@jcurve/<이름>/package.json` 에서, 아직 설치 전이면 의존성 주소 속 판(`…-v1.1.2/…-1.1.2.tgz`)에서 읽는다.
비밀 값은 쓰지 않고 네트워크는 읽기만 한다. 종료 코드: 0 모두 최신 · 1 옛 판 있음 · 2 최신 판 표를 못 읽음.

## 서버 쪽 표시
`@jcurve/receipt-link` 1.1.3 부터 실행 끝 보고(`receipt-link/run-end`) · 실패 기록(`receipt-link/fails`)에 자기 판 `pkg` 를 실어 보낸다.
서버는 최신보다 낮으면 `receipt_link.pkg_old` 경고 로그와 실패 기록 줄의 `info.pkg_old`(최신 판)로 남긴다 — 어드민 「전자 영수증 실패 기록」에서 보인다.
