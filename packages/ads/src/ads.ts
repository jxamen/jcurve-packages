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
   * 구글 테스트 광고를 쓸까 — 보통 `isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST)`.
   * 개발 실행(`__DEV__`)은 이 값과 무관하게 테스트 광고다.
   */
  test: boolean;
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
  /** 못 봤다 — 보상을 주지 말고 남은 횟수도 깎지 않는다 */
  onFail: (msg: string) => void;
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
  /** 안내 팝업이 뜨는 순간 미리 받아 둔다 — **앱 시작에는 부르지 않는다**(발열) */
  warm: (userId?: string, customData?: string, interstitial?: boolean) => void;
  /** 미리 받아 둔 광고가 바로 열 수 있는가 — 대기 화면을 띄울지 정한다 */
  warmReady: (userId?: string, customData?: string, interstitial?: boolean) => boolean;
  /** 기다리기를 그만둔다(대기 화면의 「그만두기」) — 실패로 세지 않는다 */
  cancel: () => void;
  /** 광고 자리를 접어 둔 시간이 얼마나 남았나 — 0 이면 평소대로 */
  mutedMs: () => number;
  /** iOS 추적 허용(ATT)을 한 번만 묻는다 — 미션 제출 중간에 창이 뜨지 않게 미리 부를 수 있다 */
  requestTracking: () => Promise<void>;
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
    if (!initDone) initDone = Promise.resolve().then(() => mod.default().initialize()).catch(() => null);

    return withTimeout(initDone, 5000);
  };

  let trackingP: Promise<void> | null = null;
  const requestTracking = (): Promise<void> => {
    if (os !== 'ios') return Promise.resolve();
    if (trackingP) return trackingP;
    trackingP = (async () => {
      try {
        const att = env.tracking();
        if (!att) return;
        const cur = (await withTimeout(att.getTrackingPermissionsAsync(), 3000)) as { status?: string } | null;
        if (cur?.status === 'undetermined') await withTimeout(att.requestTrackingPermissionsAsync(), 20000);
      } catch { /* 모듈이 없는 빌드면 그냥 넘어간다 */ }
    })();

    return trackingP;
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

  const makeAd = (userId?: string, customData?: string, interstitial = false): any => {
    const { RewardedAd, RewardedInterstitialAd, TestIds } = mod;
    // 보상형 전면도 이벤트·SSV 가 보상형과 같다 — 만드는 클래스와 광고 단위만 다르다
    if (interstitial) {
      const unit = test ? TestIds.REWARDED_INTERSTITIAL : unitOf(opts.units.rewardedInterstitial);

      return RewardedInterstitialAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...ssvRequestOptions(test, userId, customData) });
    }
    const unit = test ? TestIds.REWARDED : unitOf(opts.units.rewarded);

    return RewardedAd.createForAdRequest(unit, { requestNonPersonalizedAdsOnly: false, ...ssvRequestOptions(test, userId, customData) });
  };

  /*
   | 미리 받아 둔 광고 — 안내 팝업이 뜨는 순간 받아 두면 확인을 누를 때 로딩 없이 바로 열린다(꼬꼬농장 2026-08-27).
   | **한 번 쓰고 버린다** — 한 인스턴스를 재사용하면 두 번째부터 안 열렸다.
   | 보상형·보상형 전면은 다른 광고라 키를 가른다 — 섞어 꺼내 쓰면 다른 형식이 열린다.
   */
  let pre: { ad: any; key: string; loaded: boolean; offs: Array<() => void> } | null = null;
  const preKey = (u?: string, c?: string, i = false): string => (u ?? '') + '|' + (c ?? '') + (i ? '|i' : '');
  const dropPre = (): void => {
    if (!pre) return;
    pre.offs.forEach((f) => { try { f(); } catch { /* noop */ } });
    pre = null;
  };
  /** 같은 보상 조건일 때만 꺼낸다 — SSV 데이터가 다르면 못 쓴다 */
  const takeWarm = (key: string): any => {
    if (!pre || !pre.loaded || pre.key !== key) return null;
    const box = pre;
    pre = null;
    box.offs.forEach((f) => { try { f(); } catch { /* noop */ } });

    return box.ad;
  };
  const warmReady = (userId?: string, customData?: string, interstitial = false): boolean =>
    !!pre && pre.loaded && pre.key === preKey(userId, customData, interstitial);
  const warm = (userId?: string, customData?: string, interstitial = false): void => {
    if (!nativeReady || !unitReady || showing) return;
    if (interstitial && !interstitialAvailable) return;
    const key = preKey(userId, customData, interstitial);
    if (pre && pre.key === key) return;      // 이미 같은 조건으로 받는 중
    dropPre();
    void ensureInit().then(() => {
      if (showing || pre) return;
      const { RewardedAdEventType, AdEventType } = mod;
      const box = { ad: makeAd(userId, customData, interstitial), key, loaded: false, offs: [] as Array<() => void> };
      box.offs.push(box.ad.addAdEventListener(RewardedAdEventType.LOADED, () => { box.loaded = true; }));
      box.offs.push(box.ad.addAdEventListener(AdEventType.ERROR, () => { if (pre === box) dropPre(); }));
      pre = box;
      try { box.ad.load(); } catch { if (pre === box) dropPre(); }
    });
  };

  async function show({ userId, customData, interstitial = false, onEarned, onFail, onClosed, onOpened }: ShowOptions): Promise<boolean> {
    if (!nativeReady) { onFail('이 빌드에서는 광고를 재생할 수 없어요'); return false; }
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
    // 안내 팝업에서 미리 받아 둔 게 있으면 그걸 그대로 연다(로딩 대기 없음)
    const warmAd = takeWarm(preKey(userId, customData, interstitial));
    if (!warmAd) dropPre();
    const ad = warmAd ?? makeAd(userId, customData, interstitial);

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
    const safe = (f?: (m?: any) => void, arg?: any): void => { try { f?.(arg); } catch { /* noop */ } };
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
        if (!got) safe(onFail, '광고를 끝까지 보지 않았어요');
      }, 1200));
    };
    const fail = (msg: string): void => {
      if (finished) return;
      finished = true;
      // 보상형 전면(재고가 자주 빈다)의 실패는 자리 접기 횟수에 넣지 않는다 — 전면이 몇 번 비었다고 멀쩡한
      // 「광고 보고 받기」까지 30분 접혔다(꼬꼬농장 2026-09-14). 전면이 실패하면 부르는 쪽이 보상형으로 잇는다
      if (!interstitial) noteAdFail();
      cleanup();
      safe(onFail, msg);
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
    offs.push(ad.addAdEventListener(AdEventType.CLOSED, () => {
      finishClose();
      // 미리 받아 둔 것은 방금 썼다 — 다음 것을 바로 받아 둔다(안 하면 연달아 볼 때 로딩에서 실패했다, 2026-09-08)
      if (!interstitial) setTimeout(() => warm(userId, customData), 1500);
    }));
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
      // 미리 받아 둔 광고는 LOADED 가 이미 지났으므로 바로 띄운다
      if (warmAd) present();
      else ad.load();
    } catch (e: any) {
      fail('광고를 열지 못했어요 (' + String(e?.message ?? e ?? '원인 불명') + ')');

      return false;
    }
    /*
     | 광고가 없으면 ERROR 가 몇 초 안에 오므로, 여기까지 오는 것은 SDK 가 응답을 안 주는 경우다 — 더 기다려도
     | 소용없다. 25초는 화면이 덮인 채 멈춘 줄 알았다는 제보가 와서(2026-09-10) 15초(미리 받은 것은 12초).
     */
    timers.push(setTimeout(() => {
      if (!opened && !finished) fail('광고를 불러오지 못했어요. 잠시 후 다시 시도해 주세요 (' + stage + ')');
    }, warmAd ? 12000 : 15000));

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
  };
}
