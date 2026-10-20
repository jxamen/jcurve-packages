import React, { useEffect, useRef, useState } from 'react';
import { t } from './i18n';

/**
 * (1.9.9) Why the slot is (not) filled — diagnostics only, never changes behavior.
 * - `requesting`: a request started (native: every attempt; banner: the BannerAd was mounted).
 * - `loaded`: a creative is on screen.
 * - `video-dropped`: a video creative came back and was destroyed (a 40dp row cannot render the required video).
 * - `no-fill`: the request failed or came back empty (`error` = SDK message when there is one).
 * - `waiting`: native used up its quick retries (1, 3, 10, 30 s) and now keeps asking every 60 s while the app is in front
 *   (and once right away when the app comes back to the front). Reported once, right after the `video-dropped` / `no-fill` of that attempt.
 * - `init-failed`: the ads SDK did not initialize.
 * `tries` = requests made in this run since the last `loaded` (first request = 1; banner always 1).
 */
export type TabBarBannerState = {
  state: 'requesting' | 'loaded' | 'video-dropped' | 'no-fill' | 'waiting' | 'init-failed';
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
export const NATIVE_SLOT_HEIGHT = 40;

/**
 * Estimated height (dp) of an anchored adaptive banner for a window, used to reserve the slot **before** the ad loads (1.9.8).
 * Google documents only the limits — at least 50 and at most 15% of the device height (the Unity guide adds a 90 dp cap) — not the formula.
 * So: the standard 320x50 ratio scaled to the width, `ceil(width * 50 / 320)`, clamped to [50, min(90, 15% of height)].
 * e.g. 360 -> 57, 390 -> 61, 412 -> 65, tablets -> 90. It is an estimate: the SDK's real height can differ by a few dp, which is why the slot
 * centers and clips the ad instead of resizing (the outer height must never move the tab row).
 */
export function bannerSlotHeight(windowWidth: number, windowHeight?: number): number {
  const width = Number.isFinite(windowWidth) && windowWidth > 0 ? windowWidth : 320;
  const byWidth = Math.ceil(width * 50 / 320);
  const cap = typeof windowHeight === 'number' && Number.isFinite(windowHeight) && windowHeight > 0 ? Math.min(90, Math.floor(windowHeight * 0.15)) : 90;

  return Math.max(50, Math.min(byWidth, Math.max(50, cap)));
}

/**
 * Mount below the tabs, above the caller's safe-area inset.
 * (1.9.8) The slot is **reserved from the first render** with a fixed outer height, so the tab row never jumps when the ad arrives:
 * before load, no fill, exhausted retries, video filtered out and creative swaps all keep the same height (empty slot = `backgroundColor`).
 * Only `enabled=false`, a missing unit, web, or no ads SDK reserve nothing (0 height).
 */
export function TabBarBanner({ unitId, enabled, format = 'banner', backgroundColor = '#fff', bannerHeight, lang, onState }: TabBarBannerProps) {
  if (!enabled || !unitId) return null;
  // Optional native peers: importing this package must remain safe on web/Expo Go.
  let sdk: any;
  let rn: any;
  try { sdk = require('react-native-google-mobile-ads'); rn = require('react-native'); }
  catch { return null; }
  if (rn.Platform.OS === 'web') return null;
  return React.createElement(LoadedBanner, { key: `${format}:${unitId}`, sdk, rn, unitId, format, backgroundColor, bannerHeight, lang, onState });
}

/** Quick retry delays after no fill / video creative (ms). After the last one the slot stays reserved and keeps asking every `NATIVE_REFRESH_MS`. */
export const NATIVE_RETRY_MS = [1000, 3000, 10000, 30000];   // (1.9.14) was 3, 10, 30, 60 s — the first creative reaches the slot sooner
/** Swap the creative while it stays on screen — also how often an empty slot keeps asking after the quick retries (1.9.12). */
export const NATIVE_REFRESH_MS = 60000;
/** (1.9.12) Least time between two native requests when the app returns to the front, so flipping apps cannot spam requests. */
export const NATIVE_MIN_GAP_MS = 10000;
/** (1.9.14) How long a prefetched creative may wait for the slot to mount before it is dropped (an old creative may no longer be shown). */
export const NATIVE_HOLD_TTL_MS = 30 * 60 * 1000;

/**
 * (1.9.10) Label of the native row's call-to-action button: the ad's own `callToAction` text, or "설치" (en: "Install") when the ad has none.
 * AdMob lists "Call to action" as a required element of a native ad (policy table), so the row always shows one.
 */
export function nativeCtaLabel(callToAction: unknown, lang?: string): string {
  const text = typeof callToAction === 'string' ? callToAction.trim() : '';

  return text || t('설치', lang);
}

/** Small filled button, right end of the 40dp row. `flexShrink: 0` keeps it whole — the headline is what shrinks. */
const CTA_STYLE = {
  flexShrink: 0, maxWidth: 96, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 4, overflow: 'hidden' as const,
  backgroundColor: '#555', color: '#fff', fontSize: 12, fontWeight: '700' as const, textAlign: 'center' as const,
};

/** Short, single-line description of an SDK error for `TabBarBannerState.error` (never throws). */
function describeError(e: any): string | undefined {
  if (e == null) return undefined;
  try {
    const text = typeof e === 'string' ? e : [e.code, e.message].filter(Boolean).join(': ') || String(e);
    return text.slice(0, 200);
  } catch { return undefined; }
}

/** What a mounted slot gives the feed: where creatives and diagnostics go. */
type FeedSink = {
  onAd: (ad: any) => void;
  onInitFailed: () => void;
  report: (state: TabBarBannerState['state'], tries: number, error?: unknown) => void;
};

type NativeFeed = {
  start: () => void;
  /** The slot is mounted: hand over the creative that is already there and send everything that follows to it. */
  attach: (sink: FeedSink) => void;
  destroy: () => void;
};

/**
 * (1.9.14) The native request loop, outside React so it can run **before** the slot is mounted (`prefetchTabBarBanner`).
 * With a sink (a mounted slot) it behaves exactly as before: drop video, quick retries, then one request a minute while the app
 * is in front, the creative swapped every minute. Without a sink (prefetch, nobody mounted yet) it only fetches the **first**
 * creative: no swap timer, and when the quick retries are used up it stops (`onGone`) — a slot that mounts later asks for itself.
 */
function createNativeFeed(sdk: any, rn: any, unitId: string, onGone?: () => void): NativeFeed {
  let alive = true;
  let sink: FeedSink | null = null;
  let shown: any = null;
  let timer: any = null;
  let hold: any = null;     // drops a prefetched creative nobody took
  let tries = 0;            // retries used (picks the next delay)
  let requests = 0;         // requests since the last loaded (reported as `tries`)
  let loadedRequests = 0;   // how many requests it took to get `shown`
  let started = false;      // the ads SDK is initialized — before that, app state changes must not trigger a request
  let paused = false;       // a due request was held back because the app is behind
  let inflight = false;
  let lastStart = 0;
  let waiting = false;      // `waiting` was reported (the quick retries are used up)
  const report = (state: TabBarBannerState['state'], n: number, error?: unknown) => { sink?.report(state, n, error); };
  const isActive = (): boolean => { const st = rn.AppState?.currentState; return st !== 'background' && st !== 'inactive'; };
  const destroy = () => {
    alive = false;
    if (timer) clearTimeout(timer);
    if (hold) clearTimeout(hold);
    try { appSub?.remove?.(); } catch { /* noop */ }
    shown?.destroy();
    shown = null;
  };
  const gone = () => { destroy(); onGone?.(); };
  const later = (ms: number) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      if (!alive) return;
      if (!isActive()) { paused = true; return; }   // behind the app: stop asking until it comes back (1.9.12)
      void load();
    }, ms);
  };
  const load = async () => {
    inflight = true;
    lastStart = Date.now();
    try { await attempt(); } finally { inflight = false; }
  };
  // A one-line native slot cannot display mandatory video media: drop video and ask again
  // (2026-10-19 owner: 「배너 광고가 하나도 안 나와」 — one video creative used to leave the slot empty for the whole session).
  // (1.9.12) It never gives up while the app is in front: after the quick retries it asks every minute. The slot is reserved
  // since 1.9.8, so a late creative cannot move the tab row.
  const attempt = async () => {
    let next: any = null;
    let error: unknown;
    requests++;
    report('requesting', requests);
    try { next = await sdk.NativeAd.createForAdRequest(unitId, { startVideoMuted: true }); } catch (e) { next = null; error = e; }
    if (!alive) { next?.destroy(); return; }
    if (next && !next.mediaContent?.hasVideoContent) {
      const old = shown; shown = next;
      loadedRequests = requests; tries = 0; requests = 0;
      if (sink) { sink.onAd(next); report('loaded', loadedRequests); later(NATIVE_REFRESH_MS); }
      else hold = setTimeout(gone, NATIVE_HOLD_TTL_MS);   // nobody mounted yet: keep it ready, no swap
      old?.destroy();
      return;
    }
    next?.destroy();
    report(next ? 'video-dropped' : 'no-fill', requests, error);
    if (shown) { requests = 0; later(NATIVE_REFRESH_MS); return; }   // keep the current creative
    if (tries < NATIVE_RETRY_MS.length) { later(NATIVE_RETRY_MS[tries++]); return; }
    if (!sink) { gone(); return; }                                   // prefetch: quick retries used up and nobody waits — stop
    if (!waiting) { waiting = true; report('waiting', requests); }
    later(NATIVE_REFRESH_MS);
  };
  // (1.9.12) a request that comes due while the app is behind is held back (see `later`);
  // when the app is back in front, an empty slot asks right away and a full one resumes its normal swap
  const appSub = rn.AppState?.addEventListener?.('change', (st: string) => {
    if (!alive || !started || st !== 'active' || inflight) return;     // an answer on its way schedules the next request itself
    if (!shown) later(Math.max(0, lastStart + NATIVE_MIN_GAP_MS - Date.now()));   // empty slot: ask right away (spaced)
    else if (paused && sink) later(NATIVE_REFRESH_MS);                 // a creative is on screen: just resume the normal swap
    paused = false;
  });

  return {
    start() {
      void Promise.resolve().then(() => sdk.default().initialize()).then(() => {
        if (!alive) return;
        started = true;
        return load();
      }).catch((e) => {
        if (!alive) return;
        if (sink) { sink.onInitFailed(); sink.report('init-failed', requests, e); } else gone();   // prefetch: drop it, the slot will try itself
      });
    },
    attach(s) {
      if (!alive) return;
      sink = s;
      if (hold) { clearTimeout(hold); hold = null; }
      if (shown) { s.onAd(shown); s.report('loaded', loadedRequests); later(NATIVE_REFRESH_MS); }
      // otherwise the loop that is already running (or about to) carries on, now reporting to this slot
    },
    destroy,
  };
}

