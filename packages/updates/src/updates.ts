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
  reloadAsync: () => Promise<void>;
  latestContext?: NativeState;
  addUpdatesStateChangeListener?: (fn: (e: { context?: NativeState }) => void) => { remove: () => void };
};

/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다(`__reset`) */
type Env = {
  updates: () => ExpoUpdates;
  /** 앱이 화면에 떠 있는가 — 뒤로 넘어간 사이(로그인 창·미션 매체)에는 적용하지 않는다 */
  active: () => boolean;
  dev: () => boolean;
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
  dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
});

let env: Env = defaultEnv();

/** 시험에서만 쓴다 — 기기 대신 흉내 낸 것을 쓴다. 인자 없이 부르면 원래대로 */
export function __reset(fake?: Partial<Env>): void {
  env = { ...defaultEnv(), ...fake };
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
  /** 로그인한 사람에게 적용해도 되는 자리인가 — 메인 화면(꼬꼬농장: 농장 탭 첫 화면) */
  atHome: () => boolean;
};

/**
 * 네이티브가 받아 둔 새 버전을 **안전한 순간에** 적용한다 — 앱이 켜질 때 한 번 부른다. 돌려주는 함수로 멈춘다.
 *
 * 받는 것은 네이티브가 켤 때 한다(`app.json` 의 `checkAutomatically` 기본값). 여기서는 다 받았을 때
 * (`isUpdatePending`) 언제 다시 시작할지만 정한다:
 *  1. 로그인한 사람 — 켠 지 6초 안이면(시작 화면) 바로. 깜빡임이 안 보인다
 *  2. 로그인 전 — **로그인 버튼을 누르기 전이면** 바로. 새로 깐 사람이 스토어 빌드의 옛 코드에 갇히지 않게
 *  3. 그 밖 — 3초마다 보다가, 로그인 전이면 「아직 안 눌렀을 때」, 로그인했으면 「메인에 있을 때」
 * 어느 경우든 **로그인·가입 중이거나 앱이 뒤로 가 있으면 하지 않는다** — 끝내 기회가 없으면 다음 실행에 저절로 적용된다.
 */
export function autoApply(deps: AutoApplyDeps, opts: { quickMs?: number; everyMs?: number } = {}): () => void {
  const U = updates();
  if (!U) return () => undefined;
  const quickMs = opts.quickMs ?? 6000;
  const everyMs = opts.everyMs ?? 3000;
  const launchedAt = Date.now();
  let armed = false;
  let timer: ReturnType<typeof setInterval> | null = null;
  let sub: { remove: () => void } | undefined;

  const busy = (): boolean => deps.busy() || !env.active();
  const reload = (): void => {
    try { void Promise.resolve(U.reloadAsync()).catch(() => undefined); } catch { /* 다음 실행에 적용된다 */ }
  };

  const onPending = (): void => {
    if (armed) return;
    armed = true;
    // 1. 시작 화면이 아직 떠 있는 동안 — 켠 지 6초 안에 로그인 창을 여는 사람도 있어 같은 가드를 둔다
    if (deps.signedIn() && !busy() && Date.now() - launchedAt < quickMs) { reload(); return; }
    // 2. 로그인 전, 아직 로그인 버튼을 안 눌렀다 — 재시작해도 같은 로그인 화면으로 돌아올 뿐이다
    if (!deps.signedIn() && !deps.triedAuth() && !busy()) { reload(); return; }
    // 3. 그 뒤로는 조용한 순간을 기다린다
    timer = setInterval(() => {
      if (busy()) return;
      if (!deps.signedIn()) { if (deps.triedAuth()) return; }
      else if (!deps.atHome()) return;
      if (timer) clearInterval(timer);
      timer = null;
      reload();
    }, everyMs);
  };

  try {
    if (U.latestContext?.isUpdatePending) onPending();
    else sub = U.addUpdatesStateChangeListener?.((e) => { if (e?.context?.isUpdatePending) { sub?.remove(); onPending(); } });
  } catch { /* 상태를 못 읽으면 다음 실행에 저절로 적용된다 */ }

  return () => {
    sub?.remove();
    if (timer) clearInterval(timer);
    timer = null;
  };
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
