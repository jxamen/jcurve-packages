/**
 * OTA 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 로그인했는지·로그인 중인지·메인에 있는지는 앱이 함수로 알려 준다.
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진 빌드에서 정적 import 는 앱 시작 자체를
 * 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */

declare const __DEV__: boolean | undefined;

/** expo-updates 의 네이티브 상태 — 쓰는 칸만 */
type NativeState = {
  isStartupProcedureRunning?: boolean;
  isDownloading?: boolean;
  isUpdatePending?: boolean;
  checkError?: unknown;
  downloadError?: unknown;
};

/**
 * expo-updates 에서 쓰는 것만 적는다 — **패키지가 그것을 의존성으로 들고 있지 않다.**
 * 들고 있으면 안 쓰는 앱에도 딸려 가고, 버전이 앱과 어긋나면 빌드가 깨진다.
 */
type ExpoUpdates = {
  isEnabled: boolean;
  isEmbeddedLaunch: boolean;
  updateId: string | null;
  channel?: string | null;
  runtimeVersion?: string | null;
  reloadAsync: () => Promise<void>;
  /** 빌드에 박힌 「켤 때 받기」 설정 — ON_LOAD·WIFI_ONLY 면 네이티브가 받는다 */
  checkAutomatically?: string | null;
  checkForUpdateAsync?: () => Promise<{ isAvailable?: boolean }>;
  fetchUpdateAsync?: () => Promise<{ isNew?: boolean }>;
  latestContext?: NativeState;
  addUpdatesStateChangeListener?: (fn: (e: { context?: NativeState }) => void) => { remove: () => void };
};

/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다(`__reset`) */
type Env = {
  updates: () => ExpoUpdates;
  /** 앱이 화면에 떠 있는가 — 뒤로 넘어간 사이(로그인 창·미션 매체)에는 적용하지 않는다 */
  active: () => boolean;
  /** 뒤로 넘어갔는가(2.6.2) — 받기만 하는 일은 inactive(ATT 같은 시스템 창이 위에 뜸)에서도 한다. 없으면 !active 로 본다 */
  background?: () => boolean;
  dev: () => boolean;
  /** 앱이 다시 앞으로 올 때마다 부른다(2.4) — 돌려주는 함수로 끊는다 */
  onActive: (fn: () => void) => () => void;
  /** 플랫폼(2.5) — ios · android · web */
  os: () => string;
  /** 앱 상태가 바뀔 때마다(2.7) — active · inactive · background. 돌려주는 함수로 끊는다. 없으면 onActive 만 쓴다 */
  onState?: (fn: (state: string) => void) => () => void;
};

const defaultEnv = (): Env => ({
  updates: () => require('expo-updates') as ExpoUpdates,
  active: () => {
    try {
      return (require('react-native') as { AppState: { currentState: string } }).AppState.currentState === 'active';
    } catch {
      return true;
    }
  },
  background: () => {
    try {
      return (require('react-native') as { AppState: { currentState: string } }).AppState.currentState === 'background';
    } catch {
      return false;
    }
  },
  dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
  os: () => { try { return String((require('react-native') as { Platform: { OS: string } }).Platform.OS ?? ''); } catch { return ''; } },
  onState: (fn) => {
    try {
      const sub = (require('react-native') as {
        AppState: { addEventListener: (e: string, f: (s: string) => void) => { remove?: () => void } };
      }).AppState.addEventListener('change', (st) => fn(String(st)));

      return () => { try { sub?.remove?.(); } catch { /* 이미 끊겼다 */ } };
    } catch {
      return () => undefined;
    }
  },
  onActive: (fn) => {
    try {
      const sub = (require('react-native') as {
        AppState: { addEventListener: (e: string, f: (s: string) => void) => { remove?: () => void } };
      }).AppState.addEventListener('change', (st) => { if (st === 'active') fn(); });

      return () => { try { sub?.remove?.(); } catch { /* 이미 끊겼다 */ } };
    } catch {
      return () => undefined;
    }
  },
});

let env: Env = defaultEnv();

