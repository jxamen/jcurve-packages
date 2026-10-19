export type InboxItem = {
    id: number;
    kind: 'general' | 'shopping' | 'ad';
    title: string;
    body: string;
    data: Record<string, unknown>;
    link: string | null;
    read: boolean;
    readAt: string | null;
    sentAt: string;
};
export type Resp = {
    ok: boolean;
    items: InboxItem[];
    unread: number;
    next?: number;
};
export type InboxApi = {
    list(cursor?: number): Promise<Resp>;
    unread(): Promise<number>;
    read(ids?: number[], all?: boolean): Promise<number>;
};
export type InboxApiOptions = {
    basePath?: string;
};
export declare function createInboxApi(fetchJson: (method: string, path: string, body?: any) => Promise<any>, options?: InboxApiOptions): InboxApi;
export declare const defaultStrings: {
    title: string;
    back: string;
    empty: string;
    error: string;
    retry: string;
    ad: string;
    now: string;
    minutes: (n: number) => string;
    hours: (n: number) => string;
    yesterday: string;
    date: (m: number, d: number) => string;
};
export type InboxStrings = typeof defaultStrings;
export declare const defaultTheme: {
    bg: string;
    card: string;
    text: string;
    sub: string;
    line: string;
    primary: string;
    unreadDot: string;
    adBadgeBg: string;
    adBadgeText: string;
    radius: number;
};
export type InboxTheme = typeof defaultTheme;
export declare function relativeTime(sentAt: string, now?: Date, strings?: Partial<InboxStrings>): string;
export declare function hasDestination(item: InboxItem): boolean;
export type InboxState = {
    items: InboxItem[];
    expanded: number[];
    unread: number;
    next?: number;
    loading: boolean;
    error: boolean;
};
/** Read rows stay hidden while requests or stale pages are in flight. */
export declare function createInboxStore(api: InboxApi): {
    getSnapshot: () => InboxState;
    subscribe: (fn: () => void) => () => void;
    load(more?: boolean): Promise<void>;
    markRead: (item: InboxItem) => Promise<void>;
    press(item: InboxItem, onOpen: (item: InboxItem) => void): void;
    leave(): void;
};
