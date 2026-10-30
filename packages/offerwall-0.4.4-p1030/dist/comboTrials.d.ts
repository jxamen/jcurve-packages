/**
 * 무료체험 (대표님 10/27 22:11~22:29): a cancel-notice consent popup before a free-trial campaign's detail opens, the member's own list
 * 「무료체험 확인」 (what they joined, when the trial ends, whether they cancelled), and the request channel a push uses to open that list.
 * The server (앱보조5) decides everything about status and dates; this file only shows it.
 */
import type { ReactElement } from 'react';
import { type ComboTheme } from './combos';
export declare const COMBO_TRIALS_NAME = "\uBB34\uB8CC\uCCB4\uD5D8 \uD655\uC778";
/** What a row says once the member marked it cancelled. */
export declare const COMBO_CANCELLED_TEXT = "\uD574\uC9C0 \uC644\uB8CC \u2713 \u00B7 \uC54C\uB9BC\uC744 \uADF8\uB9CC \uBCF4\uB0BC\uAC8C\uC694";
export declare const COMBO_TRIAL_STATUSES: readonly ["체험 중", "지금 해지 가능", "결제 시작됨"];
export type MyTrialStatus = (typeof COMBO_TRIAL_STATUSES)[number];
/** One row of `GET offerwall/trials`: a free trial this member joined (consented to cancel notices, or was paid for). */
export type MyTrial = {
    campaignKey: string;
    name: string;
    points?: number;
    icon?: string;
    /** ISO time with +09:00 (the server's own); `joinedVia`: 'reward' = the real credit time, 'consent' = when they agreed (before any credit) */
    joinedAt?: string;
    joinedVia?: 'reward' | 'consent';
    agreed?: boolean;
    trialDays?: number;
    trialHours?: number;
    cancelAfterHours?: number;
    chargeAmount?: number;
    /** from when the trial can be cancelled, and when the first charge happens (ISO, +09:00) */
    cancelFrom?: string;
    chargeAt?: string;
    /** computed by the server against its own `now` */
    status?: MyTrialStatus;
    /** null = not marked yet, true = 해지했어요, false = 아직 안 했어요 */
    cancelled?: boolean | null;
};
/**
 * The body of `GET offerwall/trials`: `{ ok, trials: [...], now }`. Returns the checked rows in the server's order (newest first), or null when
 * the body is not that shape (so the screen can say it could not load instead of showing nothing). A row needs a campaign key; every other
 * value is optional and a bad one is simply left out.
 */
export declare function parseMyTrials(body: unknown): MyTrial[] | null;
/** 「2026-10-30T22:32:24+09:00」 → 「10/30」 (the date as the server wrote it, Korean time). */
export declare function monthDay(iso: string | undefined): string;
/** Does this row still have to ask 「해지했나요?」: the cancel time has come (or the first charge has started) and the member has not said yes. */
export declare function asksCancelled(trial: Pick<MyTrial, 'status' | 'cancelled'>): boolean;
/** The small grey line under a row's name: 「10/27 참여 · 11/3 결제 예정 · 월 29,900원」 (parts the server did not give are left out). */
export declare function myTrialLine(trial: MyTrial): string;
type TrialsOpener = {
    priority: number;
    open(focusKey?: string): void;
};
/**
 * Opens the member's free-trial list from anywhere (a cancel-notice push). `focusKey` is the campaign to highlight. Like `requestOpenCombos`:
 * with no entry mounted yet (the app is switching to the Chance tab) the request waits up to 10 seconds for the first one that mounts.
 */
