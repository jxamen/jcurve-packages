"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ATT_PRIMER_TEXTS = exports.ATT_SHEET_TEXTS = void 0;
exports.attSheetTexts = attSheetTexts;
exports.localDay = localDay;
exports.decideAttAction = decideAttAction;
exports.loadTracking = loadTracking;
exports.loadRN = loadRN;
exports.readStatus = readStatus;
exports.requestStatus = requestStatus;
exports.registerAttHost = registerAttHost;
exports.showAttPrimerOnce = showAttPrimerOnce;
exports.showAttSheet = showAttSheet;
exports.ensureTrackingBeforeOfferwallWith = ensureTrackingBeforeOfferwallWith;
exports.ensureTrackingBeforeOfferwall = ensureTrackingBeforeOfferwall;
/**
 * iOS ATT — 상태 읽기 · 시스템 요청 · 안내 두 가지의 판단 로직(화면은 `AttDeniedSheet.ts`).
 *
 * (1.9.11) 애플 심사 기준(5.1.2(i) — ATT 동의를 조건이나 대가로 삼을 수 없다)에 맞춰 안내를 다시 짰다.
 *  ① **시스템 ATT 창 바로 앞의 중립 안내 — 한 번.** 상태가 미정(undetermined)일 때만, 「계속」 버튼 하나. 대가 · 압박 문구 없음.
 *  ② **거부 · 제한 안내(단계 시트) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만.**
 *     앱을 켤 때 · 루트 마운트로는 절대 열리지 않는다. 닫아도 오퍼월 진입은 막지 않는다.
 * 시스템 ATT 창 자체는 `ads.requestTracking()`(앱을 켤 때)과 `ensureTrackingBeforeOfferwall()` 이 띄운다 — 둘 다 ① 을 거친다.
 *
 * ⚠ 네이티브 모듈은 `expo-tracking-transparency` 하나만, **네이티브가 있는지 먼저 본 뒤**(native.ts) 읽는다 — 없으면
 * 함수들은 던지지 않고 돌아온다. 새 네이티브 모듈·권한·Info.plist 는 없다(OTA 로 나간다).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
const native_1 = require("./native");
/** 거부 · 제한 단계 시트 기본 문구(1.9.11: 첫 줄만 사실 설명으로 바꾸고 이익을 내세우던 문구는 지웠다 — 단계 안내는 그대로) */
exports.ATT_SHEET_TEXTS = {
    title: '애드팝콘 참여형 미션은 설치 · 참여 확인을 위해 추적 허용이 필요해요',
    body: '',
    steps: [
        '「설정」 앱을 열어요',
        '「앱」으로 가요',
        '「{appName}」을 찾아 눌러요',
        '「추적 허용」을 켜요',
        '앱으로 돌아오면 바로 이용할 수 있어요',
    ],
    guide: '아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요',
    fallback: '앱 화면에 「추적 허용」이 안 보이면: 설정 → 개인정보 보호 및 보안 → 추적 → 맨 위 「앱이 추적을 요청하도록 허용」을 먼저 켜요',
    openSettings: '설정에서 허용하기',
    later: '나중에',
};
/** 시스템 ATT 창 앞 중립 안내 기본 문구(대표님 확정 문구 — 앱이 `primerTexts` 로 덮어쓸 수 있다) */
exports.ATT_PRIMER_TEXTS = {
    title: '다음 화면에서 앱 추적 허용 여부를 물어봐요',
    body: '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
    button: '계속',
};
/** 문구를 합친다 — 덮어쓴 값이 있으면 그것을, 단계의 `{appName}` 을 앱 이름으로 바꾼다 */
function attSheetTexts(appName, overrides) {
    const m = { ...exports.ATT_SHEET_TEXTS, ...(overrides ?? {}) };
    const name = String(appName ?? '');
    return { ...m, steps: m.steps.map((s) => s.split('{appName}').join(name)) };
}
/** 로컬 달력 날짜(YYYY-MM-DD) */
function localDay(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창(`request`) — 어느 시점이든. 그 앞에 중립 안내가 한 번 붙는다.
 * - 거부·제한이면 **오퍼월 진입 때만** 단계 시트(`show`). 앱을 켤 때(`launch`)는 절대 아니다.
 */
function decideAttAction(i) {
    if (i.os !== 'ios')
        return 'none';
    if (i.status === 'undetermined')
        return 'request';
    if ((i.status === 'denied' || i.status === 'restricted') && i.trigger === 'offerwall')
        return 'show';
    return 'none';
}
function loadTracking() {
    // 네이티브가 있을 때만 읽는다(1.9.6, native.ts) — 없는 바이너리에 OTA 로 얹혀도 require 로 죽지 않는다
    const m = (0, native_1.requireTracking)();
    if (m && typeof m.getTrackingPermissionsAsync === 'function' && typeof m.requestTrackingPermissionsAsync === 'function')
        return m;
    return null;
}
/** react-native 를 가드된 require 로 — 웹·Expo Go 에서도 import 가 던지지 않게 */
function loadRN() {
    try {
        return require('react-native');
    }
    catch {
        return null;
    }
}
/** 현재 상태를 읽는다 — 실패하면 `unknown`(던지지 않는다) */
async function readStatus(tracking) {
    try {
        const r = await tracking.getTrackingPermissionsAsync();
        return normStatus(r?.status);
    }
    catch {
        return 'unknown';
    }
}
/** 시스템 ATT 창을 띄우고 결과 상태를 돌려준다(창이 없으면 미정 그대로) */
async function requestStatus(tracking) {
    try {
        const r = await tracking.requestTrackingPermissionsAsync();
        return normStatus(r?.status);
    }
    catch {
        return 'unknown';
    }
}
function normStatus(s) {
    switch (s) {
        case 'granted':
        case 'denied':
        case 'restricted':
        case 'undetermined':
            return s;
        default:
            return 'unknown';
    }
}
let host = null;
function registerAttHost(h) { host = h; }
let primerRun = null;
/** 시스템 ATT 창 앞 중립 안내 — **한 번만**(이번 실행 안에서: 끝난 약속을 그대로 돌려준다). 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
function showAttPrimerOnce() {
    const h = host;
    if (!h)
        return Promise.resolve();
    primerRun ?? (primerRun = new Promise((resolve) => {
        try {
            h.primer(resolve);
        }
        catch {
            resolve();
        }
    }));
    return primerRun;
}
let sheetRun = null;
/** 거부 · 제한 단계 시트 — 닫히면 돌아온다. 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
function showAttSheet() {
    const h = host;
    if (!h)
        return Promise.resolve();
    sheetRun ?? (sheetRun = new Promise((resolve) => {
        try {
            h.sheet(resolve);
        }
        catch {
            resolve();
        }
    }).then(() => { sheetRun = null; }));
    return sheetRun;
}
/**
 * 오퍼월에 들어가기 전 — ATT 상태를 확인하고 **결과 상태**를 돌려준다. 오퍼월을 막지 않는다.
 * - 미정: 중립 안내(한 번) → 시스템 창 → 그 결과.
 * - 거부 · 제한: 단계 시트를 열고, 닫히면 다시 읽은 상태(설정에서 켰을 수 있다). 시트가 안 붙어 있으면 그 상태를 바로 돌려준다.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 */
async function ensureTrackingBeforeOfferwallWith(d) {
    if (d.os !== 'ios' || !d.tracking)
        return 'unavailable';
    const status = await readStatus(d.tracking);
    const action = decideAttAction({ os: d.os, trigger: 'offerwall', status, today: localDay(new Date()) });
    if (action === 'request') {
        try {
            await (d.primer ?? showAttPrimerOnce)();
        }
        catch { /* 안내가 안 떠도 시스템 창은 묻는다 */ }
        return requestStatus(d.tracking);
    }
    if (action === 'show') {
        try {
            await (d.sheet ?? showAttSheet)();
        }
        catch { /* 시트가 안 떠도 오퍼월은 막지 않는다 */ }
        return readStatus(d.tracking);
    }
    return status;
}
/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 화면을 쓴다. `storage` 는 1.9.11 부터 쓰이지 않는다(호출 코드가 그대로 컴파일되도록 남김) */
function ensureTrackingBeforeOfferwall(_storage) {
    try {
        const rn = loadRN();
        return ensureTrackingBeforeOfferwallWith({ os: String(rn?.Platform?.OS ?? ''), tracking: loadTracking() }).catch(() => 'unknown');
    }
    catch {
        return Promise.resolve('unknown');
    }
}
