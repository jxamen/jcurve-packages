"use strict";
/**
 * OTA 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진
 * 빌드에서 정적 import 는 앱 시작 자체를 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로
 * 더 그렇다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.hasWaiting = void 0;
exports.__reset = __reset;
exports.onUpdateReady = onUpdateReady;
exports.bandShows = bandShows;
exports.bundleLabel = bundleLabel;
exports.pullUpdateSoon = pullUpdateSoon;
exports.applyUpdate = applyUpdate;
/** 한 번 켠 동안 여러 번 받지 않는다 */
let pulled = false;
/** 다 받았을 때 알릴 곳 — 화면이 띠를 띄운다 */
let ready = null;
/** 받아 둔 새 판이 있다 — 띠를 낼 수 있다 */
let waiting = false;
/** 시험에서만 쓴다 — 켠 상태를 처음으로 되돌린다 */
function __reset() {
    pulled = false;
    ready = null;
    waiting = false;
}
/**
 * 다 받으면 알려 달라 — 띠를 내는 화면이 부른다.
 *
 * **이미 받아 뒀으면 그 자리에서 한 번 부른다.** 받는 것이 홈보다 먼저 끝난 기기에서
 * 등록만 하고 기다리면 그 사이에 온 알림을 놓쳐 **띠가 영영 안 뜬다**(캐시팡에 있던 구멍).
 */
function onUpdateReady(fn) {
    ready = fn;
    if (waiting)
        fn();
}
/** 받아 둔 새 판이 있는가 */
const hasWaiting = () => waiting;
exports.hasWaiting = hasWaiting;
/**
 * 띠를 낼 때인가 — 받아 둔 것이 있고, 알려 주기를 켰고, 키보드가 자리를 쓰지 않을 때.
 *
 * 순수 함수라 화면 없이 확인할 수 있다.
 */
function bandShows(gotOne, notice, keyboard) {
    return gotOne && notice && !keyboard;
}
/** 지금 돌고 있는 판 이름 — 기본 판(스토어에서 받은 그대로)이면 빈 문자열 */
function bundleLabel() {
    try {
        const U = require('expo-updates');
        if (!U.isEnabled || U.isEmbeddedLaunch)
            return '';
        return String(U.updateId ?? '').slice(0, 8);
    }
    catch {
        return '';
    }
}
/**
 * 새 버전을 받아 둔다 — **어느 화면에서든 받는다.**
 *
 * 홈에 도착한 뒤에만 받게 하면 **로그인 화면을 고친 변경이 영영 안 내려간다** —
 * 로그인하지 않은 기기는 홈에 갈 일이 없고 `checkAutomatically` 도 꺼 두었기 때문이다.
 *
 * 앞에 잠깐 텀을 둔다 — 첫 화면이 쓸 네트워크를 같이 먹지 않게. **6초는 너무 길었다**
 * (그 전에 앱을 끄면 못 받는다).
 */
function pullUpdateSoon(delayMs = 2000) {
    if (pulled)
        return;
    if (typeof __DEV__ !== 'undefined' && __DEV__)
        return; // 개발 빌드는 Metro 에서 읽는다
    pulled = true;
    setTimeout(() => {
        // 화면을 보고 있을 때만 — 뒤로 넘어간 앱이 굳이 받을 이유가 없다
        try {
            const { AppState } = require('react-native');
            if (AppState.currentState !== 'active')
                return;
        }
        catch {
            // react-native 가 없는 환경(시험)에서는 그냥 받는다
        }
        void pull();
    }, delayMs);
}
async function pull() {
    try {
        const U = require('expo-updates');
        if (!U.isEnabled)
            return;
        const found = await U.checkForUpdateAsync();
        if (!found.isAvailable)
            return;
        const got = await U.fetchUpdateAsync();
        // **「새 판을 정말 받았다」일 때만 알린다** — 되돌리기·실패에 띠를 내면 눌러도 그대로다
        if (!got.isNew)
            return;
        waiting = true;
        ready?.();
    }
    catch {
        // 못 받아도 앱은 그대로 돈다 — 지금 쓰는 판이 멀쩡하기 때문이다
    }
}
/**
 * 받아 둔 판으로 다시 시작한다 — **사람이 눌렀을 때만 부른다.**
 *
 * **이 함수 말고 어디에서도 `reloadAsync` 를 부르지 않는다.** 앱이 스스로 다시 시작하면
 * 소셜 로그인처럼 앱 밖으로 나갔다 돌아오는 흐름이 끊긴다 — 돌아올 곳이 사라져 결과를 못 받는다.
 */
async function applyUpdate() {
    try {
        const U = require('expo-updates');
        await U.reloadAsync();
    }
    catch {
        // 못 돌면 다음에 켤 때 저절로 적용된다
    }
}
