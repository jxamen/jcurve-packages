/** Ways into 「포인트 빨리 모으기」: Chance-tab chip, Home banner, and a route that popups / pushes / deep links can fire. */
import type { ReactElement } from 'react';
import type { ComboBundle, ComboMission, ComboTheme, TodayCombos } from './combos';
import type { CampaignApi, CampaignInfo } from './campaigns';
import type { ComboStorage } from './comboDone';
/** Route name for pushes (`data.go`) and links. Apps use in-app actions, not a URL scheme. */
export declare const COMBOS_ROUTE = "offerwall/combos";
/** Server popups store their action in a 10-character column, so the popup action is this short form. */
export declare const COMBOS_POPUP_ACTION = "combos";
/** Accepts 'offerwall/combos', '/offerwall/combos?from=push', 'myapp://offerwall/combos' and the popup action 'combos'. */
export declare function isCombosRoute(value: unknown): boolean;
type Opener = {
    priority: number;
    open(): void;
};
/**
 * Opens the guide from anywhere (popup button, push tap, link). If no entry is mounted yet, for example while the app
 * switches tabs, the request waits up to 10 seconds for the first one that mounts. Returns true when an entry took it.
 */
export declare function requestOpenCombos(now?: number): boolean;
/** Chance tab (2) wins over Home (1) so one request never opens two screens. */
export declare function listenForComboRequests(opener: Opener, now?: number): () => void;
/**
 * Where the chip sits, in points from the top-right of the wall's container. Measured on two captures of the wall's own
 * header row (iPhone 402pt wide, Galaxy A32 411dp wide): row ~48 high, profile icon centered ~24 down and its left edge
 * ~44 from the right, so a 36-high chip 8 left of the icon is top 6 / right 52. The header stays fixed when the list scrolls.
 */
export declare const COMBO_CHIP_TOP = 6;
/** The wall's own title (「리워드 충전소」) ends about this far from the left edge (iPhone 402pt and Galaxy A32 411dp captures: 145~150). */
export declare const COMBO_TITLE_END = 150;
/** Space kept between that title and our buttons. */
export declare const COMBO_TITLE_GAP = 8;
/** Space between the 「무료체험」 button and the chip. */
export declare const COMBO_CHIP_GAP = 8;
/** How a button in the chip row is drawn: its words, font size and side padding. */
export type ComboChipFit = {
    label: string;
    size: number;
    pad: number;
};
/**
 * 대표님 10/27 22:50: with the 「무료체험」 button beside it the chip must not run into the wall's title on a small phone. Tries these in order and
 * keeps the first whose row fits between the title (`COMBO_TITLE_END` + 8) and the chip's right edge: both buttons in full, then the chip as
 * 「빨리 모으기」, then also the button as 「체험」 (the screen reader still hears the full names). `width` is the screen width, `right` the chip's right offset.
 */
export declare function comboChipFit(width: number, right: number): {
    chip: ComboChipFit;
    pill: ComboChipFit;
};
export declare const COMBO_CHIP_RIGHT = 52;
export declare const COMBO_SHEET_TOP = 52;
export type ComboChipProps = {
    onPress: () => void;
    open?: boolean;
    theme?: ComboTheme;
    top?: number;
    right?: number; /** Animated opacity for the blink (see usePulse). */
    opacity?: import('react-native').Animated.Value; /** drawn to the chip's left in the same row (the 「무료체험 확인」 button) */
    before?: ReactElement | null; /** words, size and padding when the row is crowded (see comboChipFit) */
    fit?: ComboChipFit;
};
/**
 * Small chip that floats over the wall's own header row, left of its profile icon. Only the chip is drawn: no band,
 * no padding box, and the wrapper lets touches through everywhere else.
 */
export declare function ComboChip({ onPress, open, theme, top, right, opacity, before, fit }: ComboChipProps): ReactElement;
/**
 * 「무료체험 확인」 (대표님 10/27 22:11): a small button to the left of the chip that opens the member's own free-trial list. Short on purpose
 * (the wall's title is to its left): white with a yellow rim, so it does not compete with the chip.
 */
