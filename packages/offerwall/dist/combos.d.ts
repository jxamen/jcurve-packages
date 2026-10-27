/** Daily point combos for the Chance tab. Pure JS (OTA-safe); it only shows server data and never grants points. */
import type { ReactElement } from 'react';
export type ComboLevel = 'easy' | 'normal' | 'hard';
export type ComboMission = {
    id: string;
    name: string;
    points: number;
    todo: string;
    level: ComboLevel;
    minutes?: number;
};
export type ComboBundle = {
    goal: number;
    missions: ComboMission[];
    total: number;
};
/** Server switches. chance: the entry shown in the Chance tab; home: the optional banner on Home. */
export type ComboDisplay = {
    chance: 'card' | 'banner' | 'off';
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
/** Yesterday's combos must not be shown as today's. A missing date is treated as fresh. */
export declare function isTodayCombos(combos: TodayCombos, now?: number): boolean;
export declare function formatPoints(n: number): string;
/** 1000 → 1천, 5000 → 5천, 10000 → 1만, anything else → 1,500P */
export declare function formatGoal(goal: number): string;
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
/** Fixed data for building the screen before the API exists. Only `sample: true` ever shows it. */
export declare const TODAY_COMBOS_SAMPLE: TodayCombos;
export type TodayCombosState = {
    status: 'loading' | 'ready' | 'empty';
    combos: TodayCombos | null;
    reload(): void;
};
/**
 * Loads today's combos. Without `url` nothing is shown unless `sample` is true (screen work only),
 * so users never see example rows as if they were real.
 */
export declare function useTodayCombos({ url, headers, sample }: {
    url?: string;
    headers?: Record<string, string>;
    sample?: boolean;
}): TodayCombosState;
export type TodayComboCardProps = {
    combos: TodayCombos;
    onPress: () => void;
    accentColor?: string;
};
/** Entry card above the wall list. Tapping it opens the guide screen. */
export declare function TodayComboCard({ combos, onPress, accentColor }: TodayComboCardProps): ReactElement;
export type TodayComboScreenProps = {
    /** null while loading or when there is nothing for today; the screen then shows a short message. */
    combos: TodayCombos | null;
    loading?: boolean;
    onClose: () => void;
    /** Opens the matching item. Without it, `usn` opens the whole list instead (the SDK cannot jump to one item). */
    onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
    usn?: string | null;
    accentColor?: string;
    showHeader?: boolean;
    topInset?: number;
};
export declare function TodayComboScreen({ combos, loading, onClose, onPressMission, usn, accentColor, showHeader, topInset }: TodayComboScreenProps): ReactElement;
export {};
