import React, { useEffect, useState } from 'react';

export type TabBarBannerProps = {
  unitId?: string;
  enabled: boolean;
  /** Match the existing unit's AdMob format. Never send a native unit to BannerAd. */
  format?: 'banner' | 'native';
};

/** Mount below the tabs, above the caller's safe-area inset. No fill means no space. */
export function TabBarBanner({ unitId, enabled, format = 'banner' }: TabBarBannerProps) {
  if (!enabled || !unitId) return null;
  // Optional native peers: importing this package must remain safe on web/Expo Go.
  let sdk: any;
  let rn: any;
  try { sdk = require('react-native-google-mobile-ads'); rn = require('react-native'); }
  catch { return null; }
  if (rn.Platform.OS === 'web') return null;
  return React.createElement(LoadedBanner, { key: `${format}:${unitId}`, sdk, rn, unitId, format });
}

/** Retry delays after no fill / video creative (ms). After the last one the slot stays collapsed. */
export const NATIVE_RETRY_MS = [3000, 10000, 30000, 60000];
/** Swap the creative while it stays on screen. */
export const NATIVE_REFRESH_MS = 60000;

function LoadedBanner({ sdk, rn, unitId, format }: any) {
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
  if (failed) return null;
  const h = React.createElement;
  if (format === 'banner') {
    if (!ready) return null;
    return h(rn.View, { style: { height: ad ? undefined : 0, overflow: 'hidden', width: '100%', alignItems: 'center' } },
      h(sdk.BannerAd, { unitId, size: sdk.BannerAdSize.ANCHORED_ADAPTIVE_BANNER,
        onAdLoaded: () => setAd(true), onAdFailedToLoad: () => setFailed(true) }));
  }
  if (!ad) return null;
  // NativeAdView supplies AdChoices. Native attribution is required separately by AdMob.
  // Centered row (2026-10-19 owner 「가운데 정렬로」); side padding keeps clear of the AdChoices corner.
  return h(sdk.NativeAdView, { nativeAd: ad, style: { height: 40, width: '100%', backgroundColor: '#fff' } },
    h(rn.View, { collapsable: false, style: { height: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 8 } },
      h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'),
      ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON },
        h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null,
      h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE },
        h(rn.Text, { numberOfLines: 1, style: { flexShrink: 1, fontSize: 13, color: '#555' } }, ad.headline))));
}
