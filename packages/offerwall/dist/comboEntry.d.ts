/** Ways into the combo guide: Chance-tab card, Home banner, and a route that popups / pushes / deep links can fire. */
import type { ReactElement } from 'react';
import type { ComboBundle, ComboMission, TodayCombos } from './combos';
/** Route name shared by server popups, pushes and links. Apps use in-app actions, not a URL scheme. */
export declare const COMBOS_ROUTE = "offerwall/combos";
/** Accepts 'offerwall/combos', '/offerwall/combos?from=push' and 'myapp://offerwall/combos'. */
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
export type TodayComboBannerProps = {
    combos: TodayCombos;
    onPress: () => void;
    accentColor?: string;
};
/** One-line strip for Home or the top of the Chance tab. */
export declare function TodayComboBanner({ combos, onPress, accentColor }: TodayComboBannerProps): ReactElement;
export type TodayComboEntryProps = {
    placement: 'chance' | 'home';
    /** Combos API address. Without it nothing shows unless `sample` is true. */
    url?: string;
    headers?: Record<string, string>;
    usn?: string | null;
    accentColor?: string;
    /** Screen work only: shows fixed example rows. Never set this in a release. */
    sample?: boolean;
    /** Opens one item. Without it, `usn` opens the whole list (the SDK cannot jump to one item). */
    onPressMission?: (mission: ComboMission, bundle: ComboBundle) => void;
};
/**
 * Mount once in the Chance tab (above the wall list) and, if wanted, once on Home. The server picks what each shows
 * through `display`. The guide opens over the current screen, so popup / push / link entries work from any tab.
 */
export declare function TodayComboEntry({ placement, url, headers, usn, accentColor, sample, onPressMission }: TodayComboEntryProps): ReactElement | null;
export {};
