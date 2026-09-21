# @jcurve/auth

리워드 앱 세 개(**당근캐시 · 꿀꿀캐시 · 꼬꼬농장**)가 같이 쓰는 **소셜 로그인**.

로그인은 앱마다 다시 만들 자리가 아니다. 겉보기에는 「카카오 버튼을 누르면 토큰을 받아
서버에 준다」가 전부인데, 실제로는 **기기에서만 드러나는 함정**이 줄줄이 있다. 아래는 전부
실기기에서 한 번씩 밟고 고친 것이고, 앱을 새로 만들 때마다 **다시 밟았다.**

---

## 왜 이 패키지가 있나 — 각 줄이 사고 하나다

| | 밟은 곳 | 증상 |
|---|---|---|
| ① SDK 로그인이어야 한다 | 꼬꼬농장(옛날) | 웹 OAuth 를 쓰던 시절 **로그인 단계에서 절반이 빠졌다**(첫 실행 55명 중 27명). 그 뒤 SDK 로 옮겼다 — **되돌아가지 말라는 기록**이다 |
| ② 네이티브는 지연 `require` | 공통 | 모듈이 빠진 빌드에서 정적 import 는 **앱 시작 자체를 죽인다** |
| ③ 카카오는 초기화 전에 부르면 죽는다 | 꿀꿀캐시 | 로그인 화면이 뜨고 **1.2초 만에 크래시** — JS `try/catch` 로 안 잡힌다 |
| ④ `login()` 한 줄은 사유를 안 남긴다 | 꼬꼬농장 | 카카오 가입 0 명인데 **왜인지 알 수 없었다** |
| ⑤ 구글 취소는 예외가 아니다 | 당근캐시 | 그냥 취소했는데 **「로그인하지 못했어요」 오류창** |
| ⑥ 애플 이름은 최초 1회 | 공통 | 그때 서버에 안 넘기면 **영영 못 받는다** |
| ⑦ 돌아오는 순간의 fetch 가 끊긴다 | 공통(iOS) | 토큰은 받았는데 서버 교환만 실패 |

③ 이 특히 무섭다. 네이티브가 **메인 스레드에서** 던져서 자바스크립트로는 못 막고,
**iOS 는 같은 코드로도 버텨서** 안드로이드 실기기에 올리기 전까지 안 보인다.

```
lateinit property hosts has not been initialized
  at RNCKakaoUserModule.isKakaoTalkLoginAvailable$lambda$9
```

---

## 설치

```bash
npm i "git+https://github.com/jxamen/jc-auth.git#<커밋 sha>"
```

**주소 형식을 지켜라.** `github:jxamen/jc-auth` 로 적으면 npm 이 lockfile 에 `git+ssh://` 로
적어 넣고, 그러면 **GitHub SSH 키가 없는 기계에서는 받지도 못한다** — 맥 빌드 기계와
**EAS 클라우드 빌드**가 거기 걸린다(2026-09-18 앱빌드 세션 제보).

**저장소가 비공개라 받는 기계에 GitHub 인증이 있어야 한다.** 그리고 npm 은 GitHub 주소를
lockfile 의 `resolved` 에 **`git+ssh://` 로 적는다** — `git+https://` 로 써 넣어도 그렇다.
SSH 키가 없는 기계(맥 빌드 기계·EAS 클라우드)는 거기서 막힌다. 한 줄로 푼다:

```bash
git config --global url."https://github.com/".insteadOf ssh://git@github.com/
```

기계마다 한 번만 하면 된다(GitHub HTTPS 자격증명은 `gh auth login` 이 넣어 준다).
이게 번거로워지면 **저장소를 공개로 돌리는 것**도 방법이다 — 이 패키지에는 키도 서버 주소도
없다. 다만 주석에 이탈률·앱 이름 같은 내부 내용이 있어 **오너가 정할 일**이다.

**커밋 sha 로 고정하라.** 브랜치로 두면 기계마다 다른 코드를 받아, 「내 기계에서는 되는데」가
난다. 올릴 때마다 sha 를 바꾸고 세 앱의 lockfile 을 같이 올린다.

`dist/` 를 저장소에 함께 두므로 **설치할 때 빌드하지 않는다.** Metro 설정도 필요 없고,
받는 기계에 타입 패키지가 없어도 된다 — 전에 `prepare` 로 `tsc` 를 돌리게 두었다가
깨끗한 `npm ci` 에서 `Cannot find name 'require'` 로 죽었다(만든 기계에서는 상위 폴더의
`@types/node` 가 잡혀 **거기서만 통과**했다).

## 쓰는 법

앱마다 다른 것은 **셋뿐**이다. 키, 서버 호출, 기록.

```ts
// src/auth.ts
import { createAuth } from '@jcurve/auth';
import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID, KAKAO_NATIVE_APP_KEY } from './config';
import { loginApple, loginGoogle, loginKakao, type AuthResult } from './api';
import { track } from './track';

const auth = createAuth<AuthResult>({
  keys: {
    kakaoNative: KAKAO_NATIVE_APP_KEY,
    googleWeb: GOOGLE_WEB_CLIENT_ID,
    googleIos: GOOGLE_IOS_CLIENT_ID,
  },
  server: { kakao: loginKakao, google: loginGoogle, apple: loginApple },
  track,
});

export const { initKakao, availableProviders, kakaoTalkAvailable, signIn } = auth;
export type { Provider } from '@jcurve/auth';
```

