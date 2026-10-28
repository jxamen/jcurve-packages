/**
 * 0.4.0 — `<OfferwallCombos>`: 「포인트 빨리 모으기」 whole, for any app. The app gives its server address and auth headers, its ad unit and its colors; everything the
 * apps used to write themselves (the requests, the test-member checks, the diagnostics, the free-trial calls, the notification question, the popup ad, the iPhone list
 * reading and its upload) is here.
 *
 *   <OfferwallCombos placement="chance" usn={usn} memberId={member.id}
 *     serverUrl={API_BASE} getAuthHeaders={() => ({ 'X-App-Token': TOKEN, Authorization: 'Bearer ' + session })}
 *     adUnit={{ ios: '…', android: '…' }} tokens={{ C, R, F, shadow }} popupArt={require('./coin.png')} />
 *
 * Server paths (relative to `serverUrl`): GET `offerwall/combos` · POST `offerwall/campaigns` · POST `offerwall/combos/diag` · GET `offerwall/trials` ·
 * POST `offerwall/trials/consent` · POST `offerwall/trials/{key}/cancelled`.
 *
 * **Nothing turns on by itself.** The chip, the popup and the list reading appear only for what the server's answer switches on: no answer (a server without the
 * endpoint, a failed request) shows nothing, and an answer without an explicit `display.chance` keeps the chip off. Campaign keys differ per app and per OS, so the server
 * says per app and per OS when there is something to show. The iPhone list reading (`display.list_tap: "on"`) is a switch of its own and is off unless the answer says "on".
 */
import type { ReactElement } from 'react';
import type { CampaignInfo } from './campaigns';
import { type OfferwallClient, type OfferwallClientOptions, type WebTapSummary } from './connector';
import { type ComboDetailSignal, type ComboEntryProps, type ComboSheetShown, type ComboTapDiagnostic } from './comboEntry';
import type { ComboStorage } from './comboDone';
import { comboThemeFromTokens, type ComboTheme } from './combos';
import { type OfferwallAdUnits } from './popupAd';
import { type TrialNotifyDeps, type TrialNotifyHooks } from './trialNotify';
/** The app's `C` / `R` / `F` / `shadow` token objects (see `comboThemeFromTokens`). */
export type OfferwallTokens = Parameters<typeof comboThemeFromTokens>[0];
export type OfferwallCombosProps = {
    placement: 'chance' | 'home';
    /** The member's offerwall id (the wall's `usn`). */
    usn: string | null;
    /** Who is signed in. Null = nothing is shown (and nothing is asked of the server). Also the scope of the device-side marks. */
    memberId: number | string | null | undefined;
    /** The app's server address and its auth headers (the package makes the requests) … */
    serverUrl?: string;
    getAuthHeaders?: OfferwallClientOptions['getAuthHeaders'];
    /** … and what to do when the server says 401 (drop the session). */
    onUnauthorized?: () => void;
    /**
     * … or, instead of the three above, the app's own request layer (`{ get(path), post(path, body) }`, paths relative to the app's server such as `offerwall/combos`), when it
     * already handles headers, 401s and retries. When given, `serverUrl` / `getAuthHeaders` are not used.
     */
    client?: OfferwallClient;
    /** Colors and shape: the app's token objects, and/or single values on top (applied in that order over the defaults). */
    tokens?: OfferwallTokens;
    theme?: Partial<ComboTheme>;
    /** The picture on top of the recommendation popup. Without it a coin is drawn. */
    popupArt?: ComboEntryProps['popupArt'];
    /** The ad under 「추천 보기」: the app's native ad unit per OS. No unit (or `popupAd: false`) = no ad and no space for it. */
    adUnit?: OfferwallAdUnits | string;
    adTestMode?: boolean;
    adTestDevices?: string[];
    /** The app's own off switch for that ad (for instance a remote setting). Default true. */
    popupAd?: boolean;
    /**
     * Is this member a test member? Only test members send the SDK campaign list and the per-tap diagnostics (the server accepts them from nobody else), and only
     * test members keep the 「항상」 popup. Without it nobody is one. Asked at most once per member, and only when an answer needs it; answer `null` when it could not
     * be found out (the answer counts as "no" this time and is asked again next time).
     */
    isTestMember?: () => Promise<boolean | null | undefined>;
    /** AsyncStorage-shaped store for the device-side marks. Default: `@react-native-async-storage/async-storage` when the app has it. */
    storage?: ComboStorage;
    /** Free trials: how the phone's notifications and the push token are seen to (see `ensureTrialNotify`). */
    syncPushToken?: TrialNotifyHooks['syncToken'];
    notifyHooks?: Omit<TrialNotifyHooks, 'syncToken'>;
    notifications?: Partial<TrialNotifyDeps>;
    /** Where the log of the sheet's opening time goes (default `console.log('[combos] sheet', …)`). */
    onSheetShown?: (info: ComboSheetShown) => void;
    /**
     * 0.6.3 (the 0.6.2 entry props, handed to `ComboEntry` as they are) — the 찬스2 (SnapPlay) tab's own list: the app's call for `GET offerwall/combos?source=snapplay` (the parsed body,
     * same shape as the 찬스1 answer; a row's `campaignKey` is the SnapPlay `adv_id`). It is **not** run through the 찬스1 guard (the chip needs no `display.chance`: rows are what turn it on).
     * Without it the 찬스2 tab has no chip.
     */
    loadSnapPlay?: ComboEntryProps['loadSnapPlay'];
    /** 0.6.3 — each time the phone reads the SnapPlay ad list (see `ComboEntryProps.onSnapPlayAds`): to send it to the server, or to compare `points` with SnapPlay's own screen. */
    onSnapPlayAds?: ComboEntryProps['onSnapPlayAds'];
    chipTop?: number;
    chipRight?: number;
    sheetTop?: number;
};
/**
 * The answer as the connector wants it: a combos document that does not say `display.chance` for itself keeps the chip off (nothing turns on by default),
 * and the `always` popup survives only for test members. The original body is not touched.
 */
