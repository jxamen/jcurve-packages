/**
 * 0.5.0 — 스냅플레이(SnapPlay) 오퍼월 제공자. 찬스 화면의 「찬스2」 탭이 이것이다. SDK 는 `react-native-s2offerwall`(네이티브 모듈 `S2OfferwallModule`)이고
 * **스토어 빌드에 들어가야** 쓸 수 있다. 이 파일은 JS 라서 OTA 로 나가도 되고, 네이티브가 없는 옛 빌드에서는 제공자가 「쓸 수 없음」이라 탭이 나오지 않는다.
 *
 * 지키는 것:
 *  - 모듈 유무는 `NativeModules` 속성 조회로만 본다. 없으면 `require('react-native-s2offerwall')` 도 하지 않는다(그 패키지는 모듈이 없으면 불러오는 순간 던진다).
 *  - 앱 ID 는 서버 설정에서 읽는다(`resolveSnapPlayConfig`) — 앱 안에 박지 않는다. 콜백 키(`verify_cd` 검증용)는 서버만 알고 앱에는 오지 않는다.
 *  - 회원 식별값(`setUserName`)은 오퍼월 별칭 `usn`(64자 SHA256 hex) — 실제 회원 번호 · 전화번호 · 이메일이 아니다.
 *  - SDK 순서: 앱 ID → 이벤트 듣기(`onInitCompleted` · `onLoginRequested`) → `initSdk()` → 초기화 완료 → `setUserName` → `showOfferwall`.
 *    (iOS 모듈은 JS 가 듣기 시작한 뒤에만 이벤트를 내보낸다 — 듣기가 `initSdk()` 보다 먼저여야 한다.)
 *  - `removeAllListeners()` 는 부르지 않는다(앱의 다른 SDK 이벤트까지 지워진다). ATT 창(`presentATTPopup`)도 부르지 않는다 — 광고 패키지가 이미 앱 시작에 띄운다.
 *  - 앱 리워드 광고(`onRewardedAdRequested`)는 연결하지 않는다: 안 달면 SDK 가 알아서 「광고 없음」으로 답하고 웹 광고로 넘어간다.
 */
import { notifyChanceProviders, registerChanceProvider, type ChanceContext, type ChanceResult } from './chanceProviders';

export const SNAPPLAY_PROVIDER_ID = 'snapplay';
/** 스냅플레이 RN 플러그인이 내놓는 네이티브 모듈 이름(Android `getName()` · iOS `RCT_EXPORT_MODULE()` 가 같다). */
export const SNAPPLAY_NATIVE_MODULE = 'S2OfferwallModule';
export const SNAPPLAY_DEFAULT_PLACEMENT = 'main';
export const SNAPPLAY_INIT_TIMEOUT_MS = 10_000;
/** 0.6.0 — the native view (`JCurveSnapPlayViewManager`, Android + iOS) that shows SnapPlay's own screen inside the tab. Only in builds made with 0.6.0 and the SnapPlay SDK. */
export const SNAPPLAY_VIEW_NAME = 'JCurveSnapPlayView';

/** 서버가 앱마다 · OS 마다 주는 값. 앱 ID 가 없는 OS 에서는 제공자가 꺼진다. */
export type SnapPlayServerConfig = {
  android: string; ios: string; placement: string; enabled: boolean;
  /** 0.6.0 — `false` 면 탭 안에 끼우지 않고 전체 화면(모달)으로 연다(서버에서 끄는 스위치; 기본 true) */
  embed: boolean;
  /**
   * 0.6.2 — 광고 목록 읽기 · 추천 미션 직접 열기에 쓰는 플레이스먼트. 스냅플레이 문서가 목록용으로 "main" 을 못 쓰게 해서, 콘솔에서 따로 만든 이름을 서버가 `listPlacement` 로 준다.
   * 비어 있으면 직접 열기는 꺼지고(찬스2 탭으로만 보냄) 목록도 읽지 않는다.
   */
  listPlacement: string;
  /**
   * 0.6.8 — 찬스2 를 이 회원에게 연다(서버의 허용 목록 · 테스트 회원). 없거나 `true` 가 아니면 닫힘: 탭은 「준비 중입니다」 만 보여 준다.
   * 설정은 앱이 받을 때 한 번 정해지니, 회원을 넣거나 빼면 그 뒤 앱을 다시 열어야 한다.
   */
  open: boolean;
};

