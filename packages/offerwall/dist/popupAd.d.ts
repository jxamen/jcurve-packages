/**
 * 0.4.0 — the native ad under 「추천 보기」 in the recommendation popup, moved here from the apps (it was the same card in each).
 *
 * Uses `react-native-google-mobile-ads` (an optional peer: without it, or without an ad unit, nothing is drawn and no space is left). The app gives its
 * ad unit (one id per OS) and, while testing, `testMode` (Google's test unit is used) and its test devices.
 * Looks like an ad, not like the app's button: a grey outlined button, a 「광고」 tag on top. Every tappable part is registered as a native asset, so a tap counts only as an ad click.
 * Picture ads are preferred (a video is thrown away up to five times; the last video is shown muted when nothing else comes), and an unfilled request is tried again after 3 s, 10 s and 30 s.
 */
import type { ReactElement } from 'react';
import type { ComboTheme } from './combos';
export type OfferwallAdUnits = {
    ios?: string;
    android?: string;
};
export type OfferwallPopupAdOptions = {
    /** One ad unit id per OS. Empty = no ad. */
    adUnit?: OfferwallAdUnits | string;
    /** Use Google's test native unit instead of `adUnit`. Never set this in a release. */
    testMode?: boolean;
    /** Google test device ids (so a review device never gets a real ad). */
    testDevices?: string[];
    theme?: ComboTheme;
};
export declare const POPUP_AD_RETRY_MS: number[];
/** The ad unit id for this OS from what the app gave ('' when none). */
export declare function popupAdUnit(adUnit: OfferwallAdUnits | string | undefined, os?: string): string;
/** Is the ad possible at all (an SDK and a unit)? Used to decide whether the popup leaves room for it. */
export declare function popupAdAvailable(options: Pick<OfferwallPopupAdOptions, 'adUnit' | 'testMode'>): boolean;
export declare function OfferwallPopupAd({ adUnit, testMode, testDevices, theme, style }: OfferwallPopupAdOptions & {
    style?: Record<string, unknown>;
}): ReactElement | null;
