export type EmbeddedDetailRequest = {
    key: string;
    nonce: number;
};
type Show = (request: EmbeddedDetailRequest | null) => void;
/** How long the embedded detail may take to report "loaded" before the caller gives up and opens the SDK's full-screen detail. */
export declare const EMBEDDED_DETAIL_TIMEOUT_MS = 10000;
/** iOS with the native bridge: the only place the embedded wall can take a detail key. Never throws. */
export declare function embeddedDetailSupported(): boolean;
/** A mounted wall that can show a detail registers here; the last one registered answers. Returns the unregister function. */
export declare function registerEmbeddedWall(show: Show): () => void;
/** True when a wall is mounted that can open a detail. */
export declare function embeddedDetailAvailable(): boolean;
/**
 * Asks the mounted wall to show this campaign's detail. Resolves true once the wall reports it loaded; false when no wall
 * is mounted, the wall fails, or `timeoutMs` passes (the wall is then put back to the list). A newer request replaces an older one.
 */
export declare function openEmbeddedDetail(key: string, timeoutMs?: number): Promise<boolean>;
/** The wall calls these from its native view's events. */
export declare function embeddedDetailLoaded(nonce: number): void;
export declare function embeddedDetailFailed(nonce: number): void;
export {};
