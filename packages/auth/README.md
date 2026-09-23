# @jcurve/auth

리워드 앱들이 같이 쓰는 **소셜 로그인 + 가입 퍼널 기록**.

**2.0**(2026-09-21) — 꼬꼬농장이 실기기에서 쌓은 장치를 얹었다: SDK 가 안 되면 서버 웹 로그인으로,
늦게 오는 복귀 주소, 게스트 농장 잇기, 어드민이 켠 로그인만, 로그인 중 재시작 막기, 티켓 밀어 넣기(로그인 CSRF)
막기, 가입 퍼널을 앱마다 같은 이름으로. **전부 선택**이라 1.0 처럼 셋(키·서버·기록)만 줘도 그대로 돈다.
각 장치가 왜 있는지는 `src/index.ts` 머리말 ①~⑭ 가 원본이다.

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

`package.json` 에 릴리스 파일 주소를 적는다(공개 저장소라 토큰이 필요 없다).

```json
"@jcurve/auth": "https://github.com/jxamen/jcurve-packages/releases/download/auth-v2.0.0/jcurve-auth-2.0.0.tgz"
```

**앱에 다음 JS 패키지가 모두 있어야 한다.** 패키지는 네이티브 모듈을 지연 `require` 로 집어서 **실행 때는**
모듈이 없어도 넘어가지만, **Metro 는 `require('…')` 를 빌드 때 찾는다**(`allowOptionalDependencies` 기본 꺼짐) —
하나라도 없으면 번들이 깨진다:

`@react-native-kakao/core` · `@react-native-kakao/user` · `@react-native-google-signin/google-signin` ·
`expo-apple-authentication` · `expo-web-browser` · `@react-native-firebase/analytics` ·
`expo-application` · `expo-modules-core` · `expo-updates`

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

### 2.0 — 웹 로그인·게스트·퍼널까지 (선택)

```ts
import { AuthError, createAuth, createFunnel, createTrack } from '@jcurve/auth';

const funnel = createFunnel({ base: API, appToken: APP_TOKEN, storage: AsyncStorage });
export const track = createTrack({ funnel });          // GA4 + 서버 퍼널에 같은 이름으로

export const auth = createAuth<AuthResult>({
  keys: { kakaoNative: KAKAO_NATIVE_APP_KEY, googleWeb: GOOGLE_WEB_CLIENT_ID, googleIos: GOOGLE_IOS_CLIENT_ID },
  server: { kakao: loginKakao, google: loginGoogle, apple: loginApple },
  track,
  web: {
    // nonce 는 시작 주소와 교환 본문 **둘 다**에 싣는다 — 한쪽만 실으면 서버가 모든 교환을 거절한다
    start: (p, link, nonce) => `${API}/auth/start?provider=${p}&nonce=${nonce}` + (link ? `&link=${link}` : ''),
    returnUrl: 'myapp://auth',
    exchange: (ticket, nonce) => api.post('auth/exchange', { ticket, nonce }),
    // 서버가 만든 nonce — 기기에서 만들면 짐작될 수 있다(RN 기본엔 보안 난수가 없다)
    nonce: async () => (await api.post('auth/nonce')).nonce,
  },
  providers: () => serverProviders,                    // GET /auth/providers — 비어 있으면 막지 않는다
  guest: { active: () => !!guestToken, link: () => guestLinkCode(guestToken) },
});

funnel.appOpen();                                      // 앱 실행마다 한 번
auth.onLateReturn((p) => auth.signIn(p));             // 창 밖으로 늦게 온 복귀 — 받은 제공자로
try {
  const session = await auth.signIn('kakao');
} catch (e) {
  // 취소·busy(다른 로그인이 도는 중)는 오류창을 띄우지 않는다. 실패는 e.tag 에 어디서 끊겼는지가 있다
  if (e instanceof AuthError && (e.code === 'cancelled' || e.code === 'busy')) return;
  showError(e instanceof AuthError ? e.tag : '');
}
```

**OTA 로 스스로 재시작할 때는 `auth.hasTriedAuth()`·`auth.isAuthorizing()` 을 본다** — 로그인 창을 다녀오는 중에
재시작하면 돌아올 곳이 사라진다(꼬꼬농장 신규 설치 134대 중 57대).

**이미 퍼널을 쓰던 앱은 저장 키를 그대로 준다**(`createFunnel({ keys: { device: '쓰던_키' } })`) — 바뀌면
하루에 전 사용자가 「첫 실행」으로 찍힌다.

**1.0 에서 올릴 때 달라지는 것** — 폴백 사유를 `why` 가 아니라 `code` 로 싣는다. 취소는 SDK 오류 대신
`AuthError`(`code: 'cancelled'`, 메시지 `user_cancel`)로 온다 — `isCancel(e.message)` 는 그대로 참이다.

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

