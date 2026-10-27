/**
 * 0.4.0 — the app-side glue of 「포인트 빨리 모으기」, now in the package: a small request client, the request bodies, and the push-route helpers.
 * An app gives only its server address and a function that returns its auth headers (see `OfferwallCombos`); nothing else of the glue is the app's.
 *
 * Nothing here carries a member number, device id, advertising id or `usn` in a body: each body below keeps a fixed set of fields and cuts their length.
 */
import type { CampaignInfo } from './campaigns';
import type { ComboDetailSignal, ComboTapDiagnostic } from './comboEntry';
import type { TapCampaign } from './webTap';
export type OfferwallClientOptions = {
    /** The app's server address, the part before `offerwall/…` (for example `https://api.example.com/v1/myapp`). http(s) only. */
    serverUrl: string;
    /** The app's own auth headers (app token, member session, device, OTA …), asked for on every request so a fresh login is picked up. */
    getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
    /** Called when the server answers 401 (the member's session is gone): the app drops it, as it does for its own requests. The request still fails. */
    onUnauthorized?: () => void;
    /** Default 15 s. */
    timeoutMs?: number;
    /** For tests. */
    fetcher?: (url: string, init: {
        method: string;
        headers: Record<string, string>;
        body?: string;
        signal?: any;
        cache?: any;
    }) => Promise<{
        ok: boolean;
        status: number;
        json(): Promise<any>;
    }>;
};
export type OfferwallClient = {
    get<T = unknown>(path: string): Promise<T>;
    post<T = unknown>(path: string, body?: unknown): Promise<T>;
};
/** A failed request: `status` 0 = no answer (network, timeout), else the HTTP status. */
export declare class OfferwallRequestError extends Error {
    status: number;
    constructor(message: string, status: number);
}
/** The base address with no trailing slash, or '' when it is not an http(s) address. */
export declare function normalizeServerUrl(serverUrl: unknown): string;
export declare function createOfferwallClient({ serverUrl, getAuthHeaders, onUnauthorized, timeoutMs, fetcher }: OfferwallClientOptions): OfferwallClient;
/** What `POST offerwall/campaigns` takes per campaign: key, name and reward, and (from a list read out of the web page) optional `info` and `icon`. */
export type CampaignBodyItem = {
    campaignKey: string;
    name: string;
    reward: number;
    info?: string;
    icon?: string;
};
/**
 * `POST offerwall/campaigns` body — the server's shape: campaigns ≤ 600, campaignKey ≤ 128 chars, name ≤ 255, reward a whole number,
 * and optionally `info` (≤ 1500, the campaign's one-line description or participation text) and `icon` (https, ≤ 300: the server keeps no longer ones).
 */
export declare function campaignsBody(list: ReadonlyArray<CampaignInfo | TapCampaign>): {
    campaigns: CampaignBodyItem[];
};
/** `POST offerwall/combos/diag` body for one 「하러 가기」 tap. Fixed fields only, lengths cut; no member, device or advertising id. */
export declare function diagBody(d: ComboTapDiagnostic): Record<string, unknown>;
declare const RESULTS: readonly ["open_failed", "closed_fast"];
/** `POST offerwall/combos/diag` body for the detail-page signal: four fields only (result, campaignKey, platform, ms). */
export declare function detailSignalBody(s: ComboDetailSignal): {
    result: (typeof RESULTS)[number];
    campaignKey: string;
    platform: 'ios' | 'android';
    ms: number;
};
/** The combos response asks for the recommendation popup on every entry (`display.chance_popup: "always"`, meant for test members). */
export declare function hasAlwaysPopup(body: unknown): boolean;
/** A copy of the response with 「항상」 turned into the normal rule (`on`); other values and fields stay, the original is not touched. */
export declare function dropAlwaysPopup(body: unknown): unknown;
/**
 * Did the server switch the iPhone list reading on for this member (`display.list_tap: "on"`)? Anything else (missing, `off`, a typo) is off:
 * the reading never starts without an explicit answer.
 */
export declare function listTapSwitch(body: unknown): boolean;
/** The campaign key in a notification's data (a string or a number), up to 64 chars; undefined when missing or odd. */
export declare function pushCampaignKey(data: unknown): string | undefined;
/** The free-trial list route: 'offerwall/trials' · '/offerwall/trials?from=push' · 'myapp://offerwall/trials' (the same shapes `isCombosRoute` knows). */
export declare function isTrialsRoute(value: unknown): boolean;
export type ComboPushTarget = 'combos' | 'trials';
/**
 * Where a notification's data sends the member inside this package's screens: the free-trial list (`go: 'offerwall/trials'`, or the older
 * `go: 'offerwall/combos'` with a `kind` starting with `trial_`), the 「포인트 빨리 모으기」 guide (`go: 'offerwall/combos'`), or null (not ours).
 */
export declare function comboPushTarget(data: unknown): ComboPushTarget | null;
export {};
