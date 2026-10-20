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
  };
  const sdk = { default: () => ({ initialize: async () => {} }),
    NativeAd: { createForAdRequest: vi.fn(() => result) },
    NativeAdView: 'NativeAdView', NativeAsset: 'NativeAsset', NativeAssetType: { ICON: 'icon', HEADLINE: 'headline' },
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