/** 시험에서만 쓴다 — 기기 대신 흉내 낸 것을 쓴다. 인자 없이 부르면 원래대로 */
export function __reset(fake?: Partial<Env>): void {
  env = { ...defaultEnv(), ...fake };
  waiting = false;
  restarting = false;
  launchAsked = 0;
  current = null;
  readyFns.clear();
  headersCache = null;
}

const updates = (): ExpoUpdates | null => {
  try {
    const U = env.updates();

    return U?.isEnabled && !env.dev() ? U : null;
  } catch {
    return null;
  }
};

/** 앱이 알려 주는 것 — 적용해도 되는 순간인지는 이 넷으로 정한다 */
export type AutoApplyDeps = {
  /** 로그인한 사람인가(세션이 있다) */
  signedIn: () => boolean;
  /** 이 실행에서 로그인 버튼을 눌러 봤는가 — `@jcurve/auth` 의 `hasTriedAuth` */
  triedAuth: () => boolean;
  /**
   * 지금 로그인·가입 중인가 — 로그인 화면·가입 화면이 떠 있거나 로그인 창을 다녀오는 중(`isAuthorizing`).
   * 앱이 뒤로 가 있는지는 패키지가 따로 본다.
   */
  busy: () => boolean;
  /**
   * 메인 화면인가(선택). 2.7 부터 쓰는 중 재시작에는 쓰지 않는다(대표님 10-03 「쓰고 있는데 자꾸 꿈뻑꿈뻑」).
   * (2.9) 오래 나갔다 돌아온 **직후**(resumeFreshMs) 받기가 끝났을 때만 본다 — 주면 메인일 때만 그 자리에서 적용, 안 주면 그냥 적용.
   */
  atHome?: () => boolean;
  /**
   * 「새 버전 알려 주기」가 켜져 있는가(2.2) — 켜져 있으면 **스스로 적용하지 않고** 띠를 띄울 수 있게 알린다
   * (`onUpdateReady`). 사람이 띠를 누르면 `applyUpdate()` 가 적용한다. 꺼져 있거나 주지 않으면 위 규칙대로 스스로 적용한다.
   * 도중에 바꿔도 따른다 — 켜 두었다가 끄면 다음 조용한 순간에 스스로 적용된다.
   */
  notice?: () => boolean;
};

/*
 | 받아 둔 새 판과 지금 붙어 있는 앱 사정 — 띠(`onUpdateReady`·`applyUpdate`)가 autoApply 와 같은 판단을 쓰게 한 곳에 둔다.
 | autoApply 는 앱이 켜질 때 한 번만 부르므로 하나면 된다.
 */
let waiting = false;
let restarting = false;
/** (2.9) 켤 때 받기(launchUpdate)가 이번 실행에 새 판을 이미 물었다 — autoApply 의 2초 뒤 받기 · 돌아올 때 받기가 겹쳐 묻지 않게 */
let launchAsked = 0;
let current: { deps: AutoApplyDeps; reload: () => void } | null = null;

/**
 * 지금 새 판으로 다시 시작하는 중인가(2.3) — **로그인·게스트 버튼은 이게 참이면 탭을 무시한다.**
 *
 * 재시작을 정한 순간부터 실제로 다시 뜨기까지 1초 남짓 걸린다. 그 사이 로그인 버튼을 누르면 로그인이 시작되자마자
 * 끊긴다 — 로그인 화면에서도 새 판을 적용하게 하면서(버튼 누르기 전) 남는 유일한 틈이다. 버튼이 무시하면 로그인은
 * 시작조차 안 되고, 잠시 뒤 새 판의 같은 화면이 뜬다.
 */
export const isRestarting = (): boolean => restarting;
const readyFns = new Set<() => void>();

/** 받아 둔 새 판이 있는가 */
export const hasWaiting = (): boolean => waiting;

/**
 * 새 판을 다 받으면 알려 달라 — 띠를 띄우는 화면이 부른다. **이미 받아 뒀으면 그 자리에서 한 번 부른다**
 * (받는 것이 화면보다 먼저 끝난 기기에서 알림을 놓쳐 띠가 영영 안 뜨던 구멍). 돌려주는 함수로 끊는다.
 */
