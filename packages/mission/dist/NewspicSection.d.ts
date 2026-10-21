import React from 'react';
import type { Requester } from './entry';
export type NewspicItem = {
    id: string;
    title: string;
    source: string;
    thumbnail: string;
    url: string;
};
type Feed = {
    items: NewspicItem[];
    message: string;
};
export declare function isNewspicUrl(value: unknown): value is string;
export declare function parseNewspicFeed(value: unknown): Feed | null;
/** Metadata only. Articles open exclusively from the user's press in an external browser. */
export declare function NewspicSection({ fetchJson, refreshKey }: {
    fetchJson: Requester;
    refreshKey?: unknown;
}): React.JSX.Element | null;
export {};