`signIn(provider)` 이 돌려주는 것은 **서버 호출이 돌려준 그대로**다(`createAuth<AuthResult>`).
앱마다 세션 모양이 달라도 패키지가 건드리지 않는다.

## 꼭 지킬 것

**화면이 뜨는 순간 도는 자리에서 카카오 네이티브를 부르지 마라.**

`availableProviders()` 는 그래도 되게 만들어 두었다 — 모듈 객체의 필드를 **읽기만** 한다.
「카카오톡이 없으면 버튼을 아래로 내린다」 같은 것을 붙일 때는 반드시 `kakaoTalkAvailable()`
을 쓴다. 그 안에서 초기화를 먼저 한다. 직접 `isKakaoTalkLoginAvailable()` 을 부르면 ③ 을 밟는다.

```ts
// ✗ 화면이 뜨는 순간 죽는다
const talk = await require('@react-native-kakao/user').isKakaoTalkLoginAvailable();

// ✓
const talk = await kakaoTalkAvailable();
```

**`login_native_fallback` 을 서버 화이트리스트에 넣어라.** 이 패키지가 내는 이름이다.
없으면 **400 으로 버려지고** 어드민 퍼널에서 그 단계만 조용히 비어 보인다
(`FunnelController::EVENTS`, 앱의 `SERVER_EVENTS` 둘 다).

사유는 갈래마다 다르다 — 이것이 ④ 를 막는 장치다.

| `why` | 뜻 |
|---|---|
| `no_talk` | 카카오톡이 없거나 로그인 안 돼 있음 |
| `sdk_…` | 카카오톡은 있는데 SDK 가 실패(키 해시·서명 문제가 여기 잡힌다) |
| `no_sdk` | SDK 초기화가 실패함(**키가 틀렸을 때 여기 잡힌다**) |
| `cannot_tell` | 옛 SDK 라 판단할 수단이 없음 |
| `server_reject` | 토큰은 받았는데 **서버가 거절**(앱 키가 다른 앱 것일 때) |

**취소 판별은 `isCancel()` 을 쓴다.** 직접 정규식을 쓰면 `user_cancel`·`12501` 을 빠뜨린다.
그러면 그만둔 사람에게 오류창이 뜨고, 퍼널에서 이탈이 **실패로 부풀어** 보인다.

## 웹 폴백을 직접 만들 때 (안드로이드)

이 패키지는 **웹 창을 직접 열지 않는다.** 카카오는 SDK 의 `useKakaoAccountLogin` 이,
구글은 구글 SDK 가 알아서 한다. 그런데 앱에서 `openAuthSessionAsync` 같은 것으로
**직접 브라우저를 여는 자리를 만든다면**, 안드로이드에서는 열기 전에 먼저 붙여야 한다.

```ts
if (Platform.OS === 'android') await WebBrowser.warmUpAsync();
```

안 붙이고 열면 시스템이 Custom Tabs 대신 **일반 인텐트로 넘겨 다른 앱이 링크를 가로챈다.**
꼬꼬농장은 구글 로그인을 처음 누르면 **메일 쓰기가 열리고**, 뒤로 나와 다시 누르면 되는
증상으로 겪었다(2026-09-10).

## 이 패키지가 **안 하는** 것

- **화면** — 버튼 배치·문구는 앱마다 다르다
- **게스트 로그인** — 서버 계약이 앱마다 다르다. 꼬꼬농장은 **게스트 → SNS 승격**
  (`guestLinkCode` 로 같은 회원 번호를 잇는 것)까지 있어서, 옮길 때 그 계약을 먼저 맞춰야 한다
- **`busy` 관리** — 로그인 중 앱 밖에 나갔다 **아이콘으로** 돌아오면 커스텀 탭이 닫혀
  약속이 영영 안 끝난다. 그 상태로 `if (busy) return` 을 두면 **모든 로그인 버튼이 먹통**이
  된다(당근캐시 2026-09-18 실기기). 앱 store 에서 `AppState` 가 active 가 될 때
  **2.5초 기다렸다가** 안 끝났으면 풀어라 — 바로 풀면 정상 로그인에 오탐이 난다

## 고칠 때

```bash
npm run build     # dist/ 다시 만들기
npm test          # 동작 + 소스 규칙 + **dist 가 소스와 같은지**
```

**`dist/` 를 꼭 같이 커밋하라.** 설치할 때 빌드하지 않으므로, 소스만 고치고 `dist/` 를 안
만들면 **세 앱이 옛 코드를 받는다** — 고쳤다고 믿는데 안 고쳐져 있고 아무 오류도 안 난다.
`npm test` 가 그걸 잡는다(지금 빌드한 것과 글자까지 비교한다).

테스트가 **소스 글자까지** 본다. `@react-native-kakao/*` 는 테스트 환경에서 못 불러와
동작으로 막을 수 없는데, ③ 은 어기면 앱이 죽는 종류라 무른 방식으로라도 지킨다.

고친 뒤에는 **세 앱 모두** `npm update @jcurve/auth` 를 해야 한다. 한 곳만 올리면
같은 버그를 한 앱만 갖게 된다 — 이 패키지를 만든 이유가 그것이다.
