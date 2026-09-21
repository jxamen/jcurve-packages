"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isCancel = exports.PLACEHOLDER = void 0;
exports.createAuth = createAuth;
/**
 * 아직 안 채운 값인가 — `.env.example` 의 `여기에_...` 같은 자리표시자.
 *
 * 키가 자리표시자면 **버튼을 아예 띄우지 않는다.** 눌러도 안 되는 버튼은 고장으로 보이고,
 * 카카오는 그 상태로 초기화하면 SDK 가 이상한 오류를 뱉는다.
 */
exports.PLACEHOLDER = /^$|여기에|placeholder|YOUR_|xxxx/i;
const isPlaceholder = (v) => exports.PLACEHOLDER.test(String(v ?? '').trim());
/**
 * 사용자가 **스스로 그만둔 것**인가.
 *
 * 그만둔 사람에게 오류창을 띄우면 앱이 고장 난 줄 안다. 그리고 퍼널에서 이탈이 **실패로
 * 부풀어** 보여, 고칠 것이 없는 자리를 들여다보게 된다.
 *
 * 제공자마다 말이 다르다 — 하나라도 빠뜨리면 그 갈래만 조용히 오류창이 된다.
 *  - `cancel` — `Cancelled`·`USER_CANCELLED`·`SIGN_IN_CANCELLED`·`ERR_REQUEST_CANCELED`
 *    (l 이 하나든 둘이든 앞부분이 같아 다 걸린다)
 *  - **`AccessDenied`** — 카카오가 동의 화면에서 「취소」를 눌렀을 때 주는 말이다.
 *    `cancel` 이 안 들어가 있어서 **빠뜨리기 쉽다.** 꿀꿀캐시가 2026-09-18 실기기에서
 *    이것 때문에 **취소한 사람에게 오류창**을 띄웠다. OAuth 표준 `access_denied` 도 같다.
 *  - `1001` — 애플·구글 iOS 쪽 취소
 *  - `12501` — 구글 안드로이드 계정 선택 취소
 */
const isCancel = (code) => /cancel|취소|access.?denied|(?<![0-9])(1001|12501)(?![0-9])/i.test(code);
exports.isCancel = isCancel;
/** 모듈이 없으면 null — 크래시 대신 그 버튼만 숨긴다(②) */
function mod(load) {
    try {
        return load();
    }
    catch {
        return null;
    }
}
/* eslint-disable @typescript-eslint/no-explicit-any */
const kakaoCore = () => mod(() => require('@react-native-kakao/core'));
const kakaoUser = () => mod(() => require('@react-native-kakao/user'));
const googleMod = () => mod(() => require('@react-native-google-signin/google-signin'));
const appleMod = () => mod(() => require('expo-apple-authentication'));
/**
 * iOS 인가 — `react-native` 도 **지연 require** 다.
 *
 * 정적 import 를 두면 패키지가 리액트 네이티브 타입에 묶여, 앱 밖에서는 빌드도 테스트도
 * 못 한다. 쓰는 것이 `Platform.OS` 하나뿐이라 그럴 값어치가 없다 — 네이티브 모듈을
 * 다루는 방식(②)과도 같아진다.
 */