const ID_PATTERN = /^[^\s\u0000-\u001f]{4,200}$/;
const PLACEMENT_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function pickId(value: unknown): string {
  const raw = typeof value === 'string' ? value : (value && typeof value === 'object'
    ? ((value as Record<string, unknown>).appId ?? (value as Record<string, unknown>).mediaKey ?? (value as Record<string, unknown>).appKey) : '');
  const id = typeof raw === 'string' ? raw.trim() : '';
  return ID_PATTERN.test(id) ? id : '';
}

function pickListPlacement(root: Record<string, unknown>): string {
  const raw = [root.listPlacement, root.list_placement, root.dataPlacement].find((value) => typeof value === 'string') as string | undefined;
  const name = (raw ?? '').trim();
  return PLACEMENT_PATTERN.test(name) && name !== SNAPPLAY_DEFAULT_PLACEMENT ? name : '';
}

/**
 * 서버 응답 → 설정. `{ ok: true, config: { android: { appId }, ios: { appId }, placement?, enabled? } }` 모양을 받고, `config` 없이 같은 칸이 바로 와도,
 * `appId` 대신 `mediaKey` 라고 와도, OS 값이 문자열 하나여도 읽는다. `ok:false` · 앱 ID 가 둘 다 없음 · 모양이 다름이면 null.
 */
export function parseSnapPlayConfig(data: unknown): SnapPlayServerConfig | null {
  if (!data || typeof data !== 'object') return null;
  const top = data as Record<string, unknown>;
  if (top.ok === false) return null;
  const root = (top.config && typeof top.config === 'object' ? top.config : top) as Record<string, unknown>;
  const android = pickId(root.android);
  const ios = pickId(root.ios);
  if (!android && !ios) return null;
  const placementRaw = typeof root.placement === 'string' ? root.placement : typeof root.placementName === 'string' ? root.placementName : '';
  return {
    android, ios,
    placement: PLACEMENT_PATTERN.test(placementRaw.trim()) ? placementRaw.trim() : SNAPPLAY_DEFAULT_PLACEMENT,
    enabled: root.enabled !== false,
    embed: root.embed !== false,
    listPlacement: pickListPlacement(root),
    open: root.open === true,
  };
}

let config: SnapPlayServerConfig | null = null;
/** 앱이 설정 값을 직접 넣을 때(시험 · 서버 없이 쓰는 앱). 모양은 `parseSnapPlayConfig` 와 같다. 못 읽으면 설정을 비운다. */
export function configureSnapPlay(raw: unknown): boolean {
  config = parseSnapPlayConfig(raw);
  notifyChanceProviders();
  return config !== null;
}

type Api = {
  setAppIdForAndroid(id: string): Promise<void>; setAppIdForIOS(id: string): Promise<void>;
  initSdk(): Promise<void>; showOfferwall(placement: string): Promise<void>;
  setUserName(userName: string, displayName?: string): Promise<void>; resetUserName(): Promise<void>;
  /** 0.6.2 — Data API(플러그인 1.0.38 에 있음). 옛 플러그인에 없으면 직접 열기가 꺼진다. */
  requestOfferwallData?(placementName: string, isEmbeded: boolean): Promise<string>;
  openAdItem?(advId: number, needDetail: boolean, placementFrom: string): Promise<void>;
  onInitCompleted(callback: (event: { flag?: boolean }) => void): unknown;
  onLoginRequested(callback: (event: unknown) => void): unknown;
};

/** 0.6.12: the app is in the foreground. Without AppState (tests, odd hosts) it counts as active. */
export function appIsActive(): boolean {
  try {
    const { AppState } = require('react-native') as typeof import('react-native');
    return !AppState || AppState.currentState == null || AppState.currentState === 'active';
  } catch { return true; }
}

function platform(): 'ios' | 'android' | null {
  try {
    const os = (require('react-native') as typeof import('react-native')).Platform.OS;
    return os === 'ios' || os === 'android' ? os : null;
  } catch { return null; }
}
/** 이 빌드에 스냅플레이 네이티브 모듈이 들어 있는가 — `NativeModules` 속성 조회뿐, `require` 없음. */
export function hasSnapPlayNative(): boolean {
  try {
    const { NativeModules } = require('react-native') as typeof import('react-native');
    const mod = (NativeModules as Record<string, unknown> | undefined)?.[SNAPPLAY_NATIVE_MODULE];
    return !!mod && typeof mod === 'object';
  } catch { return false; }
}
let apiCache: Api | null | undefined;
function api(): Api | null {
  if (!hasSnapPlayNative()) return null;
  if (apiCache === undefined) {
    try { apiCache = ((require('react-native-s2offerwall') as { S2Offerwall?: Api }).S2Offerwall) ?? null; } catch { apiCache = null; }
  }
  return apiCache;
}
function appId(): string {
  const os = platform();
  return !config || !config.enabled || !os ? '' : config[os];
}

