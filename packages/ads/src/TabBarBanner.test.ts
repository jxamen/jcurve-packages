import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const Module = require('node:module');
const originalLoad = Module._load;
afterEach(() => { Module._load = originalLoad; vi.restoreAllMocks(); });

function harness(result: Promise<any>) {
  const states: any[] = [];
  let cursor = 0;
  let effect: (() => void | (() => void)) | undefined;
  const react = {
    createElement: (type: any, props: any, ...children: any[]) => ({ type, props: { ...props, children } }),
    useState: (value: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = value;
      return [states[slot], (next: any) => { states[slot] = next; }];
    },
    useEffect: (fn: any) => { effect ??= fn; },
    useRef: (value: any) => {
      const slot = cursor++;
      if (!(slot in states)) states[slot] = { current: value };
      return states[slot];
    },
  };
  const sdk = { default: () => ({ initialize: async () => {} }),
    NativeAd: { createForAdRequest: vi.fn(() => result) },
    NativeAdView: 'NativeAdView', NativeAsset: 'NativeAsset', NativeAssetType: { ICON: 'icon', HEADLINE: 'headline', CALL_TO_ACTION: 'callToAction' },
    BannerAd: 'BannerAd', BannerAdSize: { ANCHORED_ADAPTIVE_BANNER: 'adaptive' } };
  const rn = { Platform: { OS: 'ios' }, View: 'View', Text: 'Text', Image: 'Image', Dimensions: { get: () => ({ width: 390, height: 844 }) } };
  Module._load = function(id: string, ...args: any[]) {
    if (id === 'react') return react;
    if (id === 'react-native') return rn;
    if (id === 'react-native-google-mobile-ads') return sdk;
    return originalLoad.call(this, id, ...args);
  };
  const path = require.resolve('../dist/TabBarBanner.js');
  delete require.cache[path];
  const { TabBarBanner } = require(path);
  let child: any;
  return {
    sdk,
    mount(props: any) { child = TabBarBanner(props); return child; },
    render() { cursor = 0; return child.type(child.props); },
    start() { return effect?.(); },
  };
}
const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

/** The outer View's height at this moment (what pushes the tab row). */
const outer = (h: any) => h.render().props.style.height;
const inner = (h: any) => h.render().props.children[0];
const bannerSlotHeight = (...a: any[]) => require(require.resolve('../dist/TabBarBanner.js')).bannerSlotHeight(...a);