export declare function ComboTrialsChip({ onPress, open, theme, fit }: {
    onPress: () => void;
    open?: boolean;
    theme?: ComboTheme;
    fit?: ComboChipFit;
}): ReactElement;
export type ComboBannerProps = {
    combos: TodayCombos;
    onPress: () => void;
    theme?: ComboTheme; /** Animated opacity for the blink (see usePulse). */
    opacity?: import('react-native').Animated.Value;
};
/** Home banner: the name large, the goal numbers emphasized. */
export declare function ComboBanner({ combos, onPress, theme, opacity }: ComboBannerProps): ReactElement;
/**
 * What happened on one 하러 가기 tap, step by step, so a failure can be located without guessing: was there a bridge, did the
 * SDK list arrive (how many, or which error), which key was tried and how it was found, did the SDK take it. Public campaign data
 * only: no member, device or advertising id. The host decides whether and where to send it (`onDiagnostic`).
 */
export type ComboTapDiagnostic = {
    t: 'tap';
    /** the server's mission id (a campaign key when the server knows it, else a short hash) */
    mission: string;
    name: string;
    bridge: boolean;
    /** how many campaigns the SDK list returned (0 when it failed or was not asked) */
    listCount: number;
    listError?: string;
    /** first names of the SDK list, to see why a name did not match */
    listSample?: string[];
    /** where the key we tried came from: the server (`campaignKey` / a numeric id), a name match, the row id found in the list, or none */
    how: 'server_key' | 'name' | 'id_in_list' | 'none';
    key?: string;
    /** keys tried in all (the last one is described by `key` / `open`) */
    attempts: number;
    /** true: the SDK took the key. false: it refused or gave no answer in time. 'error': the call threw. 'skipped': nothing to try */
    open: boolean | 'error' | 'skipped';
    openError?: string;
    openMs?: number;
    copied?: boolean;
    /** milliseconds from the tap to the outcome */
    ms: number;
};
/**
 * What the app saw when it opened a campaign's detail page, as a hint for the server's own sold-out check (대표님 10/27 22:11):
 * `open_failed` = the SDK would not open it or gave no sign it did (`ms` = the wait; ~5000+ on iOS means no sign of opening),
 * `closed_fast` = it opened and was closed again within COMBO_CLOSED_FAST_MS (`ms` = how long it stayed). `platform` is 'ios' | 'android'.
 * Opening and closing quickly is also what a quick participation looks like, so this is a hint and nothing more.
 */