export type SnapPlayStatus = { native: boolean; configured: boolean; enabled: boolean; hasAppId: boolean; initialized: boolean; placement: string; /** 0.6.2 — 목록 읽기 · 직접 열기가 가능한가(플러그인에 Data API 가 있고 서버가 `listPlacement` 를 줬다) */ directOpen: boolean };
/** 진단용(값은 내보내지 않는다): 네이티브 모듈이 있는지 · 설정이 왔는지 · 이 OS 의 앱 ID 가 있는지 · 초기화가 끝났는지. */
export function snapPlayStatus(): SnapPlayStatus {
  return { native: hasSnapPlayNative(), configured: config !== null, enabled: config?.enabled === true, hasAppId: appId() !== '', initialized: inited, placement: config?.placement ?? SNAPPLAY_DEFAULT_PLACEMENT, directOpen: directOpenAvailable() };
}

/**
 * 서버 설정을 받아 둔다 — `fetcher` 는 앱이 준다(앱 서버 주소 · 토큰을 패키지가 모르게): `content/config/snapplay` 응답 JSON 을 돌려준다.
 * 이미 설정이 있으면 다시 받지 않는다. 실패하면 조용히 그대로(탭이 안 나올 뿐). 네이티브 모듈이 없는 빌드에서는 받지도 않는다.
 */
export async function resolveSnapPlayConfig(fetcher: () => Promise<unknown>): Promise<SnapPlayStatus> {
  if (config === null && hasSnapPlayNative()) {
    try { const parsed = parseSnapPlayConfig(await fetcher()); if (parsed) { config = parsed; notifyChanceProviders(); } } catch { /* 설정을 못 받으면 탭이 없을 뿐 */ }
  }
  return snapPlayStatus();
}

/* ── SDK 준비 ─────────────────────────────────────────────────────────────────────────────── */

let bound = false;
let waiter: ((ok: boolean) => void) | null = null;
let initializing: Promise<boolean> | null = null;
let inited = false;
let userKey = '';
let latest: ChanceContext | null = null;

function bind(sdk: Api): void {
  if (bound) return;
  sdk.onInitCompleted((event) => { const done = waiter; waiter = null; done?.(event?.flag !== false); });
  // 회원이 아직 안 정해진 채 참여하려 하면 SDK 가 로그인을 요청한다 — 가장 최근에 받은 회원으로 답한다.
  sdk.onLoginRequested(() => { const who = latest; if (who) Promise.resolve(sdk.setUserName(who.usn, who.displayName ?? '')).catch(() => {}); });
  bound = true;
}

function initialize(sdk: Api, id: string): Promise<boolean> {
  if (initializing) return initializing;
  initializing = (async () => {
    bind(sdk);
    const done = new Promise<boolean>((resolve) => { waiter = resolve; });
    await (platform() === 'ios' ? sdk.setAppIdForIOS(id) : sdk.setAppIdForAndroid(id));
    await sdk.initSdk();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const ok = await Promise.race([done, new Promise<boolean>((resolve) => { timer = setTimeout(() => resolve(false), SNAPPLAY_INIT_TIMEOUT_MS); })]);
    if (timer) clearTimeout(timer);
    waiter = null;
    if (ok) inited = true; else initializing = null;   // 실패하면 다음에 다시 시도한다
    return ok;
  })().catch(() => { waiter = null; initializing = null; return false; });
  return initializing;
}

const NOT_READY: ChanceResult = { ok: false, reason: 'not_ready', message: '잠시 후 다시 시도해 주세요' };
const validUsn = (usn: unknown): usn is string => typeof usn === 'string' && /^[a-f0-9]{64}$/.test(usn);

async function prepare(context: ChanceContext): Promise<ChanceResult> {
  const sdk = api();
  const id = appId();
  if (!sdk || !id) return NOT_READY;
  if (!validUsn(context.usn)) return { ok: false, reason: 'invalid_usn', message: '회원 정보를 확인해 주세요' };
  latest = context;
  try {
    if (!(await initialize(sdk, id))) return NOT_READY;
    const key = context.usn + '\n' + (context.displayName ?? '');
    if (key !== userKey) { await sdk.setUserName(context.usn, context.displayName ?? ''); userKey = key; }
    return { ok: true };
  } catch { return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }; }
}