/** Prefetched feeds waiting for their slot, and the native slots that are mounted — both by unit id. */
const held = new Map<string, NativeFeed>();
const mounted = new Map<string, number>();

/**
 * (1.9.14) Ask for the first native creative **before** the slot is mounted, so it can show at once when it is.
 * Call it once at app start, after the app's own ads start-up (on iOS after the ATT answer — it initializes the ads SDK), with the
 * same `unitId` the `<TabBarBanner format="native">` will get. Only the first creative is fetched: it waits up to
 * `NATIVE_HOLD_TTL_MS` for the slot; if the quick retries are used up (video only / no fill) it stops and the slot asks for itself.
 * Does nothing on web / without the ads SDK, without a unit, when called twice for one unit, or when that slot is already mounted.
 * Video creatives are dropped exactly as in the slot. Never throws.
 */
export function prefetchTabBarBanner(unitId?: string): void {
  try {
    if (!unitId || held.has(unitId) || mounted.get(unitId)) return;
    let sdk: any;
    let rn: any;
    try { sdk = require('react-native-google-mobile-ads'); rn = require('react-native'); }
    catch { return; }
    if (rn.Platform.OS === 'web') return;
    const feed: NativeFeed = createNativeFeed(sdk, rn, unitId, () => { if (held.get(unitId) === feed) held.delete(unitId); });
    held.set(unitId, feed);
    feed.start();
  } catch { /* a prefetch is only a head start */ }
}

