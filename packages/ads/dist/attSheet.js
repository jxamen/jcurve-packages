"use strict";
/**
 * ATT 거부 안내 시트 — 판단 · 저장 · 시스템 요청 로직(화면은 `AttDeniedSheet.ts`).
 *
 * 추적이 「거부됨·제한됨」이면 설정 앱에서 켜도록 안내한다(참여형 미션 포인트가 추적 허용에 달려 있다).
 * iOS 시스템 ATT 창은 **한 번만** 뜨므로, 아직 안 물은(undetermined) 상태면 시트 대신 시스템 창을 띄운다.
 *
 * - 앱 켤 때(launch): 거부·제한이면 **하루 한 번**(로컬 달력 날짜로 센다). 미정이면 시스템 창.
 * - 오퍼월 들어갈 때(offerwall): 거부·제한이면 **매번** 보인다. 미정이면 시스템 창. 결과 상태를 돌려준다.
 *
 * ⚠ 네이티브 모듈은 `expo-tracking-transparency` 하나만 **가드된 require** 로 읽는다 — 없으면 시트가 안 뜨고
 * 함수들은 던지지 않고 돌아온다. 새 네이티브 모듈·권한·Info.plist 는 없다(OTA 로 나간다).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
Object.defineProperty(exports, "__esModule", { value: true });
exports.memoryStorage = exports.ATT_SHEET_TEXTS = exports.ATT_STORAGE_KEY = void 0;
exports.attSheetTexts = attSheetTexts;
exports.localDay = localDay;
exports.decideAttAction = decideAttAction;
exports.loadTracking = loadTracking;
exports.loadRN = loadRN;
exports.readStatus = readStatus;
exports.requestStatus = requestStatus;
exports.launchCheck = launchCheck;
exports.setAttSheetOpener = setAttSheetOpener;
exports.ensureTrackingBeforeOfferwallWith = ensureTrackingBeforeOfferwallWith;
exports.ensureTrackingBeforeOfferwall = ensureTrackingBeforeOfferwall;
/** 저장소 열쇠 — 마지막으로 시트를 띄운 날 */
exports.ATT_STORAGE_KEY = 'jcurve.ads.attSheet.lastShown';
/** 기본 문구 — 「」 는 문장 안의 인용 부호만 남기고, 제목·본문·버튼 글자의 바깥 짝은 뺐다 */
exports.ATT_SHEET_TEXTS = {
    title: '추적을 허용하면 포인트를 더 받을 수 있어요',
    body: '참여형 미션 포인트는 추적 허용이 켜져 있어야 적립돼요',
    steps: [
        '「설정」 앱을 열어요',
        '「앱」으로 가요',
        '「{appName}」을 찾아 눌러요',
        '「추적 허용」을 켜요',
        '앱으로 돌아오면 바로 적립돼요',
    ],
    guide: '아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요',
    fallback: '앱 화면에 「추적 허용」이 안 보이면: 설정 → 개인정보 보호 및 보안 → 추적 → 맨 위 「앱이 추적을 요청하도록 허용」을 먼저 켜요',
    openSettings: '설정에서 허용하기',
    later: '나중에',
};
/** 문구를 합친다 — 덮어쓴 값이 있으면 그것을, 셋째 줄의 `{appName}` 을 앱 이름으로 바꾼다 */
function attSheetTexts(appName, overrides) {
    const m = { ...exports.ATT_SHEET_TEXTS, ...(overrides ?? {}) };
    const name = String(appName ?? '');
    return { ...m, steps: m.steps.map((s) => s.split('{appName}').join(name)) };
}
/** 로컬 달력 날짜(YYYY-MM-DD) — 「하루 한 번」은 기기 시간대의 자정 기준이다 */
function localDay(d) {
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
}
/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창을 띄운다(시트는 안 띄운다). 두 경로 모두 같다.
 * - 거부·제한이면: 오퍼월은 매번 시트, 앱 켜기는 오늘 아직 안 보였을 때만 시트.
 */
