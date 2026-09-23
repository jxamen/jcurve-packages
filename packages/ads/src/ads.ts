/**
 * 보상형 광고 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다(꼬꼬농장 `src/ads/rewarded.ts` 에서 옮김).
 *
 * **이 파일은 앱을 모른다.** 광고 단위 ID·테스트 여부는 앱이 넘기고, 보상을 무엇으로 줄지·하루 몇 번인지는
 * 앱의 일이다. 여기는 「광고를 안전하게 띄우고 끝까지 봤는지 알려 주기」만 한다.
 *
 * ⚠ `require` 안의 이름은 **글자 그대로** 쓴다 — Metro 는 require 를 빌드 때 찾고, 변수로 주면 실행 때 던지는
 * 코드로 바꿔 모듈이 늘 없는 것처럼 돈다(`@jcurve/notify` 1.1.0 사고).
 */
import { ssvRequestOptions } from './mode';

/* eslint-disable @typescript-eslint/no-explicit-any */

declare const __DEV__: boolean | undefined;

/** 플랫폼마다 따로인 광고 단위 ID */
export type AdUnits = { android?: string; ios?: string };

export type AdsOptions = {
  units: {
    /** 보상형 — 「광고 보고 받기」 */
    rewarded: AdUnits;
    /** 보상형 전면 — 안내 카운트다운 뒤 저절로 시작하는 것(없으면 안 쓴다) */
    rewardedInterstitial?: AdUnits;
  };
  /**
   * 구글 테스트 광고를 쓸까 — 보통 `isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST, testDevices.length > 0)`.
   * 개발 실행(`__DEV__`)은 이 값과 무관하게 테스트 광고다.
   */
  test: boolean;
  /**
   * 애드몹 테스트 기기 ID(1.1, 당근캐시). 여기 적힌 기기는 **실제 광고 단위로도 테스트 광고**를 받는다 —
   * 검수 기기에 실광고가 뜨면 정책 위반이고, 실단위라야 SSV 가 와서 보상 흐름을 끝까지 시험할 수 있다.
   * ID 는 그 기기에서 광고를 한 번 요청하면 로그에 찍힌다(`testDeviceIdentifiers = @[ @"…" ]`). 서명 키마다 다르다.
   */
  testDevices?: string[];
  /**
   * 기기 ID 를 돌려주는 함수(선택) — 주면 SSV 값(`customData`)에 **`dev` 로 함께 실어 보낸다**(1.5, 2026-09-23).
   *
   * 광고 기록에 회원번호밖에 없어 「한 사람이 많이 보는가, 계정이 여럿인가」를 가릴 수 없었다.
   * 앱이 **이미 만들어 둔** 값을 받아 쓸 뿐이라 새로 걷는 항목이 아니고, 광고 식별자(adid)도 아니다.
   * 보통 `device: funnel.deviceId`(`@jcurve/auth`). 빈 문자열이면 그 광고만 그냥 나간다.
   */
  device?: () => string;
  /**
   * 광고 식별자(IDFA/광고 ID)를 SSV 값에 `adid` 로 실을까(1.5). **기본은 끄기.**
   *
   * 서버가 이것으로 **폰 하나당 하루 몇 회**를 전 앱 합산해 센다 — 앱이 스스로 만든 기기 ID 는
   * 앱을 넘지 못해 합산이 안 된다. 새로 걷는 항목은 아니지만(미션이 이미 쓴다) **쓰는 목적이 늘어난다** —
   * 그래서 **개인정보처리방침에 「부정 이용 방지·전체 하루 상한 합산에 쓴다」가 들어간 앱만** 켠다.
   * 추적을 껐거나 iOS 미동의면 값이 없고, 그때는 싣지 않는다(서버도 그런 기기는 막지 않는다).
   */
  adid?: boolean;
};