function LoadedBanner({ sdk, rn, unitId, format, backgroundColor, bannerHeight, lang, onState }: any) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ad, setAd] = useState<any>(null);
  // Always call the latest callback without restarting the loader (it is not an effect dependency).
  const callback = useRef(onState);
  callback.current = onState;
  const report = (state: TabBarBannerState['state'], tries: number, error?: unknown) => {
    const fn = callback.current;
    if (!fn) return;
    const text = describeError(error);
    try { fn(text ? { state, tries, error: text } : { state, tries }); } catch { /* diagnostics must never break the slot */ }
  };
  useEffect(() => {
    if (format === 'banner') {
      // The BannerAd manages itself: start the SDK, then mount it (no request loop of ours).
      let alive = true;
      void Promise.resolve().then(() => sdk.default().initialize()).then(() => {
        if (!alive) return;
        setReady(true); report('requesting', 1);
      }).catch((e) => { if (alive) { setFailed(true); report('init-failed', 0, e); } });

      return () => { alive = false; };
    }
    // native: take over the feed `prefetchTabBarBanner` started (its creative shows at once), or start our own
    const prefetched = held.get(unitId);
    if (prefetched) held.delete(unitId);
    const feed = prefetched ?? createNativeFeed(sdk, rn, unitId);
    mounted.set(unitId, (mounted.get(unitId) ?? 0) + 1);
    feed.attach({ onAd: setAd, onInitFailed: () => setFailed(true), report });
    if (!prefetched) feed.start();

    return () => {
      feed.destroy();
      const left = (mounted.get(unitId) ?? 1) - 1;
      if (left > 0) mounted.set(unitId, left); else mounted.delete(unitId);
    };
  }, [sdk, unitId, format]);
  const h = React.createElement;
  // One outer View for every state — its height is decided here, once, and nothing below can change it.
  const win = rn.Dimensions?.get?.('window');
  const slotHeight = format === 'native' ? NATIVE_SLOT_HEIGHT : (typeof bannerHeight === 'number' && bannerHeight > 0 ? bannerHeight : bannerSlotHeight(win?.width, win?.height));
  const slot = (child: any) => h(rn.View, { style: { height: slotHeight, width: '100%', overflow: 'hidden', backgroundColor, alignItems: 'center', justifyContent: 'center' } }, child);
  if (format === 'banner') {
    // The BannerAd renders nothing (0x0) until it loads; a failed request just leaves the empty slot.
    return slot(ready && !failed ? h(sdk.BannerAd, { unitId, size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
      onAdLoaded: () => report('loaded', 1), onAdFailedToLoad: (e: unknown) => { setFailed(true); report('no-fill', 1, e); } }) : null);
  }
  if (!ad || failed) return slot(null);
  // NativeAdView supplies AdChoices. Native attribution is required separately by AdMob.
  // Centered row (2026-10-19 owner 「가운데 정렬로」); side padding keeps clear of the AdChoices corner (top right by default).
  // (1.9.10) Only the registered assets — icon, headline, call to action — take taps: the badge, the row and the NativeAdView carry no
  // handlers and are not registered, so the background is not clickable (AdMob: "The background of the ad must be not clickable").
  // Video creatives never get here (dropped in load), so no MediaView is needed.
  return slot(h(sdk.NativeAdView, { nativeAd: ad, style: { height: NATIVE_SLOT_HEIGHT, width: '100%', backgroundColor } },
    h(rn.View, { collapsable: false, style: { height: NATIVE_SLOT_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 } },
      h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'),
      ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON },
        h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null,
      h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE },
        h(rn.Text, { numberOfLines: 1, style: { flexShrink: 1, fontSize: 13, color: '#555' } }, ad.headline)),
      h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.CALL_TO_ACTION },
        h(rn.Text, { numberOfLines: 1, style: CTA_STYLE }, nativeCtaLabel(ad.callToAction, lang))))));
}