export function onUpdateReady(fn: () => void): () => void {
  readyFns.add(fn);
  if (waiting) { try { fn(); } catch { /* 화면 쪽 오류는 삼킨다 */ } }

  return () => { readyFns.delete(fn); };
}

/**
 * 지금 띠를 눌러 적용해도 되는가 — 받아 둔 것이 있고, **로그인·가입 중이 아니고** 앱이 떠 있을 때.
 * 띠는 이것이 참일 때만 보여 준다(로그인 중에 누르면 로그인이 끊긴다 — 이 패키지가 생긴 까닭이다).
 */
export function canApplyNow(): boolean {
  return waiting && !!current && !current.deps.busy() && env.active();
}

/** 띠를 눌렀다 — 적용할 수 있으면 곧바로 다시 시작한다. 못 하면 거짓(로그인 중·받아 둔 것 없음) */
export function applyUpdate(): boolean {
  if (!canApplyNow() || !current) return false;
  current.reload();

  return true;
}

/**
 * 네이티브가 받아 둔 새 버전을 **안전한 순간에** 적용한다 — 앱이 켜질 때 한 번 부른다. 돌려주는 함수로 멈춘다.
 *
 * 받는 것은 네이티브가 켤 때 한다(`app.json` 의 `checkAutomatically` 기본값). 여기서는 다 받았을 때
 * (`isUpdatePending`) 언제 다시 시작할지만 정한다:
 *  1. 로그인한 사람 — 켠 지 6초 안이면(시작 화면) 바로. 깜빡임이 안 보인다
 *  2. 로그인 전 — **로그인 버튼을 누르기 전이면** 바로. 새로 깐 사람이 스토어 빌드의 옛 코드에 갇히지 않게
 *  3. 로그인 전 · 아직 버튼 안 누름 — 로그인 · 가입 화면이 끝나길 3초마다 보다가(그 사이 누르면 끝까지 안 함)
 *  4. 그 밖 — **쓰는 중엔 다시 시작하지 않는다**(2.7, 대표님 10-03 「쓰고 있는데 자꾸 꿈뻑꿈뻑」 · 「화면이 상단으로 붙음」).
 *     앱이 백그라운드로 갔다가 `resumeApplyMs`(기본 30초) 넘게 있다 돌아오는 순간에만 적용 — 돌아오는 순간이라 깜빡임을 못 느낀다.
 * 어느 경우든 **로그인·가입 중이거나 앱이 뒤로 가 있으면 하지 않는다** — 끝내 기회가 없으면 다음 실행에 저절로 적용된다. 「버튼 없이 자동」 원칙은 그대로.
 */
/** 앞으로 올 때 새 판을 묻는 기본 간격(2.8) — `resumeCheckMs` 를 안 주면 이 값, 0 이면 끔 */
export const RESUME_CHECK_MS = 600_000;

