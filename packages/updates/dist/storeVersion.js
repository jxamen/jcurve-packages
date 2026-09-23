"use strict";
/**
 * 스토어 업데이트(2.6) — **최소 설치 버전**(강제)과 **권장 버전**(권유) 두 단계. 꼬꼬농장 `ForceUpdate.tsx` 를 떼어 왔다.
 *
 *  - 설치 버전 < 최소: 닫을 수 없는 창 → 스토어로. 스토어에 갔다 돌아오면 다시 뜬다
 *  - 설치 버전 < 권장: 「나중에」가 있는 창. **같은 권장 버전은 하루 한 번**
 *  - 권장 = 어드민 권장과 iOS 앱스토어 공개 버전(iTunes lookup) 중 높은 쪽 — 새 버전이 승인되면 설정 없이 권한다
 *  - 최소가 비어 있으면 강제하지 않고, 권장까지 비어 있으면 아무것도 안 한다
 *
 * 값은 서버 `GET {app}/app/version` 이 준다(어드민 「앱 관리」의 최소·권장 버전 + 스토어 번호).
 * **JS 뿐이다** — 창은 RN `Alert`, 설치 버전은 이미 든 `expo-application` 으로 읽어서 OTA 로 퍼진다.
 * 이 파일은 `updates.ts` 를 부르지 않는다(import 고리를 만들지 않는다).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.cmpVersion = cmpVersion;
exports.decideStoreUpdate = decideStoreUpdate;
exports.storeLinks = storeLinks;
exports.__resetStoreVersion = __resetStoreVersion;
exports.checkStoreVersion = checkStoreVersion;
const VER = /^\d+(\.\d+){0,3}$/;
const isVersion = (v) => typeof v === 'string' && VER.test(v.trim());
/** a < b 면 음수, 같으면 0, a > b 면 양수. 자릿수가 모자라면 0 으로 본다(1.0 == 1.0.0) */
function cmpVersion(a, b) {
    const pa = a.trim().split('.').map(Number);
    const pb = b.trim().split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const d = (pa[i] ?? 0) - (pb[i] ?? 0);
        if (d !== 0)
            return d;
    }
    return 0;
}
/** 후보 중 가장 높은 버전. 버전 모양이 하나도 없으면 null */
function highest(...vs) {
    return vs.filter(isVersion).map((v) => v.trim()).reduce((hi, v) => (!hi || cmpVersion(v, hi) > 0 ? v : hi), null);
}
/**
 * 막을까·권할까·그냥 둘까. 순수 함수 — 자체 화면을 그리는 앱(꼬꼬농장)도 이것만 가져다 쓸 수 있다.
 * 설치 버전을 모르면(개발 실행) 아무것도 하지 않는다.
 */
