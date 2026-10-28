/**
 * 0.4.0 — the app-side glue of 「포인트 빨리 모으기」, now in the package: a small request client, the request bodies, and the push-route helpers.
 * An app gives only its server address and a function that returns its auth headers (see `OfferwallCombos`); nothing else of the glue is the app's.
 *
 * Nothing here carries a member number, device id, advertising id or `usn` in a body: each body below keeps a fixed set of fields and cuts their length.
 */
import type { CampaignInfo } from './campaigns';
import type { ComboDetailSignal, ComboTapDiagnostic } from './comboEntry';
import { isCombosRoute } from './comboEntry';
import type { TapCampaign } from './webTap';

/* ── request client ───────────────────────────────────────────────────────────────────────── */

export type OfferwallClientOptions = {
  /** The app's server address, the part before `offerwall/…` (for example `https://api.example.com/v1/myapp`). http(s) only. */
  serverUrl: string;
  /** The app's own auth headers (app token, member session, device, OTA …), asked for on every request so a fresh login is picked up. */
  getAuthHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** Called when the server answers 401 (the member's session is gone): the app drops it, as it does for its own requests. The request still fails. */
  onUnauthorized?: () => void;
  /** Default 15 s. */
  timeoutMs?: number;
  /** For tests. */
  fetcher?: (url: string, init: { method: string; headers: Record<string, string>; body?: string; signal?: any; cache?: any }) => Promise<{ ok: boolean; status: number; json(): Promise<any> }>;
};
export type OfferwallClient = {
  get<T = unknown>(path: string): Promise<T>;
  post<T = unknown>(path: string, body?: unknown): Promise<T>;
};
/** A failed request: `status` 0 = no answer (network, timeout), else the HTTP status. */
export class OfferwallRequestError extends Error {
  status: number;
  constructor(message: string, status: number) { super(message); this.name = 'OfferwallRequestError'; this.status = status; }
}

const SAFE_PATH = /^[A-Za-z0-9][A-Za-z0-9/_\-.%]*$/;
const cleanHeaders = (raw: unknown): Record<string, string> => {
  const out: Record<string, string> = {};
  if (!raw || typeof raw !== 'object') return out;
  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    if (/^[A-Za-z0-9-]{1,64}$/.test(name) && typeof value === 'string' && value.length <= 4000 && !/[\r\n]/.test(value)) out[name] = value;
  }
  return out;
};

/** The base address with no trailing slash, or '' when it is not an http(s) address. */
export function normalizeServerUrl(serverUrl: unknown): string {
  const url = typeof serverUrl === 'string' ? serverUrl.trim().replace(/\/+$/, '') : '';
  return /^https?:\/\/[^\s/]+(\/\S*)?$/i.test(url) ? url : '';
}

export function createOfferwallClient({ serverUrl, getAuthHeaders, onUnauthorized, timeoutMs = 15_000, fetcher }: OfferwallClientOptions): OfferwallClient {
  const base = normalizeServerUrl(serverUrl);
  const call = async <T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> => {
    if (!base) throw new OfferwallRequestError('no_server', 0);
    if (!SAFE_PATH.test(path) || path.includes('..') || path.includes('//')) throw new OfferwallRequestError('bad_path', 0);
    const headers: Record<string, string> = { Accept: 'application/json', ...cleanHeaders(await getAuthHeaders?.()) };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = typeof AbortController === 'function' ? new AbortController() : undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = (fetcher ?? (fetch as unknown as NonNullable<OfferwallClientOptions['fetcher']>))(`${base}/${path}`, {
        method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: controller?.signal, cache: 'no-store',
      });
      const response = await Promise.race([request, new Promise<never>((_, reject) => {
        timer = setTimeout(() => { controller?.abort(); reject(new OfferwallRequestError('timeout', 0)); }, timeoutMs);
      })]);
      let json: any = null;
      try { json = await response.json(); } catch { /* an empty or invalid body */ }
      if (response.status === 401) { try { onUnauthorized?.(); } catch { /* the app's handler must not change the failure */ } }
      if (!response.ok) throw new OfferwallRequestError(typeof json?.error === 'string' ? json.error.slice(0, 80) : 'http_' + response.status, response.status);
      return json as T;
    } catch (error) {
      if (error instanceof OfferwallRequestError) throw error;
      throw new OfferwallRequestError('network', 0);
    } finally { if (timer) clearTimeout(timer); }
  };
  return { get: <T = unknown>(path: string) => call<T>('GET', path), post: <T = unknown>(path: string, body?: unknown) => call<T>('POST', path, body ?? {}) };
}

