# @jcurve/identity — 간편 인증(KICA) 본인확인

앱은 **브라우저를 열었다가 1회용 토큰으로 결과(이름 · 휴대폰 · 생년월일)만 받는다.** 인증 페이지 · 검증 · CI(1인 1계정) 대조는 서버가 한다.
앱 번들에는 어떤 인증 자격증명도 없다.

- `@jcurve/identity` — 앱(React Native · Expo)
- `@jcurve/identity/server` — 자체 서버(Node)가 플랫폼과 **같은 판정**을 하게 하는 공통 함수(스터디숲 apps/admin 같은 곳)

플랫폼 API(jcurve-api `/v1/{app}/kiap/*`)를 쓰는 앱은 서버 코드를 짤 필요가 없다.

## 앱에서 쓰기

```ts
import { createIdentity, identityMessage } from '@jcurve/identity';

const identity = createIdentity({
  base: 'https://api.j-curve.co.kr/v1/kkokkofarm',   // 앱 API 주소(끝에 / 없이)
  appToken: APP_TOKEN,                                // X-App-Token(공개 값)
  token: () => session?.token ?? null,                // 로그인 세션(flow 'init' 은 필수)
  ret: 'kkokkofarm://kiap',                           // 복귀 주소 — 앱 스킴이어야 한다(서버가 슬러그로 확인)
  keep: (v) => saveLocally(v),
  me: () => fetchMe(),                                // already_verified 를 이어 준다
});

if (!(await identity.enabled())) return say('준비 중이에요');
const r = await identity.verify();
if (!r.ok) return say(identityMessage(r.reason));    // 문구 끝에 (코드) 가 붙는다 — 문의 때 그 코드로 가른다
use(r.name, r.phone, r.birth);                        // birth: 'YYYY-MM-DD' | null — 가입에서 다시 묻지 않는다
```

**가입 전(로그인 없이) 흐름** — 자체 서버가 `status` 에 `start` 주소를 주는 경우(스터디숲 학부모 가입):

```ts
const identity = createIdentity({ base: STUDYFOREST_API, appToken, token: () => null, ret: 'studyforest-parent://kiap', flow: 'start' });
const r = await identity.verify();   // r.signupToken — 문자 인증과 같은 가입 토큰
```

### 앱이 붙일 때 값

| 값 | 어디서 | 틀리면 |
|---|---|---|
| `base` | 앱 API 주소 `https://api.j-curve.co.kr/v1/{슬러그}` (자체 서버면 그 서버의 `/api/v1`) | status 가 늘 꺼짐 |
| `appToken` | 앱 공개 토큰(X-App-Token) | status 가 **늘 꺼짐**으로 읽힌다(unauthorized 를 꺼짐으로 봄) |
| `ret` | `{앱 스킴}://kiap` — 플랫폼은 슬러그 스킴(`kkokkofarm://`)만 받는다 | `bad_return_url` · 인증 뒤 **브라우저가 열린 채** 끝남 |
| `flow` | 로그인 뒤 `init`(기본) · 가입 전 자체 서버 `start` | `NO_SESSION` |
| 앱 스킴 등록 | app.json `scheme` 이 `ret` 앞부분과 같아야 한다 | 복귀를 못 받음 |
| `expo-web-browser` | 네이티브 모듈 — 없는 판이면 `NEED_UPDATE` | 새 빌드 필요 |

**iOS 「'앱'이(가) 로그인하려고 합니다」 창이 안 뜬다** — 인증 창을 ephemeral 세션으로 연다(`openAuth`). 본인인증은 한 번이라 쿠키를 남기지 않는 게 맞다.

### 서버(어드민)에서 정하는 것

| 설정 | 자리 | 기본 |
|---|---|---|
| 본인확인 켜기 | 어드민 앱 관리 › 본인확인 스위치(`apps.kiap_enabled`) | 꺼짐 |
| 쓸 인증기관 | 어드민 앱 관리 › 간편 인증 — PASS · 카카오 · 네이버 · 토스 체크(`app_configs(app, kiap).providers`) | 앱 설정 없으면 전부 |
| KICA 계약 기관 | 서버 env `KIAP_CONTRACTED`(기본 `KAKAO,NAVER,TOSS`) — **켰는데 계약에 없으면 창에 안 나온다**(어드민 「계약에 없음」) | |
| 테스트/운영 키 | 서버 env `KIAP_DEV_*` / `KIAP_*` — **요청이 들어온 호스트**로 가른다(`KIAP_DEV_HOSTS`, 기본 dev-api.j-curve.co.kr) | |
| 허용 도메인 | KICA 콘솔 등록 도메인 = 인증 페이지 주소. 다르면 `KIAP_PUBLIC_BASE` 로 맞춘다 | 요청 주소 |

