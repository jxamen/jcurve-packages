"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLotteryNotify = useLotteryNotify;
const react_1 = require("react");
const react_native_1 = require("react-native");
const notify_1 = require("./notify");
/**
 * 「🔔 복권 받기 알림 켜기」 줄의 상태 — 화면이 뜰 때 · 앱이 앞으로 돌아올 때(설정에서 켜고 돌아온 경우) 알림 권한을 다시 읽는다.
 *
 *   const notify = useLotteryNotify({
 *     getNotificationStatus: async () => (await Notifications.getPermissionsAsync()).status,            // 'granted' | 'denied' | 'undetermined'
 *     onEnableNotifications: async () => { await Notifications.requestPermissionsAsync(); await registerPushToken(); },   // 앱의 기존 push 경로
 *   });
 *   <LotterySheet … notify={notify} />  <GoldenLotteryPopup … notify={notify} />  <LotteryResult … notify={notify} />
 *
 * 이미 거절한 기기('denied')는 `Linking.openSettings()` 로 설정 화면을 연다(`openSettings: false` 면 앱 콜백이 mode 'denied' 로 받는다).
 */
function useLotteryNotify(deps) {
    const ref = (0, react_1.useRef)(deps);
    ref.current = deps;
    const ctl = (0, react_1.useMemo)(() => (0, notify_1.createNotifyController)({
        getNotificationStatus: () => ref.current.getNotificationStatus(),
        onEnableNotifications: (m) => ref.current.onEnableNotifications(m),
        openSettings: ref.current.openSettings === false ? undefined : (ref.current.openSettings ?? (() => react_native_1.Linking.openSettings())),
    }), []);
    const [view, setView] = (0, react_1.useState)(ctl.view());
    (0, react_1.useEffect)(() => {
        const off = ctl.subscribe(setView);
        void ctl.refresh();
        const sub = react_native_1.AppState.addEventListener('change', (s) => { if (s === 'active')
            void ctl.refresh(); });
        return () => { off(); sub.remove(); };
    }, [ctl]);
    const onPress = (0, react_1.useCallback)(() => { void ctl.enable(); }, [ctl]);
    const refresh = (0, react_1.useCallback)(() => { void ctl.refresh(); }, [ctl]);
    return { visible: view.visible, busy: view.busy, onPress, view, refresh };
}
