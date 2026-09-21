# jcurve-packages

리워드 앱들이 **같이 쓰는 로직**. 화면은 없다 — 디자인은 앱마다 다르고, 달라도 되는 것이다.

## 쓰는 법

`package.json` 에 릴리스 파일 주소를 적는다.

```json
"@jcurve/phone": "https://github.com/jxamen/jcurve-packages/releases/download/phone-v1.0.0/jcurve-phone-1.0.0.tgz"
```

```ts
import { createPhone, format, looksValid, message } from '@jcurve/phone';
```

> npm 은 저장소 하위 폴더를 직접 설치하지 못한다. 그래서 릴리스에 올린 파일을 가리킨다.
> 공개 저장소라 **토큰이 필요 없다** — 사람도 CI 도 그대로 받는다.

## 패키지

| 이름 | 무엇 | 화면 |
|---|---|---|
| `@jcurve/auth` | 소셜 로그인 — 카카오·구글·애플 (SDK 방식) | 없음 |
| `@jcurve/apphub` | 앱 모아보기 — 계열 앱 목록 시트 | 시트만 공용, 입구 버튼은 앱마다 |
| `@jcurve/phone` | 휴대폰 번호 인증 — 서버 호출·번호 검증·오류 문구 | 없음 |
| `@jcurve/updates` | OTA — 언제 받고 언제 적용할지 | 없음 (띠는 앱마다) |
| `@jcurve/ocr` | 영수증 사진 → 읽은 값. 어드민에서 켠 앱만 | 없음 |

## 새 판 내기

```
cd packages/<이름> && npx tsc -p tsconfig.json && npm pack
gh release create <이름>-v<버전> jcurve-<이름>-<버전>.tgz
```

`dist/` 는 커밋한다 — 설치하는 쪽에서 빌드하지 않는다.