const isIOS = () => mod(() => require('react-native'))?.Platform?.OS === 'ios';
function createAuth(deps) {
    const { keys, server } = deps;
    const track = deps.track ?? (() => undefined);
    let kakaoReady = false;
    function initKakao() {
        if (kakaoReady || isPlaceholder(keys.kakaoNative))
            return;
        const core = kakaoCore();
        if (!core?.initializeKakaoSDK)
            return;
        try {
            core.initializeKakaoSDK(keys.kakaoNative);
            kakaoReady = true;
        }
        catch { /* 초기화 실패는 로그인 실패로만 드러난다 */ }
    }
    /**
     * 카카오 네이티브를 만지는 **유일한 길**.
     *
     * 초기화를 먼저 하고 모듈을 준다. 이 길을 거치지 않고 `require` 로 직접 집어 부르면
     * 초기화 전에 네이티브를 건드릴 수 있고, 그러면 **안드로이드가 그 자리에서 죽는다**(③).
     * 초기화가 안 됐으면 `null` 이라 부르는 쪽이 자연스럽게 막힌다.
     */
    function kakaoApi() {
        initKakao();
        return kakaoReady ? kakaoUser() : null;
    }
    function availableProviders() {
        const list = [];
        /*
         | **여기서는 네이티브를 부르지 않는다.** 이 함수는 로그인 화면이 버튼을 그리려고
         | **화면이 뜨는 순간** 부른다. `?.login` 은 모듈 객체의 필드를 읽을 뿐이라 안전하다 —
         | 괄호를 붙이는 순간 ③ 을 밟는다.
         */
        if (!isPlaceholder(keys.kakaoNative) && kakaoUser()?.login)
            list.push('kakao');
        if (!isPlaceholder(keys.googleWeb) && googleMod()?.GoogleSignin)
            list.push('google');
        // 애플 로그인은 iOS 에서만 — 소셜 로그인만 제공하는 앱은 심사지침 4.8 로 필수다
        if (isIOS() && appleMod())
            list.push('apple');
        return list;
    }
    async function kakaoTalkAvailable() {
        const user = kakaoApi();
        if (typeof user?.isKakaoTalkLoginAvailable !== 'function')
            return false;
        try {
            return (await user.isKakaoTalkLoginAvailable()) === true;
        }
        catch {
            return false;
        }
    }
    /**
     * 카카오 토큰 — **어느 길로 갔는지 남긴다**(④).
     *
     * `login()` 한 줄이면 카카오톡을 먼저 열어 보고 안 되면 웹으로 조용히 떨어진다.
     * 그러면 카카오 가입이 0 명이어도 **왜인지 알 수 없다.** 갈래마다 사유를 남긴다.
     */
    async function kakaoToken() {
        const user = kakaoApi();
        if (!user?.login) {
            /*
             | 여기까지 온 것은 **초기화가 실패했다**는 뜻이다 — 모듈이 아예 없으면
             | `availableProviders()` 가 버튼을 안 띄우므로 이 자리에 못 온다.
             | 키가 틀렸거나 SDK 가 초기화를 거부한 경우인데, 남기지 않으면 **버튼을 눌렀는데
             | 아무 일도 안 일어나는** 것으로만 보인다(꼬꼬농장은 이 갈래를 `no_sdk` 로 남긴다).
             */
            track('login_native_fallback', { provider: 'kakao', why: 'no_sdk' });
            throw new Error('kakao_unavailable');
        }
        const grab = (r) => String(r?.accessToken ?? '');
        // 판단할 수단 자체가 없는 옛 SDK — 그냥 맡기되 그 사실을 남긴다
        if (typeof user.isKakaoTalkLoginAvailable !== 'function') {
            const token = grab(await user.login());
            if (!token)
                throw new Error('kakao_no_token');
            track('login_native_fallback', { provider: 'kakao', why: 'cannot_tell' });
            return token;
        }
        if (await kakaoTalkAvailable()) {
            try {
                const token = grab(await user.login());
                if (!token)
                    throw new Error('kakao_no_token');
                track('login_native_ok', { provider: 'kakao' });
                return token;
            }
            catch (e) {
                const code = String(e?.message ?? e);
                // 그만둔 것은 폴백하지 않는다 — 웹 창이 또 뜨면 놀란다
                if ((0, exports.isCancel)(code))
                    throw e;
                track('login_native_fallback', { provider: 'kakao', why: 'sdk_' + code.slice(0, 20) });
            }
        }
        else {
            track('login_native_fallback', { provider: 'kakao', why: 'no_talk' });
        }
        const token = grab(await user.login({ useKakaoAccountLogin: true }));
        if (!token)
            throw new Error('kakao_no_token');
        return token;
    }
    async function googleToken() {
        const g = googleMod();
        if (!g?.GoogleSignin)
            throw new Error('google_unavailable');
        g.GoogleSignin.configure({
            webClientId: keys.googleWeb,
            iosClientId: isPlaceholder(keys.googleIos) ? undefined : keys.googleIos,
        });
        await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
        const r = await g.GoogleSignin.signIn();
        /*
         | **취소는 예외가 아니라 반환값이다**(⑤). 이걸 못 알아보면 아래에서 빈 토큰을 보고
         | `google_no_token` 을 던져, 그냥 취소한 사람에게 오류창이 뜬다.
         | 던지는 말은 `isCancel` 에 걸리는 글자여야 한다.
         */
        if (r?.type === 'cancelled')
            throw new Error('user_cancel');
        const token = String(r?.data?.idToken ?? r?.idToken ?? '');
        /*
         | 로그인 뒤 반드시 signOut — 안 하면 다음부터 계정 선택 없이 이전 계정으로 붙어
         | **계정을 바꿀 수 없다**(함정 E-3). 우리 세션은 서버가 들고 있으므로 끊어도 된다.
         */
        await g.GoogleSignin.signOut().catch(() => undefined);
        if (!token)
            throw new Error('google_no_token');
        return token;
    }
    async function appleIdentity() {
        const a = appleMod();
        if (!a)
            throw new Error('apple_unavailable');
        const c = await a.signInAsync({
            requestedScopes: [a.AppleAuthenticationScope.FULL_NAME, a.AppleAuthenticationScope.EMAIL],
        });
        const token = String(c?.identityToken ?? '');
        if (!token)
            throw new Error('apple_no_token');
        // 이름은 **최초 1회만** 온다(⑥)
        const name = [c?.fullName?.familyName, c?.fullName?.givenName].filter(Boolean).join('');
        return { token, name };
    }
    /**
     * 인증 창이 닫히며 앱이 돌아오는 순간 보낸 fetch 가 iOS 에서 「취소됨」으로 끊긴다(⑦).
     * 같은 토큰으로 두 번까지 다시 보낸다 — 서버 교환은 멱등이다.
     *
     * **서버가 코드 한 단어로 거절한 것**(`invalid_token` 같은)은 다시 보내도 같다.
     * 8초를 넘긴 요청도 안 보낸다 — 사용자가 이미 오래 기다렸다.
     */
    async function withRetry(fn) {
        const waits = [700, 1500];
        const t0 = Date.now();
        for (let i = 0;; i++) {
            try {
                return await fn();
            }
            catch (e) {
                const msg = String(e?.message ?? '');
                if (i >= waits.length || /^[a-z0-9_]+$/i.test(msg) || Date.now() - t0 > 8000)
                    throw e;
                await new Promise((r) => setTimeout(r, waits[i]));
            }
        }
    }
    async function signIn(provider) {
        if (provider === 'kakao') {
            const t = await kakaoToken();
            try {
                return await withRetry(() => server.kakao(t));
            }
            catch (e) {
                /*
                 | **서버가 토큰을 거절한 경우**도 남긴다. 앱 키가 다른 앱 것이면 여기서 막히는데,
                 | 앱 로그만 보면 「카카오톡으로 잘 받았다」로 끝나 원인이 안 보인다.
                 | 꼬꼬농장이 카카오 가입 0 명을 한동안 못 알아챈 것도 이런 자리였다.
                 */
                track('login_native_fallback', {
                    provider: 'kakao',
                    why: 'server_reject',
                    code: String(e?.code ?? '').slice(0, 20),
                });
                throw e;
            }
        }
        if (provider === 'google') {
            const t = await googleToken();
            return withRetry(() => server.google(t));
        }
        const { token, name } = await appleIdentity();
        return withRetry(() => server.apple(token, name));
    }
    return { initKakao, availableProviders, kakaoTalkAvailable, signIn };
}
