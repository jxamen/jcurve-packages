/**
 * 0.4.0, iOS: sends the campaign list the web tap read (`webTap.ts`) to the app's server — rarely, and only when it changed.
 *
 * The page loads the list every time the wall opens, so messages arrive often; the server only needs it about once a day (it uses a key once two different members
 * have sent it). So: at most one upload per `minGapMs`, nothing when the list is the same as the one already sent today, and a detail message's text is
 * merged into the next upload instead of causing one of its own. A failed upload is tried again later (three times in all per start).
 *
 * Public campaign data only — see `campaignsBody` for the fields. No member, device or advertising id is ever in the list.
 */
import type { ComboStorage } from './comboDone';
import { type CampaignBodyItem } from './connector';
import type { TapMessage } from './webTap';
export declare const TAP_UPLOAD_MIN_GAP_MS: number;
export declare const TAP_UPLOAD_DEBOUNCE_MS = 8000;
export declare const tapUploadStorageKey: (scope: string | number | undefined) => string;
export type TapUploaderOptions = {
    upload: (body: {
        campaigns: CampaignBodyItem[];
    }) => Promise<unknown>;
    storage?: ComboStorage;
    /** Whose upload record this is (the member id). */
    scope?: string | number;
    now?: () => number;
    minGapMs?: number;
    debounceMs?: number;
    setTimer?: (fn: () => void, ms: number) => unknown;
    clearTimer?: (handle: unknown) => void;
};
export type TapUploadResult = 'sent' | 'unchanged' | 'empty' | 'error';
export type TapUploader = {
    handle(message: TapMessage): void;
    flush(): Promise<TapUploadResult>;
    stop(): void;
};
/** A short, stable fingerprint of a body (djb2 over its JSON) — only to tell "same as the last upload" from "changed". */
export declare function bodySignature(body: unknown): string;
export declare function createTapUploader({ upload, storage, scope, now, minGapMs, debounceMs, setTimer, clearTimer, }: TapUploaderOptions): TapUploader;
