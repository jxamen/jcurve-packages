/** Name of the script message handler the native module registers in the SDK's web view (the page posts nothing to it by itself). */
export declare const WEB_TAP_HANDLER = "JCurveOfferwallTap";
/** Hosts the script (and the native handler) act on: AdPopcorn's offerwall page only. */
export declare const WEB_TAP_HOST_PATTERN = "^(?:[a-z0-9-]+\\.)*offerwall\\.adpopcorn\\.com$";
/**
 * The user script (ES5, runs at document start in the main frame of every web view the module sees; inert unless the page is the AdPopcorn offerwall).
 * It wraps `XMLHttpRequest` and `fetch` to read the campaign list / detail responses, and listens to the page's own `NativeEvent`.
 *
 * The response shape (0.4.2, read from the wall page's own public code — `offerwall.adpopcorn.com/assets/*.js` — and checked against its card
 * components): the list is `POST …/v3/sdk/media/campaigns` → `{ CampaignList: [ { Key, Title, Description, IconImage, MainImage, Reward: { Quantity, Unit }, … } ], … }`
 * (a `CPMCampaignList` may sit beside it), the detail `…/v3/sdk/media/campaign` → `{ Campaign: { Key, … } }`. The page's live-commerce rows are different
 * (`CampaignKey`, `IconUrl`, a plain-number `Reward`, `PartiTypeCode`, broadcast times) and are not missions. 0.4.0 / 0.4.1 looked for `CampaignKey` only
 * and so found no mission list at all on a device (diag: lists 0, shapes 1).
 */
export declare const WEB_TAP_SCRIPT: string;
/** One campaign read from the web page. `reward` is a whole number; `icon` is https only. */
export type TapCampaign = {
    campaignKey: string;
    name: string;
    reward: number;
    description?: string;
    icon?: string;
    info?: string;
};
export type TapMessage = {
    type: 'list';
    campaigns: TapCampaign[];
} | {
    type: 'detail';
    campaign: TapCampaign;
}
/** an event the SDK handed to the page: normalDialog (its message is the dialog text, e.g. a campaign that is full), showDetailPage, requestJoinCampaign … */
 | {
    type: 'native';
    event: string;
    ok: boolean;
    message: string;
}
/** the key names (never values) of a response the script could not read, to learn its shape */
 | {
    type: 'shape';
    path: string;
    keys: string[];
    itemKeys: string[];
}
/** 0.4.1: the script started on the wall page */
 | {
    type: 'hello';
    host: string;
    ready: string;
}
/** 0.4.1: a path the page requested (no query) */
 | {
    type: 'net';
    path: string;
}
/** 0.4.2: the shape of one response (kind · length · key names · array lengths and row key names — never a value), so the next device run shows the real format */
 | ({
    type: 'resp';
} & TapResp);
/** What one response looked like: only names and numbers. */
export type TapResp = {
    path: string;
    status: number;
    kind: string;
    len: number;
    top?: string;
    n?: number;
    keys: string[];
    item: string[];
    arrays: Array<{
        k: string;
        n: number;
        item: string[];
        sub: Array<[string, string[]]>;
    }>;
};
/** Names and numbers only: a value that is not a short key name never survives this (`text` cuts to 30 characters, arrays and lists are capped). */
export declare function cleanResp(raw: unknown): TapResp | null;
/** A message from the native module (a JSON string or an object) → a checked `TapMessage`, or null for anything else. */
export declare function parseTapMessage(raw: unknown): TapMessage | null;
export type WebTapOptions = {
    /** Called with every checked message. */
    onMessage: (message: TapMessage) => void;
    /** Off (false) = the native side removes the script for web views created from now on. Default true. */
    enabled?: boolean;
};
export type WebTapHandle = {
    ok: boolean;
    reason?: 'no_native' | 'unsupported' | 'failed';
    stop: () => void;
};
/**
 * Starts the web tap: gives the native module the script, and listens to what it posts. Resolves `{ ok: false }` on a binary without the 0.4.0
 * native module (nothing is hooked) — the caller just goes on without the list reading. `stop()` switches it off again.
 */
export declare function startWebTap({ onMessage, enabled }: WebTapOptions): Promise<WebTapHandle>;
