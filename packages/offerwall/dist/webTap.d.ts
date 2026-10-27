/** Name of the script message handler the native module registers in the SDK's web view (the page posts nothing to it by itself). */
export declare const WEB_TAP_HANDLER = "JCurveOfferwallTap";
/** Hosts the script (and the native handler) act on: AdPopcorn's offerwall page only. */
export declare const WEB_TAP_HOST_PATTERN = "^(?:[a-z0-9-]+\\.)*offerwall\\.adpopcorn\\.com$";
/**
 * The user script (ES5, runs at document start in the main frame of every web view the module sees; inert unless the page is the AdPopcorn offerwall).
 * It wraps `XMLHttpRequest` and `fetch` to read the campaign list / detail responses, and listens to the page's own `NativeEvent`.
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
};
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
