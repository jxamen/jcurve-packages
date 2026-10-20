/**
 * iOS ATT — 상태 읽기 · 시스템 요청 · 안내 두 가지의 판단 로직(화면은 `AttDeniedSheet.ts`).
 *
 * 애플 심사 기준(5.1.2(i) — ATT 동의를 조건이나 대가로 삼을 수 없다)에 맞춘 안내다.
 *  ① **시스템 ATT 창 바로 앞의 중립 안내 — 한 번.** 상태가 미정(undetermined)일 때만, 「계속」 버튼 하나. 대가 · 압박 문구 없음.
 *  ② **추적이 꺼져 있을 때(거부 · 제한)의 가운데 팝업 — 오퍼월/미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만, 하루 한 번.**
 *     앱을 켤 때 · 루트 마운트로는 절대 열리지 않는다. 어느 버튼을 눌러도 **오퍼월 진입을 막지 않는다**(반환값으로도).
 * 시스템 ATT 창 자체는 `ads.requestTracking()`(앱을 켤 때)과 `ensureTrackingBeforeOfferwall()` 이 띄운다 — 둘 다 ① 을 거친다.
 *
 * ⚠ 네이티브 모듈은 `expo-tracking-transparency` 하나만, **네이티브가 있는지 먼저 본 뒤**(native.ts) 읽는다 — 없으면
 * 함수들은 던지지 않고 돌아온다. 새 네이티브 모듈·권한·Info.plist 는 없다(OTA 로 나간다).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTracking } from './native';

/**
 * ATT 상태 — `unavailable` 은 iOS 가 아니거나 모듈이 없는 빌드, `unknown` 은 읽기가 실패한 것.
 * `proceed` 는 `ensureTrackingBeforeOfferwall` 만 돌려준다: 추적이 꺼져 있지만(거부 · 제한) **오퍼월은 열어도 된다**는 뜻이다.
 */
export type AttStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable' | 'unknown' | 'proceed';
export type AttTrigger = 'launch' | 'offerwall';
/** `request` = 시스템 창(중립 안내 뒤), `show` = 추적이 꺼져 있을 때의 가운데 팝업(오퍼월 진입 때만) */
export type AttAction = 'show' | 'request' | 'none';