async function open(context: ChanceContext): Promise<ChanceResult> {
  if (!appIsActive()) return { ok: false, reason: 'not_ready', message: '잠시 후 다시 시도해 주세요' };
  const ready = await prepare(context);
  if (!ready.ok) return ready;
  try { await api()?.showOfferwall(config?.placement ?? SNAPPLAY_DEFAULT_PLACEMENT); return { ok: true }; }
  catch { return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }; }
}

/** 로그아웃 · 회원 바뀜: SDK 에 남은 회원을 지운다(초기화한 적이 없으면 아무것도 안 한다). `resetOfferwall()` 이 부른다. */
export function forgetSnapPlayUser(): void {
  latest = null;
  userKey = '';
  adsCache = null;
  // 0.6.10: the server's answer (`open`, the app IDs, listPlacement) is per member: a new member (or a logout) asks again, so a member's `open` never carries over.
  if (config !== null) { config = null; notifyChanceProviders(); }
  if (!inited) return;
  try { Promise.resolve(api()?.resetUserName()).catch(() => {}); } catch { /* 지우지 못해도 다음 열기에서 새 회원으로 다시 설정한다 */ }
}
/** 설정까지 모두 비운다(앱 바뀜 · 시험). SDK 초기화 상태는 프로세스가 사는 동안 유지된다. */
export function resetSnapPlay(): void { forgetSnapPlayUser(); config = null; adsFlight = null; notifyChanceProviders(); }

/* ── 0.6.2: 광고 목록 읽기 · 추천 미션 직접 열기 ──────────────────────────────────────────────── */

/** SDK 의 Data API 가 주는 광고 한 건(필요한 칸만). `advId` 가 캠페인 키이고 `openAdItem` 에 그대로 쓴다. */
export type SnapPlayAd = {
  advId: string; title: string; description: string;
  /** 목록의 `user_pnt`(사용자 적립 포인트) — 전환 비율이 이미 반영된 값인지는 문서에 없다. 실기기에서 같은 광고의 화면 표시와 비교해 확인한다. */
  points: number;
  /** `org_user_pnt` — 2배 이벤트 같은 때의 원래 값(없으면 `points`) */
  originalPoints: number;
  unit: string; icon: string; feed: string;
  advType: number; actionType: number; actions: number;
  /** `detail_yn === 'Y'`: 상세 화면이 있다(`openAdItem` 의 `needDetail`) */
  detail: boolean;
  /** `adid_yn === 'Y'`: 광고 ID 가 있어야 참여할 수 있는 광고 */
  needsAdid: boolean;
};
export const SNAPPLAY_LIST_TIMEOUT_MS = 6_000;
/** 읽은 목록을 이만큼(ms) 다시 쓴다 — 미션을 연달아 누를 때마다 SDK 를 부르지 않게. */
export const SNAPPLAY_LIST_TTL_MS = 60_000;
const MAX_ADS = 500;

