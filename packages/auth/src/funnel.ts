/**
 * 가입 퍼널을 **우리 서버**(jcurve-api `{app}/funnel`)에 남긴다.
 *
 * GA4 에 가는 같은 이벤트를 조회 권한 없이도 볼 수 있어야 해서다 — 설치 79건에 가입 20명일 때
 * 어디서 멈추는지(앱을 안 열었는지·로그인 화면에서 떠났는지) 서버 기록만으로는 알 수 없었다
 * (꼬꼬농장 2026-09-15).
 *
 * **앱마다 이름이 같아야 한다.** 어드민의 「시간대별 가입 비교」·퍼널은 이 이름으로 앱을 나란히
 * 놓는다. 앱마다 `login_click`·`tap_login` 처럼 제각각이면 비교가 깨진다 — 그래서 로그인과 한
 * 패키지에 둔다.
 *
 * **개인정보를 보내지 않는다** — 설치 때 만든 난수 기기 ID·단계·플랫폼·앱 버전·짧은 꼬리표뿐.
 * 실패해도 조용히 넘긴다(계측이 앱을 막으면 안 된다).
 */

/**
 * 서버가 받는 이벤트 — **jcurve-api `FunnelController::EVENTS` 와 같아야 한다.**
 *
 * 여기 없는 이름은 보내지 않는다. 서버에 없는 이름을 보내면 400 으로 버려지는데, 앱에서는
 * 아무 오류도 안 보여 「그 단계만 조용히 비어 있다」로만 드러난다.
 */
export const FUNNEL_EVENTS: readonly string[] = [
  'first_open', 'app_open',
  'onboarding_view', 'onboarding_done',
  'login_view', 'login_tap', 'login_cancel', 'login_fail', 'login_done', 'login_native_fallback',
  'signup_start', 'signup_terms_view', 'signup_terms_done', 'signup_done', 'signup_abort', 'signup_fail',
  'install_ref',
  'guest_tap', 'guest_start', 'guest_signup_view',
  // 가입 관문 밖의 기능 계측(2.1) — 초대·앱 모아보기. 서버가 받게 되어(jcurve-api c002595) GA4 와 함께 서버에도 남긴다
  'invite_lock', 'invite_join', 'invite_share',
  'apphub_open', 'apphub_tap',
  // 푸시 토큰을 못 올린 까닭(@jcurve/notify onError) — 목록에 없어 GA4 로만 가고 서버 퍼널에 안 남았다(2.1.3, 꿀꿀)
  'push_register_failed',
];

/**
 * 개인정보처럼 보이는 값인가 — 이메일(@) 이나 숫자가 7개 넘게 이어진 것(전화번호·회원번호).
 *
 * 「개인정보를 보내지 않는다」가 약속뿐이면 언젠가 누가 `reason` 에 번호를 넣는다(Codex #9).
 * 완전한 차단은 아니다 — **눈에 띄는 것**만 막는다. 이름 같은 것은 부르는 쪽이 넣지 않아야 한다.
 */
export function looksPersonal(v: string | number): boolean {
  const s = String(v);
  // 이메일 · 숫자 7개 넘게 이어짐 · 하이픈·점·공백으로 끊은 전화번호(010-1234-5678)도(Codex 2차 #6)
  return /@|\d{7,}|\d{2,4}[-.\s]\d{3,4}[-.\s]\d{4}/.test(s);
}

/** AsyncStorage 모양 — 앱의 것을 그대로 준다 */
export type KeyValue = {
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
};

export type FunnelDeps = {
  /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
  base: string;
  /** 앱 공개 토큰(`X-App-Token`) */
  appToken: string;
  storage: KeyValue;
  /**
   * 저장 키 — **이미 쓰던 앱은 쓰던 이름을 그대로 준다.**
   *
   * 이름이 바뀌면 모든 기기가 새 ID 를 받아 **하루에 전 사용자가 「첫 실행」으로 찍힌다.**
   * 기본값은 새 앱용이다.
   */
  keys?: { device?: string; installRef?: string };
  /**
   * 이 기능이 나오기 **전부터** 쓰던 사람인가 — 그러면 기기 ID 가 없어도 첫 실행으로 세지 않는다.
   *
   * 앱마다 알아보는 방법이 다르다(로그인 세션·앱 소개를 본 기록 등). 안 주면 기기 ID 가 없는
   * 사람을 모두 새 설치로 본다 — **새 앱에서만** 그래도 된다.
   */
  existingUser?: () => Promise<boolean>;
};