/** 마지막으로 팝업을 띄운 날을 적어 둘 곳 — 앱이 `<AttDeniedSheet storage={AsyncStorage}>` 로 넘긴다. 안 넘기면 메모리(앱을 끄면 잊는다) */
export type AttStorage = {
  getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

/** 1.9.13 부터 쓰이지 않는다(옛 단계 시트 문구 모양 — 앱 코드가 타입을 가져다 써도 컴파일되도록 이름만 남김) */
export type AttSheetTexts = {
  title: string;
  body: string;
  steps: string[];
  guide: string;
  fallback: string;
  openSettings: string;
  later: string;
};

/** 1.9.13 부터 비어 있다 — 옛 단계 시트 문구를 지웠다(번들에 남기지 않는다). 앱이 import 해도 컴파일은 유지된다 */
export const ATT_SHEET_TEXTS: Readonly<AttSheetTexts> = {
  title: '',
  body: '',
  steps: [],
  guide: '',
  fallback: '',
  openSettings: '',
  later: '',
};

/** 시스템 ATT 창 앞 중립 안내 문구 */
export type AttPrimerTexts = {
  title: string;
  body: string;
  button: string;
};

/** 추적이 꺼져 있을 때의 가운데 팝업 문구 */
export type AttDeniedTexts = {
  title: string;
  body: string;
  /** 설정 앱을 연다 */
  openSettings: string;
  /** 그냥 닫고 이어서 간다 */
  proceed: string;
};

/** 시스템 ATT 창 앞 중립 안내 기본 문구(대표님 확정 문구 — 앱이 `primerTexts` 로 덮어쓸 수 있다) */
export const ATT_PRIMER_TEXTS: Readonly<AttPrimerTexts> = {
  title: '다음 화면에서 앱 추적 허용 여부를 물어봐요',
  body: '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
  button: '계속',
};

/** 추적이 꺼져 있을 때의 가운데 팝업 기본 문구(대표님 확정 문구 — 앱이 `deniedTexts` 로 덮어쓸 수 있다) */
export const ATT_DENIED_TEXTS: Readonly<AttDeniedTexts> = {
  title: '추적이 꺼져 있어요',
  body: '추적이 꺼져 있으면 일부 미션은 참여 확인이 안 될 수 있어요. 원하시면 설정에서 켤 수 있어요.',
  openSettings: '설정 열기',
  proceed: '그냥 보기',
};

/** 로컬 달력 날짜(YYYY-MM-DD) — 「하루 한 번」은 기기 시간대의 자정 기준이다 */
export function localDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창(`request`) — 어느 시점이든. 그 앞에 중립 안내가 한 번 붙는다.
 * - 거부·제한이면 **오퍼월 진입 때만** 가운데 팝업(`show`, 하루 한 번은 호출 쪽이 센다). 앱을 켤 때(`launch`)는 절대 아니다.
 */
export function decideAttAction(i: {
  os: string;
  trigger: AttTrigger;
  status: string;
  lastShownDay?: string | null;
  today: string;
}): AttAction {
  if (i.os !== 'ios') return 'none';
  if (i.status === 'undetermined') return 'request';
  if ((i.status === 'denied' || i.status === 'restricted') && i.trigger === 'offerwall') return 'show';

  return 'none';
}

/** 추적 모듈 — 없거나 함수가 없으면 null. 가드된 require 는 이 한 곳에서만 한다 */
export type TrackingModule = {
  getTrackingPermissionsAsync: () => Promise<{ status?: string } | null | undefined>;
  requestTrackingPermissionsAsync: () => Promise<{ status?: string } | null | undefined>;
};

export function loadTracking(): TrackingModule | null {
  // 네이티브가 있을 때만 읽는다(1.9.6, native.ts) — 없는 바이너리에 OTA 로 얹혀도 require 로 죽지 않는다
  const m: any = requireTracking();
  if (m && typeof m.getTrackingPermissionsAsync === 'function' && typeof m.requestTrackingPermissionsAsync === 'function') return m;

  return null;
}

/** react-native 를 가드된 require 로 — 웹·Expo Go 에서도 import 가 던지지 않게 */
export function loadRN(): any | null {
  try {
    return require('react-native');
  } catch {
    return null;
  }
}

/** 현재 상태를 읽는다 — 실패하면 `unknown`(던지지 않는다) */
export async function readStatus(tracking: TrackingModule): Promise<AttStatus> {
  try {
    const r = await tracking.getTrackingPermissionsAsync();

    return normStatus(r?.status);
  } catch {
    return 'unknown';
  }
}

/** 시스템 ATT 창을 띄우고 결과 상태를 돌려준다(창이 없으면 미정 그대로) */
export async function requestStatus(tracking: TrackingModule): Promise<AttStatus> {
  try {
    const r = await tracking.requestTrackingPermissionsAsync();

    return normStatus(r?.status);
  } catch {
    return 'unknown';
  }
}

function normStatus(s?: string): AttStatus {
  switch (s) {
    case 'granted':
    case 'denied':
    case 'restricted':
    case 'undetermined':
      return s;
    default:
      return 'unknown';
  }
}

/** 메모리 저장소 — 앱이 저장소를 안 넘겼을 때. 앱을 끄면 잊으므로 하루 한 번 규칙은 그 실행 안에서만 지켜진다 */
const memory = new Map<string, string>();
const memoryStorage: AttStorage = {
  getItem: (k) => memory.get(k) ?? null,
  setItem: (k, v) => { memory.set(k, v); },
};

/** 저장소 열쇠 — 마지막으로 가운데 팝업을 띄운 날(YYYY-MM-DD) */
export const ATT_DENIED_STORAGE_KEY = 'jcurve.ads.attDenied.lastShown';

async function readLastShown(storage: AttStorage): Promise<string | null> {
  try {
    const v = await storage.getItem(ATT_DENIED_STORAGE_KEY);

    return typeof v === 'string' && v !== '' ? v : null;
  } catch {
    return null;
  }
}

async function writeLastShown(storage: AttStorage, day: string): Promise<void> {
  try {
    await storage.setItem(ATT_DENIED_STORAGE_KEY, day);
  } catch { /* 저장 실패 — 다음 실행에 한 번 더 뜰 수 있을 뿐이다 */ }
}

/**
 * 화면을 가진 쪽 — 마운트된 `AttDeniedSheet` 가 등록한다. 각 함수는 보이고, 사용자가 끝내면(그리고 창이 사라지면) `done` 을 부른다.
 * 등록된 곳이 없으면(앱이 안 붙였으면) 안내 없이 바로 넘어간다.
 */
export type AttHost = {
  primer: (done: () => void) => void;
  denied: (done: () => void) => void;
  /** 가운데 팝업을 띄운 날을 적어 둘 곳 — 없으면 메모리 */
  storage?: AttStorage;
};
let host: AttHost | null = null;
export function registerAttHost(h: AttHost | null): void { host = h; }

let primerRun: Promise<void> | null = null;

/** 시스템 ATT 창 앞 중립 안내 — **한 번만**(이번 실행 안에서: 끝난 약속을 그대로 돌려준다). 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
export function showAttPrimerOnce(): Promise<void> {
  const h = host;
  if (!h) return Promise.resolve();
  primerRun ??= new Promise<void>((resolve) => {
    try { h.primer(resolve); } catch { resolve(); }
  });

  return primerRun;
}

let deniedRun: Promise<void> | null = null;

/**
 * 추적이 꺼져 있을 때의 가운데 팝업 — **하루 한 번**(기기 로컬 날짜). 오늘 이미 보였으면 띄우지 않고 바로 돌아온다.
 * 닫힐 때까지(「설정 열기」는 설정 앱에서 돌아올 때까지) 기다린다. 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다.
 */
export async function showAttDeniedOncePerDay(today: string = localDay(new Date())): Promise<void> {
  const h = host;
  if (!h) return;
  if (deniedRun) { await deniedRun; return; }
  const storage = h.storage ?? memoryStorage;
  if ((await readLastShown(storage)) === today) return;
  if (deniedRun) { await deniedRun; return; }          // 읽는 사이에 다른 호출이 먼저 열었다
  await writeLastShown(storage, today);                // 띄우기 전에 적는다 — 도중에 꺼져도 오늘 또 뜨지 않는다
  deniedRun ??= new Promise<void>((resolve) => {
    try { h.denied(resolve); } catch { resolve(); }
  }).then(() => { deniedRun = null; });
  await deniedRun;
}

/** 설정 앱에 다녀온 뒤 — 앱이 다시 앞으로 오면 돌아온다. 설정 앱으로 안 넘어가면(열기가 안 먹으면) `leaveMs` 뒤에 돌아온다 */
export const SETTINGS_LEAVE_MS = 2000;
export function waitForReturn(appState: any, leaveMs: number = SETTINGS_LEAVE_MS): Promise<void> {
  return new Promise<void>((resolve) => {
    if (!appState || typeof appState.addEventListener !== 'function') { resolve(); return; }
    let left = false;
    let sub: any = null;
    let timer: any = null;
    const end = (): void => {
      try { sub?.remove?.(); } catch { /* noop */ }
      if (timer) clearTimeout(timer);
      resolve();
    };
    try {
      sub = appState.addEventListener('change', (s: string) => {
        if (s !== 'active') { left = true; if (timer) { clearTimeout(timer); timer = null; } return; }
        if (left) end();
      });
    } catch { resolve(); return; }
    timer = setTimeout(() => { if (!left) end(); }, leaveMs);
  });
}

/** 판단에 쓰는 기기 값 묶음 — 시험에서는 가짜를 넣는다 */
export type AttDeps = {
  os: string;
  tracking: TrackingModule | null;
  /** 시스템 창 앞 중립 안내 — 기본은 `showAttPrimerOnce` */
  primer?: () => Promise<void>;
  /** 추적이 꺼져 있을 때의 가운데 팝업 — 기본은 `showAttDeniedOncePerDay` */
  denied?: () => Promise<void>;
};

/** 최종 상태 → 돌려줄 값: 추적이 꺼져 있으면(거부 · 제한) `proceed` — 오퍼월은 열어도 된다는 뜻이다 */
function forEntry(status: AttStatus): AttStatus {
  return status === 'denied' || status === 'restricted' ? 'proceed' : status;
}

/**
 * 오퍼월에 들어가기 전 — ATT 상태를 확인하고 **오퍼월을 열어도 되는지**를 돌려준다. 오퍼월을 막지 않는다.
 * - 미정: 중립 안내(한 번) → 시스템 창 → 그 결과.
 * - 거부 · 제한: 가운데 팝업(하루 한 번) → 닫히면 다시 읽은 상태(설정에서 켰을 수 있다). 팝업이 안 붙어 있거나 오늘 이미 봤으면 바로.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 * 돌려주는 값: `granted` · `unavailable` · `unknown` 은 그대로, 추적이 꺼져 있으면(거부 · 제한, 시스템 창에서 막 거부한 경우 포함) **`proceed`**.
 * 앱은 어떤 값이 와도 오퍼월을 연다 — 값은 참고용이다.
 */
export async function ensureTrackingBeforeOfferwallWith(d: AttDeps): Promise<AttStatus> {
  if (d.os !== 'ios' || !d.tracking) return 'unavailable';
  const status = await readStatus(d.tracking);
  const action = decideAttAction({ os: d.os, trigger: 'offerwall', status, today: localDay(new Date()) });
  if (action === 'request') {
    try { await (d.primer ?? showAttPrimerOnce)(); } catch { /* 안내가 안 떠도 시스템 창은 묻는다 */ }

    return forEntry(await requestStatus(d.tracking));
  }
  if (action === 'show') {
    try { await (d.denied ?? showAttDeniedOncePerDay)(); } catch { /* 팝업이 안 떠도 오퍼월은 막지 않는다 */ }

    return forEntry(await readStatus(d.tracking));
  }

  return forEntry(status);
}

/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 화면을 쓴다. `storage` 는 `<AttDeniedSheet storage>` 로 넘긴다(여기 인자는 쓰이지 않는다) */
export function ensureTrackingBeforeOfferwall(_storage?: AttStorage): Promise<AttStatus> {
  try {
    const rn = loadRN();

    return ensureTrackingBeforeOfferwallWith({ os: String(rn?.Platform?.OS ?? ''), tracking: loadTracking() }).catch((): AttStatus => 'unknown');
  } catch {
    return Promise.resolve('unknown');
  }
}
