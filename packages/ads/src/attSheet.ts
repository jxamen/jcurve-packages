/**
 * iOS ATT — 상태 읽기 · 시스템 요청 · 안내 두 가지의 판단 로직(화면은 `AttDeniedSheet.ts`).
 *
 * (1.9.11) 애플 심사 기준(5.1.2(i) — ATT 동의를 조건이나 대가로 삼을 수 없다)에 맞춰 안내를 다시 짰다.
 *  ① **시스템 ATT 창 바로 앞의 중립 안내 — 한 번.** 상태가 미정(undetermined)일 때만, 「계속」 버튼 하나. 대가 · 압박 문구 없음.
 *  ② **거부 · 제한 안내(단계 시트) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만.**
 *     앱을 켤 때 · 루트 마운트로는 절대 열리지 않는다. 닫아도 오퍼월 진입은 막지 않는다.
 * 시스템 ATT 창 자체는 `ads.requestTracking()`(앱을 켤 때)과 `ensureTrackingBeforeOfferwall()` 이 띄운다 — 둘 다 ① 을 거친다.
 *
 * ⚠ 네이티브 모듈은 `expo-tracking-transparency` 하나만, **네이티브가 있는지 먼저 본 뒤**(native.ts) 읽는다 — 없으면
 * 함수들은 던지지 않고 돌아온다. 새 네이티브 모듈·권한·Info.plist 는 없다(OTA 로 나간다).
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { requireTracking } from './native';

/** ATT 상태 — `unavailable` 은 iOS 가 아니거나 모듈이 없는 빌드, `unknown` 은 읽기가 실패한 것 */
export type AttStatus = 'granted' | 'denied' | 'restricted' | 'undetermined' | 'unavailable' | 'unknown';
export type AttTrigger = 'launch' | 'offerwall';
/** `request` = 시스템 창(중립 안내 뒤), `show` = 거부 · 제한 단계 시트(오퍼월 진입 때만) */
export type AttAction = 'show' | 'request' | 'none';

/** 1.9.11 부터 쓰이지 않는다(앱 코드가 타입을 가져다 써도 컴파일되도록 이름만 남김) */
export type AttStorage = {
  getItem: (key: string) => string | null | undefined | Promise<string | null | undefined>;
  setItem: (key: string, value: string) => void | Promise<void>;
};

/** 거부 · 제한 단계 시트 문구 — 기본값은 아래 `ATT_SHEET_TEXTS`. `{appName}` 자리는 앱 이름으로 바뀐다 */
export type AttSheetTexts = {
  /** 맨 위 첫 줄 */
  title: string;
  /** 둘째 줄 — 기본은 비어 있다(안 그린다) */
  body: string;
  /** 다섯 단계 — 셋째 줄에 `{appName}` 이 들어간다 */
  steps: string[];
  /** 「설정에서 허용하기」를 누르면 3단계까지 바로 간다는 안내 */
  guide: string;
  /** 앱 화면에 「추적 허용」이 안 보일 때의 보조 안내(작은 글씨) */
  fallback: string;
  openSettings: string;
  later: string;
};

/** 시스템 ATT 창 앞 중립 안내 문구 */
export type AttPrimerTexts = {
  title: string;
  body: string;
  button: string;
};

/** 거부 · 제한 단계 시트 기본 문구(1.9.11: 첫 줄만 사실 설명으로 바꾸고 이익을 내세우던 문구는 지웠다 — 단계 안내는 그대로) */
export const ATT_SHEET_TEXTS: Readonly<AttSheetTexts> = {
  title: '애드팝콘 참여형 미션은 설치 · 참여 확인을 위해 추적 허용이 필요해요',
  body: '',
  steps: [
    '「설정」 앱을 열어요',
    '「앱」으로 가요',
    '「{appName}」을 찾아 눌러요',
    '「추적 허용」을 켜요',
    '앱으로 돌아오면 바로 이용할 수 있어요',
  ],
  guide: '아래 「설정에서 허용하기」를 누르면 3단계까지 바로 가요',
  fallback: '앱 화면에 「추적 허용」이 안 보이면: 설정 → 개인정보 보호 및 보안 → 추적 → 맨 위 「앱이 추적을 요청하도록 허용」을 먼저 켜요',
  openSettings: '설정에서 허용하기',
  later: '나중에',
};

/** 시스템 ATT 창 앞 중립 안내 기본 문구(대표님 확정 문구 — 앱이 `primerTexts` 로 덮어쓸 수 있다) */
export const ATT_PRIMER_TEXTS: Readonly<AttPrimerTexts> = {
  title: '다음 화면에서 앱 추적 허용 여부를 물어봐요',
  body: '허용하면 앱 사용 기록이 광고와 참여형 미션 참여 확인에 쓰여요. 허용하지 않아도 앱은 그대로 이용할 수 있어요.',
  button: '계속',
};