| `code` (1.0 은 `why`) | 뜻 |
|---|---|
| `no_talk` | 카카오톡이 없거나 로그인 안 돼 있음 |
| `sdk_…` | 카카오톡은 있는데 SDK 가 실패(키 해시·서명 문제가 여기 잡힌다) |
| `no_sdk` | SDK 초기화가 실패함(**키가 틀렸을 때 여기 잡힌다**) |
| `cannot_tell` | 옛 SDK 라 판단할 수단이 없음 |
| `server_reject` | 토큰은 받았는데 **서버가 거절**(앱 키가 다른 앱 것일 때) |

**취소 판별은 `isCancel()` 을 쓴다.** 직접 정규식을 쓰면 `user_cancel`·`12501` 을 빠뜨린다.
그러면 그만둔 사람에게 오류창이 뜨고, 퍼널에서 이탈이 **실패로 부풀어** 보인다.

## 웹 폴백을 직접 만들 때 (안드로이드)

2.0 의 `web` 을 주면 **패키지가 창을 열고 아래도 한다.** 앱에서 `openAuthSessionAsync` 같은 것으로
**따로 브라우저를 여는 자리를 만든다면**, 안드로이드에서는 열기 전에 먼저 붙여야 한다.

```ts
if (Platform.OS === 'android') await WebBrowser.warmUpAsync();
```

안 붙이고 열면 시스템이 Custom Tabs 대신 **일반 인텐트로 넘겨 다른 앱이 링크를 가로챈다.**
꼬꼬농장은 구글 로그인을 처음 누르면 **메일 쓰기가 열리고**, 뒤로 나와 다시 누르면 되는
증상으로 겪었다(2026-09-10).

## 이 패키지가 **안 하는** 것

- **화면** — 버튼 배치·문구는 앱마다 다르다
- **게스트 시작** — 서버 계약이 앱마다 다르다. 가입할 때 게스트로 키운 것을 **잇는 것**(`guest`)은 2.0 이 한다
- **화면의 `busy` 를 푸는 것** — 로그인 중 앱 밖에 나갔다 **아이콘으로** 돌아오면 커스텀 탭이 닫혀
  약속이 영영 안 끝난다. 그 상태로 `if (busy) return` 을 두면 **모든 로그인 버튼이 먹통**이
  된다(당근캐시 2026-09-18 실기기). **언제 풀지는 2.3 의 `createReturnWatch` 가 판단한다**(아래) —
  앱은 풀기만 한다. 풀 때 **`auth.abandon()` 도 같이 부른다** — 안 부르면 화면은 풀려도 패키지가
  옛 약속을 붙잡고 있어 같은 버튼은 그 약속을 또 받고 다른 버튼은 `busy` 가 된다.

  ```ts
  const watch = createReturnWatch({ busy: () => busyRef.current, onStuck: () => { auth.abandon(); clearBusy(); } });
  const sub = AppState.addEventListener('change', (s) => watch.saw(s));
  // 화면을 떠날 때: sub.remove(); watch.stop();
  ```

  ⚠ `busy` 는 **값이 아니라 함수**다(`() => boolean`). 패키지는 타이머가 터지는 **그때** 읽는다 —
  값으로 넘기면 창을 열던 순간의 옛 값으로 판단해 **도는 로그인을 놓거나 먹통을 안 풀어 준다.**
  리액트 state 를 그대로 넘기지 말고 `busyRef.current` 처럼 최신을 읽는 것을 넘겨라(총무님 2026-09-22).

  이 한 줄에 사고 셋이 들어 있다. ① `inactive ↔ active` 를 「돌아왔다」로 읽으면 iOS 앱 안 로그인 창 ·
  구글 계정 고르기 중에 로그인을 잊는다(영테크 · 당근 a93c018 · 꿀꿀 82e748c). ② 중간 `inactive` 에서
  깃발을 지우면 진짜 복귀를 놓쳐 ①의 먹통이 되살아난다(총무님). ③ 복귀마다 타이머를 새로 걸지 않으면
  옛 타이머가 뒤늦게 울려 **그 사이 시작된 정상 로그인을 끊는다**(당근 0079d15 · 영테크 f9f643b).

- **안내 팝업을 안 띄우는 것** — 풀 때 「로그인 창이 닫혔어요」 같은 팝업을 띄우지 마라. iOS 에서
  로그인 창 위에 RN `Modal` 을 올리면 **보이지 않는 막이 남아 화면 터치가 전부 막힌다.** 조용히 푼다.
  ⚠ 패키지는 이 실수를 막아 주지 못한다 — 앱이 자기 모듈(`authReturnWatch.ts` 등)을 지우고 패키지로
  갈아탈 때 **그 모듈에 붙어 있던 「팝업이 되살아나는지 보는 시험」도 같이 사라진다.** 그 시험은
  별도 파일로 남겨라(영테크 2026-09-22 제안).

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

고친 뒤에는 새 판을 릴리스하고 **쓰는 앱 모두** 릴리스 주소를 올린다. 한 곳만 올리면
같은 버그를 한 앱만 갖게 된다 — 이 패키지를 만든 이유가 그것이다.