export function autoApply(
  deps: AutoApplyDeps,
  opts: { quickMs?: number; everyMs?: number; fetchDelayMs?: number; resumeCheckMs?: number; resumeApplyMs?: number; resumeFreshMs?: number } = {},
): () => void {
  const U = updates();
  if (!U) return () => undefined;
  const quickMs = opts.quickMs ?? 6000;
  const everyMs = opts.everyMs ?? 3000;
  const launchedAt = Date.now();
  let armed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let fetchTimer: ReturnType<typeof setTimeout> | null = null;
  let sub: { remove: () => void } | undefined;
  let offActive: (() => void) | null = null;
  let offState: (() => void) | null = null;
  let wentBack = 0;   // 백그라운드로 간 시각(2.7)
  let resumedAt = 0;  // 오래 나갔다 돌아온 시각(2.9) — 그 직후 받기가 끝나면 그 자리에서 적용
  let lastCheck = launchAsked || launchedAt;   // 켤 때 네이티브(또는 launchUpdate · 아래 2.1)가 한 번 본다

  const busy = (): boolean => deps.busy() || !env.active();
  const reload = (): void => {
    if (restarting) return;   // 켤 때 받기(launchUpdate)가 이미 다시 시작 중
    restarting = true;
    // 다시 시작하지 못했으면 표시를 풀어 버튼이 다시 먹게 한다 — 다음 실행에 저절로 적용된다
    try { void Promise.resolve(U.reloadAsync()).catch(() => { restarting = false; }); } catch { restarting = false; }
  };
  const noticeOn = (): boolean => { try { return !!deps.notice?.(); } catch { return false; } };
  const homeOk = (): boolean => { try { return deps.atHome ? !!deps.atHome() : true; } catch { return false; } };
  /** 새 판이 있나 묻고 있으면 받는다 — 적용은 받은 뒤 네이티브 상태 구독이 정한다 */
  const fetchNow = async (): Promise<void> => {
    lastCheck = Date.now();
    try {
      const found = await U.checkForUpdateAsync!();
      if (found?.isAvailable) await U.fetchUpdateAsync!();
    } catch { /* 못 받아도 지금 판은 멀쩡하다 */ }
  };
  current = { deps, reload };

  const onPending = (): void => {
    if (armed) return;
    armed = true;
    waiting = true;
    // 띠를 띄우는 화면에 알린다 — 「새 버전 알려 주기」가 켜져 있으면 띠가 뜨고, 꺼져 있으면 화면이 무시한다
    readyFns.forEach((f) => { try { f(); } catch { /* 화면 쪽 오류는 삼킨다 */ } });
    // 알려 주기가 켜져 있으면 스스로 적용하지 않는다 — 사람이 띠를 누를 때(applyUpdate)까지 기다린다
    if (!noticeOn()) {
      // 1. 시작 화면이 아직 떠 있는 동안 — 켠 지 6초 안에 로그인 창을 여는 사람도 있어 같은 가드를 둔다
      if (deps.signedIn() && !busy() && Date.now() - launchedAt < quickMs) { reload(); return; }
      // 2. 로그인 전, 아직 로그인 버튼을 안 눌렀다 — 재시작해도 같은 로그인 화면으로 돌아올 뿐이다
      if (!deps.signedIn() && !deps.triedAuth() && !busy()) { reload(); return; }
      // 2-1. (2.9) 오래 나갔다 돌아온 바로 그때 받기가 끝났다(resumeFreshMs 안) — 돌아오는 순간이라 다시 시작해도 「쓰는 중」이 아니다.
      //      atHome 을 주는 앱은 메인 화면일 때만(알림을 눌러 다른 화면으로 돌아왔으면 다음 복귀로). 대표님 10-04 「두 번 껐다 켜야 최신판?」
      if (resumedAt && Date.now() - resumedAt < resumeFreshMs && !busy() && !(!deps.signedIn() && deps.triedAuth()) && homeOk()) { reload(); return; }
    }
    // 3. 로그인 전 · 아직 버튼을 안 눌렀다 — 로그인 · 가입 화면이 끝나길 기다린다(쓰기 시작 전이라 깜빡여도 같은 화면)
    if (!deps.signedIn() && !deps.triedAuth()) {
      timer = setInterval(() => {
        if (noticeOn() || busy()) return;
        if (deps.signedIn() || deps.triedAuth()) {   // 그 사이 로그인했거나 버튼을 눌렀다 — 4번(돌아올 때)으로
          if (timer) clearInterval(timer);
          timer = null;
          return;
        }
        if (timer) clearInterval(timer);
        timer = null;
        reload();
      }, everyMs);
    }
    // 4. 그 밖은 백그라운드에서 돌아올 때만(아래 onState)
  };
  const resumeApplyMs = opts.resumeApplyMs ?? 30000;
  const resumeFreshMs = opts.resumeFreshMs ?? 5000;
  offState = env.onState ? env.onState((st) => {
    if (st === 'background') { wentBack = Date.now(); return; }
    if (st !== 'active') return;
    const away = wentBack ? Date.now() - wentBack : 0;
    wentBack = 0;
    if (away >= resumeApplyMs) resumedAt = Date.now();
    if (!waiting || restarting || noticeOn() || away < resumeApplyMs) return;
    try { if (deps.busy()) return; } catch { return; }   // 로그인 창에서 돌아오는 복귀 — 로그인을 끊지 않는다
    if (!deps.signedIn() && deps.triedAuth()) return;    // 로그인 버튼을 누른 뒤 · 아직 로그인 전 — 돌아올 곳이 사라진다
    if (timer) clearInterval(timer);
    timer = null;
    reload();
  }) : null;

  try {
    if (U.latestContext?.isUpdatePending) onPending();
    else sub = U.addUpdatesStateChangeListener?.((e) => { if (e?.context?.isUpdatePending) { sub?.remove(); onPending(); } });
  } catch { /* 상태를 못 읽으면 다음 실행에 저절로 적용된다 */ }

  /*
   | **켤 때 네이티브가 받지 않는 빌드**는 여기서 받는다(2.1). 1.0 안내대로 `checkAutomatically` 를 ON_ERROR_RECOVERY 로
   | 박아 스토어에 낸 앱(당근캐시 등)이 있는데, 그 설정은 빌드에 박혀 OTA 로는 못 바꾼다 — 그대로 두면 새 판을 영영
   | 안 받는다. 받기만 하고, 언제 적용할지는 위 규칙 그대로다(다 받으면 네이티브 상태가 바뀌어 위 구독이 부른다).
   | 켤 때 받는 빌드(꼬꼬농장 — ON_LOAD)는 네이티브와 겹치지 않게 아무것도 하지 않는다.
   */
  const auto = String(U.checkAutomatically ?? 'ON_LOAD').toUpperCase();
  if (auto !== 'ON_LOAD' && auto !== 'WIFI_ONLY' && U.checkForUpdateAsync && U.fetchUpdateAsync && !U.latestContext?.isUpdatePending) {
    fetchTimer = setTimeout(() => {
      fetchTimer = null;
      /*
       | 뒤로 넘어간 앱만 건너뛴다 — inactive 는 받는다(2.6.2). 새로 설치하면 첫 실행에 ATT 창(시스템 창)이 떠
       | 실행 내내 inactive 라, active 만 보면 첫 실행에 OTA 를 못 받았다(민트런 실기기 2026-10-01, 아이폰 12 mini).
       | 받기만 한다 — 적용(재시작)은 위 규칙대로 active 에서만 한다(busy()).
       */
      if (env.background ? env.background() : !env.active()) return;
      if (launchAsked) return;   // (2.9) 켤 때 받기(launchUpdate)가 이미 물었다
      void fetchNow();
    }, opts.fetchDelayMs ?? 2000);   // 첫 화면이 쓸 네트워크를 같이 먹지 않게 잠깐 텀을 둔다
  }

  /*
   | **앱이 다시 앞으로 올 때도 받는다**(2.4, 선택 — `resumeCheckMs`). 켤 때만 받으면 뒤에 둔 채 몇 시간씩 쓰는
   | 폰은 옛 판에 머문다(머니트리 2026-09-19 「ota 안 되는데?」 — 백그라운드에 둔 아이폰이 몇 시간째 옛 판).
   | 마지막 확인에서 이만큼 지났고, 받아 둔 것이 없고, 네이티브가 켤 때 확인·받는 중이 아닐 때만 묻는다.
   | 다 받으면 네이티브 상태가 바뀌어 위 구독이 부르고, 적용은 위 규칙 그대로다.
   | (2.8) **기본 10분(600000)으로 켠다** — 값을 안 준 앱(디저트나우 · 꿀꿀캐시 · 팩트투자)이 「완전히 껐다 켤 때」만 확인해
   | 대표님 아이폰이 몇 시간째 옛 판에 머물렀다(2026-10-04 두 번). 끄려면 0 을 준다.
   */
  const gap = opts.resumeCheckMs ?? RESUME_CHECK_MS;
  if (gap > 0 && U.checkForUpdateAsync && U.fetchUpdateAsync) {
    offActive = env.onActive(() => {
      const c = U.latestContext;
      if (waiting || c?.isUpdatePending || c?.isStartupProcedureRunning || c?.isDownloading) return;
      /*
       | **로그인 중이면 받지 않는다**(2.4.1, 머니트리 지적). 카카오 로그인에서 돌아오는 바로 그 복귀에 받기(수 MB)가
       | 시작되면 로그인 요청과 겹친다 — 이 패키지가 생긴 까닭이 로그인과 겹치지 않는 것이다. 다음 복귀·다음 실행에 받는다.
       */
      try { if (deps.busy()) return; } catch { return; }
      if (Date.now() - lastCheck < gap) return;
      void fetchNow();
    });
  }

  return () => {
    sub?.remove();
    offActive?.();
    offActive = null;
    offState?.();
    offState = null;
    if (timer) clearInterval(timer);
    timer = null;
    if (fetchTimer) clearTimeout(fetchTimer);
    fetchTimer = null;
    if (current?.deps === deps) current = null;
  };
}