export type ShowOptions = {
  /** 서버 보상 확인(SSV)에 실을 회원 번호 — 둘러보기면 비운다 */
  userId?: string;
  /** SSV 에 같이 실을 값(무엇에 대한 보상인지). 미리 받아 둔 광고는 이 값까지 같아야 쓴다 */
  customData?: string;
  /** 보상형 전면으로 띄울까 */
  interstitial?: boolean;
  /** 끝까지 봤다 — 광고가 아직 전체화면일 때 온다(연출은 onClosed 뒤에) */
  onEarned: () => void;
  /**
   * 못 봤다 — 보상을 주지 말고 남은 횟수도 깎지 않는다.
   *
   * `noAd` 는 **광고가 열리지도 않았다**(재고 없음·로드 실패·시간 초과)는 뜻이다(1.1, 당근캐시). 중간에 닫은 것
   * (`noAd: false`)과 가를 자리가 있다 — 이미 번 것을 꺼내는 동작은 광고를 못 띄웠다는 이유로 잠그면 안 되고,
   * 중간에 닫은 것은 멈춰야 한다. 인자 하나만 받는 함수를 줘도 된다.
   */
  onFail: (msg: string, noAd: boolean) => void;
  onClosed?: () => void;
  onOpened?: () => void;
};

export type Rewarded = {
  /** 실제 광고를 띄울 수 있는 빌드인가(Expo Go·웹은 거짓 — 앱이 목업으로 넘어간다) */
  available: boolean;
  /** 보상형 전면을 띄울 수 있는가 */
  interstitialAvailable: boolean;
  /** 광고를 띄운다. 이미 하나가 도는 중이라 시작하지 못하면 거짓 */
  show: (o: ShowOptions) => Promise<boolean>;
  /**
   * **(1.2) 아무것도 하지 않는다** — 광고를 미리 받지 않는다(2026-09-22 사용자 결정 「미리 받아 오는 거 없애자」).
   * 받아 두고 안 보여 준 광고는 AdMob 에 요청만 있고 노출이 없는 것으로 쌓인다. 부르는 앱이 깨지지 않게 이름만 남겼다.
   */
  warm: (userId?: string, customData?: string, interstitial?: boolean) => void;
  /** (1.2) 늘 거짓 — 미리 받아 두지 않으므로. 대기 화면은 늘 뜬다 */
  warmReady: (userId?: string, customData?: string, interstitial?: boolean) => boolean;
  /** 기다리기를 그만둔다(대기 화면의 「그만두기」) — 실패로 세지 않는다 */
  cancel: () => void;
  /** 광고 자리를 접어 둔 시간이 얼마나 남았나 — 0 이면 평소대로 */
  mutedMs: () => number;
  /**
   * iOS 추적 허용(ATT)을 묻는다 — **앱을 켤 때 앱 루트가 한 번 부른다**(1.3). 광고를 열 때도 부르지만 그것만으로는
   * 심사자가 창을 못 찾는다(용돈캡슐 2026-09-21 거절 「iOS 27 에서 ATT 창을 찾을 수 없다」).
   * 앱이 앞에 올라온 뒤 0.6초 기다렸다 묻고, 창 없이 넘어가면(답이 미정) 다음 호출에 다시 묻는다.
   * 알림 권한 창과 겹치면 ATT 가 창 없이 끝난다 — 알림을 묻기 전에 이 약속을 기다린다.
   */
  requestTracking: () => Promise<void>;
  /**
   * 광고 식별자(IDFA · AAID) — **읽기만 한다**(1.4). ATT 는 묻지 않는다 — 묻는 것은 `requestTracking` 이 켤 때 한다.
   * iOS 는 추적을 허용했을 때만 값, 안드로이드는 그대로. 초기화된 식별자(0000-…)·시뮬레이터는 null.
   * 미션 매체가 참여자를 가리는 데 쓴다(당근·영테크·용돈캡슐·캐시팡이 각자 들고 있던 adid.ts — 그중 몇은 여기서
   * ATT 를 따로 물어 심사 기준과 어긋났다).
   */
  advertisingId: () => Promise<string | null>;
};

type AppStateLike = { currentState: string; addEventListener: (t: 'change', fn: (s: string) => void) => { remove: () => void } };

/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다 */
export type AdsEnv = {
  sdk: () => any | null;
  tracking: () => any | null;
  os: () => string;
  appState: () => AppStateLike | null;
  dev: () => boolean;
};

