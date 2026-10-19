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
  const rn = { Platform: { OS: 'ios' }, View: 'View', Text: 'Text', Image: 'Image' };
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

describe('TabBarBanner lifecycle (packed CommonJS)', () => {
  it('disabled or absent unit never loads or reserves a slot', () => {
    const h = harness(Promise.resolve(null));
    expect(h.mount({ enabled: false, unitId: 'existing' })).toBeNull();
    expect(h.mount({ enabled: true, unitId: '' })).toBeNull();
    expect(h.sdk.NativeAd.createForAdRequest).not.toHaveBeenCalled();
  });
  it('native stays collapsed until loaded and destroys on unmount', async () => {
    const ad = { headline: 'existing ad', destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'existing-native', format: 'native' });
    expect(h.render()).toBeNull();
    const cleanup = h.start(); await flush();
    expect(h.render().props.style.height).toBe(40);
    expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(1);
    cleanup?.(); expect(ad.destroy).toHaveBeenCalledOnce();
  });
  it('no-fill leaves no view', async () => {
    const h = harness(Promise.resolve().then(() => { throw Error('no fill'); }));
    h.mount({ enabled: true, unitId: 'existing', format: 'native' });
    h.render(); h.start(); await flush(); expect(h.render()).toBeNull();
  });
  it('video response is destroyed without another request or blank slot', async () => {
    const ad = { mediaContent: { hasVideoContent: true }, destroy: vi.fn() };
    const h = harness(Promise.resolve(ad));
    h.mount({ enabled: true, unitId: 'existing', format: 'native' });
    h.render(); h.start(); await flush();
    expect(h.render()).toBeNull(); expect(ad.destroy).toHaveBeenCalledOnce();
    expect(h.sdk.NativeAd.createForAdRequest).toHaveBeenCalledTimes(1);
  });
  it('destroys a late native response after the footer was removed', async () => {
    let resolve: (ad: any) => void = () => {};
    const h = harness(new Promise(r => { resolve = r; }));
    h.mount({ enabled: true, unitId: 'existing', format: 'native' });
    h.render(); const cleanup = h.start(); await flush(); cleanup?.();
    const ad = { destroy: vi.fn() }; resolve(ad); await flush();
    expect(ad.destroy).toHaveBeenCalledOnce(); expect(h.render()).toBeNull();
  });
  it('adaptive banner collapses after SDK failure', async () => {
    const h = harness(Promise.resolve(null));
    h.mount({ enabled: true, unitId: 'existing-banner' });
    h.render(); h.start(); await flush();
    let view = h.render(); expect(view.props.style.height).toBe(0);
    view.props.children[0].props.onAdLoaded();
    view = h.render(); expect(view.props.style.height).toBeUndefined();
    view.props.children[0].props.onAdFailedToLoad(); expect(h.render()).toBeNull();
  });
});
