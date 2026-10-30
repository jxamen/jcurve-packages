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
export declare function notifyState(): Promise<NotifyState>;
/** The default dependencies: the real phone. */
export declare function defaultTrialNotifyDeps(hooks?: TrialNotifyHooks): TrialNotifyDeps;
export declare function ensureTrialNotify(deps?: TrialNotifyDeps): Promise<TrialNotifyResult>;
