/**
 * 무료체험 (대표님 10/27 22:11~22:29): a cancel-notice consent popup before a free-trial campaign's detail opens, the member's own list
 * 「무료체험 확인」 (what they joined, when the trial ends, whether they cancelled), and the request channel a push uses to open that list.
 * The server (앱보조5) decides everything about status and dates; this file only shows it.
 */
import type { ReactElement } from 'react';
import { type ComboTheme } from './combos';
export declare const COMBO_TRIALS_NAME = "\uBB34\uB8CC\uCCB4\uD5D8 \uD655\uC778";
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
/** Broken by hand after 「전에」 so no word is cut in the middle (the sentence is 「무료체험이 끝나기 전에 해지 안내를 받으시겠어요?」). */
export declare const COMBO_CONSENT_TITLE = "\uBB34\uB8CC\uCCB4\uD5D8\uC774 \uB05D\uB098\uAE30 \uC804\uC5D0\n\uD574\uC9C0 \uC548\uB0B4\uB97C \uBC1B\uC73C\uC2DC\uACA0\uC5B4\uC694?";
export declare const COMBO_CONSENT_BODY = "\uD574\uC9C0\uD558\uC9C0 \uC54A\uC73C\uBA74 \uC790\uB3D9\uC73C\uB85C \uACB0\uC81C\uB420 \uC218 \uC788\uC5B4\uC694.\n\uC548\uB0B4\uB97C \uBC1B\uC73C\uBA74 \uD574\uC9C0\uD560 \uB54C \uC54C\uB824 \uB4DC\uB824\uC694.";
export type ConsentAnswer = 'agree' | 'decline' | 'cancel';
/**
 * Asked before a free-trial campaign's detail page opens. 「안내 받기」 and 「괜찮아요」 both go on to the campaign (the caller records the
 * answer); tapping the dimmed area or going back answers nothing ('cancel': the campaign does not open and the question comes again next time).
 */
export declare function TrialConsentPopup({ name, theme, onAnswer }: {
    name: string;
    theme?: ComboTheme;
    onAnswer: (answer: ConsentAnswer) => void;
}): ReactElement;
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
    /** 「했어요」 (true) or 「아직」 (false) was tapped on a row */
    onCancelled: (trial: MyTrial, cancelled: boolean) => void;
    onRetry?: () => void;
};
/** 「무료체험 확인」: the member's free trials, one row each, newest first (the pushed one first, highlighted). */
export declare function ComboTrialsScreen({ items, loading, failed, theme, focusKey, onClose, onOpen, onCancelled, onRetry }: ComboTrialsScreenProps): ReactElement;
export {};