const finiteNumber = (value: unknown): number => {
  const n = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  return Number.isFinite(n) ? n : NaN;
};
const plain = (value: unknown, max: number): string => (typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max) : '');
const httpsUrl = (value: unknown): string => { const text = plain(value, 600); return /^https:\/\//i.test(text) ? text : ''; };

/**
 * `requestOfferwallData` 의 JSON 문자열(또는 이미 읽은 객체) → 광고 목록. `ret_cd` 가 0 이 아니거나 `ret_list` 가 배열이 아니면 null(= 목록을 못 읽음, 빈 목록과 다르다).
 * 광고 번호가 없거나 제목이 없는 건은 버리고, 같은 번호는 한 번만, 최대 500건.
 */
export function parseSnapPlayAds(raw: unknown): SnapPlayAd[] | null {
  let body: unknown = raw;
  if (typeof raw === 'string') { try { body = JSON.parse(raw); } catch { return null; } }
  if (!body || typeof body !== 'object') return null;
  const top = body as Record<string, unknown>;
  if (finiteNumber(top.ret_cd) !== 0 || !Array.isArray(top.ret_list)) return null;
  const seen = new Set<string>();
  const ads: SnapPlayAd[] = [];
  for (const item of top.ret_list) {
    if (ads.length >= MAX_ADS) break;
    if (!item || typeof item !== 'object') continue;
    const ad = item as Record<string, unknown>;
    const id = finiteNumber(ad.adv_id);
    const title = plain(ad.adv_title, 80);
    if (!Number.isSafeInteger(id) || id <= 0 || !title || seen.has(String(id))) continue;
    seen.add(String(id));
    const points = finiteNumber(ad.user_pnt);
    const original = finiteNumber(ad.org_user_pnt);
    ads.push({
      advId: String(id), title, description: plain(ad.adv_desc, 200),
      points: points >= 0 ? points : 0, originalPoints: original >= 0 ? original : points >= 0 ? points : 0,
      unit: plain(ad.pnt_unit, 12), icon: httpsUrl(ad.icon_img_url), feed: httpsUrl(ad.feed_img_url),
      advType: finiteNumber(ad.adv_type) || 0, actionType: finiteNumber(ad.actn_type) || 0, actions: finiteNumber(ad.num_actions) || 1,
      detail: ad.detail_yn === 'Y', needsAdid: ad.adid_yn === 'Y',
    });
  }
  return ads;
}

/** 목록 읽기 · 직접 열기에 필요한 것이 다 있는가: 이 OS 의 앱 ID, 서버가 준 목록용 플레이스먼트, 플러그인의 Data API. */
function directOpenAvailable(): boolean {
  try {
    const sdk = api();
    return !!sdk && appId() !== '' && !!config?.listPlacement && typeof sdk.requestOfferwallData === 'function' && typeof sdk.openAdItem === 'function';
  } catch { return false; }
}

let adsCache: { at: number; placement: string; ads: SnapPlayAd[] } | null = null;
let adsFlight: Promise<SnapPlayAd[] | null> | null = null;

export type SnapPlayAdsResult =
  | { ok: true; ads: SnapPlayAd[]; cached: boolean }
  | { ok: false; reason: 'unsupported' | 'not_ready' | 'invalid_usn' | 'list_failed' };

/**
 * 스냅플레이 SDK 에서 지금 참여할 수 있는 광고 목록을 읽는다(`requestOfferwallData(listPlacement, false)` = 전체 목록). 먼저 SDK 를 준비한다(앱 ID · 회원).
 * 같은 목록을 `SNAPPLAY_LIST_TTL_MS` 동안 다시 쓰고, 동시에 부르면 한 번만 읽는다. 목록은 OS · 기기에 따라 다르다. 던지지 않는다.
 */
export async function readSnapPlayAds(context?: ChanceContext, opts: { fresh?: boolean } = {}): Promise<SnapPlayAdsResult> {
  if (!appIsActive()) return { ok: false, reason: 'not_ready' };
  const sdk = api();
  const placement = config?.listPlacement ?? '';
  if (!sdk || !placement || !config?.enabled || appId() === '' || typeof sdk.requestOfferwallData !== 'function') return { ok: false, reason: 'unsupported' };
  const who = context ?? latest;
  if (!who) return { ok: false, reason: 'not_ready' };
  const ready = await prepare(who);
  if (!ready.ok) return { ok: false, reason: ready.reason === 'invalid_usn' ? 'invalid_usn' : 'not_ready' };
  if (!opts.fresh && adsCache && adsCache.placement === placement && Date.now() - adsCache.at < SNAPPLAY_LIST_TTL_MS) return { ok: true, ads: adsCache.ads, cached: true };
  const request = sdk.requestOfferwallData.bind(sdk);
  if (!adsFlight) {
    adsFlight = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        const text = await Promise.race([request(placement, false), new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), SNAPPLAY_LIST_TIMEOUT_MS); })]);
        const ads = text === null ? null : parseSnapPlayAds(text);
        if (ads) adsCache = { at: Date.now(), placement, ads };
        return ads;
      } catch { return null; } finally { if (timer) clearTimeout(timer); adsFlight = null; }
    })();
  }
  const ads = await adsFlight;
  return ads ? { ok: true, ads, cached: false } : { ok: false, reason: 'list_failed' };
}

export type SnapPlayOpenResult =
  | { ok: true; listCount: number }
  /** `gone`: 방금 읽은 최신 목록에 그 광고가 없다(마감되었거나 이 기기에 해당 없음). `unsupported`/`list_failed`/`not_ready`/`invalid_usn`/`sdk_error`: 직접 열 수 없었다 — 앱은 찬스2 탭 목록으로 안내한다. */
  | { ok: false; reason: 'unsupported' | 'not_ready' | 'invalid_usn' | 'list_failed' | 'gone' | 'sdk_error'; listCount: number };