export declare function requestOpenTrials(focusKey?: string, now?: number): boolean;
export declare function listenForTrialRequests(opener: TrialsOpener, now?: number): () => void;
/** 대표님 10/27 22:51 wording. The body is broken by hand so no word is cut in the middle. */
export declare const COMBO_CONSENT_TITLE = "\uBB34\uB8CC\uCCB4\uD5D8, \uC548\uC2EC\uD558\uACE0 \uCC38\uC5EC\uD558\uC138\uC694";
export declare const COMBO_CONSENT_BODY = "\uCCB4\uD5D8\uC774 \uB05D\uB098\uAE30 \uC804\uC5D0\n\uD574\uC9C0\uD560 \uB54C\uB97C \uC54C\uB9BC\uC73C\uB85C \uC54C\uB824 \uB4DC\uB824\uC694.\n\uD574\uC9C0\uD558\uBA74 \uB3C8\uC774 \uB098\uAC00\uC9C0 \uC54A\uC544\uC694.";
/** 대표님 10/27 23:14: what the soft box says (the popup is about the whole tab, not one campaign). */
export declare const COMBO_CONSENT_TAB_LINE = "\uC5EC\uAE30 \uC788\uB294 \uCCB4\uD5D8\uC740 \uB05D\uB098\uBA74 \uC790\uB3D9 \uACB0\uC81C\uB3FC\uC694.\n\uB05D\uB098\uAE30 \uC804\uC5D0 \uD574\uC9C0 \uC54C\uB9BC\uC744 \uBCF4\uB0B4 \uB4DC\uB824\uC694.";
/** The strong button (대표님 10/27 23:15 「해지 알림 켜고 참여하기」) and the other one. */
export declare const COMBO_CONSENT_AGREE = "\uD574\uC9C0 \uC54C\uB9BC \uCF1C\uACE0 \uCC38\uC5EC\uD558\uAE30";
export declare const COMBO_CONSENT_DECLINE = "\uAD1C\uCC2E\uC544\uC694";
/** Shown for a moment after the strong button, once the phone's notifications are seen to. */
export declare const COMBO_CONSENT_TOAST = "\uD574\uC9C0 \uC54C\uB9BC\uC744 \uB9DE\uCDB0 \uB480\uC5B4\uC694";
/** Instead, when the phone's notifications stayed off (대표님 10/27 23:11): the member is told they will not get the notices. */
export declare const COMBO_CONSENT_TOAST_OFF = "\uC54C\uB9BC\uC774 \uAEBC\uC838 \uC788\uC5B4 \uC548\uB0B4\uB97C \uBABB \uBC1B\uC544\uC694";
/**
 * What the app found out about the phone's notifications after the strong button: 'on' = they are on (asked, or turned on in the settings), 'off' = they stayed off,
 * 'none' = this build cannot ask. The app does the asking (permission window, the settings page, the push token): see `onTrialNotify`.
 */
export type TrialNotifyResult = 'on' | 'off' | 'none';
export type ConsentAnswer = 'agree' | 'decline';
/**
 * Asked when the member walks into the 무료체험 tab (대표님 10/27 23:14), not when they tap a row: one question for the whole tab. The strong button
 * (`COMBO_CONSENT_AGREE`) turns the cancel notices on — the app sees to the phone's notifications, the choice is kept on the device, and from then on tapping a
 * row saves that campaign's consent by itself and opens it. 「괜찮아요」 (and the dimmed area, and going back) means not again today. The button for the member's own
 * list does not ask.
 */
export declare function TrialConsentPopup({ theme, onAnswer }: {
    theme?: ComboTheme;
    onAnswer: (answer: ConsentAnswer) => void;
}): ReactElement;
import type { ComboStorage } from './comboDone';
/** 「해지 알림 켜고 참여하기」 was pressed once: kept per member on the device, no daily reset. */
export declare const trialNoticeKey: (scope: string | number | undefined) => string;
/** 「괜찮아요」: kept for the Korean day only (read through `useSeenToday`), the popup comes again the next day. */
export declare const trialNoticeDeclineKey: (scope: string | number | undefined) => string;
/** `agreed` is null until the stored value was read (the popup waits meanwhile), then true or false. */
export declare function useTrialNoticeAgreed({ storage, scope }: {
    storage?: ComboStorage;
    scope?: string | number;
}): {
    agreed: boolean | null;
    setAgreed(): void;
};
/** Test helper: forget the choice in memory. */
export declare function resetTrialNoticeMemory(): void;
export type ComboTrialsScreenProps = {
    items: MyTrial[] | null;
    loading?: boolean;
    /** true when the list could not be loaded (a network or body problem) */
    failed?: boolean;
    theme?: ComboTheme;
    /** a campaign to put first and highlight (the push's `campaignKey`) */
    focusKey?: string;
    onClose: () => void;
    /** a row was tapped: open that campaign's detail page */
    onOpen: (trial: MyTrial) => void;
    /** 「해지했어요」 was tapped on a row (always `true`: the notices stop) */
    onCancelled: (trial: MyTrial, cancelled: boolean) => void;
    onRetry?: () => void;
};
/** 「무료체험 확인」: the member's free trials, one row each, newest first (the pushed one first, highlighted). */
export declare function ComboTrialsScreen({ items, loading, failed, theme, focusKey, onClose, onOpen, onCancelled, onRetry }: ComboTrialsScreenProps): ReactElement;
export {};
