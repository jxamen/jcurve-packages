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
    /** The campaign's icon (https URL from the server, `icon`). Without it the row shows the first letter of the name. */
    icon?: string;
};
export type ComboBundle = {
    goal: number;
    missions: ComboMission[];
    total: number;
};
/** Missions that reach `goal` on their own ("한 번에 끝내기"), mixed kinds. Several to choose from, any one is enough. */
export type ComboSingles = {
    goal: number;
    missions: ComboMission[];
};
/** Server switches. chance: the floating chip in the Chance tab; home: the optional banner on Home. */
export type ComboDisplay = {
    chance: 'chip' | 'off';
    home: 'banner' | 'off';
    /**
     * `chance_popup` from the server: 'off' turns the recommendation popup off, 'always' shows it on every direct entry to the Chance tab
     * (test accounts: no once-a-day limit, the "guide already opened today" mark is ignored). Absent or 'on' = once a day.
     */
    popup?: 'off' | 'always';
};
/** 「쉽게 모으기」: short, easy missions (follow, subscribe, install and open) with no goal; `total` is the sum of their points. */
export type ComboEasy = {
    missions: ComboMission[];
    total: number;
};
export type TodayCombos = {
    date?: string;
    display: ComboDisplay;
    bundles: ComboBundle[];
    /** absent when the server sent none: the 「한 번에 끝내기」 box is then hidden */
    singles?: ComboSingles[];
    /** absent when the server sent none: the 「쉽게 모으기」 tab is then hidden */
    easy?: ComboEasy;
    /** Campaign keys this member was already paid for today (the server's `done`). Rows with such a key are shown as done on their own. */
    done?: string[];
    /** 무료체험 campaigns (the server's `trials`): a list of its own, never part of the sums or the steps. Absent = no 「무료체험」 tab. */
    trials?: ComboTrial[];
    /** Every free-trial campaign key (sold-out and other-OS ones too): opening one of these asks for the cancel-notice consent first. */
    trialKeys?: string[];
    /** The campaigns this member already answered (`trial_consent`): key (lower case) → agreed or not. An answered one is not asked again. */
    trialConsent?: Record<string, boolean>;
    /**
     * 항목별 탭 (the server's `categories`): the tabs of the guide, in the server's order; each with its items and its own total. When there are
     * some, the guide shows these tabs instead of the easy / amount / trial tabs; without them it is the screen it always was.
     */
    categories?: ComboCategory[];
};
/** One row of a category: what to do (`line`, one line: for games the goal and its time limit) and what it costs (`cost`, a short phrase, none when it is free). */
export type ComboCategoryItem = {
    campaignKey: string;
    name: string;
    points: number;
    icon?: string;
    line?: string;
    cost?: string;
    trialDays?: number;
    chargeAmount?: number;
    /** this member was already paid for it today */
    done?: boolean;
};
/** One tab: `totalPoints` is the sum of the items that cost nothing (null: the tab has no total, e.g. 무료체험 · 쇼핑); `count` the server's item count. */
export type ComboCategory = {
    key: string;
    title: string;
    totalPoints: number | null;
    count: number;
    items: ComboCategoryItem[];
};
/**
 * One free-trial campaign. Everything but key, name and points is optional: a value the server could not read is simply missing
 * (e.g. no `chargeAmount` for some), and the line then says less.
 */
export type ComboTrial = {
    campaignKey: string;
    name: string;
    points: number;
    icon?: string;
    /** free days / hours, the monthly price after the trial (won), and how many hours after joining the trial can be cancelled */
    trialDays?: number;
    trialHours?: number;
    chargeAmount?: number;
    cancelAfterHours?: number;
};
/** Name of the tab that lists only easy missions, before the 1천 → 5천 → 1만P steps. */
export declare const COMBO_EASY_NAME = "\uC27D\uAC8C \uBAA8\uC73C\uAE30";
export declare const COMBO_LEVEL_LABEL: Record<ComboLevel, string>;
/** Keeps only well-formed rows; totals are recomputed so the screen never shows a sum the rows do not add up to. */
export declare function normalizeTodayCombos(raw: unknown): TodayCombos | null;
/** The category rows as mission-shaped rows (id = campaign key), for the check marks and the 「paid today」 mark. A campaign in two tabs is one row here. */
export declare function categoryMissions(combos: TodayCombos | null | undefined): ComboMission[];
/** The terms of a free-trial campaign for the consent popup: from the `trials` list, else from a category row that carries them. Empty when unknown. */
export declare function trialTerms(combos: TodayCombos | null | undefined, key: string | undefined): string;
/** 29900 → 「29,900원」 */
export declare function formatWon(amount: number): string;
/**
 * The second line of a free-trial row: 「7일 무료 · 이후 월 16,500원」. Days win over hours (whole days are said as days); with neither,
 * just 「무료체험」; the price part is left out when the server gave none.
 */
export declare function trialLine(trial: Pick<ComboTrial, 'trialDays' | 'trialHours' | 'chargeAmount'>): string;
/**
 * The free-trial list as mission rows: id = campaign key, the second line is 「7일 무료 · 이후 월 16,500원」. They are never in a sum; they only
 * share the number circle, the hand check and the 「already paid today」 mark with the other rows.
 */
