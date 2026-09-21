/**
 * 사용 기록 — **같은 이름**으로 GA4(Firebase)와 우리 서버 퍼널에 함께 남긴다.
 *
 * GA4 는 구글 애즈 전환을 가져오는 곳이고, 서버 퍼널은 조회 권한 없이 바로 보는 곳이다.
 * 둘이 다른 이름을 쓰면 「GA4 는 가입 30, 서버는 가입 20」을 맞대어 볼 수가 없다.
 *
 * GA4 설정 파일(`google-services.json`·`GoogleService-Info.plist`)은 **네이티브 빌드에 들어가서
 * 패키지로 옮길 수 없다** — 앱마다 둔다. 여기서 같게 만드는 것은 **이벤트 이름과 보내는 방법**이다.
 *
 * **개인정보는 넣지 않는다** — 회원번호·이름·이메일·전화번호 금지.
 * 이벤트 이름은 GA4 규칙을 따른다: 소문자·숫자·밑줄, 40자 이내.
 */
import type { TrackParams } from './auth';
import { looksPersonal, type Funnel } from './funnel';

/* eslint-disable @typescript-eslint/no-explicit-any */

type Ga = { getAnalytics: () => unknown; logEvent: (a: unknown, name: string, params?: Record<string, string | number | boolean>) => unknown };

export type TrackEnv = {
  /** GA4 모듈 — 이 빌드에 없으면 null */
  ga: () => Ga | null;
};

function defaultEnv(): TrackEnv {
  let cached: Ga | null | undefined;

  return {
    ga: () => {
      if (cached !== undefined) return cached;
      cached = null;
      try {
        const RN = require('react-native');
        /*
         | 네이티브 모듈이 실렸는지 **먼저** 본다. 바로 require 하면 모듈이 없는 빌드에서
         | RNFirebase 가 초기화하다 **앱을 죽인다 — try/catch 로도 안 잡힌다**(꼬꼬농장 2026-09-11,
         | 부화·알 받기에서 앱이 꺼진다는 제보).
         |
         | RNFirebase 26 은 **TurboModule** 로 등록되고 기본 내보내기가 없다. 예전 방식
         | (`NativeModules.RNFBAppModule` 로 확인하고 `mod.default()` 로 부르기)은 모듈이 있어도
         | **한 건도 안 나갔다** — GA4 에 가입 이벤트가 없어 구글 애즈 전환으로 못 가져온 원인이다(2026-09-15).
         */
        if (RN?.Platform?.OS !== 'web'
          && RN?.TurboModuleRegistry?.get?.('NativeRNFBTurboApp')
          && RN?.TurboModuleRegistry?.get?.('NativeRNFBTurboAnalytics')) {
          cached = require('@react-native-firebase/analytics') as Ga;
        }
      } catch {
        cached = null;
      }

      return cached;
    },
  };
}

/**
 * GA4 추천 이벤트 — 우리 이름은 그대로 두고, GA4 기본 보고서·구글 애즈 추천 전환이 알아보는
 * 이름으로 **한 번 더** 보낸다. `method` 는 GA4 규칙의 로그인 수단 매개변수다.
 * `login_done` 은 기존 회원 로그인에만 난다(처음 온 계정은 가입으로 넘어간다).
 */
/** GA4 로그인 수단으로 보낼 수 있는 이름 — 그 밖의 값은 싣지 않는다(무엇이 들어올지 모른다) */
const METHODS = ['kakao', 'google', 'apple', 'naver', 'guest', 'toss', 'email'];
/** 서버 퍼널 꼬리표에 실을 수 있는 제공자 — 로그인 수단 + 서버 제공자 목록의 갈래 이름 */
const PROVIDERS = [...METHODS, 'kakao_native', 'apple_web'];

