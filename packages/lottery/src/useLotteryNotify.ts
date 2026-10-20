import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, Linking } from 'react-native';
import { createNotifyController, type NotifyDeps, type NotifyView } from './notify';
import type { LotteryNotify } from './LotteryUi';

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
export function useLotteryNotify(deps: Omit<NotifyDeps, 'openSettings'> & { openSettings?: NotifyDeps['openSettings'] | false }): LotteryNotify & { view: NotifyView; refresh: () => void } {
  const ref = useRef(deps);
  ref.current = deps;
  const ctl = useMemo(() => createNotifyController({
    getNotificationStatus: () => ref.current.getNotificationStatus(),
    onEnableNotifications: (m) => ref.current.onEnableNotifications(m),
    openSettings: ref.current.openSettings === false ? undefined : (ref.current.openSettings ?? (() => Linking.openSettings())),
  }), []);
  const [view, setView] = useState<NotifyView>(ctl.view());
  useEffect(() => {
    const off = ctl.subscribe(setView);
    void ctl.refresh();
    const sub = AppState.addEventListener('change', (s: string) => { if (s === 'active') void ctl.refresh(); });

    return () => { off(); sub.remove(); };
  }, [ctl]);
  const onPress = useCallback(() => { void ctl.enable(); }, [ctl]);
  const refresh = useCallback(() => { void ctl.refresh(); }, [ctl]);

  return { visible: view.visible, busy: view.busy, onPress, view, refresh };
}
