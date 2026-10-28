"use strict";
/**
 * 앱 오프닝 광고 — **보여도 되는지 가리는 순수 규칙**(2026-10-10 대표님 지시).
 *
 * 기기 모듈을 읽지 않는다(노드 시험 · `flow.ts` 가 가드를 부른다). 광고를 불러오고 띄우는 쪽은 `appOpen.ts`.
 *
 * 규칙 요약
 *  - 어드민 `<앱>.app_open_on` 이 1 이고 단위 ID 가 있어야 한다(기본 꺼짐).
 *  - 콜드 스타트는 **스플래시 로딩 중에만**. 로딩이 끝났으면 건너뛴다.
 *  - 백그라운드 → 앞으로(웜 스타트)는 `app_open_on_resume` 이 1 일 때만.
 *  - **마지막으로 앱을 쓴 때**(앞에 있던 마지막 시각 · 뒤로 간 시각)로부터 `app_open_interval_h` 시간이 지나야 한다.
 *  - 하루(KST) `app_open_daily_max` 번까지.
 *  - 설치(첫 실행)한 날은 세지 않고 `app_open_skip_days` 일이 지나야 한다(1 이면 다음 날부터).
 *  - 보상형 · 전면 광고 · 미션(외부 앱/웹) · 결제 · 로그인에서 돌아온 직후엔 **절대** 안 띄운다(가드).
 *  - 전체화면 광고가 떠 있는 동안에도 안 띄운다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.guardActive = exports.blockFor = exports.EMPTY_GUARD = exports.AFTER_RETURN_MS = exports.COLD_HOLD_MS = exports.shownToday = exports.kstDay = exports.EMPTY_STORE = exports.DEFAULT_APP_OPEN = void 0;
exports.noteShown = noteShown;
exports.decide = decide;
exports.shouldHold = shouldHold;
exports.coldPrecheck = coldPrecheck;
exports.markReturn = markReturn;
exports.onForeground = onForeground;
exports.DEFAULT_APP_OPEN = { on: false, onResume: false, intervalH: 4, dailyMax: 3, skipDays: 1 };
exports.EMPTY_STORE = { firstLaunchAt: null, lastUseAt: null, day: '', count: 0 };
const HOUR = 3600000;
const DAY = 86400000;
const KST = 9 * HOUR;
/** KST 날짜 글자 `YYYY-MM-DD` */
const kstDay = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
exports.kstDay = kstDay;
/** KST 로 1970-01-01 부터 며칠째 */
const kstIndex = (ms) => Math.floor((ms + KST) / DAY);
/** 오늘 이미 띄운 횟수 — 날짜가 바뀌었으면 0 */
const shownToday = (st, now) => (st.day === (0, exports.kstDay)(now) ? st.count : 0);
exports.shownToday = shownToday;
/** 한 번 띄웠다고 적는다 */
function noteShown(st, now) {
    return { ...st, day: (0, exports.kstDay)(now), count: (0, exports.shownToday)(st, now) + 1 };
}
function decide(i) {
    const no = (reason) => ({ show: false, reason });
    if (!i.cfg.on)
        return no('off');
    if (!i.unitId)
        return no('no_unit');
    if (i.fullScreenShowing)
        return no('fullscreen');
    if (i.guarded)
        return no('guard');
    if (i.trigger === 'cold' && !i.splash)
        return no('cold_after_splash');
    if (i.trigger === 'resume' && !i.cfg.onResume)
        return no('resume_off');
    /* 설치일은 세지 않는다 — 첫 실행 기록이 없으면(처음 켜는 참) 오늘이 설치일이다 */
    const first = i.store.firstLaunchAt ?? i.now;
    if (kstIndex(i.now) - kstIndex(first) < i.cfg.skipDays)
        return no('skip_days');
    /* 마지막으로 쓴 때를 모르면(기록 없음) 간격으로는 막지 않는다 */
    const last = i.store.lastUseAt;
    if (last !== null && i.now - last <= i.cfg.intervalH * HOUR)
        return no('interval');
    if ((0, exports.shownToday)(i.store, i.now) >= i.cfg.dailyMax)
        return no('daily_max');
    if (!i.loaded)
        return no('not_loaded');
    return { show: true };
}
/** 콜드 스타트에서 스플래시를 광고 로드까지 붙잡는 최대 시간(ms) — A32 실측 로드 4.6초를 받도록 5초(3초는 hold_timeout 으로 못 떴다 · 대표님 기준 스플래시 3~5초 이내) */
exports.COLD_HOLD_MS = 5000;
/**
 * 스플래시를 광고 때문에 더 붙잡아야 하나 — **띄울 수 있는 실행일 때만**, 로드가 안 끝났고 상한(`COLD_HOLD_MS`) 안일 때만.
 * 쉬는 날 · 간격 · 하루 최대 · 꺼짐에 걸리는 실행은 로드 여부와 상관없이 붙잡지 않는다(규칙 판정은 로드 전에 먼저).
 */
function shouldHold(i) {
    if (i.loaded || i.elapsedMs >= exports.COLD_HOLD_MS)
        return false;
    return coldPrecheck(i).show;
}
/** 로드 · 스플래시 여부는 따지지 않고 규칙만으로 콜드 스타트에 띄울 수 있나 */
function coldPrecheck(i) {
    return decide({
        cfg: i.cfg, unitId: i.unitId, trigger: 'cold', splash: true, loaded: true,
        fullScreenShowing: false, guarded: false, store: i.store, now: i.now,
    });
}
/** 이 흐름으로 앱을 떠나 있을 수 있는 최대 시간 — 이 안에 돌아오면 「그 흐름에서 돌아온 것」이다 */
const AWAY_MS = {
    rewarded: 3 * 60000,
    interstitial: 3 * 60000,
    mission: 60 * 60000,
    payment: 30 * 60000,
    login: 10 * 60000,
    external: 30 * 60000,
};
/** 돌아온 뒤 더 막는 시간 */
exports.AFTER_RETURN_MS = 30000;
exports.EMPTY_GUARD = { pending: null, until: 0 };
/** 흐름을 시작한다 — 떠나 있는 동안 + 돌아온 뒤 `AFTER_RETURN_MS` 막는다 */
function markReturn(g, reason, now) {
    return { pending: { reason, expires: now + AWAY_MS[reason] }, until: Math.max(g.until, now + exports.AFTER_RETURN_MS) };
}
/** 앞으로 `ms` 동안은 무조건 막는다 */
const blockFor = (g, ms, now) => ({ ...g, until: Math.max(g.until, now + ms) });
exports.blockFor = blockFor;
/** 앱이 앞으로 돌아왔다 — 떠난 흐름이 있으면 거기서 돌아온 것이다 */
function onForeground(g, now) {
    if (g.pending && now <= g.pending.expires)
        return { pending: null, until: Math.max(g.until, now + exports.AFTER_RETURN_MS) };
    return { pending: null, until: g.until };
}
/** 지금 막혀 있나 — 떠난 흐름이 아직 안 돌아왔거나 막는 시간 안 */
const guardActive = (g, now) => now < g.until || (g.pending !== null && now <= g.pending.expires);
exports.guardActive = guardActive;