export function standardEvent(name: string, params?: TrackParams): [string, Record<string, string> | undefined] | null {
  // 추천 이벤트도 거른 값만 — 전에는 제공자 칸을 그대로 method 로 실어 개인정보가 샐 수 있었다(Codex 2차 #6)
  const p = params?.provider != null ? String(params.provider) : '';
  const method = METHODS.includes(p) ? { method: p } : undefined;
  if (name === 'signup_done') return ['sign_up', method];
  if (name === 'login_done') return ['login', method];
  if (name === 'onboarding_view' && params?.step === 1) return ['tutorial_begin', undefined];
  if (name === 'onboarding_done') return ['tutorial_complete', undefined];

  return null;
}

/**
 * 서버 퍼널에 같이 보낼 꼬리표 한 토막 — **어느 소셜을 눌렀는지·왜 떨어졌는지**.
 *
 * 서버는 이름만 받으면 「로그인 버튼 9번 눌렀는데 가입은 3명」까지만 보이고, 어느 소셜에서
 * 잃는지를 볼 수 없었다(꼬꼬농장 2026-09-18). `provider` 와 `code`(없으면 `reason`)를 잇는다.
 */
export function propOf(params?: TrackParams): string | undefined {
  // 제공자도 아는 이름만 — 화면이 무엇을 넣을지 모른다(Codex 3차, 사유만 거르고 제공자는 그대로였다)
  const p0 = params?.provider != null ? String(params.provider) : '';
  const p = PROVIDERS.includes(p0) ? p0 : '';
  const c0 = params?.code != null ? String(params.code) : (params?.reason != null ? String(params.reason) : '');
  // 사유에 번호·이메일이 섞여 들어오면 그 조각은 버린다(개인정보)
  const c = looksPersonal(c0) ? '' : c0;
  const tag = [p, c].filter(Boolean).join(':');

  return tag ? tag.replace(/[^A-Za-z0-9_:.-]/g, '').slice(0, 40) : undefined;
}

/** 이름만 봐도 개인정보인 칸 — 값과 상관없이 GA4 로 보내지 않는다 */
const PERSONAL_KEY = /^(e-?mail|phone|tel|mobile|name|full_?name|nick_?name|birth(day|date)?|address|ci|di|member_?id|user_?id|uid|social_?id)$/i;

/**
 * GA4 로 보낼 모양으로 — null·undefined 는 GA4 가 안 받으니 빼고,
 * **개인정보처럼 보이는 칸과 값도 뺀다**(Codex #9). 약속만으로는 언젠가 새어 나간다.
 */
function clean(params?: TrackParams): Record<string, string | number | boolean> | undefined {
  if (!params) return undefined;
  const out: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v == null || PERSONAL_KEY.test(k)) continue;
    // 숫자 값도 본다 — 회원번호·전화번호가 숫자로 들어올 수 있다
    if (typeof v !== 'boolean' && looksPersonal(v)) continue;
    out[k] = v;
  }

  return out;
}

/**
 * 기록기를 만든다 — 로그인(`createAuth({ track })`)과 앱 화면이 같은 것을 쓴다.
 *
 * `funnel` 을 주면 퍼널 이벤트는 서버에도 남는다. GA4 모듈이 없는 빌드에서는 GA4 만 조용히 건너뛴다.
 */
export function createTrack(opts: { funnel?: Funnel } = {}, env: TrackEnv = defaultEnv()): (name: string, params?: TrackParams) => void {
  return (name, params) => {
    // 서버 퍼널은 네이티브 모듈과 무관하다 — GA4 가 없어도 남긴다
    try { opts.funnel?.event(name, propOf(params)); } catch { /* 계측이 앱을 막지 않는다 */ }
    try {
      const m = env.ga();
      if (!m) return;
      const a = m.getAnalytics();
      // logEvent 는 Promise 를 돌려준다 — 거절돼도 처리되지 않은 거절로 새지 않게(Codex #8)
      void Promise.resolve(m.logEvent(a, name, clean(params))).catch(() => undefined);
      const std = standardEvent(name, params);
      if (std) void Promise.resolve(m.logEvent(a, std[0], std[1])).catch(() => undefined);
    } catch { /* 계측이 앱을 막지 않는다 */ }
  };
}
