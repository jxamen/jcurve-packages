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

function LoadedBanner({ sdk, rn, unitId, format }: any) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [ad, setAd] = useState<any>(null);
  useEffect(() => {
    let alive = true;
    let loaded: any;
    void Promise.resolve().then(() => sdk.default().initialize()).then(async () => {
      if (!alive) return;
      if (format === 'banner') { setReady(true); return; }
      loaded = await sdk.NativeAd.createForAdRequest(unitId, { startVideoMuted: true });
      // A one-line native slot cannot display mandatory video media. Do not retry/preload.
      if (!alive || loaded.mediaContent?.hasVideoContent) { loaded.destroy(); loaded = null; return; }
      setAd(loaded);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; loaded?.destroy(); };
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
  return h(sdk.NativeAdView, { nativeAd: ad, style: { height: 40, width: '100%', backgroundColor: '#fff' } },
    h(rn.View, { collapsable: false, style: { height: 40, flexDirection: 'row', alignItems: 'center', paddingLeft: 12, paddingRight: 28, gap: 8 } },
      h(rn.Text, { style: { fontSize: 11, color: '#666', backgroundColor: '#eee', paddingHorizontal: 4 } }, 'AD'),
      ad.icon ? h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.ICON },
        h(rn.Image, { source: { uri: ad.icon.url }, style: { width: 28, height: 28 } })) : null,
      h(sdk.NativeAsset, { assetType: sdk.NativeAssetType.HEADLINE },
        h(rn.Text, { numberOfLines: 1, style: { flex: 1, fontSize: 13, color: '#555' } }, ad.headline))));
}
