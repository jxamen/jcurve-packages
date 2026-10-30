/**
 * 무료체험 「해지 알림 켜고 참여하기」 — makes sure the phone can really show the cancel notices (0.4.0: moved here from the app).
 *
 *  ① the OS notification permission: not asked yet → the permission window; refused → 「알림이 꺼져 있어요 · 설정에서 켜 주세요」 → the app's settings page, and a new check on the way back
 *  ② once notifications are on, the push token is sent again (the app's `syncToken`; without one nothing is sent)
 *
 * Resolves `on` (on) · `off` (still off) · `none` (this build cannot ask). Whatever it answers, saving the consent and opening the campaign go on; only the toast differs.
 * It never touches the app's own 「새 혜택과 이벤트」 (marketing) switch: agreeing to ads on the member's behalf is not allowed, and cancel notices go to those who agreed
 * to them whatever that switch says.
 *
 * Needs `expo-notifications` (found lazily; absent = `none`). Everything the phone is asked is in `TrialNotifyDeps`, so tests replace it.
 */
import type { TrialNotifyResult } from './comboTrials';

export type NotifyState = 'on' | 'off' | 'ask' | 'none';

export type TrialNotifyDeps = {
  state: () => Promise<NotifyState>;
  /** Not asked yet: show the permission window and answer the new state (only called when `state` said `ask`). */
  ask: () => Promise<NotifyState>;
  /** 「알림이 꺼져 있어요」 — true for 「설정 열기」, false for 「나중에」 or tapping outside. */
  confirmSettings: () => Promise<boolean>;
  openSettings: () => Promise<void>;
  /** Waits until the member is back from the settings (at most two minutes). */
  backFromSettings: () => Promise<void>;
  syncToken: () => Promise<void>;
};

/** The few things an app may add around the phone's own questions. */
export type TrialNotifyHooks = {
  /** Runs before the permission window (an app may need to finish its tracking question first — two system windows at once swallow one). */
  beforeAsk?: () => Promise<unknown> | unknown;
  /** Runs right before the settings page opens (an app may mute its "came back from outside" handling). */
  beforeSettings?: () => unknown;
  /** Sends the push token to the app's server. */
  syncToken?: () => Promise<unknown>;
};

const BACK_MAX_MS = 120_000;

type Notifications = {
  getPermissionsAsync(): Promise<{ granted?: boolean; canAskAgain?: boolean }>;
  requestPermissionsAsync(): Promise<unknown>;
};
function notifications(): Notifications | null {
  try { return require('expo-notifications') as Notifications; } catch { return null; }
}

export async function notifyState(): Promise<NotifyState> {
  const N = notifications();
  if (!N) return 'none';
  try {
    const p = await N.getPermissionsAsync();
    if (p.granted) return 'on';
    return p.canAskAgain ? 'ask' : 'off';
  } catch { return 'none'; }
}

/** The default dependencies: the real phone. */
export function defaultTrialNotifyDeps(hooks: TrialNotifyHooks = {}): TrialNotifyDeps {
  const rn = () => require('react-native') as typeof import('react-native');
  return {
    state: notifyState,
    ask: async () => {
      const N = notifications();
      if (!N) return 'none';
      try {
        await hooks.beforeAsk?.();
        await N.requestPermissionsAsync();
      } catch { return 'none'; }
      return notifyState();
    },
    confirmSettings: () => new Promise<boolean>(resolve => {
      const { Alert } = rn();
      Alert.alert(
        '알림이 꺼져 있어요',
        '설정에서 켜 주세요',
        [
          { text: '나중에', style: 'cancel', onPress: () => resolve(false) },
          { text: '설정 열기', onPress: () => resolve(true) },
        ],
        { cancelable: true, onDismiss: () => resolve(false) },
      );
    }),
    openSettings: async () => {
      try { await hooks.beforeSettings?.(); } catch { /* a hook must not stop the settings page */ }
      try { await rn().Linking.openSettings(); } catch { /* it stays where it was */ }
    },
    backFromSettings: () => new Promise<void>(resolve => {
      const { AppState } = rn();
      let left = AppState.currentState !== 'active';
      let done = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      let subscription: { remove(): void } | undefined;
      const finish = () => { if (done) return; done = true; if (timer) clearTimeout(timer); try { subscription?.remove(); } catch { /* ignore */ } resolve(); };
      subscription = AppState.addEventListener('change', (next: string) => {
        if (next !== 'active') left = true;
        else if (left) finish();
      });
      timer = setTimeout(finish, BACK_MAX_MS);
    }),
    syncToken: async () => { try { await hooks.syncToken?.(); } catch { /* the token upload is retried by the app on its own */ } },
  };
}

export async function ensureTrialNotify(deps: TrialNotifyDeps = defaultTrialNotifyDeps()): Promise<TrialNotifyResult> {
  try {
    let now = await deps.state();
    if (now === 'none') return 'none';
    if (now === 'ask') now = await deps.ask();
    if (now === 'on') { await deps.syncToken(); return 'on'; }
    if (now === 'none') return 'none';
    // refused: the app cannot ask again — tell, and open the settings
    if (!(await deps.confirmSettings())) return 'off';
    await deps.openSettings();
    await deps.backFromSettings();
    now = await deps.state();
    if (now === 'on') { await deps.syncToken(); return 'on'; }
    return 'off';
  } catch {
    return 'none';
  }
}
