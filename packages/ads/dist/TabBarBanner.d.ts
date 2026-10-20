import React from 'react';
/**
 * (1.9.9) Why the slot is (not) filled — diagnostics only, never changes behavior.
 * - `requesting`: a request started (native: every attempt; banner: the BannerAd was mounted).
 * - `loaded`: a creative is on screen.
 * - `video-dropped`: a video creative came back and was destroyed (a 40dp row cannot render the required video).
 * - `no-fill`: the request failed or came back empty (`error` = SDK message when there is one).
 * - `retries-exhausted`: native gave up after the last retry (follows the `video-dropped` / `no-fill` of that attempt).
 * - `init-failed`: the ads SDK did not initialize.
 * `tries` = requests made in this run since the last `loaded` (first request = 1; banner always 1).
 */
export type TabBarBannerState = {
    state: 'requesting' | 'loaded' | 'video-dropped' | 'no-fill' | 'retries-exhausted' | 'init-failed';
    tries: number;
    error?: string;
};
export type TabBarBannerProps = {
    unitId?: string;
    enabled: boolean;
    /** Match the existing unit's AdMob format. Never send a native unit to BannerAd. */
    format?: 'banner' | 'native';
    /**
     * (1.9.8) Color of the reserved slot while no creative is on screen (before load, no fill, retries exhausted, between creatives).
     * Pass the app's tab-bar color so the empty slot is invisible. Default '#fff'.
     */
    backgroundColor?: string;
    /**
     * (1.9.8) Optional measured outer height (dp) for format="banner". Default: an estimate from the window size (`bannerSlotHeight`).
     * The outer height never changes after mount; if the SDK's real banner is a few dp different it is centered and clipped inside the slot.
     */
    bannerHeight?: number;
    /** (1.9.10) App language ('ko' / 'en' / 'en-US' ...) for the package's own words — only the fallback CTA label today. Absent = Korean. */
    lang?: string;
    /** (1.9.9) Optional diagnostics callback — see `TabBarBannerState`. Absent means nothing is reported; a throwing callback is ignored. */
    onState?: (s: TabBarBannerState) => void;
};
/** Outer height of a native slot (dp). Reserved from the first render. */
export declare const NATIVE_SLOT_HEIGHT = 40;
/**
 * Estimated height (dp) of an anchored adaptive banner for a window, used to reserve the slot **before** the ad loads (1.9.8).
 * Google documents only the limits — at least 50 and at most 15% of the device height (the Unity guide adds a 90 dp cap) — not the formula.
 * So: the standard 320x50 ratio scaled to the width, `ceil(width * 50 / 320)`, clamped to [50, min(90, 15% of height)].
 * e.g. 360 -> 57, 390 -> 61, 412 -> 65, tablets -> 90. It is an estimate: the SDK's real height can differ by a few dp, which is why the slot
 * centers and clips the ad instead of resizing (the outer height must never move the tab row).
 */
export declare function bannerSlotHeight(windowWidth: number, windowHeight?: number): number;
/**
 * Mount below the tabs, above the caller's safe-area inset.
 * (1.9.8) The slot is **reserved from the first render** with a fixed outer height, so the tab row never jumps when the ad arrives:
 * before load, no fill, exhausted retries, video filtered out and creative swaps all keep the same height (empty slot = `backgroundColor`).
 * Only `enabled=false`, a missing unit, web, or no ads SDK reserve nothing (0 height).
 */
export declare function TabBarBanner({ unitId, enabled, format, backgroundColor, bannerHeight, lang, onState }: TabBarBannerProps): React.FunctionComponentElement<any> | null;
/** Retry delays after no fill / video creative (ms). After the last one the slot stays reserved but empty. */
export declare const NATIVE_RETRY_MS: number[];
/** Swap the creative while it stays on screen. */
export declare const NATIVE_REFRESH_MS = 60000;
/**
 * (1.9.10) Label of the native row's call-to-action button: the ad's own `callToAction` text, or "설치" (en: "Install") when the ad has none.
 * AdMob lists "Call to action" as a required element of a native ad (policy table), so the row always shows one.
 */
export declare function nativeCtaLabel(callToAction: unknown, lang?: string): string;