export declare function guardedBody(body: unknown): unknown;
/** The last explicit "on" the server gave for the iPhone list reading, kept on the device so the tap can start at mount, before the combos answer is back (0.4.1). */
export declare const LIST_TAP_CACHE_MS: number;
export declare const listTapCacheKey: (member: string | number) => string;
/** The cached value ('1700000000000' = when the server last said "on") is still usable. Anything else — nothing stored, "0", garbage, too old — is off. */
export declare function listTapCached(raw: string | null | undefined, now?: number): boolean;
export type ComboHandlerDeps = {
    client: () => OfferwallClient;
    memberId: () => number | string | null | undefined;
    /** The app's own answer to "is this member a test member?" (undefined = nobody is). */
    askTestMember?: () => Promise<boolean | null | undefined> | boolean | null | undefined;
    /** Told, on every combos answer, whether the server switched the iPhone list reading on. */
    onListTap?: (on: boolean) => void;
};
/**
 * The calls `<OfferwallCombos>` hands to the entry, with their rules: who may send what, what is never sent, what failing means. Exported so that an app that
 * wants its own screen around `ComboEntry` can still use the same calls.
 */
export declare function createComboHandlers({ client, memberId, askTestMember, onListTap }: ComboHandlerDeps): {
    isTestMember: () => Promise<boolean>;
    /** GET offerwall/combos, the body the entry parses: chip kept off unless the server said so, "always" popup only for test members. */
    load(): Promise<unknown>;
    /** The SDK's campaign list (Android, iPhone with the bridge): test members only. */
    report(list: CampaignInfo[]): Promise<void>;
    /** One line per 하러 가기 tap: test members only. */
    diagnose(d: ComboTapDiagnostic): Promise<void>;
    /** What the web tap saw (counts and path names only): test members only, quietly. */
    diagnoseWebTap(summary: WebTapSummary): Promise<void>;
    /** A detail page that did not open / closed at once: every member, four fields. */
    signalDetail(s: ComboDetailSignal): Promise<void>;
    /** A failure is thrown on purpose: the entry knows what to do with it (the consent still opens the page, the list says it could not load, a cancel mark reloads the list). */
    trialConsent(campaignKey: string, agree: boolean): Promise<void>;
    loadTrials(): Promise<unknown>;
    trialCancelled(campaignKey: string, cancelled: boolean): Promise<void>;
};
export declare function OfferwallCombos(props: OfferwallCombosProps): ReactElement | null;
