"use strict";
/**
 * OTA 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 로그인했는지·로그인 중인지·메인에 있는지는 앱이 함수로 알려 준다.
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진 빌드에서 정적 import 는 앱 시작 자체를
 * 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasWaiting = exports.isRestarting = void 0;
exports.__reset = __reset;
exports.onUpdateReady = onUpdateReady;
exports.canApplyNow = canApplyNow;
exports.applyUpdate = applyUpdate;
exports.autoApply = autoApply;
exports.otaHeaders = otaHeaders;
exports.startupSettled = startupSettled;
exports.bundleLabel = bundleLabel;
const defaultEnv = () => ({
    updates: () => require('expo-updates'),
    active: () => {
        try {
            return require('react-native').AppState.currentState === 'active';
        }
        catch {
            return true;
        }
    },
    dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
    os: () => { try {
        return String(require('react-native').Platform.OS ?? '');
    }
    catch {
        return '';
    } },
    onActive: (fn) => {
        try {
            const sub = require('react-native').AppState.addEventListener('change', (st) => { if (st === 'active')
                fn(); });
            return () => { try {
                sub?.remove?.();
            }
            catch { /* 이미 끊겼다 */ } };
        }
        catch {
            return () => undefined;
        }
    },
});
let env = defaultEnv();
/** 시험에서만 쓴다 — 기기 대신 흉내 낸 것을 쓴다. 인자 없이 부르면 원래대로 */
function __reset(fake) {
    env = { ...defaultEnv(), ...fake };
    waiting = false;
    restarting = false;
    current = null;
    readyFns.clear();
    headersCache = null;
}
const updates = () => {
    try {
        const U = env.updates();
        return U?.isEnabled && !env.dev() ? U : null;
    }
    catch {
        return null;
    }
};
/*
 | 받아 둔 새 판과 지금 붙어 있는 앱 사정 — 띠(`onUpdateReady`·`applyUpdate`)가 autoApply 와 같은 판단을 쓰게 한 곳에 둔다.
 | autoApply 는 앱이 켜질 때 한 번만 부르므로 하나면 된다.
 */
let waiting = false;
let restarting = false;
let current = null;
/**
 * 지금 새 판으로 다시 시작하는 중인가(2.3) — **로그인·게스트 버튼은 이게 참이면 탭을 무시한다.**
 *
 * 재시작을 정한 순간부터 실제로 다시 뜨기까지 1초 남짓 걸린다. 그 사이 로그인 버튼을 누르면 로그인이 시작되자마자
 * 끊긴다 — 로그인 화면에서도 새 판을 적용하게 하면서(버튼 누르기 전) 남는 유일한 틈이다. 버튼이 무시하면 로그인은
 * 시작조차 안 되고, 잠시 뒤 새 판의 같은 화면이 뜬다.
 */
const isRestarting = () => restarting;
exports.isRestarting = isRestarting;
const readyFns = new Set();
/** 받아 둔 새 판이 있는가 */
const hasWaiting = () => waiting;
exports.hasWaiting = hasWaiting;
/**
 * 새 판을 다 받으면 알려 달라 — 띠를 띄우는 화면이 부른다. **이미 받아 뒀으면 그 자리에서 한 번 부른다**
 * (받는 것이 화면보다 먼저 끝난 기기에서 알림을 놓쳐 띠가 영영 안 뜨던 구멍). 돌려주는 함수로 끊는다.
 */
function onUpdateReady(fn) {
    readyFns.add(fn);
    if (waiting) {
        try {
            fn();
        }
        catch { /* 화면 쪽 오류는 삼킨다 */ }
    }
    return () => { readyFns.delete(fn); };
}
/**
 * 지금 띠를 눌러 적용해도 되는가 — 받아 둔 것이 있고, **로그인·가입 중이 아니고** 앱이 떠 있을 때.
 * 띠는 이것이 참일 때만 보여 준다(로그인 중에 누르면 로그인이 끊긴다 — 이 패키지가 생긴 까닭이다).
 */
function canApplyNow() {
    return waiting && !!current && !current.deps.busy() && env.active();
}
/** 띠를 눌렀다 — 적용할 수 있으면 곧바로 다시 시작한다. 못 하면 거짓(로그인 중·받아 둔 것 없음) */
function applyUpdate() {
    if (!canApplyNow() || !current)
        return false;
    current.reload();
    return true;
}
/**
 * 네이티브가 받아 둔 새 버전을 **안전한 순간에** 적용한다 — 앱이 켜질 때 한 번 부른다. 돌려주는 함수로 멈춘다.
 *
 * 받는 것은 네이티브가 켤 때 한다(`app.json` 의 `checkAutomatically` 기본값). 여기서는 다 받았을 때
 * (`isUpdatePending`) 언제 다시 시작할지만 정한다:
 *  1. 로그인한 사람 — 켠 지 6초 안이면(시작 화면) 바로. 깜빡임이 안 보인다
 *  2. 로그인 전 — **로그인 버튼을 누르기 전이면** 바로. 새로 깐 사람이 스토어 빌드의 옛 코드에 갇히지 않게
 *  3. 그 밖 — 3초마다 보다가, 로그인 전이면 「아직 안 눌렀을 때」, 로그인했으면 「메인에 있을 때」
 * 어느 경우든 **로그인·가입 중이거나 앱이 뒤로 가 있으면 하지 않는다** — 끝내 기회가 없으면 다음 실행에 저절로 적용된다.
 */