/** 문구를 합친다 — 덮어쓴 값이 있으면 그것을, 단계의 `{appName}` 을 앱 이름으로 바꾼다 */
export function attSheetTexts(appName: string, overrides?: Partial<AttSheetTexts>): AttSheetTexts {
  const m: AttSheetTexts = { ...ATT_SHEET_TEXTS, ...(overrides ?? {}) };
  const name = String(appName ?? '');

  return { ...m, steps: m.steps.map((s) => s.split('{appName}').join(name)) };
}

/** 로컬 달력 날짜(YYYY-MM-DD) */
export function localDay(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');

  return `${d.getFullYear()}-${mm}-${dd}`;
}

/**
 * 무엇을 할지 — 기기 없이 판단하는 순수 함수.
 * - Android·웹 등 iOS 가 아니면 아무것도 안 한다.
 * - 미정이면 시스템 창(`request`) — 어느 시점이든. 그 앞에 중립 안내가 한 번 붙는다.
 * - 거부·제한이면 **오퍼월 진입 때만** 단계 시트(`show`). 앱을 켤 때(`launch`)는 절대 아니다.
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

/**
 * 화면을 가진 쪽 — 마운트된 `AttDeniedSheet` 가 등록한다. 각 함수는 보이고, 사용자가 끝내면(그리고 창이 사라지면) `done` 을 부른다.
 * 등록된 곳이 없으면(앱이 안 붙였으면) 안내 없이 바로 넘어간다.
 */
export type AttHost = {
  primer: (done: () => void) => void;
  sheet: (done: () => void) => void;
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

let sheetRun: Promise<void> | null = null;

/** 거부 · 제한 단계 시트 — 닫히면 돌아온다. 동시에 부르면 하나를 같이 기다린다. 화면이 없으면 바로 돌아온다 */
export function showAttSheet(): Promise<void> {
  const h = host;
  if (!h) return Promise.resolve();
  sheetRun ??= new Promise<void>((resolve) => {
    try { h.sheet(resolve); } catch { resolve(); }
  }).then(() => { sheetRun = null; });

  return sheetRun;
}

/** 판단에 쓰는 기기 값 묶음 — 시험에서는 가짜를 넣는다 */
export type AttDeps = {
  os: string;
  tracking: TrackingModule | null;
  /** 시스템 창 앞 중립 안내 — 기본은 `showAttPrimerOnce` */
  primer?: () => Promise<void>;
  /** 거부 · 제한 단계 시트 — 기본은 `showAttSheet` */
  sheet?: () => Promise<void>;
};

/**
 * 오퍼월에 들어가기 전 — ATT 상태를 확인하고 **결과 상태**를 돌려준다. 오퍼월을 막지 않는다.
 * - 미정: 중립 안내(한 번) → 시스템 창 → 그 결과.
 * - 거부 · 제한: 단계 시트를 열고, 닫히면 다시 읽은 상태(설정에서 켰을 수 있다). 시트가 안 붙어 있으면 그 상태를 바로 돌려준다.
 * - 허용 · Android · 모듈 없음: 바로 돌려준다.
 */
export async function ensureTrackingBeforeOfferwallWith(d: AttDeps): Promise<AttStatus> {
  if (d.os !== 'ios' || !d.tracking) return 'unavailable';
  const status = await readStatus(d.tracking);
  const action = decideAttAction({ os: d.os, trigger: 'offerwall', status, today: localDay(new Date()) });
  if (action === 'request') {
    try { await (d.primer ?? showAttPrimerOnce)(); } catch { /* 안내가 안 떠도 시스템 창은 묻는다 */ }

    return requestStatus(d.tracking);
  }
  if (action === 'show') {
    try { await (d.sheet ?? showAttSheet)(); } catch { /* 시트가 안 떠도 오퍼월은 막지 않는다 */ }

    return readStatus(d.tracking);
  }

  return status;
}

/** 앱이 오퍼월에 들어가기 전에 부른다 — 실제 기기 값과 마운트된 화면을 쓴다. `storage` 는 1.9.11 부터 쓰이지 않는다(호출 코드가 그대로 컴파일되도록 남김) */
export function ensureTrackingBeforeOfferwall(_storage?: AttStorage): Promise<AttStatus> {
  try {
    const rn = loadRN();

    return ensureTrackingBeforeOfferwallWith({ os: String(rn?.Platform?.OS ?? ''), tracking: loadTracking() }).catch((): AttStatus => 'unknown');
  } catch {
    return Promise.resolve('unknown');
  }
}