인증 창: 켠 기관이 **하나면 우리 화면 없이 그 기관으로 바로**, 여럿이면 켠 것만 고르고 누르면 KICA 가 그 기관으로 넘어간다(`default_provider`).
테스트 키(개발 주소)는 CI 를 빈 값으로 줄 때가 있어 **개발 환경에서만** 번호로 대신 식별한다. 운영은 CI 가 없으면 `CI_MISSING` 으로 멈춘다.

## 흔한 오류 코드

`identityMessage(code)` 가 사람 말로 바꾸고 끝에 `(코드)` 를 붙인다(취소 제외).

| 코드 | 뜻 | 볼 곳 |
|---|---|---|
| `KIAP_E4108` | KICA 요청 도메인 오류 — 인증 페이지 주소가 KICA 허용 도메인이 아니거나 Referrer 가 안 갔다 | `KIAP_PUBLIC_BASE` · KICA 콘솔 도메인 · 페이지 머리글 `Referrer-Policy`(no-referrer 금지) |
| `KIAP_<코드>` | KICA 가 준 그 밖의 오류(K/E 코드) | KICA 규격서 |
| `KIAP_HTTP_401` | getResult 인증 실패 — 콜백의 **동적** access_token 대신 콘솔 토큰을 썼거나, 세션 게이트웨이와 다른 주소로 물었다 | 콜백 코드 · 테스트/운영 주소 |
| `KIAP_TIMEOUT` | KICA 응답 5초 넘음 | 잠시 뒤 다시 |
| `CI_MISSING` | 운영에서 CI 가 없다(계약에 CI 가 빠졌거나 칸 이름이 다르다) | 서버 로그 `kiap getResult fields`(칸 이름 · CI 출처만 남김) · KICA 계약 |
| `DUPLICATE_CI` | 같은 사람이 이미 다른 계정으로 인증했다(1인 1계정) | 정상 — 기존 계정으로 로그인 안내 |
| `UID_CI_CONFLICT` | 이 계정은 다른 사람 명의로 인증돼 있다 | 정상 |
| `RATE_LIMITED` | 같은 **회원**이 5초 안에 다시 시작(플랫폼). IP 로는 막지 않는다 — 프록시 · Cloudflare 뒤에선 모두 같은 IP | 잠시 뒤 다시 |
| `SESSION_EXPIRED` · `SESSION_USED` | 인증 세션 15분 지남 · 이미 끝난 세션 | 다시 시작 |
| `RESULT_LOST` | 복귀는 됐는데 1회용 토큰(120초)으로 결과를 못 받음 | 네트워크 · 시간 |
| `RESULT_BINDING_MISMATCH` · `DECRYPT_FAILED` · `CALLBACK_FIELDS_MISSING` | KICA 응답이 이 거래가 아니거나 못 읽음 | 서버 로그 |
| `PROVIDER_NOT_ALLOWED` · `PROVIDER_DISABLED` | 기관 코드 모양이 이상함 · 어드민에서 끈 로그인 | 어드민 설정 |
| `CONFIG_MISSING` · `KIAP_DISABLED` | 키 · CI 해시 키가 없거나 앱에서 본인확인을 안 켬 | 서버 env · 어드민 스위치 |
| `NEED_UPDATE` | `expo-web-browser` 가 없는 판 | 새 빌드 |

## 자체 서버(Node)에서 쓰기 — `@jcurve/identity/server`

```ts
import { PAGE_HEADERS, startPageHtml, verifyCallback, backPageHtml, withQuery, publicBase, KIAP_HOST, ciHash } from '@jcurve/identity/server';

// 시작 페이지 — 세션을 만든 뒤
return new Response(startPageHtml({ title: '본인인증', host, clientId, accessToken,
  sdkUrl: `${base}/kiap/sdk.js`, callbackUrl: `${base}/kiap/callback?sid=${sid}`, cancelUrl: withQuery(ret, { ok: 0, reason: 'CANCELED' }),
  providers: [{ code: 'KAKAO', label: '카카오' }, { code: 'TOSS', label: '토스' }] }), { headers: PAGE_HEADERS });

// 콜백 — ①②③ 판정. ④ 1인 1계정(ciHash 대조) · 세션 · 가입은 앱 서버가
const v = await verifyCallback(Object.fromEntries(await req.formData()) as Record<string, string>, { host });
if (!v.ok) return new Response(backPageHtml(withQuery(ret, { ok: 0, reason: v.reason })), { headers: PAGE_HEADERS });
const h = ciHash(v.ci, CI_KEY);   // v.name · v.phone · v.birth · v.provider
```

`verifyCallback` 은 개발 주소(`KIAP_HOST.dev`)일 때만 CI 를 번호로 대신한다. 값(이름 · 번호 · CI)은 로그에 남기지 말고 `v.fields`(칸 이름)만 남긴다.
