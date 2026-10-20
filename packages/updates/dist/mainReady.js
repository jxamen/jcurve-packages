"use strict";
/**
 * (2.10) **메인에 도착했을 때만** 새 판을 적용한다 — 대표님 10-20 11:51 「앱 열면 메인에서 자동 ota 되는것도 다 넣어」 ·
 * 11:52 「껐다 켤 필요 없게」 · 11:54 「로그인에서는 아니야」.
 *
 *  - 켤 때 · 로그인 · 가입 · 약관 · 본인인증 화면: `prefetchUpdate()` — **받기만** 한다(다시 시작하지 않는다)
 *  - 메인 진입 · 메인으로 돌아올 때: `onMainReady()` — 받아 둔 새 판이 있으면 바로 다시 시작. 없으면 묻고 받아
 *    `timeoutMs`(기본 5000) 안에 다 받으면 그 자리에서, 넘으면 받던 것은 계속 받고 다음 메인 도착 때
 *  - 광고 · 뽑기 · 결제 · 영상 · 가입 중: `setBusy(reason)` … `clearBusy(reason)` — 그동안 미루고, 마지막 사유가 풀리면 (메인이면) 적용
 *  - 같은 판 id 로 두 번 다시 시작하지 않는다(앱마다 있던 bootUpdate 의 marker 그대로): 다시 시작 **전에** id 를 적고,
 *    적지 못하면 다시 시작하지 않는다(저장 실패가 재시작 반복이 되지 않게). 다시 뜬 판이 그 id 면 표시를 지운다
 *  - 실패는 모두 조용히 넘어간다 — 지금 판은 멀쩡하다
 *
 * 네이티브는 expo-updates 만(지연 require). 저장소(marker)는 앱이 준다 — 패키지는 AsyncStorage 를 들고 있지 않다.
 * **`autoApply` · `launchUpdate` 와 같이 쓰지 않는다** — 이 방식으로 옮기는 앱은 그 둘을 빼고 이것만 부른다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.__resetMainReady = exports.isMainReadyRestarting = exports.clearBusy = exports.setBusy = exports.onMainReady = exports.prefetchUpdate = exports.MAIN_READY_CHECK_EVERY_MS = exports.MAIN_READY_TIMEOUT_MS = void 0;
exports.createMainReady = createMainReady;
exports.configureMainReady = configureMainReady;
exports.MAIN_READY_TIMEOUT_MS = 5000;
exports.MAIN_READY_CHECK_EVERY_MS = 60000;
function createMainReady(d, opts = {}) {
    const timeoutMs = opts.timeoutMs ?? exports.MAIN_READY_TIMEOUT_MS;
    const checkEveryMs = opts.checkEveryMs ?? exports.MAIN_READY_CHECK_EVERY_MS;
    const now = () => (d.now ? d.now() : Date.now());
    const sleep = (ms) => (d.sleep ? d.sleep(ms) : new Promise((r) => setTimeout(r, ms)));
    const busy = new Set();
    let restarting = false;
    let held = false;
    let fetchedId = null;
    let tried = null; // marker 에 남은 id — 이 id 로는 다시 시작하지 않는다
    let lastCheck = 0;
    let inflight = null;
    let markerRead = null;
    let applying = null;
    /** 이번 실행에서 한 번 — 다시 시작해 그 판으로 떴으면 표시를 지우고, 아니면(적용 실패) 그 id 를 기억해 반복하지 않는다 */
    const readMarker = () => markerRead ?? (markerRead = (async () => {
        try {
            const m = await d.getMarker();
            if (!m)
                return;
            if (m === d.currentId) {
                try {
                    await d.clearMarker();
                }
                catch { /* 다음 실행에 다시 지운다 */ }
                return;
            }
            tried = m;
        }
        catch { /* 못 읽으면 표시가 없는 것으로 */ }
    })());
    const waitNative = async (until) => {
        while (d.nativeBusy && safe(d.nativeBusy) && now() < until)
            await sleep(250);
    };
    /** 묻고 받는다 — 다 받은 새 판 id 를 기억한다. 실패는 조용히 */
    const fetchNow = () => inflight ?? (inflight = (async () => {
        try {
            await waitNative(now() + 15000);
            lastCheck = now();
            const found = await d.check();
            if (!found?.isAvailable)
                return;
            const got = await d.fetch();
            const id = got?.manifest?.id ?? null;
            if (got?.isNew && id && id !== d.currentId)
                fetchedId = id;
        }
        catch { /* 못 받아도 지금 판은 멀쩡하다 */ }
        finally {
            inflight = null;
        }
    })());
    const canApply = () => !!fetchedId && fetchedId !== d.currentId && fetchedId !== tried;
    const apply = async () => {
        if (restarting)
            return 'applied';
        if (busy.size > 0) {
            held = true;
            return 'held';
        }
        if (!safe(d.active))
            return 'none';
        const id = fetchedId;
        try {
            await d.setMarker(id);
        }
        catch {
            return 'none';
        } // 적지 못하면 다시 시작하지 않는다
        // 적는 사이 바쁨 · 뒤로 감 — 표시를 지우고 미룬다(남겨 두면 다음 실행이 그 판을 「시도함」으로 보고 건너뛴다)
        if (busy.size > 0 || !safe(d.active)) {
            try {
                await d.clearMarker();
            }
            catch { /* 다음 실행에 다시 본다 */ }
            if (busy.size > 0) {
                held = true;
                return 'held';
            }
            return 'none';
        }
        tried = id;
        restarting = true;
        try {
            await d.reload();
        }
        catch {
            restarting = false;
            return 'none';
        }
        return 'applied';
    };
    const run = async () => {
        if (!d.enabled)
            return 'skipped';
        held = false;
        await readMarker();
        if (canApply())
            return apply();
        if (busy.size > 0) {
            held = true;
            return 'held';
        }
        const due = now() - lastCheck >= checkEveryMs;
        if (!inflight && !due)
            return 'none';
        let timer;
        const late = new Promise((r) => { timer = setTimeout(() => r('timeout'), timeoutMs); });
        const r = await Promise.race([fetchNow().then(() => 'done'), late]);
        if (timer)
            clearTimeout(timer);
        if (r === 'timeout')
            return 'timeout'; // 받던 것은 계속 받는다 — 다음 메인 도착 때
        return canApply() ? apply() : 'none';
    };
    const onMain = () => applying ?? (applying = run().finally(() => { applying = null; }));
    return {
        async prefetchUpdate() {
            if (!d.enabled)
                return;
            await readMarker();
            if (fetchedId)
                return;
            await fetchNow();
        },
        onMainReady: onMain,
        setBusy(reason) { busy.add(reason); },
        clearBusy(reason) {
            if (!busy.delete(reason) || busy.size > 0 || !held)
                return;
            held = false;
            let main = true;
            try {
                main = opts.atMain ? !!opts.atMain() : true;
            }
            catch {
                main = false;
            }
            if (main)
                void onMain();
        },
        isBusy: () => busy.size > 0,
        isRestarting: () => restarting,
        waitingId: () => fetchedId,
    };
}
function safe(fn) {
    try {
        return !!fn();
    }
    catch {
        return false;
    }
}
let shared = null;
/**
 * 앱이 켜질 때 한 번 — expo-updates 와 앱의 저장소로 묶는다. 그 뒤 `prefetchUpdate` · `onMainReady` · `setBusy` · `clearBusy` 를 부른다.
 * 개발 빌드 · 웹 · 모듈 없는 빌드면 아무것도 하지 않는다(skipped).
 */