export type Funnel = {
  /** 퍼널 이벤트면 보낸다. `prop` 은 제공자·사유 같은 한 토막(영문·숫자·`_:.-`, 40자) */
  event: (name: string, prop?: string) => void;
  /** 앱 실행마다 한 번 — 설치 후 첫 실행이면 `first_open` 도, 안드로이드면 설치 출처도 한 번 */
  appOpen: () => void;
};

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 기기와 닿는 것 — 시험에서만 갈아 끼운다 */
export type FunnelEnv = {
  os: () => string;
  appVersion: () => string;
  post: (url: string, headers: Record<string, string>, body: string) => Promise<boolean>;
  /** 안드로이드 설치 시각·리퍼러. 모듈이 없으면 null */
  install: () => Promise<{ at: number; ref: string } | null>;
  now: () => number;
  random: () => string;
};

function mod<M>(load: () => M): M | null {
  try { return load(); } catch { return null; }
}

/**
 * 퍼널에 적을 앱 버전 — OTA 런타임 버전이 있으면 그것, **없으면 앱 설정의 버전**(2.1.1).
 * OTA 가 꺼진 빌드는 runtimeVersion 이 비어 서버 app_ver 가 null 로 쌓였다(AWeek 2026-09-22 — 전에는 1.0.0 을 보냈다).
 */
export const pickVersion = (runtimeVersion: unknown, configVersion: unknown): string =>
  runtimeVersion ? String(runtimeVersion) : configVersion ? String(configVersion) : '';

function defaultEnv(): FunnelEnv {
  return {
    os: () => String(mod<any>(() => require('react-native'))?.Platform?.OS ?? ''),
    appVersion: () => pickVersion(
      mod<any>(() => require('expo-updates'))?.runtimeVersion,
      mod<any>(() => require('expo-constants'))?.default?.expoConfig?.version,   // expo 가 늘 함께 든 모듈
    ),
    post: (url, headers, body) => fetch(url, { method: 'POST', headers, body }).then((r) => r.ok).catch(() => false),
    /*
     | expo-application 은 네이티브 모듈이 없으면 **불러오는 순간 던진다** — 있는지 먼저 본다.
     | iOS 에는 설치 리퍼러가 없다.
     */
    install: async () => {
      const core = mod<any>(() => require('expo-modules-core'));
      if (!core?.requireOptionalNativeModule?.('ExpoApplication')) return null;
      const A = mod<any>(() => require('expo-application'));
      if (!A) return null;
      const inst: Date | null = await A.getInstallationTimeAsync().catch(() => null);
      if (!inst) return null;
      const ref = String((await A.getInstallReferrerAsync().catch(() => '')) ?? '');

      return { at: inst.getTime(), ref: referrerKeys(ref) };
    },
    now: () => Date.now(),
    random: () => Math.random().toString(36).slice(2, 12),
  };
}

/**
 * 설치 리퍼러에서 **광고 추적에 쓰는 키만** 남긴다(Codex 2차 #6).
 *
 * 원문을 그대로 보내면 무엇이 들어 있든 서버에 남는다. 광고 전환과 맞대어 보는 데 필요한 것은
 * 캠페인 표시(utm_*)와 광고 클릭 번호(gclid·gbraid·wbraid·anid)뿐이다. 모양은 그대로 `키=값&…` 이다.
 *
 * **값도 본다**(Codex 3차) — 키만 맞으면 `utm_term=홍길동@…` 처럼 무엇이든 실린다. 캠페인 값에
 * 번호·이메일이 보이면 그 쌍을 버리고, 클릭 번호는 영숫자·`_`·`-` 모양이 아니면 버린다.
 */
const CAMPAIGN_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
const CLICK_KEYS = ['gclid', 'gbraid', 'wbraid', 'anid'];
export function referrerKeys(raw: string): string {
  return String(raw ?? '').split('&').filter((kv) => {
    const i = kv.indexOf('=');
    try {
      const k = decodeURIComponent(i < 0 ? kv : kv.slice(0, i)).toLowerCase();
      const v = decodeURIComponent((i < 0 ? '' : kv.slice(i + 1)).replace(/\+/g, ' '));
      if (CLICK_KEYS.includes(k)) return /^[A-Za-z0-9_-]*$/.test(v);

      return CAMPAIGN_KEYS.includes(k) && !looksPersonal(v);
    } catch { return false; }
  }).join('&');
}

/** 설치 출처는 14일이 지난 설치면 보내지 않는다 — 광고 전환과 맞대어 볼 수 있는 기간이다 */
const INSTALL_WINDOW = 14 * 86400_000;

