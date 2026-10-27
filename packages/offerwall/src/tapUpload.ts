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
import { kstDate } from './combos';
import { campaignsBody, type CampaignBodyItem } from './connector';
import type { TapCampaign, TapMessage } from './webTap';

export const TAP_UPLOAD_MIN_GAP_MS = 10 * 60_000;
export const TAP_UPLOAD_DEBOUNCE_MS = 8000;
const MAX_ATTEMPTS = 3;

export const tapUploadStorageKey = (scope: string | number | undefined): string => `jcurve.offerwall.tapupload:${scope ?? ''}`;

export type TapUploaderOptions = {
  upload: (body: { campaigns: CampaignBodyItem[] }) => Promise<unknown>;
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
export type TapUploader = { handle(message: TapMessage): void; flush(): Promise<TapUploadResult>; stop(): void };

/** A short, stable fingerprint of a body (djb2 over its JSON) — only to tell "same as the last upload" from "changed". */
export function bodySignature(body: unknown): string {
  const text = JSON.stringify(body);
  let hash = 5381;
  for (let i = 0; i < text.length; i += 1) hash = ((hash * 33) ^ text.charCodeAt(i)) >>> 0;
  return `${text.length}:${hash.toString(36)}`;
}

export function createTapUploader({
  upload, storage, scope, now = Date.now, minGapMs = TAP_UPLOAD_MIN_GAP_MS, debounceMs = TAP_UPLOAD_DEBOUNCE_MS,
  setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = handle => clearTimeout(handle as ReturnType<typeof setTimeout>),
}: TapUploaderOptions): TapUploader {
  let list: TapCampaign[] = [];
  const info = new Map<string, string>(); // the participation text from detail pages, by campaign key
  let timer: unknown = null;
  let lastSentAt = 0;
  let attempts = 0;
  let stopped = false;
  let busy = false;

  const body = () => campaignsBody(list.map(c => ({ ...c, ...(info.get(c.campaignKey) ? { info: info.get(c.campaignKey) } : {}) })));
  const schedule = () => {
    if (stopped || timer !== null) return;
    const wait = Math.max(debounceMs, lastSentAt ? lastSentAt + minGapMs - now() : 0);
    timer = setTimer(() => { timer = null; void flush(); }, wait);
  };
  const flush = async (): Promise<TapUploadResult> => {
    if (stopped || busy) return 'empty';
    const payload = body();
    if (!payload.campaigns.length) return 'empty';
    const signature = bodySignature(payload);
    const today = kstDate(now());
    try {
      if (storage) {
        const stored = JSON.parse((await storage.getItem(tapUploadStorageKey(scope))) ?? 'null');
        if (stored && stored.sig === signature && stored.date === today) return 'unchanged';
      }
    } catch { /* an unreadable record counts as "nothing sent yet" */ }
    busy = true;
    try {
      await upload(payload);
    } catch {
      busy = false;
      attempts += 1;
      lastSentAt = now();
      if (attempts < MAX_ATTEMPTS) schedule();
      return 'error';
    }
    busy = false;
    attempts = 0;
    lastSentAt = now();
    try { await storage?.setItem(tapUploadStorageKey(scope), JSON.stringify({ date: today, sig: signature })); } catch { /* the next start just sends once more */ }
    return 'sent';
  };

  return {
    handle(message) {
      if (stopped) return;
      if (message.type === 'list') {
        if (!message.campaigns.length) return;
        list = message.campaigns;
        for (const c of list) { const text = c.info ?? ''; if (text) info.set(c.campaignKey, text); }
        schedule();
      } else if (message.type === 'detail') {
        const text = message.campaign.info ?? message.campaign.description ?? '';
        if (text) info.set(message.campaign.campaignKey, text);
        // a detail text only travels with a list upload that is going to happen anyway
        if (list.length) schedule();
      }
    },
    flush,
    stop() { stopped = true; if (timer !== null) { clearTimer(timer); timer = null; } },
  };
}
