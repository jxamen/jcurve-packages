import React from 'react';
import { type InboxApi, type InboxItem, type InboxStrings, type InboxTheme } from './core';
export * from './core';
export type InboxScreenProps = {
    api: InboxApi;
    theme?: Partial<InboxTheme>;
    strings?: Partial<InboxStrings>;
    onOpen: (item: InboxItem) => void;
    onBack?: () => void;
    topInset?: number;
    isFocused?: boolean;
};
export declare function InboxScreen({ api, theme, strings, onOpen, onBack, topInset, isFocused }: InboxScreenProps): React.JSX.Element;
export declare function BellDot({ count }: {
    count: number;
}): React.JSX.Element | null;
export declare function useInboxUnread(api: InboxApi, { refreshKey }?: {
    refreshKey?: unknown;
}): number;