/* ── request bodies ───────────────────────────────────────────────────────────────────────── */

/** What `POST offerwall/campaigns` takes per campaign: key, name and reward, and (from a list read out of the web page) optional `info` and `icon`. */
export type CampaignBodyItem = { campaignKey: string; name: string; reward: number; info?: string; icon?: string };
const MAX_CAMPAIGNS = 600;
const reward = (value: unknown): number => Math.max(0, Math.round(Number(String(value ?? '0').replace(/[^0-9.]/g, '')) || 0));

/**
 * `POST offerwall/campaigns` body — the server's shape: campaigns ≤ 600, campaignKey ≤ 128 chars, name ≤ 255, reward a whole number,
 * and optionally `info` (≤ 1500, the campaign's one-line description or participation text) and `icon` (https, ≤ 300: the server keeps no longer ones).
 */
export function campaignsBody(list: ReadonlyArray<CampaignInfo | TapCampaign>): { campaigns: CampaignBodyItem[] } {
  const campaigns: CampaignBodyItem[] = [];
  for (const c of list.slice(0, MAX_CAMPAIGNS) as Array<CampaignInfo & Partial<TapCampaign>>) {
    const campaignKey = String(c.campaignKey ?? '').slice(0, 128);
    const name = String(c.name ?? '').slice(0, 255);
    if (!campaignKey || !name) continue;
    const item: CampaignBodyItem = { campaignKey, name, reward: reward(c.reward) };
    const info = String(c.info ?? c.description ?? '').slice(0, 1500);
    if (info) item.info = info;
    const icon = String(c.icon ?? '');
    if (/^https:\/\/\S+$/i.test(icon) && icon.length <= 300) item.icon = icon;
    campaigns.push(item);
  }
  return { campaigns };
}

const HOW = ['server_key', 'name', 'id_in_list', 'none'] as const;
const count = (n: unknown): number => (typeof n === 'number' && Number.isFinite(n) ? Math.min(1_000_000, Math.max(0, Math.round(n))) : 0);

/** `POST offerwall/combos/diag` body for one 「하러 가기」 tap. Fixed fields only, lengths cut; no member, device or advertising id. */
export function diagBody(d: ComboTapDiagnostic): Record<string, unknown> {
  const body: Record<string, unknown> = {
    t: 'tap',
    mission: String(d.mission ?? '').slice(0, 64),
    name: String(d.name ?? '').slice(0, 100),
    bridge: d.bridge === true,
    listCount: count(d.listCount),
    how: (HOW as readonly string[]).includes(d.how) ? d.how : 'none',
    attempts: count(d.attempts),
    open: d.open === true || d.open === 'error' || d.open === 'skipped' ? d.open : false,
    ms: count(d.ms),
  };
  if (d.listError) body.listError = String(d.listError).slice(0, 80);
  if (Array.isArray(d.listSample)) body.listSample = d.listSample.slice(0, 5).map(s => String(s).slice(0, 40));
  if (d.key) body.key = String(d.key).slice(0, 128);
  if (d.openError) body.openError = String(d.openError).slice(0, 80);
  if (typeof d.openMs === 'number') body.openMs = count(d.openMs);
  if (typeof d.copied === 'boolean') body.copied = d.copied;
  return body;
}

