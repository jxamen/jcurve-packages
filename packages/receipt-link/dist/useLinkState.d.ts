import type { ReceiptLinkClient } from './client';
import type { LinkState } from './model';
export declare function createUseLinkState(client: Pick<ReceiptLinkClient, 'fetchLinkState'>): () => {
    state: LinkState | null;
    setState: import("react").Dispatch<import("react").SetStateAction<LinkState | null>>;
    loaded: boolean;
};