function configureMainReady(cfg) {
    let U = null;
    try {
        U = cfg.updates ? cfg.updates() : require('expo-updates');
    }
    catch {
        U = null;
    }
    const dev = cfg.dev ?? (typeof __DEV__ !== 'undefined' && !!__DEV__);
    const on = !!U?.isEnabled && !dev;
    shared = createMainReady({
        enabled: on,
        currentId: U?.updateId ?? null,
        check: () => U.checkForUpdateAsync(),
        fetch: () => U.fetchUpdateAsync(),
        reload: () => U.reloadAsync(),
        getMarker: () => cfg.storage.getItem(cfg.markerKey),
        setMarker: (id) => cfg.storage.setItem(cfg.markerKey, id),
        clearMarker: () => cfg.storage.removeItem(cfg.markerKey),
        active: () => {
            try {
                return require('react-native').AppState.currentState === 'active';
            }
            catch {
                return true;
            }
        },
        nativeBusy: () => !!(U?.latestContext?.isStartupProcedureRunning || U?.latestContext?.isDownloading),
    }, cfg);
    return shared;
}
const none = async () => 'skipped';
/** 켤 때 · 로그인 · 가입 · 약관 · 본인인증 화면 — 받기만 */
const prefetchUpdate = () => (shared ? shared.prefetchUpdate() : Promise.resolve());
exports.prefetchUpdate = prefetchUpdate;
/** 메인 진입 · 메인으로 돌아올 때 — 받아 둔 새 판이 있으면 바로 적용 */
const onMainReady = () => (shared ? shared.onMainReady() : none());
exports.onMainReady = onMainReady;
/** 광고 · 뽑기 · 결제 · 영상 · 가입 중 — 끝날 때 clearBusy 를 같은 사유로 */
const setBusy = (reason) => { shared?.setBusy(reason); };
exports.setBusy = setBusy;
const clearBusy = (reason) => { shared?.clearBusy(reason); };
exports.clearBusy = clearBusy;
/** 새 판으로 다시 시작하는 중 — 로그인 · 게스트 버튼은 참이면 탭을 무시한다 */
const isMainReadyRestarting = () => !!shared?.isRestarting();
exports.isMainReadyRestarting = isMainReadyRestarting;
/** 시험에서만 */
const __resetMainReady = () => { shared = null; };
exports.__resetMainReady = __resetMainReady;