function decideStoreUpdate(installed, p, storeLatest) {
    if (!isVersion(installed) || !p)
        return null;
    const cur = installed.trim();
    const min = highest(p.min);
    if (min && cmpVersion(cur, min) < 0)
        return { kind: 'force', installed: cur, target: min };
    const rec = highest(p.recommend, storeLatest);
    if (rec && cmpVersion(cur, rec) < 0)
        return { kind: 'recommend', installed: cur, target: rec };
    return null;
}
/** 스토어 주소 — 앱으로 여는 주소와, 안 열리면 쓸 웹 주소. 번호를 모르면 null */
function storeLinks(os, p) {
    if (os === 'ios' && p?.appStoreId && /^\d+$/.test(p.appStoreId)) {
        return { app: 'itms-apps://apps.apple.com/app/id' + p.appStoreId, web: 'https://apps.apple.com/kr/app/id' + p.appStoreId };
    }
    if (os === 'android' && p?.package && /^[\w.]+$/.test(p.package)) {
        return { app: 'market://details?id=' + p.package, web: 'https://play.google.com/store/apps/details?id=' + p.package };
    }
    return null;
}
const NAG_KEY = 'jcurve.storeNag.v1';
const defaultEnv = () => {
    const rn = () => require('react-native');
    const storage = () => {
        try {
            return require('@react-native-async-storage/async-storage').default;
        }
        catch {
            return null;
        }
    };
    const mem = {};
    return {
        os: () => { try {
            return rn().Platform.OS;
        }
        catch {
            return 'web';
        } },
        dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
        installed: () => {
            // 네이티브(스토어) 버전 — OTA 로 바뀌지 않는 값이어야 한다. expo-constants 의 app.json 버전은 OTA 번들 쪽이라 쓰지 않는다
            try {
                const v = require('expo-application').nativeApplicationVersion;
                if (isVersion(v))
                    return v;
            }
            catch { /* 없으면 아래 */ }
            try {
                const v = require('expo-updates').runtimeVersion; // runtimeVersion 정책이 appVersion 이면 스토어 버전과 같다
                if (isVersion(v))
                    return v;
            }
            catch { /* 모르면 막지 않는다 */ }
            return null;
        },
        alert: (t, b, buttons) => rn().Alert.alert(t, b, buttons, { cancelable: false }),
        openURL: (u) => rn().Linking.openURL(u),
        onActive: (fn) => {
            try {
                const sub = rn().AppState.addEventListener('change', (s) => { if (s === 'active')
                    fn(); });
                return () => sub.remove();
            }
            catch {
                return () => { };
            }
        },
        lookup: async (bundleId) => {
            const ctrl = new AbortController();
            const t = setTimeout(() => ctrl.abort(), 6000);
            try {
                const j = await (await fetch('https://itunes.apple.com/lookup?country=kr&bundleId=' + encodeURIComponent(bundleId), { signal: ctrl.signal })).json();
                const v = j?.results?.[0]?.version;
                return isVersion(v) ? v : null;
            }
            catch {
                return null;
            }
            finally {
                clearTimeout(t);
            }
        },
        getItem: async (k) => { const s = storage(); return s ? s.getItem(k) : (mem[k] ?? null); },
        setItem: async (k, v) => { const s = storage(); if (s)
            await s.setItem(k, v);
        else
            mem[k] = v; },
        now: () => Date.now(),
    };
};
let env = null;
const E = () => env ?? (env = defaultEnv());
/** 시험용 — 기기 대신 가짜를 넣는다 */
function __resetStoreVersion(fake) {
    env = fake ? { ...defaultEnv(), ...fake } : null;
}
const dayKey = (ms) => { const d = new Date(ms); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
/**
 * 앱을 켤 때 한 번 부른다. 켤 때 바로 한 번, 앱이 앞으로 돌아올 때 10분에 한 번 다시 본다.
 * 돌려주는 함수로 멈춘다. 웹·개발 실행에서는 아무것도 하지 않는다.
 *
 * 서버를 못 읽거나 스토어 주소를 모르면 **막지 않는다** — 막고 못 보내면 사람이 갇힌다.
 */
function checkStoreVersion(deps) {
    const e = E();
    const os = e.os();
    if (os === 'web' || e.dev())
        return () => { };
    const t = { forceTitle: '업데이트가 필요해요', forceBody: '새 버전으로 업데이트해야 계속 쓸 수 있어요.',
        recTitle: '새 버전이 나왔어요', recBody: '더 편해진 새 버전을 만나 보세요.', update: '업데이트', later: '나중에', ...deps.text };
    let last = 0;
    let open = false;
    let forced = false; // 마지막 판단이 강제였나 — 스토어에서 돌아오면 10분을 기다리지 않고 다시 본다
    const run = async () => {
        if (open)
            return;
        last = e.now();
        let info;
        try {
            const raw = await deps.fetch();
            info = (raw?.ios || raw?.android) ? raw : (raw?.data ?? {});
        }
        catch {
            return;
        }
        const p = os === 'ios' ? info.ios : info.android;
        const links = storeLinks(os, p);
        if (!p || !links)
            return;
        const latest = os === 'ios' && p.bundleId ? await e.lookup(p.bundleId).catch(() => null) : null;
        const d = decideStoreUpdate(e.installed(), p, latest);
        forced = d?.kind === 'force';
        if (!d)
            return;
        // 스토어가 안 열리면(웹 주소까지) 강제 창을 다시 띄운다 — 창만 닫히고 앱을 계속 쓰게 되면 안 된다
        const go = () => {
            open = false;
            void e.openURL(links.app).catch(() => e.openURL(links.web)).catch(() => { if (forced)
                void run(); });
        };
        if (d.kind === 'force') {
            open = true;
            e.alert(t.forceTitle, t.forceBody + '\n현재 ' + d.installed + ' → ' + d.target, [{ text: t.update, onPress: go }]);
            return;
        }
        if (deps.canRecommend && !deps.canRecommend())
            return;
        const key = d.target + '|' + dayKey(e.now());
        if ((await e.getItem(NAG_KEY).catch(() => null)) === key)
            return;
        await e.setItem(NAG_KEY, key).catch(() => undefined);
        open = true;
        e.alert(t.recTitle, t.recBody + '\n현재 ' + d.installed + ' → ' + d.target, [
            { text: t.later, style: 'cancel', onPress: () => { open = false; } },
            { text: t.update, onPress: go },
        ]);
    };
    void run();
    // 강제 창은 스토어에 다녀오면 닫혀 있다 — 돌아오면 바로 다시 본다. 그 밖에는 10분에 한 번
    return e.onActive(() => { if (!open && (forced || e.now() - last >= 10 * 60000))
        void run(); });
}