describe('TabBarBanner lifecycle (packed CommonJS)', () => {
  it('disabled or absent unit never loads or reserves a slot', () => {
    const h = harness(Promise.resolve(null));
    expect(h.mount({ enabled: false, unitId: 'existing' })).toBeNull();
    expect(h.mount({ enabled: true, unitId: '' })).toBeNull();
    expect(h.sdk.NativeAd.createForAdRequest).not.toHaveBeenCalled();
  });
  it('native reserves its 40dp slot from the first render, and keeps it after load and unmount-destroy', async () => {
    const ad = { headline: 'existing ad', destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'existing-native', format: 'native' });
    expect(outer(h)).toBe(40);
    expect(inner(h)).toBeNull();
    const cleanup = h.start(); await flush();
    expect(outer(h)).toBe(40);
    expect(inner(h).props.style.height).toBe(40);
    expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(1);
    cleanup?.(); expect(ad.destroy).toHaveBeenCalledOnce();
  });
  it('no-fill keeps the slot, empty', async () => {
    const h = harness(Promise.resolve().then(() => { throw Error('no fill'); }));
    h.mount({ enabled: true, unitId: 'existing', format: 'native' });
    h.render(); h.start(); await flush();
    expect(outer(h)).toBe(40); expect(inner(h)).toBeNull();
  });
  it('video response is destroyed, the slot stays the same height, and it asks again after a delay', async () => {
    vi.useFakeTimers();
    try {
      const ad = { mediaContent: { hasVideoContent: true }, destroy: vi.fn() };
      const h = harness(Promise.resolve(ad));
      h.mount({ enabled: true, unitId: 'existing', format: 'native' });
      h.render(); const cleanup = h.start(); await flush();
      expect(outer(h)).toBe(40); expect(inner(h)).toBeNull(); expect(ad.destroy).toHaveBeenCalledOnce();
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(3000); await flush();
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(2);
      expect(outer(h)).toBe(40);
      cleanup?.();
      await vi.advanceTimersByTimeAsync(120000); await flush();
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(2);
    } finally { vi.useRealTimers(); }
  });
  it('retries exhausted: the slot is still there, same height, empty (it never collapses)', async () => {
    vi.useFakeTimers();
    try {
      const h = harness(Promise.resolve().then(() => { throw Error('no fill'); }));
      h.mount({ enabled: true, unitId: 'existing', format: 'native' });
      h.render(); const cleanup = h.start(); await flush();
      const seen = [outer(h)];
      for (const ms of [3000, 10000, 30000, 60000]) { await vi.advanceTimersByTimeAsync(ms); await flush(); seen.push(outer(h)); }
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(5);   // first try + 4 retries
      await vi.advanceTimersByTimeAsync(600000); await flush();
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(5);   // gave up
      seen.push(outer(h));
      expect(new Set(seen)).toEqual(new Set([40])); expect(inner(h)).toBeNull();
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('replacing a creative keeps the outer height and destroys the old one', async () => {
    vi.useFakeTimers();
    try {
      const first = { headline: 'first', destroy: vi.fn() };
      const second = { headline: 'second', destroy: vi.fn() };
      const h = harness(Promise.resolve(first));
      h.mount({ enabled: true, unitId: 'existing', format: 'native' });
      h.render(); const cleanup = h.start(); await flush();
      expect(outer(h)).toBe(40); expect(inner(h).props.nativeAd).toBe(first);
      h.sdk.NativeAd.createForAdRequest.mockImplementation(() => Promise.resolve(second));
      await vi.advanceTimersByTimeAsync(60000); await flush();
      expect(outer(h)).toBe(40); expect(inner(h).props.nativeAd).toBe(second);
      expect(first.destroy).toHaveBeenCalledOnce();
      // a refresh that fails keeps the current creative and the height
      h.sdk.NativeAd.createForAdRequest.mockImplementation(() => Promise.reject(Error('no fill')));
      await vi.advanceTimersByTimeAsync(60000); await flush();
      expect(outer(h)).toBe(40); expect(inner(h).props.nativeAd).toBe(second);
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('centers the native row', async () => {
    const ad = { headline: 'x', destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'existing-native', format: 'native' });
    h.render(); const cleanup = h.start(); await flush();
    expect(inner(h).props.children[0].props.style.justifyContent).toBe('center');
    cleanup?.();
  });
  it('destroys a late native response after the footer was removed', async () => {
    let resolve: (ad: any) => void = () => {};
    const h = harness(new Promise(r => { resolve = r; }));
    h.mount({ enabled: true, unitId: 'existing', format: 'native' });
    h.render(); const cleanup = h.start(); await flush(); cleanup?.();
    const ad = { destroy: vi.fn() }; resolve(ad); await flush();
    expect(ad.destroy).toHaveBeenCalledOnce(); expect(inner(h)).toBeNull();
  });
  it('adaptive banner: the slot is reserved before the SDK is ready, and failure leaves it empty at the same height', async () => {
    const h = harness(Promise.resolve(null));
    h.mount({ enabled: true, unitId: 'existing-banner' });
    const reserved = outer(h);
    expect(reserved).toBe(61);                       // 390dp wide window -> ceil(390*50/320)
    expect(inner(h)).toBeNull();                     // SDK still initializing: slot, no BannerAd
    h.start(); await flush();
    expect(outer(h)).toBe(reserved);
    const banner = inner(h);
    expect(banner.type).toBe('BannerAd');
    expect(banner.props.size).toBe('adaptive');
    banner.props.onAdFailedToLoad();
    expect(outer(h)).toBe(reserved); expect(inner(h)).toBeNull();
  });
  it('adaptive banner: whatever the SDK draws, the outer View is fixed, clipped and centered', async () => {
    const h = harness(Promise.resolve(null));
    h.mount({ enabled: true, unitId: 'existing-banner' });
    h.start(); await flush();
    const style = h.render().props.style;
    expect(style).toMatchObject({ height: 61, width: '100%', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' });
  });
  it('bannerHeight overrides the estimate for banners, never for native; backgroundColor defaults to white', () => {
    const banner = harness(Promise.resolve(null));
    banner.mount({ enabled: true, unitId: 'b', bannerHeight: 72, backgroundColor: '#112233' });
    expect(outer(banner)).toBe(72);
    expect(banner.render().props.style.backgroundColor).toBe('#112233');
    const plain = harness(Promise.resolve(null));
    plain.mount({ enabled: true, unitId: 'b' });
    expect(plain.render().props.style.backgroundColor).toBe('#fff');
    const native = harness(Promise.resolve(null));
    native.mount({ enabled: true, unitId: 'n', format: 'native', bannerHeight: 72 });
    expect(outer(native)).toBe(40);
  });
});

describe('bannerSlotHeight (1.9.8)', () => {
  it('is the 320x50 ratio scaled to the width, rounded up', () => {
    harness(Promise.resolve(null));   // loads dist/TabBarBanner.js with the module mocks in place
    expect(bannerSlotHeight(320, 800)).toBe(50);
    expect(bannerSlotHeight(360, 800)).toBe(57);
    expect(bannerSlotHeight(390, 844)).toBe(61);
    expect(bannerSlotHeight(412, 915)).toBe(65);
  });
  it('is clamped to [50, min(90, 15% of the window height)]', () => {
    harness(Promise.resolve(null));
    expect(bannerSlotHeight(768, 1024)).toBe(90);        // tablet: capped at 90
    expect(bannerSlotHeight(844, 390)).toBe(58);         // phone landscape: 15% of 390
    expect(bannerSlotHeight(300, 800)).toBe(50);         // never below 50
    expect(bannerSlotHeight(844, 200)).toBe(50);         // tiny window: the 50 floor wins over 15%
  });
  it('falls back to a safe value for a missing or broken window size', () => {
    harness(Promise.resolve(null));
    expect(bannerSlotHeight(NaN, NaN)).toBe(50);
    expect(bannerSlotHeight(0)).toBe(50);
    expect(bannerSlotHeight(390)).toBe(61);              // height unknown -> only the 90 cap
    expect(bannerSlotHeight(2000)).toBe(90);
  });
});

describe('TabBarBanner onState diagnostics (1.9.9)', () => {
  const collect = () => { const seen: any[] = []; return { seen, onState: (s: any) => { seen.push(s); } }; };

  it('native success: requesting -> loaded (tries 1), then nothing more', async () => {
    const ad = { headline: 'x', destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    const { seen, onState } = collect();
    h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
    h.render(); const cleanup = h.start(); await flush();
    expect(seen).toEqual([{ state: 'requesting', tries: 1 }, { state: 'loaded', tries: 1 }]);
    cleanup?.();
  });
  it('video creative: video-dropped, then asks again as requesting with tries 2', async () => {
    vi.useFakeTimers();
    try {
      const video = { mediaContent: { hasVideoContent: true }, destroy: vi.fn() };
      const h = harness(Promise.resolve(video));
      const { seen, onState } = collect();
      h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
      h.render(); const cleanup = h.start(); await flush();
      expect(seen).toEqual([{ state: 'requesting', tries: 1 }, { state: 'video-dropped', tries: 1 }]);
      await vi.advanceTimersByTimeAsync(3000); await flush();
      expect(seen.slice(2)).toEqual([{ state: 'requesting', tries: 2 }, { state: 'video-dropped', tries: 2 }]);
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('no-fill carries the SDK error text (code: message, or just the message)', async () => {
    const withCode = harness(Promise.reject({ code: 'googleMobileAds/error-code-no-fill', message: 'No ad to show.' }));
    const a = collect();
    withCode.mount({ enabled: true, unitId: 'u', format: 'native', onState: a.onState });
    withCode.render(); withCode.start(); await flush();
    expect(a.seen[1]).toEqual({ state: 'no-fill', tries: 1, error: 'googleMobileAds/error-code-no-fill: No ad to show.' });
    const plain = harness(Promise.reject(new Error('boom')));
    const b = collect();
    plain.mount({ enabled: true, unitId: 'u', format: 'native', onState: b.onState });
    plain.render(); plain.start(); await flush();
    expect(b.seen[1]).toEqual({ state: 'no-fill', tries: 1, error: 'boom' });
    const empty = harness(Promise.resolve(null));       // resolved with no ad and no error
    const c = collect();
    empty.mount({ enabled: true, unitId: 'u', format: 'native', onState: c.onState });
    empty.render(); empty.start(); await flush();
    expect(c.seen[1]).toEqual({ state: 'no-fill', tries: 1 });
  });
  it('retries exhausted: five requests, then retries-exhausted once, after the last no-fill', async () => {
    vi.useFakeTimers();
    try {
      const h = harness(Promise.reject(new Error('no fill')));
      const { seen, onState } = collect();
      h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
      h.render(); const cleanup = h.start(); await flush();
      for (const ms of [3000, 10000, 30000, 60000]) { await vi.advanceTimersByTimeAsync(ms); await flush(); }
      await vi.advanceTimersByTimeAsync(600000); await flush();
      expect(seen.filter(s => s.state === 'requesting').map(s => s.tries)).toEqual([1, 2, 3, 4, 5]);
      expect(seen.filter(s => s.state === 'retries-exhausted')).toEqual([{ state: 'retries-exhausted', tries: 5 }]);
      expect(seen[seen.length - 1]).toEqual({ state: 'retries-exhausted', tries: 5 });
      expect(seen[seen.length - 2]).toMatchObject({ state: 'no-fill', tries: 5 });
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('init-failed when the SDK does not initialize', async () => {
    const h = harness(Promise.resolve(null));
    h.sdk.default = () => ({ initialize: async () => { throw new Error('init boom'); } });
    const { seen, onState } = collect();
    h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
    h.render(); h.start(); await flush();
    expect(seen).toEqual([{ state: 'init-failed', tries: 0, error: 'init boom' }]);
    expect(h.sdk.NativeAd.createForAdRequest).not.toHaveBeenCalled();
    expect(outer(h)).toBe(40);                         // the slot is still reserved
  });
  it('a refresh that fails while a creative is shown reports the failure, not retries-exhausted, and keeps the creative', async () => {
    vi.useFakeTimers();
    try {
      const first = { headline: 'first', destroy: vi.fn() };
      const h = harness(Promise.resolve(first));
      const { seen, onState } = collect();
      h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
      h.render(); const cleanup = h.start(); await flush();
      h.sdk.NativeAd.createForAdRequest.mockImplementation(() => Promise.reject(new Error('later no fill')));
      await vi.advanceTimersByTimeAsync(60000); await flush();
      expect(seen.slice(2)).toEqual([{ state: 'requesting', tries: 1 }, { state: 'no-fill', tries: 1, error: 'later no fill' }]);
      expect(inner(h).props.nativeAd).toBe(first);
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('banner: requesting when mounted, loaded / no-fill from the SDK callbacks (with the error)', async () => {
    const h = harness(Promise.resolve(null));
    const { seen, onState } = collect();
    h.mount({ enabled: true, unitId: 'b', onState });
    h.render(); h.start(); await flush();
    expect(seen).toEqual([{ state: 'requesting', tries: 1 }]);
    const banner = inner(h);
    banner.props.onAdLoaded();
    banner.props.onAdFailedToLoad({ code: 'googleMobileAds/error-code-network-error', message: 'offline' });
    expect(seen.slice(1)).toEqual([{ state: 'loaded', tries: 1 }, { state: 'no-fill', tries: 1, error: 'googleMobileAds/error-code-network-error: offline' }]);
  });
  it('without a callback nothing changes: same heights, same ad, no errors', async () => {
    vi.useFakeTimers();
    try {
      const ad = { headline: 'x', destroy: vi.fn() };
      const h = harness(Promise.resolve(ad));
      h.mount({ enabled: true, unitId: 'u', format: 'native' });
      h.render(); const cleanup = h.start(); await flush();
      expect(outer(h)).toBe(40); expect(inner(h).props.nativeAd).toBe(ad);
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('a throwing callback is ignored — the ad still shows', async () => {
    const ad = { headline: 'x', destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'u', format: 'native', onState: () => { throw new Error('callback bug'); } });
    h.render(); const cleanup = h.start(); await flush();
    expect(inner(h).props.nativeAd).toBe(ad);
    cleanup?.();
  });
  it('the latest callback is used without restarting the loader', async () => {
    vi.useFakeTimers();
    try {
      const ad = { headline: 'x', destroy: vi.fn() };
      const h = harness(Promise.resolve(ad));
      const first = collect();
      const second = collect();
      h.mount({ enabled: true, unitId: 'u', format: 'native', onState: first.onState });
      h.render(); const cleanup = h.start(); await flush();
      h.mount({ enabled: true, unitId: 'u', format: 'native', onState: second.onState });
      h.render();                                      // a re-render with a new callback identity
      await vi.advanceTimersByTimeAsync(60000); await flush();
      expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(2);   // not restarted, just the normal refresh
      expect(first.seen.map(s => s.state)).toEqual(['requesting', 'loaded']);
      expect(second.seen.map(s => s.state)).toEqual(['requesting', 'loaded']);
      cleanup?.();
    } finally { vi.useRealTimers(); }
  });
  it('reports nothing after unmount (a late response is only destroyed)', async () => {
    let resolve: (ad: any) => void = () => {};
    const h = harness(new Promise(r => { resolve = r; }));
    const { seen, onState } = collect();
    h.mount({ enabled: true, unitId: 'u', format: 'native', onState });
    h.render(); const cleanup = h.start(); await flush(); cleanup?.();
    const ad = { destroy: vi.fn() }; resolve(ad); await flush();
    expect(seen).toEqual([{ state: 'requesting', tries: 1 }]);
    expect(ad.destroy).toHaveBeenCalledOnce();
  });
});

/** Every element under a rendered node (depth first), strings and nulls skipped. */
const walk = (node: any): any[] => {
  if (!node || typeof node !== 'object') return [];
  const kids = [].concat(node.props?.children ?? []) as any[];
  return [node, ...kids.flatMap(walk)];
};
const textOf = (node: any): string => [].concat(node?.props?.children ?? []).filter((c: any) => typeof c === 'string').join('');
const assets = (h: any) => walk(inner(h)).filter(n => n.type === 'NativeAsset');
/** The single element wrapped by a NativeAsset (the mock createElement keeps children as an array). */
const assetChild = (n: any): any => ([] as any[]).concat(n.props.children)[0];
const ctaOf = (h: any) => assetChild(assets(h).find(n => n.props.assetType === 'callToAction'));
const assetTypes = (h: any) => assets(h).map(n => n.props.assetType);

describe('native row call-to-action (1.9.10, AdMob policy: Call to action is a required element)', () => {
  const shown = async (ad: any, props: Record<string, unknown> = {}) => {
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'u', format: 'native', ...props });
    h.render(); const cleanup = h.start(); await flush();
    return { h, cleanup };
  };

  it('registers icon, headline and call to action as the clickable assets, CTA text = the ad callToAction', async () => {
    const { h, cleanup } = await shown({ headline: 'Great game', callToAction: 'Play now', icon: { url: 'https://x/i.png' }, destroy: vi.fn() });
    expect(assetTypes(h)).toEqual(['icon', 'headline', 'callToAction']);
    expect(ctaOf(h).type).toBe('Text');
    expect(textOf(ctaOf(h))).toBe('Play now');
    cleanup?.();
  });
  it('without an icon the assets are headline + call to action', async () => {
    const { h, cleanup } = await shown({ headline: 'No icon ad', callToAction: 'Open', destroy: vi.fn() });
    expect(assetTypes(h)).toEqual(['headline', 'callToAction']);
    cleanup?.();
  });
  it('no callToAction text -> "설치" (blank and non-string too); the app language "en" -> "Install"', async () => {
    for (const callToAction of [undefined, null, '', '   ', 7]) {
      const { h, cleanup } = await shown({ headline: 'x', callToAction, destroy: vi.fn() });
      expect(textOf(ctaOf(h))).toBe('설치');
      cleanup?.();
    }
    const en = await shown({ headline: 'x', destroy: vi.fn() }, { lang: 'en-US' });
    expect(textOf(ctaOf(en.h))).toBe('Install');
    en.cleanup?.();
    const trimmed = await shown({ headline: 'x', callToAction: '  Install  ', destroy: vi.fn() });
    expect(textOf(ctaOf(trimmed.h))).toBe('Install');
    trimmed.cleanup?.();
  });
  it('the background is not clickable: only the three assets can be tapped — no touchables, no handlers on the wrapper, row or badge', async () => {
    const { h, cleanup } = await shown({ headline: 'x', callToAction: 'Go', icon: { url: 'u' }, destroy: vi.fn() });
    const all = walk(inner(h));
    expect(all.some(n => /Pressable|Touchable|Button/.test(String(n.type)))).toBe(false);
    for (const n of all) expect(Object.keys(n.props ?? {}).filter(k => /^on[A-Z]|accessible$/.test(k))).toEqual([]);   // no onPress / onTouch* / onStartShouldSetResponder ...
    const row = inner(h).props.children[0];
    expect(Object.keys(inner(h).props).sort()).toEqual(['children', 'nativeAd', 'style']);
    expect(Object.keys(row.props).sort()).toEqual(['children', 'collapsable', 'style']);
    const badge = row.props.children[0];
    expect(badge.type).toBe('Text'); expect(textOf(badge)).toBe('AD');
    expect(assets(h).filter(n => assetChild(n) === badge)).toEqual([]);   // the AD badge is not an asset
    cleanup?.();
  });
  it('heights stay 40 (outer slot, NativeAdView, row) before and after the ad, with or without a CTA text', async () => {
    const h = harness(Promise.resolve({ headline: 'x', callToAction: 'Play', destroy: vi.fn() }));
    h.mount({ enabled: true, unitId: 'u', format: 'native' });
    expect(outer(h)).toBe(40);
    h.render(); const cleanup = h.start(); await flush();
    expect(outer(h)).toBe(40);
    expect(inner(h).props.style.height).toBe(40);
    expect(inner(h).props.children[0].props.style.height).toBe(40);
    cleanup?.();
    const bare = await shown({ headline: 'x', destroy: vi.fn() });
    expect(outer(bare.h)).toBe(40); expect(inner(bare.h).props.style.height).toBe(40);
    bare.cleanup?.();
  });
  it('layout keeps the button whole and clear of AdChoices: headline shrinks, CTA does not, side padding stays 28, one line', async () => {
    const { h, cleanup } = await shown({ headline: 'A very very long headline that must not push the button out of the row', callToAction: 'Download the app now please', destroy: vi.fn() });
    const row = inner(h).props.children[0];
    expect(row.props.style).toMatchObject({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 });
    const headline = assetChild(assets(h).find(n => n.props.assetType === 'headline'));
    const cta = ctaOf(h);
    expect(headline.props.style.flexShrink).toBe(1);
    expect(cta.props.style).toMatchObject({ flexShrink: 0, maxWidth: 96, backgroundColor: '#555', color: '#fff' });
    expect(cta.props.numberOfLines).toBe(1);
    expect(row.props.children[row.props.children.length - 1].props.assetType).toBe('callToAction');   // CTA is the last (right-end) item
    cleanup?.();
  });
  it('banner format is untouched: the SDK draws it, no native assets', async () => {
    const h = harness(Promise.resolve(null));
    h.mount({ enabled: true, unitId: 'b' });
    h.render(); h.start(); await flush();
    expect(inner(h).type).toBe('BannerAd');
    expect(walk(h.render()).some(n => n.type === 'NativeAsset')).toBe(false);
  });
  it('nativeCtaLabel is exported for apps that want the same word', () => {
    harness(Promise.resolve(null));
    const { nativeCtaLabel } = require(require.resolve('../dist/TabBarBanner.js'));
    expect(nativeCtaLabel('Get', 'ko')).toBe('Get');
    expect(nativeCtaLabel('', 'ko')).toBe('설치');
    expect(nativeCtaLabel('', 'en')).toBe('Install');
    expect(nativeCtaLabel('', 'fr')).toBe('설치');       // no table for fr: the Korean original, like every other package word
  });
});