/** What the web tap saw on a test member's phone, for finding out why a list did not arrive (0.4.1). Counts and path names only — no campaign, member or device data. */
export type WebTapSummary = { started: boolean; reason?: string; hello: number; helloHost?: string; lists: number; maxList: number; details: number; natives: number; shapes: number; paths: string[] };
/** `POST offerwall/combos/diag` body for it — fixed fields, lengths cut. */
export function webTapDiagBody(summary: WebTapSummary): Record<string, unknown> {
  const body: Record<string, unknown> = {
    t: 'webtap', started: summary.started === true, hello: count(summary.hello), lists: count(summary.lists), maxList: count(summary.maxList),
    details: count(summary.details), natives: count(summary.natives), shapes: count(summary.shapes),
    paths: Array.isArray(summary.paths) ? summary.paths.slice(0, 12).map(p => String(p).replace(/[?#].*$/, '').slice(0, 120)) : [],
  };
  if (summary.reason) body.reason = String(summary.reason).slice(0, 40);
  if (summary.helloHost) body.helloHost = String(summary.helloHost).slice(0, 80);
  return body;
}

const RESULTS = ['open_failed', 'closed_fast'] as const;
/** `POST offerwall/combos/diag` body for the detail-page signal: four fields only (result, campaignKey, platform, ms). */
export function detailSignalBody(s: ComboDetailSignal): { result: (typeof RESULTS)[number]; campaignKey: string; platform: 'ios' | 'android'; ms: number } {
  return {
    result: (RESULTS as readonly string[]).includes(s.result) ? s.result : 'open_failed',
    campaignKey: String(s.campaignKey ?? '').slice(0, 128),
    platform: s.platform === 'ios' ? 'ios' : 'android',
    ms: count(s.ms),
  };
}

/* ── the 「항상」 popup guard (test members only) ──────────────────────────────────────────── */

type Body = { combos?: { display?: { chance_popup?: unknown } } } | null | undefined;
/** The combos response asks for the recommendation popup on every entry (`display.chance_popup: "always"`, meant for test members). */
export function hasAlwaysPopup(body: unknown): boolean {
  return (body as Body)?.combos?.display?.chance_popup === 'always';
}
/** A copy of the response with 「항상」 turned into the normal rule (`on`); other values and fields stay, the original is not touched. */
export function dropAlwaysPopup(body: unknown): unknown {
  if (!hasAlwaysPopup(body)) return body;
  const b = body as { combos: { display: Record<string, unknown> } } & Record<string, unknown>;
  return { ...b, combos: { ...b.combos, display: { ...b.combos.display, chance_popup: 'on' } } };
}

/* ── the server's switches, read out of the raw response ───────────────────────────────────── */

type Switches = { combos?: { display?: { list_tap?: unknown } }; data?: { display?: { list_tap?: unknown } }; display?: { list_tap?: unknown } } | null | undefined;
/**
 * Did the server switch the iPhone list reading on for this member (`display.list_tap: "on"`)? Anything else (missing, `off`, a typo) is off:
 * the reading never starts without an explicit answer.
 */
export function listTapSwitch(body: unknown): boolean {
  const b = body as Switches;
  return (b?.combos?.display ?? b?.data?.display ?? b?.display)?.list_tap === 'on';
}

/* ── push routes ──────────────────────────────────────────────────────────────────────────── */

/** The campaign key in a notification's data (a string or a number), up to 64 chars; undefined when missing or odd. */
export function pushCampaignKey(data: unknown): string | undefined {
  const raw = data && typeof data === 'object' ? (data as { campaignKey?: unknown }).campaignKey : undefined;
  const key = typeof raw === 'number' && Number.isFinite(raw) ? String(raw) : typeof raw === 'string' ? raw.trim() : '';
  return key && key.length <= 64 ? key : undefined;
}

/** The free-trial list route: 'offerwall/trials' · '/offerwall/trials?from=push' · 'myapp://offerwall/trials' (the same shapes `isCombosRoute` knows). */
export function isTrialsRoute(value: unknown): boolean {
  if (typeof value !== 'string') return false;
  const path = value.trim().replace(/^[a-z][a-z0-9+.-]*:\/\//i, '').replace(/^\/+/, '').split(/[?#]/)[0].replace(/\/+$/, '');
  return path === 'offerwall/trials';
}

export type ComboPushTarget = 'combos' | 'trials';
/**
 * Where a notification's data sends the member inside this package's screens: the free-trial list (`go: 'offerwall/trials'`, or the older
 * `go: 'offerwall/combos'` with a `kind` starting with `trial_`), the 「포인트 빨리 모으기」 guide (`go: 'offerwall/combos'`), or null (not ours).
 */
export function comboPushTarget(data: unknown): ComboPushTarget | null {
  if (!data || typeof data !== 'object') return null;
  const go = (data as { go?: unknown }).go;
  if (isTrialsRoute(go)) return 'trials';
  if (isCombosRoute(go)) {
    const kind = (data as { kind?: unknown }).kind;
    return typeof kind === 'string' && kind.startsWith('trial_') ? 'trials' : 'combos';
  }
  return null;
}