const defaultEnv = (): AdsEnv => ({
  // 네이티브 모듈이 없으면(Expo Go) 여기서 예외가 나고 목업으로 넘어간다
  sdk: () => { try { return require('react-native-google-mobile-ads'); } catch { return null; } },
  tracking: () => { try { return require('expo-tracking-transparency'); } catch { return null; } },
  os: () => { try { return String(require('react-native').Platform.OS ?? ''); } catch { return ''; } },
  appState: () => { try { return require('react-native').AppState as AppStateLike; } catch { return null; } },
  dev: () => typeof __DEV__ !== 'undefined' && !!__DEV__,
});

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p.catch(() => null), new Promise<null>((r) => setTimeout(() => r(null), ms))]);
}

/*
 | 광고가 연달아 안 채워지면(no-fill) 잠시 쉰다(꼬꼬농장 2026-09-09).
 | 눌러도 안 열리는 버튼을 계속 보여 주면 사용자가 앱을 못 믿는다. 세 번 잇달아 실패하면 30분 동안 광고 자리를
 | 접고, 한 번이라도 열리면 곧바로 되살린다 — 광고를 끄는 게 아니라 잠깐 접어 두는 것이다.
 */
const MUTE_AFTER = 3;
const MUTE_MS = 30 * 60 * 1000;