let headersCache: Record<string, string> | null = null;

/**
 * 서버가 판별 사용자 수를 세는 헤더(2.5) — 앱의 모든 API 요청에 붙인다. 이름은 jcurve-api `OtaTrack` 이 읽는 그대로.
 * 안드로이드 요청은 UA 가 okhttp 라 서버가 기기를 못 가려 플랫폼을 따로 싣는다(2026-09-19). 웹·모듈 없는 빌드는 빈 객체.
 * 한 실행 동안 판이 바뀌지 않으므로(바뀌면 다시 시작한다) 한 번 만들어 둔다.
 *
 *   fetch(url, { headers: { 'X-App-Token': KEY, ...otaHeaders() } })
 */
export function otaHeaders(): Record<string, string> {
  if (headersCache) return headersCache;
  const os = env.os();
  if (os !== 'ios' && os !== 'android') return {};
  const h: Record<string, string> = { 'x-ota-platform': os, 'x-ota-update-id': 'embedded' };
  try {
    const U = env.updates();
    // 스토어 판 그대로 켠 기기도 updateId 에 내장 판 id 가 들어 있다 — 그 id 를 실으면 서버의 「스토어 판」 칸이
    // 늘 0 이 되고 기기는 낯선 id 로 잡힌다(2.5.1, 꿀꿀 제보). 받은 판으로 켰을 때만 id 를 싣는다
    if (U?.updateId && !U.isEmbeddedLaunch) h['x-ota-update-id'] = String(U.updateId);
    if (U?.channel) h['x-ota-channel'] = String(U.channel);
    if (U?.runtimeVersion) h['x-ota-runtime'] = String(U.runtimeVersion);
  } catch { /* 모듈이 없는 빌드 — 스토어 판(embedded)으로 싣는다 */ }
  headersCache = h;

  return h;
}

