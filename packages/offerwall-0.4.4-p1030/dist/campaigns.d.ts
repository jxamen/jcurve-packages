/**
 * Opening one campaign directly. Needs the native bridge of 0.3.0 builds (`JCurveOfferwallModule`); older binaries do not
 * have it, so everything here degrades to "not available" and the caller falls back to the plain list.
 */
export type CampaignInfo = {
    campaignKey: string;
    name: string;
    reward?: string;
};
export type CampaignApi = {
    /** Current campaigns the SDK can open, with their keys. */
    list(): Promise<CampaignInfo[]>;
    /** Opens that campaign's detail page. Resolves true when the SDK took the request. */
    open(campaignKey: string): Promise<boolean>;
};
/** Native → JS list, keeping only well-formed rows (a key and a name). */
export declare function cleanCampaigns(raw: unknown): CampaignInfo[];
/** '[공식] Foo Bar!' → 'foobar'. Keeps Hangul, letters and digits only. */
export declare function normalizeCampaignName(name: string): string;
/**
 * Finds a campaign's key by its displayed name: exactly the same, then the same without spaces and punctuation, then the
 * same also without bracketed parts. Each step must match exactly one campaign; two different campaigns on a step mean
 * "unsure" and give null (opening the wrong campaign is worse than showing the plain list).
 */
export declare function findCampaignKey(list: readonly CampaignInfo[], name: string): string | null;
/**
 * The bridge when this binary has it, else null. Only a property lookup on `NativeModules`: no `require` of a native
 * package, so a binary without the module cannot crash here.
 */
export declare function nativeCampaignApi(): CampaignApi | null;
/** Clipboard through the same bridge (`setClipboard`), or null when this binary has none. */
export declare function nativeCopyText(): ((text: string) => Promise<boolean>) | null;