function autoApply(deps, opts = {}) {
    const U = updates();
    if (!U)
        return () => undefined;
    const quickMs = opts.quickMs ?? 6000;
    const everyMs = opts.everyMs ?? 3000;
    const launchedAt = Date.now();
    let armed = false;
    let timer = null;
    let fetchTimer = null;
    let sub;
    let offActive = null;
    let lastCheck = launchedAt; // 켤 때 네이티브(또는 아래 2.1)가 한 번 본다
    const busy = () => deps.busy() || !env.active();
    const reload = () => {
        restarting = true;
        // 다시 시작하지 못했으면 표시를 풀어 버튼이 다시 먹게 한다 — 다음 실행에 저절로 적용된다
        try {
            void Promise.resolve(U.reloadAsync()).catch(() => { restarting = false; });
        }
        catch {
            restarting = false;
        }
    };
    const noticeOn = () => { try {
        return !!deps.notice?.();
    }
    catch {
        return false;
    } };
    /** 새 판이 있나 묻고 있으면 받는다 — 적용은 받은 뒤 네이티브 상태 구독이 정한다 */
    const fetchNow = async () => {
        lastCheck = Date.now();
        try {
            const found = await U.checkForUpdateAsync();
            if (found?.isAvailable)
                await U.fetchUpdateAsync();
        }
        catch { /* 못 받아도 지금 판은 멀쩡하다 */ }
    };
    current = { deps, reload };
    const onPending = () => {
        if (armed)
            return;
        armed = true;
        waiting = true;
        // 띠를 띄우는 화면에 알린다 — 「새 버전 알려 주기」가 켜져 있으면 띠가 뜨고, 꺼져 있으면 화면이 무시한다
        readyFns.forEach((f) => { try {
            f();
        }
        catch { /* 화면 쪽 오류는 삼킨다 */ } });
        // 알려 주기가 켜져 있으면 스스로 적용하지 않는다 — 사람이 띠를 누를 때(applyUpdate)까지 기다린다
        if (!noticeOn()) {
            // 1. 시작 화면이 아직 떠 있는 동안 — 켠 지 6초 안에 로그인 창을 여는 사람도 있어 같은 가드를 둔다
            if (deps.signedIn() && !busy() && Date.now() - launchedAt < quickMs) {
                reload();
                return;
            }
            // 2. 로그인 전, 아직 로그인 버튼을 안 눌렀다 — 재시작해도 같은 로그인 화면으로 돌아올 뿐이다
            if (!deps.signedIn() && !deps.triedAuth() && !busy()) {
                reload();
                return;
            }
        }
        // 3. 그 뒤로는 조용한 순간을 기다린다(알려 주기를 켜 둔 동안은 기다리기만 — 끄면 여기서 적용된다)
        timer = setInterval(() => {
            if (noticeOn())
                return;
            if (busy())
                return;
            if (!deps.signedIn()) {
                if (deps.triedAuth())
                    return;
            }
            else if (!deps.atHome())
                return;
            if (timer)
                clearInterval(timer);
            timer = null;
            reload();
        }, everyMs);
    };
    try {
        if (U.latestContext?.isUpdatePending)
            onPending();
        else
            sub = U.addUpdatesStateChangeListener?.((e) => { if (e?.context?.isUpdatePending) {
                sub?.remove();
                onPending();
            } });
    }
    catch { /* 상태를 못 읽으면 다음 실행에 저절로 적용된다 */ }
    /*
     | **켤 때 네이티브가 받지 않는 빌드**는 여기서 받는다(2.1). 1.0 안내대로 `checkAutomatically` 를 ON_ERROR_RECOVERY 로
     | 박아 스토어에 낸 앱(당근캐시 등)이 있는데, 그 설정은 빌드에 박혀 OTA 로는 못 바꾼다 — 그대로 두면 새 판을 영영
     | 안 받는다. 받기만 하고, 언제 적용할지는 위 규칙 그대로다(다 받으면 네이티브 상태가 바뀌어 위 구독이 부른다).
     | 켤 때 받는 빌드(꼬꼬농장 — ON_LOAD)는 네이티브와 겹치지 않게 아무것도 하지 않는다.
     */
    const auto = String(U.checkAutomatically ?? 'ON_LOAD').toUpperCase();
    if (auto !== 'ON_LOAD' && auto !== 'WIFI_ONLY' && U.checkForUpdateAsync && U.fetchUpdateAsync && !U.latestContext?.isUpdatePending) {
        fetchTimer = setTimeout(() => {
            fetchTimer = null;
            if (!env.active())
                return; // 뒤로 넘어간 앱이 굳이 받을 이유가 없다
            void fetchNow();
        }, opts.fetchDelayMs ?? 2000); // 첫 화면이 쓸 네트워크를 같이 먹지 않게 잠깐 텀을 둔다
    }
    /*
     | **앱이 다시 앞으로 올 때도 받는다**(2.4, 선택 — `resumeCheckMs`). 켤 때만 받으면 뒤에 둔 채 몇 시간씩 쓰는
     | 폰은 옛 판에 머문다(머니트리 2026-09-19 「ota 안 되는데?」 — 백그라운드에 둔 아이폰이 몇 시간째 옛 판).
     | 마지막 확인에서 이만큼 지났고, 받아 둔 것이 없고, 네이티브가 켤 때 확인·받는 중이 아닐 때만 묻는다.
     | 다 받으면 네이티브 상태가 바뀌어 위 구독이 부르고, 적용은 위 규칙 그대로다. 주지 않으면 하지 않는다.
     */
    const gap = opts.resumeCheckMs ?? 0;
    if (gap > 0 && U.checkForUpdateAsync && U.fetchUpdateAsync) {
        offActive = env.onActive(() => {
            const c = U.latestContext;
            if (waiting || c?.isUpdatePending || c?.isStartupProcedureRunning || c?.isDownloading)
                return;
            /*
             | **로그인 중이면 받지 않는다**(2.4.1, 머니트리 지적). 카카오 로그인에서 돌아오는 바로 그 복귀에 받기(수 MB)가
             | 시작되면 로그인 요청과 겹친다 — 이 패키지가 생긴 까닭이 로그인과 겹치지 않는 것이다. 다음 복귀·다음 실행에 받는다.
             */
            try {
                if (deps.busy())
                    return;
            }
            catch {
                return;
            }
            if (Date.now() - lastCheck < gap)
                return;
            void fetchNow();
        });
    }
    return () => {
        sub?.remove();
        offActive?.();
        offActive = null;
        if (timer)
            clearInterval(timer);
        timer = null;
        if (fetchTimer)
            clearTimeout(fetchTimer);
        fetchTimer = null;
        if (current?.deps === deps)
            current = null;
    };
}
let headersCache = null;
/**
 * 서버가 판별 사용자 수를 세는 헤더(2.5) — 앱의 모든 API 요청에 붙인다. 이름은 jcurve-api `OtaTrack` 이 읽는 그대로.
 * 안드로이드 요청은 UA 가 okhttp 라 서버가 기기를 못 가려 플랫폼을 따로 싣는다(2026-09-19). 웹·모듈 없는 빌드는 빈 객체.
 * 한 실행 동안 판이 바뀌지 않으므로(바뀌면 다시 시작한다) 한 번 만들어 둔다.
 *
 *   fetch(url, { headers: { 'X-App-Token': KEY, ...otaHeaders() } })
 */