/** 시작 확인이 끝났거나(받을 게 없음·오류) 받기가 시작됐는가 */
const settled = (c?: NativeState): boolean =>
  !c?.isStartupProcedureRunning || !!c.isDownloading || !!c.isUpdatePending || !!c.checkError || !!c.downloadError;

/**
 * 로그인 전 사람의 시작 화면을 **네이티브의 시작 확인이 끝날 때까지**(최대 `maxMs`) 붙잡는다.
 *
 * 확인이 도는 동안 앱 소개가 먼저 뜨면, 곧이어 받은 새 버전이 적용되며 화면이 덜컥 처음으로 돌아간다.
 * 시작 화면 뒤에서 끝내면 깜빡임이 보이지 않는다.
 */
export function startupSettled(maxMs = 3000): Promise<void> {
  return new Promise((resolve) => {
    const U = updates();
    try {
      if (!U || settled(U.latestContext) || !U.addUpdatesStateChangeListener) { resolve(); return; }
      const t = setTimeout(() => { sub.remove(); resolve(); }, maxMs);
      const sub = U.addUpdatesStateChangeListener((e) => {
        if (!settled(e?.context)) return;
        clearTimeout(t);
        sub.remove();
        resolve();
      });
    } catch {
      resolve();
    }
  });
}

export type LaunchResult = 'applied' | 'none' | 'timeout' | 'skipped';