export function createFunnel(deps: FunnelDeps, env: FunnelEnv = defaultEnv()): Funnel {
  const DEVICE_KEY = deps.keys?.device ?? 'jc.device.v1';
  const REF_KEY = deps.keys?.installRef ?? 'jc.installRef.v1';
  const url = deps.base.replace(/\/+$/, '') + '/funnel';
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json', 'X-App-Token': deps.appToken };

  let deviceP: Promise<{ id: string; fresh: boolean }> | null = null;
  /*
   | first_open 은 **한 실행에 한 번**(2.1.2). 안드로이드는 뒤로가기로 나갔다 다시 열면 JS 가 살아 있어 앱 루트가
   | 다시 뜨고 appOpen 을 또 부른다 — 기억해 둔 「처음(fresh)」 으로 다시 열 때마다 첫 실행이 찍혔다(꼬꼬 2026-09-22,
   | 한 기기 · 같은 ID 로 20분에 7번). app_open 은 다시 연 것이 맞으니 그대로 보낸다.
   */
  let firstSent = false;
  /** 기기 임시 ID — 처음이면 만들고(fresh) 저장한다. 계정이 바뀌어도 그대로다(설치 단위) */
  function device(): Promise<{ id: string; fresh: boolean }> {
    if (!deviceP) {
      deviceP = (async () => {
        let saved: string | null;
        try {
          saved = await deps.storage.getItem(DEVICE_KEY);
        } catch {
          /*
           | **읽지 못한 것과 없는 것은 다르다**(Codex #7). 못 읽었는데 새로 만들어 저장하면 멀쩡한
           | 기기 ID 를 덮어써, 그 사람이 「첫 실행」으로 한 번 더 찍힌다. 이번 실행만 임시 ID 로
           | 보내고 첫 실행으로 세지 않는다 — 저장된 것은 건드리지 않는다.
           */
          return { id: 'tmp-' + env.now().toString(36) + '-' + env.random(), fresh: false };
        }
        if (saved) return { id: saved, fresh: false };
        const id = env.now().toString(36) + '-' + env.random();
        let stored = false;
        try { await deps.storage.setItem(DEVICE_KEY, id); stored = true; } catch { /* 이번 실행만 쓴다 */ }
        // 저장하지 못했으면 다음 실행에 또 새 ID 가 생긴다 — 그때마다 첫 실행으로 세면 부풀어 보인다
        if (!stored) return { id, fresh: false };
        let used = false;
        try { used = !!(await deps.existingUser?.()); } catch { /* 모르면 새 설치로 본다 */ }

        return { id, fresh: !used };
      })();
    }

    return deviceP;
  }

  /** 절대 던지지 않는다 — 앱이 준 `post` 가 거절해도 처리되지 않은 거절로 새지 않게(Codex #8) */
  const post = (id: string, event: string, extra?: Record<string, string | number>): Promise<boolean> =>
    Promise.resolve()
      .then(() => env.post(url, headers, JSON.stringify({
        device: id, event, platform: env.os() === 'ios' ? 'ios' : 'android', v: env.appVersion(), ...extra,
      })))
      .catch(() => false);

  async function sendInstallRef(id: string): Promise<void> {
    if (env.os() !== 'android') return;
    try {
      if (await deps.storage.getItem(REF_KEY)) return;
      const inst = await env.install();
      if (!inst) return;
      if (env.now() - inst.at > INSTALL_WINDOW) { await deps.storage.setItem(REF_KEY, 'old'); return; }
      // 보낸 것이 확인됐을 때만 표시한다 — 실패하면 다음 실행에 다시 보낸다
      if (await post(id, 'install_ref', { ref: inst.ref.slice(0, 300), inst: inst.at })) await deps.storage.setItem(REF_KEY, '1');
    } catch { /* 계측 실패는 넘긴다 */ }
  }

  return {
    event(name, prop) {
      if (!FUNNEL_EVENTS.includes(name) || env.os() === 'web') return;
      // 개인정보처럼 보이면 꼬리표를 통째로 뺀다 — 글자를 걸러 내는 것만으로는 전화번호가 그대로 통과한다
      const p = prop && !looksPersonal(prop) ? prop.replace(/[^A-Za-z0-9_:.-]/g, '').slice(0, 40) : '';
      void device().then((d) => post(d.id, name, p ? { p } : undefined)).catch(() => undefined);
    },
    appOpen() {
      if (env.os() === 'web') return;
      void device().then((d) => {
        if (d.fresh && !firstSent) { firstSent = true; void post(d.id, 'first_open'); }
        void post(d.id, 'app_open');
        void sendInstallRef(d.id);
      }).catch(() => undefined);
    },
  };
}