function otaHeaders() {
    if (headersCache)
        return headersCache;
    const os = env.os();
    if (os !== 'ios' && os !== 'android')
        return {};
    const h = { 'x-ota-platform': os, 'x-ota-update-id': 'embedded' };
    try {
        const U = env.updates();
        if (U?.updateId)
            h['x-ota-update-id'] = String(U.updateId);
        if (U?.channel)
            h['x-ota-channel'] = String(U.channel);
        if (U?.runtimeVersion)
            h['x-ota-runtime'] = String(U.runtimeVersion);
    }
    catch { /* 모듈이 없는 빌드 — 스토어 판(embedded)으로 싣는다 */ }
    headersCache = h;
    return h;
}
/** 시작 확인이 끝났거나(받을 게 없음·오류) 받기가 시작됐는가 */
const settled = (c) => !c?.isStartupProcedureRunning || !!c.isDownloading || !!c.isUpdatePending || !!c.checkError || !!c.downloadError;
/**
 * 로그인 전 사람의 시작 화면을 **네이티브의 시작 확인이 끝날 때까지**(최대 `maxMs`) 붙잡는다.
 *
 * 확인이 도는 동안 앱 소개가 먼저 뜨면, 곧이어 받은 새 버전이 적용되며 화면이 덜컥 처음으로 돌아간다.
 * 시작 화면 뒤에서 끝내면 깜빡임이 보이지 않는다.
 */
function startupSettled(maxMs = 3000) {
    return new Promise((resolve) => {
        const U = updates();
        try {
            if (!U || settled(U.latestContext) || !U.addUpdatesStateChangeListener) {
                resolve();
                return;
            }
            const t = setTimeout(() => { sub.remove(); resolve(); }, maxMs);
            const sub = U.addUpdatesStateChangeListener((e) => {
                if (!settled(e?.context))
                    return;
                clearTimeout(t);
                sub.remove();
                resolve();
            });
        }
        catch {
            resolve();
        }
    });
}
/** 지금 돌고 있는 판 이름 — 기본 판(스토어에서 받은 그대로)이면 빈 문자열 */
function bundleLabel() {
    try {
        const U = env.updates();
        if (!U.isEnabled || U.isEmbeddedLaunch)
            return '';
        return String(U.updateId ?? '').slice(0, 8);
    }
    catch {
        return '';
    }
}
