"use strict";
/**
 * 「🔔 복권 받기 알림 켜기」 유도(0.1.2, 대표님 10-20 15:49 「복권 받기 알림 켜기 넣어서 알림 활성화 유도하고」).
 * 알림이 꺼져 있을 때만 줄을 보이고, 누르면 OS 알림 권한을 묻는다(이미 거절했으면 설정 화면). **알림 발송은 이 패키지에 없다**(서버 「새 황금 복권」 발송은 따로).
 * 앱별 push 코드는 앱이 콜백으로 넘긴다 — 권한 확인 `getNotificationStatus` · 켜기 `onEnableNotifications`(권한 요청 + 토큰 등록은 앱의 기존 경로).
 * react-native 를 가져오지 않는다(시험이 바로 돈다). React 연결은 useLotteryNotify.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyMode = notifyMode;
exports.createNotifyController = createNotifyController;
function notifyMode(s) {
    if (s === true || s === 'granted')
        return 'on';
    if (s === 'denied' || s === 'blocked')
        return 'denied';
    if (s === false || s === 'undetermined')
        return 'ask';
    return 'unknown'; // 모르면 조르지 않는다
}
function createNotifyController(deps) {
    let view = { visible: false, busy: false, mode: 'unknown' };
    const listeners = new Set();
    const set = (next) => {
        view = { ...view, ...next };
        listeners.forEach((l) => { try {
            l(view);
        }
        catch { /* noop */ } });
    };
    const refresh = async () => {
        let mode = 'unknown';
        try {
            mode = notifyMode(await deps.getNotificationStatus());
        }
        catch {
            mode = 'unknown';
        }
        set({ mode, visible: mode === 'ask' || mode === 'denied' });
        return view;
    };
    const enable = async () => {
        if (view.busy || !view.visible)
            return view;
        set({ busy: true });
        try {
            if (view.mode === 'denied' && deps.openSettings)
                await deps.openSettings();
            else
                await deps.onEnableNotifications(view.mode);
        }
        catch { /* 앱이 보여 줄 것은 앱이 보여 준다 — 여기서는 다시 읽기만 */ }
        set({ busy: false });
        return refresh(); // 켜졌으면 줄이 사라진다
    };
    return {
        refresh,
        enable,
        view: () => view,
        subscribe: (fn) => { listeners.add(fn); return () => { listeners.delete(fn); }; },
    };
}
