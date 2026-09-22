# jcurve-packages

리워드 앱들이 **같이 쓰는 로직**. 화면은 없다 — 디자인은 앱마다 다르고, 달라도 되는 것이다.

## 쓰는 법

`package.json` 에 릴리스 파일 주소를 적는다.

```json
"@jcurve/phone": "https://github.com/jxamen/jcurve-packages/releases/download/phone-v1.2.0/jcurve-phone-1.2.0.tgz"
```

```ts
import { createPhone, format, looksValid, message } from '@jcurve/phone';
```

> npm 은 저장소 하위 폴더를 직접 설치하지 못한다. 그래서 릴리스에 올린 파일을 가리킨다.
> 공개 저장소라 **토큰이 필요 없다** — 사람도 CI 도 그대로 받는다.

## 패키지

| 이름 | 무엇 | 화면 |
|---|---|---|
| `@jcurve/auth` | 소셜 로그인 + 가입 퍼널 기록 — 카카오·구글·애플 SDK, 안 되면 서버 웹 로그인 (2.1.2) | 없음 |
| `@jcurve/apphub` | 앱 모아보기 — 계열 앱 목록 시트 | 시트만 공용, 입구 버튼은 앱마다 |
| `@jcurve/phone` | 휴대폰 번호 인증 — 서버 호출·번호 검증·오류 문구 (1.2) | 없음 |
| `@jcurve/updates` | OTA — 받은 새 버전을 로그인과 겹치지 않는 순간에 적용 (꼬꼬농장 방식, 2.5.1 — 앞으로 올 때 받기 선택 · 로그인 중엔 안 받음 · `otaHeaders()` 판 헤더) | 없음 |
| `@jcurve/ocr` | 영수증 사진 → 읽은 값. 어드민에서 켠 앱만 | 없음 |
| `@jcurve/money` | 현금 인출 검증 — 금액·계좌·예금주·번호 (1.0.1) | 없음 |
| `@jcurve/identity` | 간편인증(KICA) 본인확인 — CI 로 1인 1계정 | 없음 |
| `@jcurve/notify` | 로컬 알림(문구는 어드민) + 원격 푸시 받기 — 기기 토큰 등록·열람 보고·실패 알림(서버가 FCM·APNs 로 직접 발송, 1.2) | 없음 |
| `@jcurve/ads` | AdMob 보상형 광고 — 안전하게 띄우고 끝까지 봤는지 알려 준다(꼬꼬농장 방식, 1.4 — 미리 받지 않음 · ATT 는 켤 때 · `advertisingId()` 읽기만) | 없음 (대기·목업 화면은 앱마다) |

## 새 판 내기

```
cd packages/<이름> && npx tsc -p tsconfig.json && npm pack
gh release create <이름>-v<버전> jcurve-<이름>-<버전>.tgz
```

`dist/` 는 커밋한다 — 설치하는 쪽에서 빌드하지 않는다.
