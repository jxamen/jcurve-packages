/** 「포인트 빨리 모으기」 — daily point combos. Pure JS (OTA-safe); it only shows server data and never grants points. */
import type { ReactElement } from 'react';
/** The one place the feature's name lives (chip, Home banner, guide title, labels, popup text). */
export declare const COMBO_NAME = "\uD3EC\uC778\uD2B8 \uBE68\uB9AC \uBAA8\uC73C\uAE30";
export type ComboLevel = 'easy' | 'normal' | 'hard';
/** One mission row = one real campaign. `campaignKey` is optional: when the server knows it, the app opens that campaign directly. */
export type ComboMission = {
    id: string;
    name: string;
    points: number;
    todo: string;
    level: ComboLevel;
    minutes?: number;
    campaignKey?: string;
};
export type ComboBundle = {
    goal: number;
    missions: ComboMission[];
    total: number;
};
/** Server switches. chance: the floating chip in the Chance tab; home: the optional banner on Home. */
export type ComboDisplay = {
    chance: 'chip' | 'off';
    home: 'banner' | 'off';
};
export type TodayCombos = {
    date?: string;
    display: ComboDisplay;
    bundles: ComboBundle[];
};
export declare const COMBO_LEVEL_LABEL: Record<ComboLevel, string>;
/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
export declare function normalizeTodayCombos(raw: unknown): TodayCombos | null;
/** Calendar date in Korea (the daily reset), YYYY-MM-DD. */
export declare function kstDate(now?: number): string;
/** Yesterday's combos must not be shown as today's, so a body without a date counts as stale too. */
export declare function isTodayCombos(combos: TodayCombos, now?: number): boolean;
/** Milliseconds until the next 00:00 in Korea. */
export declare function msUntilKstMidnight(now?: number): number;
export declare function formatPoints(n: number): string;
/** 1000 → 1천P, 5000 → 5천P, 10000 → 1만P, anything else → 1,500P */
export declare function formatGoal(goal: number): string;
/**
 * Look of the screens. The apps share one token family (`C` colors, `R` radii, `F` font sizes, `shadow`), so a host
 * passes `comboThemeFromTokens({ C, R, F, shadow })` and the pages match its own mission cards. The defaults are that
 * family's values, so an app without tokens still looks like the others.
 */
export type ComboTheme = {
    bg: string;
    card: string;
    line: string;
    divider: string;
    text: string;
    sub: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    point: string;
    pointSoft: string;
    tag: string;
    tagText: string;
    radius: {
        card: number;
        slot: number;
        chip: number;
    };
    font: {
        title: number;
        head: number;
        body: number;
        small: number;
        tiny: number;
    };
    shadow: Record<string, any>;
};
export declare const DEFAULT_COMBO_THEME: ComboTheme;
type TokenSet = {
    C?: Record<string, string>;
    R?: Record<string, number>;
    F?: Record<string, number>;
    shadow?: Record<string, any>;
};
/** Maps the family's `C`/`R`/`F`/`shadow` objects (tree → accent, treeDark → accentText, treeSoft → accentSoft). */
export declare function comboThemeFromTokens({ C, R, F, shadow }: TokenSet): ComboTheme;
export type FetchCombosResult = {
    ok: true;
    combos: TodayCombos;
} | {
    ok: false;
    reason: 'network' | 'bad_response' | 'stale';
};
type Fetcher = (url: string, init: {
    headers: Record<string, string>;
    signal?: any;
    cache?: any;
}) => Promise<{
    ok: boolean;
    json(): Promise<any>;
}>;
export declare function fetchTodayCombos({ url, headers, timeoutMs, now, fetcher }: {
    url: string;
    headers?: Record<string, string>;
    timeoutMs?: number;
    now?: number;
    fetcher?: Fetcher;
}): Promise<FetchCombosResult>;
/** A response body (`{ok, combos}`, `{ok, data}` or the combos themselves) → checked combos for today. */
export declare function parseCombosBody(body: unknown, now?: number): FetchCombosResult;
/**
 * Same as `fetchTodayCombos` but the app does the request with its own API function (auth, device and OTA headers,
 * 401 handling stay the app's). `load` resolves to the parsed JSON body; a throw counts as a network failure.
 */
export declare function loadTodayCombos({ load, timeoutMs, now }: {
    load: () => Promise<unknown>;
    timeoutMs?: number;
    now?: number;
}): Promise<FetchCombosResult>;
/**
 * Fixed data for building the screen before the API exists, in the shape of a real server response (one row = one
 * campaign, same id in several bundles when the same campaign fits). Only `sample: true` ever shows it.
 */
export declare const TODAY_COMBOS_SAMPLE: TodayCombos;
export type TodayCombosState = {
    status: 'loading' | 'ready' | 'empty';
    combos: TodayCombos | null;
    reload(): void;
};
/**
 * Loads today's combos. Without `url` nothing is shown unless `sample` is true (screen work only),
 * so users never see example rows as if they were real.
 * Data is tied to the url + headers it was fetched with: a new member or address starts empty instead of showing
 * the previous one's rows. After Korean midnight yesterday's rows are dropped and today's are fetched again.
 */
export type CombosSource = {
    /** Either `url` (+ `headers`) or `load`: the app's own request function, resolving to the parsed JSON body. */
    url?: string;
    headers?: Record<string, string>;
    load?: () => Promise<unknown>;
    /** Anything that identifies who/what `load` asks for (member id, token); a change drops the previous rows at once. */
    loadKey?: string | number;
};
export declare function useTodayCombos({ url, headers, load, loadKey, sample }: CombosSource & {
    sample?: boolean;
}): TodayCombosState;
export declare const COMBO_LIST_HINT = "\uB204\uB974\uBA74 \uD61C\uD0DD \uBAA9\uB85D\uC774 \uC5F4\uB824\uC694. \uAC19\uC740 \uC774\uB984\uC744 \uCC3E\uC544 \uCC38\uC5EC\uD574 \uC8FC\uC138\uC694.";
export type ComboGuideScreenProps = {
    /** null while loading or when there is nothing for today; the screen then shows a short message. */
    combos: TodayCombos | null;
    loading?: boolean;
    onClose: () => void;
    /** Opens the matching item. Without it, `usn` opens the whole list instead (the SDK cannot jump to one item). */
    onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
    usn?: string | null;
    theme?: ComboTheme;
    showHeader?: boolean;
    topInset?: number;
    /** 'page' = full screen with a back arrow; 'sheet' = the panel that rises over the wall, with a 닫기 button. */
    variant?: 'page' | 'sheet';
    /** Shown above the rows when a tap only opens the whole list. Pass '' to hide. */
    hint?: string;
    /** Mission ids the user ticked as done. Done rows sink to the bottom, dim, and leave the remaining sum. */
    done?: ReadonlySet<string>;
    /** Called when the round mark in front of a row is tapped. Without it the marks are not interactive. */
    onToggleDone?: (id: string) => void;
};
/** The guide page: a 1단계 · 2단계 · 3단계 path (1천P → 5천P → 1만P), one bundle shown at a time. */
export declare function ComboGuideScreen({ combos, loading, onClose, onPressMission, usn, theme, showHeader, topInset, variant, hint, done, onToggleDone }: ComboGuideScreenProps): ReactElement;
export {};