/**
 * 추천 미션 → 그 광고의 SDK 화면(`openAdItem`). 광고 번호가 방금 읽은 목록에 있는지 먼저 본다 — 목록에서 상세 화면 여부(`detail_yn`)를 알아야 하고, 없으면 마감으로 본다.
 * 캐시된 목록에 없으면 한 번 새로 읽고 나서 판단한다. SDK 가 화면을 열었는지는 돌려주지 않으므로 `ok` 는 「열기를 요청했다」까지다. 던지지 않는다.
 */
export async function openSnapPlayAd(advId: string | number, context?: ChanceContext): Promise<SnapPlayOpenResult> {
  const id = typeof advId === 'number' ? advId : /^\d{1,16}$/.test(String(advId).trim()) ? Number(String(advId).trim()) : NaN;
  // 0.6.12: never present the SDK's screen while the app is going to the background or not on screen (an iOS crash while backgrounding)
  if (!appIsActive()) return { ok: false, reason: 'not_ready', listCount: 0 };
  const sdk = api();
  const placement = config?.listPlacement ?? '';
  if (!Number.isSafeInteger(id) || id <= 0 || !sdk || !placement || typeof sdk.openAdItem !== 'function') return { ok: false, reason: 'unsupported', listCount: 0 };
  try {
    let read = await readSnapPlayAds(context);
    if (!read.ok) return { ok: false, reason: read.reason, listCount: 0 };
    let ad = read.ads.find((item) => item.advId === String(id));
    if (!ad && read.cached) {
      read = await readSnapPlayAds(context, { fresh: true });
      if (!read.ok) return { ok: false, reason: read.reason, listCount: 0 };
      ad = read.ads.find((item) => item.advId === String(id));
    }
    if (!ad) return { ok: false, reason: 'gone', listCount: read.ads.length };
    await sdk.openAdItem(id, ad.detail, placement);
    return { ok: true, listCount: read.ads.length };
  } catch { return { ok: false, reason: 'sdk_error', listCount: 0 }; }
}

/** 이 빌드에 스냅플레이 화면 뷰가 있는가 — `UIManager` 의 뷰 목록 조회뿐(없으면 false, 던지지 않음). */
export function snapPlayViewAvailable(): boolean {
  if (!hasSnapPlayNative() || config?.embed === false) return false;
  try {
    const { UIManager } = require('react-native') as typeof import('react-native');
    return !!UIManager?.getViewManagerConfig?.(SNAPPLAY_VIEW_NAME);
  } catch { return false; }
}
// 뷰 안의 스냅플레이 화면이 「로그인이 필요해요」 라고 하면 가장 최근 회원으로 답한다(전체 화면일 때의 onLoginRequested 와 같다).
function answerLogin(): void {
  const sdk = api();
  const who = latest;
  if (sdk && who) Promise.resolve(sdk.setUserName(who.usn, who.displayName ?? '')).catch(() => {});
}
let nativeView: import('react').ComponentType<Record<string, unknown>> | undefined;
/** 스냅플레이 화면을 끼워 넣는 네이티브 뷰. `prepare`(SDK 시작 · 회원 설정) 뒤에 그린다. */
export function SnapPlayView({ onClose, style }: { onClose?: () => void; style?: unknown }): import('react').ReactElement | null {
  const React = require('react') as typeof import('react');
  if (!snapPlayViewAvailable()) return null;
  const rn = require('react-native') as typeof import('react-native');
  nativeView ??= rn.requireNativeComponent(SNAPPLAY_VIEW_NAME) as import('react').ComponentType<Record<string, unknown>>;
  return React.createElement(nativeView, {
    style: [{ flex: 1 }, style], placement: config?.placement ?? SNAPPLAY_DEFAULT_PLACEMENT,
    onLoginRequested: () => answerLogin(), onCloseRequested: () => { try { onClose?.(); } catch { /* 닫기 처리가 화면을 깨지 않게 */ } },
  });
}

registerChanceProvider({
  id: SNAPPLAY_PROVIDER_ID, name: '스냅플레이', kind: 'launcher',
  available: () => hasSnapPlayNative() && appId() !== '' && api() !== null,
  // 0.6.8: 허용 목록에 없는 회원에게는 「준비 중입니다」 (서버의 `open: true` 가 있어야 연다)
  closed: () => config?.open !== true,
  prepare, open,
  canEmbed: snapPlayViewAvailable,
  embed: ({ onClose }) => (snapPlayViewAvailable() ? (require('react') as typeof import('react')).createElement(SnapPlayView, { onClose }) : null),
});