export declare function trialMissions(combos: TodayCombos | null | undefined): ComboMission[];
/** The tab's one-line note, right where the other tabs show their sum (대표님 10/27 22:29). */
export declare const COMBO_TRIAL_NOTE = "\uB05D\uB098\uAE30 \uC804\uC5D0 \uD574\uC9C0\uD558\uBA74 \uBB34\uB8CC \u00B7 \uD574\uC9C0 \uC548\uB0B4\uB97C \uBC1B\uC744 \uC218 \uC788\uC5B4\uC694";
/** Name of the free-trial tab, last in the tab row. */
export declare const COMBO_TRIAL_NAME = "\uBB34\uB8CC\uCCB4\uD5D8";
/** Is this campaign key one of the free-trial campaigns (case does not matter)? */
export declare function isTrialKey(combos: TodayCombos | null | undefined, key: string | undefined): boolean;
/**
 * Does opening this campaign's detail page have to ask about cancel notices first? Yes when it is a free-trial campaign and this member
 * has not answered for it yet (neither on the server, `trial_consent`, nor in this visit, `answered`).
 */
export declare function needsTrialConsent(combos: TodayCombos | null | undefined, key: string | undefined, answered?: ReadonlyMap<string, boolean> | Record<string, boolean>): boolean;
/**
 * Ids of the missions the server says were already paid today: a mission counts when its `campaignKey` (or, when the server
 * made the id the key, its `id`) is in `combos.done`. The guide shows these rows as done on its own (down the list, out of the
 * remaining sum, numbers counted again); ticking by hand stays for the rest.
 */
export declare function autoDoneIds(combos: TodayCombos | null | undefined): Set<string>;
/** Calendar date in Korea (the daily reset), YYYY-MM-DD. */
export declare function kstDate(now?: number): string;
/** Yesterday's combos must not be shown as today's, so a body without a date counts as stale too. */
export declare function isTodayCombos(combos: TodayCombos, now?: number): boolean;
/** Milliseconds until the next 00:00 in Korea. */
export declare function msUntilKstMidnight(now?: number): number;
export declare function formatPoints(n: number): string;
export type ComboPopupContent = {
    /** headline pieces: `before` + big `amount` + `after`, e.g. 「오늘 」 「+5,965P」 「 모을 수 있어요」 */
    before: string;
    amount: string;
    after: string;
    /** one line under it, e.g. 「쉬운 미션 18개 · 하나에 3분이면 끝」 */
    sub: string;
    /** first-come notice (always the same sentence): campaigns close when their places run out */
    notice: string;
};
/** 대표님 10/27 「선착순 안내도 추가」 — AdPopcorn campaigns have a limited number of places, so the popup says so. */
export declare const COMBO_POPUP_NOTICE = "\uC120\uCC29\uC21C \u00B7 \uCEA0\uD398\uC778\uB9C8\uB2E4 \uC778\uC6D0\uC774 \uCC28\uBA74 \uB05D\uB098\uC694";
/**
 * What the recommendation popup says, from the server's combos: the easy missions' sum as the big number (else the top goal), and
 * how many easy missions there are, with how long one takes when the server gave minutes (the middle value, so one odd mission does not decide it).
 */
export declare function comboPopupContent(combos: TodayCombos): ComboPopupContent;
/** Width the popup's headline has to fit in: a 320 card minus 22 + 22 padding. */
export declare const COMBO_POPUP_HEADLINE_WIDTH = 276;
/**
 * 대표님 10/27 22:27 「두 줄을 한 줄로」: the popup headline 「오늘 +5,597P 모을 수 있어요」 is one line, the number big. When the words and
 * the number do not fit the card at full size (words 18 · number 34), both shrink by the same factor (at least 0.6) so a long number
 * (6 digits) still fits. The line height is the same for the words and the number and a bit more than the number's size, so the top of the
 * big digits is never cut off (a nested text taller than its parent's line height is clipped on iOS).
 * Widths are estimated per character (Hangul 1 em, digits and letters 0.62, comma / period / space 0.3), the text itself also carries
 * `adjustsFontSizeToFit` as a net.
 */
export declare function popupHeadlineSizes(content: Pick<ComboPopupContent, 'before' | 'amount' | 'after'>, width?: number): {
    words: number;
    amount: number;
    line: number;
};
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
    /** Flat grey behind unselected tabs (default #F2F4F6, as in the shopping tab) and behind a loading icon. */
    chipBg?: string;
    thumbBg?: string;
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
    reload(): void; /** quiet refetch, keeps the current rows */
    refresh(): void;
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
    /** A row of the 「무료체험」 tab was tapped (the app asks for the cancel-notice consent, then opens the campaign). Without it `onPressMission` gets the row as a mission. */
    onPressTrial?: (trial: ComboTrial) => void;
};
/**
 * A campaign's icon (`mission.icon`, https only), else the first letter of the name on a soft circle; a picture that fails to load
 * falls back to the letter too. Not used in the list rows now (they show numbers, 대표님 10/27); kept for places that want a picture.
 */
export declare function ComboMissionIcon({ name, uri, size, theme }: {
    name: string;
    uri?: string;
    size?: number;
    theme?: ComboTheme;
}): ReactElement;
/**
 * The guide page. With the server's `categories` it is one tab per category (see comboCategories.ts); without them the steps screen
 * (쉽게 모으기 · 1천 · 5천 · 1만P · 무료체험), exactly as before. No hooks here, so the two can swap when the server's answer changes.
 */
export declare function ComboGuideScreen(props: ComboGuideScreenProps): ReactElement;
/**
 * The steps screen, laid out like the shopping tab: white, a thin title row, small flat tabs (쉽게 모으기 · 1천 · 5천 · 1만P), a
 * one-line total, and a plain list: number, name + what to do, +points, a small check. The whole row is the button.
 */
export declare function ComboStepsScreen({ combos, loading, onClose, onPressMission, usn, theme, showHeader, topInset, variant, hint, done, onToggleDone, onPressTrial }: ComboGuideScreenProps): ReactElement;
export {};
