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

/** 서버가 앱마다 · OS 마다 주는 값. 앱 ID 가 없는 OS 에서는 제공자가 꺼진다. */
export type SnapPlayServerConfig = { android: string; ios: string; placement: string; enabled: boolean };

const ID_PATTERN = /^[^\s\u0000-\u001f]{4,200}$/;
const PLACEMENT_PATTERN = /^[A-Za-z0-9_.-]{1,64}$/;

function pickId(value: unknown): string {
  const raw = typeof value === 'string' ? value : (value && typeof value === 'object'
    ? ((value as Record<string, unknown>).appId ?? (value as Record<string, unknown>).mediaKey ?? (value as Record<string, unknown>).appKey) : '');
  const id = typeof raw === 'string' ? raw.trim() : '';
  return ID_PATTERN.test(id) ? id : '';
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
  onInitCompleted(callback: (event: { flag?: boolean }) => void): unknown;
  onLoginRequested(callback: (event: unknown) => void): unknown;
};

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

export type SnapPlayStatus = { native: boolean; configured: boolean; enabled: boolean; hasAppId: boolean; initialized: boolean; placement: string };
/** 진단용(값은 내보내지 않는다): 네이티브 모듈이 있는지 · 설정이 왔는지 · 이 OS 의 앱 ID 가 있는지 · 초기화가 끝났는지. */
export function snapPlayStatus(): SnapPlayStatus {
  return { native: hasSnapPlayNative(), configured: config !== null, enabled: config?.enabled === true, hasAppId: appId() !== '', initialized: inited, placement: config?.placement ?? SNAPPLAY_DEFAULT_PLACEMENT };
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
  const ready = await prepare(context);
  if (!ready.ok) return ready;
  try { await api()?.showOfferwall(config?.placement ?? SNAPPLAY_DEFAULT_PLACEMENT); return { ok: true }; }
  catch { return { ok: false, reason: 'sdk_error', message: '잠시 후 다시 시도해 주세요' }; }
}

/** 로그아웃 · 회원 바뀜: SDK 에 남은 회원을 지운다(초기화한 적이 없으면 아무것도 안 한다). `resetOfferwall()` 이 부른다. */
export function forgetSnapPlayUser(): void {
  latest = null;
  userKey = '';
  if (!inited) return;
  try { Promise.resolve(api()?.resetUserName()).catch(() => {}); } catch { /* 지우지 못해도 다음 열기에서 새 회원으로 다시 설정한다 */ }
}
/** 설정까지 모두 비운다(앱 바뀜 · 시험). SDK 초기화 상태는 프로세스가 사는 동안 유지된다. */
export function resetSnapPlay(): void { forgetSnapPlayUser(); config = null; notifyChanceProviders(); }

registerChanceProvider({
  id: SNAPPLAY_PROVIDER_ID, name: '스냅플레이', kind: 'launcher',
  available: () => hasSnapPlayNative() && appId() !== '' && api() !== null,
  prepare, open,
});