export type ComboDetailSignal = {
    result: 'open_failed' | 'closed_fast';
    campaignKey: string;
    platform: string;
    ms: number;
};
/** A detail page that closes within this long after opening (ms) counts as `closed_fast`. */
export declare const COMBO_CLOSED_FAST_MS = 15000;
/** How long the 「해지 알림을 맞춰 뒀어요」 toast shows before the campaign's detail page opens (ms). */
export declare const COMBO_CONSENT_TOAST_MS = 700;
/** After sending a detail signal, the combos are fetched again this long after (the server may answer with a `soldout` list). */
export declare const COMBO_SIGNAL_REFRESH_MS = 3000;
/** Fetching the combos again for `done` is skipped when the last fetch was this recent (ms). */
export declare const COMBO_REFRESH_GAP_MS = 2500;
/** How long after the wall has loaded the recommendation popup waits before it appears. */
export declare const COMBO_POPUP_DELAY_MS = 600;
export type ComboEntryProps = {
    /** 'chance': chip over the wall (mount it beside the wall inside the same container). 'home': optional banner. */
    placement: 'chance' | 'home';
    /** Where the combos come from: `url` (+ `headers`), or `load` = the app's own API call returning the parsed JSON body. */
    url?: string;
    headers?: Record<string, string>;
    load?: () => Promise<unknown>;
    /** Identifies who `load` asks for (member id / token). When it changes the previous member's rows are dropped at once. */
    loadKey?: string | number;
    usn?: string | null;
    theme?: ComboTheme;
    /** Screen work only: shows fixed example rows. Never set this in a release. */
    sample?: boolean;
    /** Takes over a mission tap completely. Without it the entry opens the campaign itself (see below). */
    onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
    /** AsyncStorage-shaped store for the "done" marks (kept per member and per Korean day). Without it they last until the app closes. */
    storage?: ComboStorage;
    /** Copies the campaign name when a tap falls back to the list. Default: the 0.3.0 native bridge when this binary has it, else no copy. */
    copyText?: (text: string) => unknown;
    /** The native campaign bridge. Default: found automatically (null on binaries without it). Pass `null` to switch direct opening off. */
    campaigns?: CampaignApi | null;
    /** Gets the campaign list (key, name, reward) once it was read, e.g. to send it to the server for test members. */
    reportCampaigns?: (list: CampaignInfo[]) => unknown;
    /** Called after every 하러 가기 tap with what happened (see ComboTapDiagnostic). Sending it is the app's business. */
    onDiagnostic?: (diagnostic: ComboTapDiagnostic) => unknown;
    /**
     * Called (for every member, once per result and campaign key per visit) when the SDK would not open a campaign's detail page
     * (`open_failed`) or the page was closed again within 15 s (`closed_fast`): a sold-out campaign ends up here, but so can a slow load
     * or a quick participation, so the app only reports and never hides the row itself. The server decides (the `soldout` list in the
     * combos). Sending it is the app's business.
     */
    onDetailSignal?: (signal: ComboDetailSignal) => unknown;
    /**
     * Free trials (0.3.11). The app sends the member's answer to the cancel-notice question (`POST offerwall/trials/consent`). Without this the
     * question is not asked and a trial campaign opens like any other.
     */
    onTrialConsent?: (campaignKey: string, agree: boolean) => unknown;
    /** The member's own free-trial list (`GET offerwall/trials`, the whole body): gives the 「무료체험 확인」 button and its list. Without it neither exists. */
    loadTrials?: () => Promise<unknown>;
    /** 「했어요」 / 「아직」 on a trial row (`POST offerwall/trials/{key}/cancelled`). */
    onTrialCancelled?: (campaignKey: string, cancelled: boolean) => unknown;
    chipTop?: number;
    chipRight?: number;
    sheetTop?: number;
    /** Picture at the top of the recommendation popup (the app's coin art). Without it a coin is drawn from plain views. */
    popupArt?: import('react-native').ImageSourcePropType;
    /**
     * The app's own ad, drawn at the bottom of the recommendation popup under the 「추천 보기」 button (Eggmoney: its existing native ad card).
     * Give it its own top margin; return null (and no spacing) when there is nothing to show.
     */
    popupAd?: () => ReactElement | null;
};
/**
 * Chance tab: put it next to the wall inside one container, `<View style={{flex:1}}><OfferwallScreen/><ComboEntry placement="chance"/></View>`.
 * The chip floats over the wall's header row; tapping it raises the guide over the wall, tapping again (or 닫기) closes it
 * and the wall stays as it was. Home: a banner that opens the guide as a full screen. The server picks what shows
 * through `display`; the Chance tab keeps answering popup / push / link requests even when its chip is switched off.
 *
 * Tapping 하러 가기 on a row: with the native bridge the campaign's key is looked up (same name in the SDK's list, or the
 * server's id when it is a key) and its detail page opens. Otherwise, or when nothing is found, the name is shown at the
 * top (and copied when possible) and the plain list is revealed: the Chance tab closes the guide, Home opens the list.
 */
export declare function ComboEntry({ placement, url, headers, load, loadKey, usn, theme, sample, onPressMission, storage, copyText, campaigns, reportCampaigns, onDiagnostic, onDetailSignal, onTrialConsent, loadTrials, onTrialCancelled, chipTop, chipRight, sheetTop, popupArt, popupAd, }: ComboEntryProps): ReactElement | null;
export {};