/**
 * (2.9) **켤 때 시작 화면 뒤에서 새 판을 받아 그 자리에서 적용한다** — 대표님 10-04 「사용자들도 두 번을 껐다 켜야만 최신판이 보이겠네?」.
 * 시작 화면(스플래시)을 내리기 **전에** `await launchUpdate()` 한다. 로그인한 사람 · 안 한 사람 똑같다.
 *
 *  - 네이티브가 켤 때 받는 빌드(ON_LOAD · WIFI_ONLY): 네이티브 확인이 끝나길 기다려, 다 받았으면 바로 다시 시작
 *  - 켤 때 안 받는 빌드(ON_ERROR_RECOVERY · NEVER): 여기서 묻고 받아, 다 받았으면 바로 다시 시작
 *  - `maxMs`(기본 4000) 안에 못 끝나면 지금 판으로 연다 — 받던 것은 계속 받고, 다음 실행(또는 autoApply 규칙)에 적용
 *  - 이미 받아 둔 것이 있으면 곧바로 다시 시작
 *
 * 돌려주는 값: applied(다시 시작함 — 곧 새 판이 뜬다) · none(새 판 없음) · timeout(시간 넘김) · skipped(개발 · 웹 · 모듈 없음).
 * 시작 화면 뒤라 깜빡임이 보이지 않는다. autoApply 는 그대로 함께 부른다(늦게 받은 것 · 돌아올 때).
 */
export async function launchUpdate(maxMs = 4000): Promise<LaunchResult> {
  const U = updates();
  if (!U) return 'skipped';
  const pending = (): boolean => { try { return !!U.latestContext?.isUpdatePending; } catch { return false; } };
  const apply = (): LaunchResult => {
    if (!restarting) {
      restarting = true;
      try { void Promise.resolve(U.reloadAsync()).catch(() => { restarting = false; }); } catch { restarting = false; }
    }
    waiting = true;

    return 'applied';
  };
  if (pending()) return apply();
  let tid: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<'timeout'>((res) => { tid = setTimeout(() => res('timeout'), maxMs); });
  const auto = String(U.checkAutomatically ?? 'ON_LOAD').toUpperCase();

  if (auto === 'ON_LOAD' || auto === 'WIFI_ONLY') {
    // 네이티브가 받는다 — 겹쳐 묻지 않고 끝나길 기다린다
    const c = U.latestContext;
    if (!c?.isStartupProcedureRunning && !c?.isDownloading) return 'none';
    if (!U.addUpdatesStateChangeListener) return 'none';
    let sub: { remove: () => void } | undefined;
    const native = new Promise<'pending' | 'none'>((res) => {
      try {
        sub = U.addUpdatesStateChangeListener!((e) => {
          const x = e?.context;
          if (x?.isUpdatePending) res('pending');
          else if (!x?.isStartupProcedureRunning && !x?.isDownloading) res('none');
          else if (x?.checkError || x?.downloadError) res('none');
        });
      } catch { res('none'); }
    });
    const r = await Promise.race([native, timeout]);
    if (tid) clearTimeout(tid);
    sub?.remove();
    launchAsked = Date.now();

    return r === 'pending' ? apply() : r;
  }

  if (!U.checkForUpdateAsync || !U.fetchUpdateAsync) return 'none';
  launchAsked = Date.now();
  const job = (async (): Promise<boolean> => {
    try {
      const found = await U.checkForUpdateAsync!();
      if (!found?.isAvailable) return false;
      const got = await U.fetchUpdateAsync!();

      return !!got?.isNew || pending();
    } catch {
      return false;   // 못 받아도 지금 판은 멀쩡하다
    }
  })();
  const r = await Promise.race([job, timeout]);
  if (tid) clearTimeout(tid);
  if (r === 'timeout') return 'timeout';

  return r ? apply() : 'none';
}

/** 지금 돌고 있는 판 이름 — 기본 판(스토어에서 받은 그대로)이면 빈 문자열 */
export function bundleLabel(): string {
  try {
    const U = env.updates();
    if (!U.isEnabled || U.isEmbeddedLaunch) return '';

    return String(U.updateId ?? '').slice(0, 8);
  } catch {
    return '';
  }
}
