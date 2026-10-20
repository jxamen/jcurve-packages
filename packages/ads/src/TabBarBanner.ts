import React, { useEffect, useState } from 'react';

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
export function TabBarBanner({ unitId, enabled, format = 'banner', backgroundColor = '#fff', bannerHeight }: TabBarBannerProps) {
  if (!enabled || !unitId) return null;
  // Optional native peers: importing this package must remain safe on web/Expo Go.
  let sdk: any;
  let rn: any;
  try { sdk = require('react-native-google-mobile-ads'); rn = require('react-native'); }
  catch { return null; }
  if (rn.Platform.OS === 'web') return null;
  return React.createElement(LoadedBanner, { key: `${format}:${unitId}`, sdk, rn, unitId, format, backgroundColor, bannerHeight });
}

/** Retry delays after no fill / video creative (ms). After the last one the slot stays reserved but empty. */
export const NATIVE_RETRY_MS = [3000, 10000, 30000, 60000];
/** Swap the creative while it stays on screen. */
export const NATIVE_REFRESH_MS = 60000;

function LoadedBanner({ sdk, rn, unitId, format, backgroundColor, bannerHeight }: any) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ad, setAd] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    let shown: any = null;
    let timer: any = null;
    let tries = 0;
    const later = (ms: number) => { timer = setTimeout(() => { void load(); }, ms); };
    // A one-line native slot cannot display mandatory video media: drop video and ask again
    // (2026-10-19 owner: 「배너 광고가 하나도 안 나와」 — one video creative used to leave the slot empty for the whole session).
    const load = async () => {
      let next: any = null;
      try { next = await sdk.NativeAd.createForAdRequest(unitId, { startVideoMuted: true }); } catch { next = null; }
      if (!alive) { next?.destroy(); return; }
      if (next && !next.mediaContent?.hasVideoContent) {
        const old = shown; shown = next; setAd(next); old?.destroy();
        tries = 0; later(NATIVE_REFRESH_MS); return;
      }
      next?.destroy();
      if (shown) { later(NATIVE_REFRESH_MS); return; }   // keep the current creative
      if (tries < NATIVE_RETRY_MS.length) later(NATIVE_RETRY_MS[tries++]);
    };
    void Promise.resolve().then(() => sdk.default().initialize()).then(() => {
      if (!alive) return;
      if (format === 'banner') { setReady(true); return; }
      return load();
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; if (timer) clearTimeout(timer); shown?.destroy(); };
  }, [sdk, unitId, format]);
  const h = React.createElement;
  // One outer View for every state — its height is decided here, once, and nothing below can change it.
  const win = rn.Dimensions?.get?.('window');
  const slotHeight = format === 'native' ? NATIVE_SLOT_HEIGHT : (typeof bannerHeight === 'number' && bannerHeight > 0 ? bannerHeight : bannerSlotHeight(win?.width, win?.height));
  const slot = (child: any) => h(rn.View, { style: { height: slotHeight, width: '100%', overflow: 'hidden', backgroundColor, alignItems: 'center', justifyContent: 'center' } }, child);
  if (format === 'banner') {
    // The BannerAd renders nothing (0x0) until it loads; a failed request just leaves the empty slot.
    return slot(ready && !failed ? h(sdk.BannerAd, { unitId, size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER, onAdFailedToLoad: () => setFailed(true) }) : null);
  }
  if (!ad || failed) return slot(null);
  // NativeAdView supplies AdChoices. Native attribution is required separately by AdMob.
  // Centered row (2026-10-19 owner 「가운데 정렬로」); side padding keeps clear of the AdChoices corner.
  return slot(h(sdk.NativeAdView, { nativeAd: ad, style: { height: NATIVE_SLOT_HEIGHT, width: '100%', backgroundColor } },
    h(rn.View, { collapsable: false, style: { height: NATIVE_SLOT_HEIGHT, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 } },
      h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'),
      ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON },
        h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null,
      h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE },
        h(rn.Text, { numberOfLines: 1, style: { flexShrink: 1, fontSize: 13, color: '#555' } }, ad.headline)))));
}