export function createRewarded(opts: AdsOptions, env: AdsEnv = defaultEnv()): Rewarded {
  const mod = env.sdk();
  const os = env.os();
  const test = env.dev() || opts.test;
  const unitOf = (u?: AdUnits): string => (os === 'ios' ? u?.ios : os === 'android' ? u?.android : '') ?? '';

  const nativeReady = !!(mod && mod.RewardedAd && mod.default);
  const unitReady = test || !!unitOf(opts.units.rewarded);
  const interstitialAvailable = nativeReady && !!mod?.RewardedInterstitialAd && (test || !!unitOf(opts.units.rewardedInterstitial));

  /*
   | **앱 시작에 초기화하지 않는다** — 광고를 한 번도 안 봐도 SDK 가 계속 돌아 기기가 더워졌다(꼬꼬농장 2026-08-26).
   | 첫 광고 직전에 부르므로 기능상 차이는 첫 광고의 로딩이 조금 길어지는 것뿐이다.
   */
  let initDone: Promise<unknown> | null = null;
  const ensureInit = (): Promise<unknown> => {
    if (!nativeReady) return Promise.resolve(null);
    if (!initDone) {
      initDone = (async () => {
        // 등록된 테스트 기기 — 초기화 **전에** 알려야 첫 광고부터 테스트 광고가 나온다
        if (opts.testDevices && opts.testDevices.length > 0) {
          await Promise.resolve(mod.default().setRequestConfiguration({ testDeviceIdentifiers: opts.testDevices })).catch(() => null);
        }

        return mod.default().initialize();
      })().catch(() => null);
    }

    return withTimeout(initDone, 5000);
  };

  /*
   | **앱이 앞에 올라온 뒤에** 묻는다(1.3, 당근캐시 96ae2c7 에서 옮김). 그 전에 부르면 iOS 가 창을 띄우지 않고 조용히
   | 넘긴다 — 답이 미정(undetermined)으로 남는다. 전에는 한 실행에 한 번만 물어서 그 실행에서는 다시 안 떴다.
   | 이제 창 없이 넘어갔으면 기억을 지워 다음 호출(광고를 열 때 등)에 다시 묻는다.
   | 앞에 올라온 뒤 0.6초 — 첫 화면이 그려지기 전에 창이 뜨면 뒤가 빈 화면이다.
   */
  const SETTLE_MS = 600;
  const whenActive = (): Promise<void> => new Promise((resolve) => {
    const st = env.appState();
    if (!st || st.currentState === 'active') { resolve(); return; }
    let sub: { remove: () => void } | null = null;
    try {
      sub = st.addEventListener('change', (s: string) => {
        if (s !== 'active') return;
        try { sub?.remove(); } catch { /* noop */ }
        resolve();
      });
    } catch { resolve(); }
  });
  let trackingP: Promise<void> | null = null;
  let trackingGen = 0;   // 창 없이 넘어간 **이번 시도만** 지운다 — 사이에 새로 시작한 것을 지우지 않게
  const requestTracking = (): Promise<void> => {
    if (os !== 'ios') return Promise.resolve();
    if (trackingP) return trackingP;
    const gen = ++trackingGen;
    const forget = (): void => { if (trackingGen === gen) trackingP = null; };
    trackingP = (async () => {
      try {
        const att = env.tracking();
        if (!att) return;   // 모듈이 없는 빌드 — 묻지 못한 것이지 고장이 아니다
        await whenActive();
        await new Promise((r) => setTimeout(r, SETTLE_MS));
        const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000)) as { status?: string } | null;
        if (cur?.status !== 'undetermined') return;   // 이미 답했다(허용·거부) — 다시 묻지 않는다
        const after = (await withTimeout(att.requestTrackingPermissionsAsync(), 20000)) as { status?: string } | null;
        if (!after || after.status === 'undetermined') forget();   // 창 없이 넘어갔다 — 다음 호출에 다시 묻는다
      } catch {
        forget();
      }
    })();

    return trackingP;
  };

  // 값을 얻었을 때만 기억한다 — 아직 허용 전이면 나중에 허용된 뒤 다시 읽는다
  let adidCache: string | null = null;
  const advertisingId = async (): Promise<string | null> => {
    if (adidCache) return adidCache;
    try {
      const att = env.tracking();
      if (!att) return null;
      if (os === 'ios') {
        const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000)) as { granted?: boolean; status?: string } | null;
        if (!(cur?.granted === true || cur?.status === 'granted')) return null;
      }
      const id = typeof att.getAdvertisingId === 'function' ? att.getAdvertisingId() : null;
      const v = typeof id === 'string' && id !== '' && !/^[0-]+$/.test(id) ? id : null;
      if (v) adidCache = v;

      return v;
    } catch {
      return null;
    }
  };

  let showing = false;
  let showingAt = 0;
  let stage = '';
  let failStreak = 0;
  let mutedUntil = 0;
  let abortCurrent: (() => void) | null = null;
  const noteAdFail = (): void => {
    failStreak += 1;
    if (failStreak >= MUTE_AFTER) { mutedUntil = Date.now() + MUTE_MS; failStreak = 0; }
  };
  const noteAdOpen = (): void => { failStreak = 0; mutedUntil = 0; };

  /**
   * SSV 값에 기기 ID 를 끼운다 — **JSON 객체로 온 값에만**.
   * 'feed' 처럼 맨 문자열을 보내는 앱의 뜻을 바꾸면 서버 판정이 어긋난다.
   * 앱이 이미 `dev` 를 넣어 보냈으면 그대로 둔다(앱 쪽이 먼저다).
   */
  const withDevice = (customData?: string): string | undefined => {
    const dev = (opts.device?.() ?? '').slice(0, 64);
    /*
     | 광고 식별자(adid)는 **전 앱 합산 상한**의 기준이다(1.5, 2026-09-23 — 서버가 폰 하나당 하루 몇 회로 센다).
     | 앱이 스스로 만든 기기 ID 는 앱을 넘지 못해 합산이 안 된다.
     | **이미 읽어 둔 값만** 쓴다 — 여기서 기다리면 광고 여는 것이 늦어진다. 아직 없으면 지금 읽어 두고
     | 이번 광고만 없이 나간다(다음 광고부터 실린다). 추적을 껐거나 iOS 미동의면 영영 없고, 그건 그대로 둔다.
     */
    if (opts.adid && !adidCache) void advertisingId();
    const adid = opts.adid ? (adidCache ?? '').slice(0, 64) : '';
    const body = (customData ?? '').trim();
    if ((!dev && !adid) || body === '') return customData;
    const add: Record<string, string> = {};
    if (dev) add.dev = dev;
    if (adid) add.adid = adid;

    /*
     | **용도를 평문으로 보내는 앱**(당근 `harvest` · 영테크 `ticket` · 꾹테크 `stamp_main`)은
     | `{"purpose":"<평문>", dev, adid}` 로 감싼다(1.5.1). 감싸지 않으면 그 앱들에는 기기 ID·광고
     | 식별자가 영영 안 실린다 — 전 앱 합산의 기준이 그 값이라 앱마다 구멍이 남는다.
     | 서버는 평문과 이 모양을 **둘 다** 받는다(jcurve-api 51b46b6). 서버가 먼저 나가야 한다.
     */
    if (!body.startsWith('{') || !body.endsWith('}')) {
      return JSON.stringify({ purpose: body, ...add });
    }
    try {
      const o = JSON.parse(body);
      if (!o || typeof o !== 'object' || Array.isArray(o)) return customData;
      for (const k of Object.keys(add)) { if (k in o) delete add[k]; }   // 앱이 이미 넣은 값은 덮지 않는다

      return Object.keys(add).length > 0 ? JSON.stringify({ ...o, ...add }) : customData;
    } catch {
      return customData;   // 우리가 못 읽는 모양이면 건드리지 않는다
    }
  };

  const makeAd = (userId?: string, customData?: string, interstitial = false): any => {
    const { RewardedAd, RewardedInterstitialAd, TestIds } = mod;
    // 보상형 전면도 이벤트·SSV 가 보상형과 같다 — 만드는 클래스와 광고 단위만 다르다
    if (interstitial) {
      const unit = test ? TestIds.REWARDED_INTERSTITIAL : unitOf(opts.units.rewardedInterstitial);

      return RewardedInterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...ssvRequestOptions(test, userId, withDevice(customData)) });
    }
    const unit = test ? TestIds.REWARDED : unitOf(opts.units.rewarded);

    return RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...ssvRequestOptions(test, userId, withDevice(customData)) });
  };

  /*
   | **광고는 보여 줄 때만 받는다**(1.2, 2026-09-22 사용자 결정 「미리 받아 오는 거 없애자」).
   | 전에는 안내 팝업이 뜰 때(warm)와 광고를 닫은 1.5초 뒤 다음 것을 미리 받아 두었다(2026-08-27 · 09-08). 받아 두고
   | 안 보여 준 광고는 AdMob 에 요청만 있고 노출은 없는 것으로 쌓인다. 대가는 누를 때마다 몇 초의 로딩이다.
   | warm · warmReady 는 부르는 앱이 깨지지 않게 이름만 남긴다.
   */
  const warm = (_userId?: string, _customData?: string, _interstitial = false): void => { /* 1.2: 미리 받지 않는다 */ };
  const warmReady = (_userId?: string, _customData?: string, _interstitial = false): boolean => false;

  async function show({ userId, customData, interstitial = false, onEarned, onFail, onClosed, onOpened }: ShowOptions): Promise<boolean> {
    if (!nativeReady) { onFail('이 빌드에서는 광고를 재생할 수 없어요', true); return false; }
    const appState = env.appState();
    const elapsed = Date.now() - showingAt;
    if (showing) {
      // 걸린 채 남은 표시를 푼다 — 받기·열기가 12초 넘게 멈췄거나, 광고가 닫혔는데 닫힘을 못 받았을 때
      const stuckLoad = (stage === 'load' || stage === 'init' || stage === 'show') && elapsed >= 12_000;
      const missedClose = stage === 'open' && elapsed >= 1500 && (appState?.currentState ?? 'active') === 'active';
      if (!stuckLoad && !missedClose) return false;
      abortCurrent?.();
    }
    showing = true;
    showingAt = Date.now();
    void requestTracking();
    stage = 'init';
    try { await ensureInit(); } catch { /* 아래에서 요청을 시도하고 안 되면 ERROR 로 안내된다 */ }
    const { RewardedAdEventType, AdEventType } = mod;
    const ad = makeAd(userId, customData, interstitial);

    let earned = false;
    let opened = false;
    let finished = false;
    let sawBg = false;
    const offs: Array<() => void> = [];
    const timers: Array<ReturnType<typeof setTimeout>> = [];
    let appSub: { remove: () => void } | null = null;
    const cleanup = (): void => {
      abortCurrent = null;
      showing = false;
      stage = '';
      try { appSub?.remove(); } catch { /* noop */ }
      appSub = null;
      offs.forEach((f) => { try { f(); } catch { /* noop */ } });
      offs.length = 0;
      timers.forEach((t) => clearTimeout(t));
      timers.length = 0;
    };
    abortCurrent = () => { finished = true; cleanup(); };
    const safe = (f?: (...a: any[]) => void, ...args: any[]): void => { try { f?.(...args); } catch { /* noop */ } };
    /*
     | 광고를 끝까지 봤는데 「끝까지 보지 않았어요」가 뜨고 보상도 안 들어왔다(꼬꼬농장 2026-09-08).
     | EARNED_REWARD 가 CLOSED **뒤에** 오는 기기가 있다 — 마지막 순간에 X 를 누르면 특히 그렇다.
     | 닫힘 직후 잠깐(1.2초) 리스너를 살려 두고, 그사이 보상이 오면 정상 지급한다.
     */
    const finishClose = (): void => {
      if (finished) return;
      finished = true;
      safe(onClosed);
      if (earned) { cleanup(); return; }
      timers.push(setTimeout(() => {
        const got = earned;
        cleanup();
        if (!got) safe(onFail, '광고를 끝까지 보지 않았어요', false);   // 열렸다가 중간에 닫았다
      }, 1200));
    };
    const fail = (msg: string): void => {
      if (finished) return;
      finished = true;
      // 보상형 전면(재고가 자주 빈다)의 실패는 자리 접기 횟수에 넣지 않는다 — 전면이 몇 번 비었다고 멀쩡한
      // 「광고 보고 받기」까지 30분 접혔다(꼬꼬농장 2026-09-14). 전면이 실패하면 부르는 쪽이 보상형으로 잇는다
      if (!interstitial) noteAdFail();
      cleanup();
      safe(onFail, msg, !opened);   // 열리기 전에 실패했으면 noAd
    };

    const present = (): void => {
      stage = 'show';
      let p: Promise<void> | void;
      try {
        p = ad.show();
      } catch (e: any) {
        fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');
        return;
      }
      if (p && typeof (p as Promise<void>).then === 'function') {
        (p as Promise<void>).catch((e: any) => {
          if (!opened) fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');
        });
      }
    };
    stage = 'load';
    offs.push(ad.addAdEventListener(RewardedAdEventType.LOADED, present));
    offs.push(ad.addAdEventListener(AdEventType.OPENED, () => {
      opened = true;
      stage = 'open';
      noteAdOpen();
      safe(onOpened);
    }));
    offs.push(ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => { earned = true; safe(onEarned); }));
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => finishClose()));
    offs.push(ad.addAdEventListener(AdEventType.ERROR, (err: any) => {
      const code = String(err?.code ?? err?.message ?? '');
      fail(/no.?fill/i.test(code)
        ? '지금은 볼 수 있는 광고가 없어요. 잠시 후 다시 시도해 주세요'
        : '광고를 불러오지 못했어요 (' + (code || '원인 불명') + ')');
    }));
    // 닫힘 이벤트를 못 받는 기기 — 앱이 뒤로 갔다 돌아오면 닫힌 것으로 본다
    try {
      appSub = appState?.addEventListener('change', (s: string) => {
        if (s !== 'active') { sawBg = true; return; }
        if (sawBg && opened && !finished) finishClose();
      }) ?? null;
    } catch { appSub = null; }

    try {
      ad.load();
    } catch (e: any) {
      fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');

      return false;
    }
    /*
     | 광고가 없으면 ERROR 가 몇 초 안에 오므로, 여기까지 오는 것은 SDK 가 응답을 안 주는 경우다 — 더 기다려도
     | 소용없다. 25초는 화면이 덮인 채 멈춘 줄 알았다는 제보가 와서(2026-09-10) 15초.
     */
    timers.push(setTimeout(() => {
      if (!opened && !finished) fail('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 (' + stage + ')');
    }, 15000));

    return true;
  }

  return {
    available: nativeReady && unitReady,
    interstitialAvailable,
    show,
    warm,
    warmReady,
    cancel: () => { abortCurrent?.(); },
    mutedMs: () => Math.max(0, mutedUntil - Date.now()),
    requestTracking,
    advertisingId,
  };
}
