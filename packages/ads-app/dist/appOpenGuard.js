"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isFullScreenAd = exports.isGuarded = void 0;
exports.markReturnGuard = markReturnGuard;
exports.noAppOpenFor = noAppOpenFor;
exports.setFullScreenAd = setFullScreenAd;
exports.watchFullScreenAd = watchFullScreenAd;
exports.onFullScreenAd = onFullScreenAd;
exports.guardForeground = guardForeground;
exports.resetAppOpenGuard = resetAppOpenGuard;
/**
 * 앱 오프닝 광고 가드 — 앱을 떠나거나 전체화면 광고를 띄우는 자리가 **떠나기 전에** 부른다.
 * 기기 모듈을 읽지 않는다(`flow.ts` 같은 노드 시험 파일도 부른다). 판단 규칙은 `appOpenRules.ts`.
 */
const appOpenRules_1 = require("./appOpenRules");
let guard = appOpenRules_1.EMPTY_GUARD;
let fullScreen = 0;
/** 보상형 · 전면 · 미션(외부 앱/웹) · 결제 · 로그인으로 앱을 떠나기 직전에 부른다 — 돌아온 직후엔 앱 오프닝을 안 띄운다 */
function markReturnGuard(reason) {
    guard = (0, appOpenRules_1.markReturn)(guard, reason, Date.now());
}
/** 지금부터 `ms` 동안 앱 오프닝을 막는다 */
function noAppOpenFor(ms) {
    guard = (0, appOpenRules_1.blockFor)(guard, ms, Date.now());
}
/** 전체화면 광고(보상형 · 전면 · 앱 오프닝 자신)가 떠 있는 동안 true 로 — 겹쳐도 센다 */
function setFullScreenAd(showing) {
    const before = fullScreen > 0;
    fullScreen = Math.max(0, fullScreen + (showing ? 1 : -1));
    if (before !== fullScreen > 0) {
        const now = fullScreen > 0;
        fullScreenListener?.(now);
        for (const listener of [...fullListeners]) {
            try {
                listener(now);
            }
            catch { /* 듣는 쪽 오류가 광고 흐름을 막지 않는다 */ }
        }
    }
}
/*
 | 광고가 떠 있는 동안 OTA 를 미룬다 — `src/ui/updates.ts` 가 @jcurve/updates setBusy('ad') · clearBusy('ad') 를 건다.
 | 이 파일은 기기 모듈을 읽지 않아야 해서(노드 시험) 패키지를 직접 부르지 않고 듣는 쪽 하나만 받는다.
 */
let fullScreenListener = null;
function watchFullScreenAd(fn) {
    fullScreenListener = fn;
}
/*
 | (0.1.0) 여러 곳이 듣는 판 — 영테크 `onFullScreenAd` 와 같다. 전체화면 광고가 뜨고(처음 하나) 닫힐 때(마지막 하나) 한 번씩 부르고, 돌려주는 함수로 그만 듣는다.
 | 에그머니 · 당근처럼 `@jcurve/updates` 의 setBusy / clearBusy 를 이 파일 안에서 부르던 앱은 여기에 듣는 쪽을 달아 그 두 줄을 앱 쪽으로 옮긴다
 | (패키지는 업데이트 모듈을 읽지 않는다 — 노드 시험이 그대로 돈다).
 */
const fullListeners = new Set();
function onFullScreenAd(listener) {
    fullListeners.add(listener);
    return () => { fullListeners.delete(listener); };
}
/** 앱이 앞으로 왔다 — 훅이 부른다 */
function guardForeground(now = Date.now()) {
    guard = (0, appOpenRules_1.onForeground)(guard, now);
}
const isGuarded = (now = Date.now()) => (0, appOpenRules_1.guardActive)(guard, now);
exports.isGuarded = isGuarded;
const isFullScreenAd = () => fullScreen > 0;
exports.isFullScreenAd = isFullScreenAd;
/** 시험용 */
function resetAppOpenGuard() {
    guard = appOpenRules_1.EMPTY_GUARD;
    fullScreen = 0;
    fullScreenListener = null;
    fullListeners.clear();
}