function decideAttAction(i) {
    if (i.os !== 'ios')
        return 'none';
    if (i.status === 'undetermined')
        return 'request';
    if (i.status === 'denied' || i.status === 'restricted') {
        if (i.trigger === 'offerwall')
            return 'show';
        return i.lastShownDay === i.today ? 'none' : 'show';
    }
    return 'none';
}
function loadTracking() {
    try {
        const m = require('expo-tracking-transparency');
        if (m && typeof m.getTrackingPermissionsAsync === 'function' && typeof m.requestTrackingPermissionsAsync === 'function')
            return m;
        return null;
    }
    catch {
        return null; // 모듈이 없는 빌드 — 시트는 안 뜨고 함수는 그냥 돌아온다
    }
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
/** 메모리 저장소 — 앱이 저장소를 안 넘겼을 때. 앱을 끄면 잊으므로 하루 한 번 규칙은 그 실행 안에서만 지켜진다 */
const memory = new Map();
exports.memoryStorage = {
    getItem: (k) => memory.get(k) ?? null,
    setItem: (k, v) => { memory.set(k, v); },
};
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
async function readLastShown(storage) {
    try {
        const v = await storage.getItem(exports.ATT_STORAGE_KEY);
        return typeof v === 'string' && v !== '' ? v : null;
    }
    catch {
        return null;
    }
}
async function writeLastShown(storage, day) {
    try {
        await storage.setItem(exports.ATT_STORAGE_KEY, day);
    }
    catch { /* 저장 실패 — 다음 실행에 한 번 더 뜰 수 있을 뿐이다 */ }
}
/**
 * 앱 켤 때 — 「시트를 띄울지」를 돌려준다(`show`). 미정이면 시스템 창을 여기서 띄우고 `none`.
 * 시트를 띄우기로 하면 저장소에 오늘 날짜를 먼저 적는다.
 */
async function launchCheck(d) {
    if (d.os !== 'ios' || !d.tracking)
        return 'none';
    const status = await readStatus(d.tracking);
    const lastShownDay = await readLastShown(d.storage);
    const action = decideAttAction({ os: d.os, trigger: 'launch', status, lastShownDay, today: d.today() });
    if (action === 'request') {
        try {
            await d.beforeRequest?.();
        }
        catch { /* 기다리기 실패 — 그냥 묻는다 */ }
        await requestStatus(d.tracking);
        return 'none';
    }
    if (action === 'show')
        await writeLastShown(d.storage, d.today());
    return action;
}
let sheetOpener = null;
function setAttSheetOpener(f) { sheetOpener = f; }
/**
 * 오퍼월에 들어가기 전 — 추적 허용 상태를 확인하고 필요하면 안내/시스템 창을 띄운 뒤 **결과 상태**를 돌려준다.
 * - 미정: 시스템 창을 띄우고 그 결과를 돌려준다(시트는 안 띄운다).
 * - 거부·제한: 시트를 띄우고, 닫히면 다시 읽은 상태를 돌려준다. 시트가 안 붙어 있으면 그 상태를 바로 돌려준다.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 */
async function ensureTrackingBeforeOfferwallWith(d, opener) {
    if (d.os !== 'ios' || !d.tracking)
        return 'unavailable';
    const status = await readStatus(d.tracking);
    const action = decideAttAction({ os: d.os, trigger: 'offerwall', status, today: d.today() });
    if (action === 'request')
        return requestStatus(d.tracking);
    if (action === 'none')
        return status;
    if (!opener)
        return status;
    await new Promise((resolve) => { opener(resolve); });
    return readStatus(d.tracking);
}
/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 시트를 쓴다 */
function ensureTrackingBeforeOfferwall(storage) {
    try {
        const rn = loadRN();
        return ensureTrackingBeforeOfferwallWith({ os: String(rn?.Platform?.OS ?? ''), tracking: loadTracking(), storage: storage ?? exports.memoryStorage, today: () => localDay(new Date()) }, sheetOpener).catch(() => 'unknown');
    }
    catch {
        return Promise.resolve('unknown');
    }
}
