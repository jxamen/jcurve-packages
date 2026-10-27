/**
 * Opening one campaign directly. Needs the native bridge of 0.3.0 builds (`JCurveOfferwallModule`); older binaries do not
 * have it, so everything here degrades to "not available" and the caller falls back to the plain list.
 */
export type CampaignInfo = { campaignKey: string; name: string; reward?: string };
export type CampaignApi = {
  /** Current campaigns the SDK can open, with their keys. */
  list(): Promise<CampaignInfo[]>;
  /** Opens that campaign's detail page. Resolves true when the SDK took the request. */
  open(campaignKey: string): Promise<boolean>;
};

const clean = (v: unknown, max: number): string => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');

/** Native → JS list, keeping only well-formed rows (a key and a name). */
export function cleanCampaigns(raw: unknown): CampaignInfo[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: CampaignInfo[] = [];
  for (const row of raw.slice(0, 500)) {
    const campaignKey = clean(row?.campaignKey, 64);
    const name = clean(row?.name, 120);
    if (!campaignKey || !name || seen.has(campaignKey)) continue;
    seen.add(campaignKey);
    const reward = clean(row?.reward, 30);
    out.push(reward ? { campaignKey, name, reward } : { campaignKey, name });
  }
  return out;
}

/** '[공식] Foo Bar!' → 'foobar'. Keeps Hangul, letters and digits only. */
export function normalizeCampaignName(name: string): string {
  return String(name).toLowerCase().replace(/[^0-9a-zㄱ-ㆎ가-힣]+/g, '');
}
const withoutBrackets = (name: string): string => String(name).replace(/[\[(（【<][^\])）】>]*[\])）】>]/g, '');

/**
 * Finds a campaign's key by its displayed name: exactly the same, then the same without spaces and punctuation, then the
 * same also without bracketed parts. Each step must match exactly one campaign; two different campaigns on a step mean
 * "unsure" and give null (opening the wrong campaign is worse than showing the plain list).
 */
export function findCampaignKey(list: readonly CampaignInfo[], name: string): string | null {
  const steps: Array<(s: string) => string> = [s => s.trim(), normalizeCampaignName, s => normalizeCampaignName(withoutBrackets(s))];
  for (const step of steps) {
    const want = step(name);
    if (!want) continue;
    const keys = new Set(list.filter(c => step(c.name) === want).map(c => c.campaignKey));
    if (keys.size === 1) return [...keys][0];
    if (keys.size > 1) return null;
  }
  return null;
}

type NativeCampaigns = {
  loadCustomCampaigns?: (max: number) => Promise<unknown>;
  openCampaignDetail?: (campaignKey: string) => Promise<unknown>;
};
/**
 * The bridge when this binary has it, else null. Only a property lookup on `NativeModules`: no `require` of a native
 * package, so a binary without the module cannot crash here.
 */
export function nativeCampaignApi(): CampaignApi | null {
  try {
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const mod = NativeModules?.JCurveOfferwallModule as NativeCampaigns | undefined;
    if (!mod || typeof mod.loadCustomCampaigns !== 'function' || typeof mod.openCampaignDetail !== 'function') return null;
    return {
      list: async () => cleanCampaigns(await mod.loadCustomCampaigns!(100)),
      open: async campaignKey => (await mod.openCampaignDetail!(campaignKey)) === true,
    };
  } catch { return null; }
}
/** Clipboard through the same bridge (`setClipboard`), or null when this binary has none. */
export function nativeCopyText(): ((text: string) => Promise<boolean>) | null {
  try {
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const mod = NativeModules?.JCurveOfferwallModule as { setClipboard?: (text: string) => Promise<unknown> } | undefined;
    if (!mod || typeof mod.setClipboard !== 'function') return null;
    return async text => (await mod.setClipboard!(text)) === true;
  } catch { return null; }
}
