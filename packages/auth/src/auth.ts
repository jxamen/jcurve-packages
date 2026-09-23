/**
 * 소셜 로그인 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * 이 파일은 **앱을 모른다.** 키·서버 호출·기록을 받아서 쓸 뿐이다.
 *
 * 2.0 에서 1.0 의 SDK 로그인 위에 **꼬꼬농장이 실기기에서 쌓은 장치**를 얹었다 —
 * 서버 웹 로그인으로 넘어가기, 늦게 오는 복귀 주소, 게스트 농장 잇기, 어드민이 켠 로그인만,
 * 로그인 중 재시작 막기. 전부 **선택**이라 1.0 처럼 셋(키·서버·기록)만 줘도 그대로 돈다.
 */
export type Provider = 'kakao' | 'google' | 'apple';

/** 서버 웹 로그인으로만 되는 제공자까지 — 네이버는 SDK 를 붙이지 않고 웹으로만 간다 */
export type AnyProvider = Provider | 'naver';

/** 서버가 토큰을 받아 세션을 만들어 준다 — 모양은 앱마다 다르므로 그대로 흘려보낸다 */
export type ServerLogin<T> = {
  kakao: (accessToken: string) => Promise<T>;
  google: (idToken: string) => Promise<T>;
  /** 이름은 애플이 **최초 1회만** 준다 — 그때 서버에 넘기지 않으면 영영 못 받는다 */
  apple: (identityToken: string, name: string) => Promise<T>;
};

/**
 * 계측에 실을 수 있는 값 — **스칼라만**.
 *
 * 객체를 넣으면 GA4 는 조용히 버리고, 서버 퍼널은 400 을 준다. 넓게 열어 두면 화면에서
 * 무심코 객체를 넣고 **나중에 「그 값이 안 보인다」로만** 드러난다.
 */
export type TrackParams = Record<string, string | number | boolean | null | undefined>;

/**
 * 서버를 거치는 웹 로그인 — SDK 가 없거나 실패했을 때 넘어가는 길(2.0).
 *
 * 브라우저로 서버의 로그인 시작 주소를 열고, 각 사 로그인이 끝나면 서버가 `returnUrl?ticket=…` 로
 * 앱을 다시 부른다. 앱은 그 티켓을 세션과 바꾼다. **인가 코드를 토큰으로 바꾸는 일은 서버가 한다** —
 * 카카오 REST 키는 client_secret 이 기본 활성이고 네이버는 필수라, 앱에 넣으면 번들을 뜯는 순간 나온다.
 *
 * 주면 켜진다: SDK 가 안 될 때 웹으로 넘어가고, 네이버와 안드로이드 애플(`apple_web`)이 된다.
 * 안 주면 1.0 과 같다 — SDK 가 안 되면 던진다.
 */
export type WebLogin<T> = {
  /**
   * 로그인 창 주소(서버의 로그인 시작 경로). `link` 는 게스트 연결 코드.
   *
   * **`nonce` 를 주소에 실어야 한다**(`&nonce=…`). 서버가 그것을 티켓에 묶고, 교환 때 같은 값을
   * 요구한다 — 없으면 다른 앱이 밀어 넣은 티켓으로 **남의 계정에 로그인**된다(2.0 Codex 검증 #1).
   */
  start: (provider: AnyProvider, link: string | undefined, nonce: string) => string;
  /** 서버가 로그인을 마치고 앱을 다시 부르는 주소. 예: `kkokkofarm://auth` */
  returnUrl: string;
  /** 복귀 주소의 1회용 티켓을 세션으로 바꾼다 — **`nonce` 를 함께 보낸다**(시작 때 준 값) */
  exchange: (ticket: string, nonce: string) => Promise<T>;
  /**
   * **서버가 만든 nonce** 를 받아 온다(`POST {app}/auth/nonce`) — 주면 이것을 먼저 쓴다.
   *
   * 기기에서 만들면 기기 난수에 기대야 하는데 React Native 기본엔 보안 난수가 없어 `Math.random` 으로
   * 떨어진다. 그 값을 누가 짐작하면 **같은 nonce 로 자기 로그인을 시작해 정상 서명된 티켓**을 받아
   * 밀어 넣을 수 있다(Codex 3차). 못 받으면 아래 `random` → 기기 난수로 넘어간다.
   */
  nonce?: () => Promise<string>;
};

/**
 * 게스트로 키우던 것을 가입한 계정에 잇는다 — **웹 로그인에서만** 쓴다.
 *
 * SDK 로그인은 앱의 `server.*` 호출이 게스트 세션을 헤더에 실어 보내면 서버가 잇는다.
 * 웹 로그인은 세션 토큰을 주소에 실을 수 없어서 1회용 연결 코드를 따로 받는다.
 */
export type Guest = {
  /** 지금 게스트로 쓰는 중인가 */
  active: () => boolean;
  /** 1회용 연결 코드. **비어 오면 창을 열지 않는다**(아래 웹 로그인 참고) */
  link: () => Promise<string | undefined>;
};

export type AuthDeps<T> = {
  keys: {
    kakaoNative?: string;
    googleWeb?: string;
    /** 없으면 웹 클라이언트 ID 로만 돈다 */
    googleIos?: string;
  };
  server: ServerLogin<T>;
  /**
   * 사용 기록 — `createTrack()` 이 만든 것이나 앱의 `track()` 을 그대로 준다.
   *
   * 여기서 내는 이름은 `login_native_fallback`·`login_native_ok` 다. **서버 퍼널 허용 목록에
   * 없는 이름은 400 으로 버려진다** — `login_native_ok` 는 GA4 에만 남는다(`funnel.ts`).
   * 사유는 `code` 로 싣는다. 1.0 은 `why` 로 실어서 **서버 퍼널에서 사유가 비어 있었다**.
   */
  track?: (name: string, params?: TrackParams) => void;
  /** 서버 웹 로그인(2.0). 없으면 SDK 로만 한다 */
  web?: WebLogin<T>;
  /**
   * 어드민이 켠 로그인 — 서버의 제공자 목록(`kakao`·`kakao_native`·`google`·`naver`·`apple`·`apple_web`).
   *
   * **비어 있으면 「아직 모른다」로 읽는다**(막지 않는다). 목록은 앱이 뜬 뒤 따로 받아 오는데,
   * 사람들은 첫 실행 1~5초 만에 로그인을 누른다. 그때 막으면 카카오 가입이 52 → 0 으로
   * 사라진다(꼬꼬농장 2026-09-18). 토큰은 어차피 서버가 확인하므로 잘못 열려도 서버가 거절한다.
   */
  providers?: () => readonly string[];
  /** 게스트 농장 잇기(2.0) */
  guest?: Guest;
  /**
   * 보안 난수 — `expo-crypto` 가 있는 앱은 `(b) => Crypto.getRandomValues(b)` 를 준다.
   *
   * 패키지가 `expo-crypto` 를 직접 require 하지 않는 이유: Metro 는 require 를 **빌드 때** 찾으므로,
   * 그 모듈이 없는 앱(꼬꼬농장)은 try/catch 로 감싸도 **번들이 깨진다**(Codex 3차).
   */
  random?: (bytes: Uint8Array) => void;
};

/**
 * `busy` — 다른 로그인이 이미 도는 중이다. **화면은 무시하면 된다**(오류창을 띄우지 않는다).
 * 버튼을 연달아 눌렀을 때 창이 두 개 뜨고 서로의 복귀 주소를 가로채던 것을 막는다.
 */
export type AuthErrorCode = 'cancelled' | 'failed' | 'disabled' | 'busy';

/**
 * 로그인이 안 됐을 때 던지는 것.
 *
 * `tag` 는 **어디서 끊겼는지**다 — `open:`(창을 못 띄움) · `win:`(창이 이상하게 닫힘) ·
 * `ret:`(서버가 티켓 대신 오류) · `exg:`(교환 거절, 걸린 시간·시도 횟수). 문구가 하나뿐이면
 * 제보를 받아도 어느 갈래인지 알 수 없었다(꼬꼬농장). 화면 오류 문구 뒤에 붙여 두면 캡처 한 장으로 가른다.
 *
 * 메시지는 일부러 **고정값**이다. 취소면 `user_cancel` 이라 `isCancel(e.message)` 가 참이고,
 * 실패면 `auth_failed` 라 거짓이다 — 태그에 `cancel` 같은 글자가 섞여도 판정이 흔들리지 않는다.
 */
export class AuthError extends Error {
  readonly code: AuthErrorCode;
  readonly tag: string;

  constructor(code: AuthErrorCode, tag: string) {
    super(code === 'cancelled' ? 'user_cancel' : 'auth_' + code);
    this.name = 'AuthError';
    this.code = code;
    this.tag = tag;
  }
}

export type Auth<T> = {
  /** 카카오 SDK 초기화 — 여러 번 불러도 한 번만 한다 */
  initKakao: () => void;
  /** 이 기기에서 SDK 로 쓸 수 있는 제공자 — **네이티브를 부르지 않는다**(화면이 뜰 때 돈다) */
  availableProviders: () => Provider[];
  /** 카카오톡으로 로그인할 수 있는가 — 안에서 초기화를 먼저 한다 */
  kakaoTalkAvailable: () => Promise<boolean>;
  signIn: (provider: AnyProvider) => Promise<T>;
  /**
   * 이 실행에서 로그인을 눌러 봤는가 — **누른 뒤에는 앱을 재시작하지 않는다.**
   *
   * OTA 적용처럼 앱이 스스로 다시 시작하는 일은 이걸 보고 정한다. 누르기 전에는 재시작해도
   * 같은 로그인 화면으로 돌아올 뿐이고, **오히려 적용해야 한다** — 새로 깐 사람은 옛 코드로
   * 시작하는데 「가입 뒤에만 적용」이면 가입을 막는 버그를 고친 판을 영영 못 받는다.
   */
  hasTriedAuth: () => boolean;
  /** 지금 로그인 창을 다녀오는 중인가 — 이때 재시작하면 복귀 주소를 잃는다 */
  isAuthorizing: () => boolean;
  /**
   * 로그인 창 **밖에서** 복귀 주소가 들어왔다 — 받은 제공자로 `signIn` 을 다시 부르면 창을 다시
   * 열지 않고 그 주소로 끝낸다. 돌려주는 함수를 부르면 구독을 끊는다.
   *
   * **반드시 받은 제공자로 부른다.** 다른 제공자로 부르면 받아 둔 주소를 쓰지 않고 새 로그인을
   * 시작한다(카카오 SDK 창이 뜨는 식). 1.x 의 꼬꼬농장은 「아무 제공자나」 넘겼다.
   */
  onLateReturn: (fn: (provider: AnyProvider) => void) => () => void;
  /**
   * 걸려 있는 로그인을 **잊는다** — 화면이 「돌아왔는데 안 끝났다」고 판단했을 때 부른다.
   *
   * 로그인 중 앱 밖에 나갔다 **아이콘으로** 돌아오면 SDK·커스텀 탭의 약속이 영영 안 끝날 수 있다
   * (당근캐시 2026-09-18 실기기). 패키지가 그 약속을 붙잡고 있으면 같은 버튼은 그 약속을 또 받고
   * 다른 버튼은 `busy` 라 **모든 로그인 버튼이 먹통**이 된다.
   *
   * ⚠ **언제 부르는지가 중요하다**(2026-09-22 영테크 · 당근 a93c018 · 꿀꿀 82e748c 에서 각각 터짐).
   * 앱이 **밖에 다녀왔을 때만** 잰다 — `createReturnWatch()` 의 `saw(next)` 가 참일 때
   * 2.5초 기다렸다가 안 끝났으면 화면의 busy 와 함께 이것을 부른다(바로 풀면 정상 로그인에 오탐).
   * 그 장치는 `background` 에서 깃발을 올리고 `active` 에서 내린다 — **중간 `inactive` 에서 지우면**
   * iOS 가 `background → inactive → active` 로 알려 주는 진짜 복귀를 놓쳐 버튼이 영영 먹통이 된다.
   * **`inactive` ↔ `active` 만 오간 것은 밖에 나간 게 아니다** — iOS 의 앱 안 로그인 창
   * (`ASWebAuthenticationSession`)·구글 계정 고르기·제어센터가 그렇다. 그걸 「돌아왔다」로 읽으면
   * 계정을 고르는 사이에 로그인을 잊어버린다.
   * 그리고 이때 **안내 팝업(RN `Modal`)을 띄우지 마라** — iOS 에서 그 창 위에 Modal 을 올리면
   * 보이지 않는 막이 남아 화면 터치가 전부 막힌다. 조용히 busy 만 푼다.
   * 웹 흐름·받아 둔 후보는 그대로 둔다 — 복귀 주소가 뒤늦게 오면 `onLateReturn` 으로 이어진다.
   */
  abandon: () => void;
};

/**
 * 아직 안 채운 값인가 — `.env.example` 의 `여기에_...` 같은 자리표시자.
 *
 * 키가 자리표시자면 **버튼을 아예 띄우지 않는다.** 눌러도 안 되는 버튼은 고장으로 보이고,
 * 카카오는 그 상태로 초기화하면 SDK 가 이상한 오류를 뱉는다.
 */
export const PLACEHOLDER = /^$|여기에|placeholder|YOUR_|xxxx/i;

const isPlaceholder = (v?: string): boolean => PLACEHOLDER.test(String(v ?? '').trim());

/**
 * 사용자가 **스스로 그만둔 것**인가.
 *
 * 그만둔 사람에게 오류창을 띄우면 앱이 고장 난 줄 안다. 그리고 퍼널에서 이탈이 **실패로
 * 부풀어** 보여, 고칠 것이 없는 자리를 들여다보게 된다.
 *
 * 제공자마다 말이 다르다 — 하나라도 빠뜨리면 그 갈래만 조용히 오류창이 된다.
 *  - `cancel` — `Cancelled`·`USER_CANCELLED`·`SIGN_IN_CANCELLED`·`ERR_REQUEST_CANCELED`
 *    (l 이 하나든 둘이든 앞부분이 같아 다 걸린다)
 *  - **`AccessDenied`** — 카카오가 동의 화면에서 「취소」를 눌렀을 때 주는 말이다.
 *    `cancel` 이 안 들어가 있어서 **빠뜨리기 쉽다.** 꿀꿀캐시가 2026-09-18 실기기에서
 *    이것 때문에 **취소한 사람에게 오류창**을 띄웠다. 꼬꼬농장은 같은 자리에서 **웹 로그인
 *    창을 한 번 더 열었다**(2.0 에서 고침). OAuth 표준 `access_denied` 도 같다.
 *  - `1001` — 애플·구글 iOS 쪽 취소
 *  - `12501` — 구글 안드로이드 계정 선택 취소
 */
export const isCancel = (code: string): boolean =>
  /cancel|취소|access.?denied|(?<![0-9])(1001|12501)(?![0-9])/i.test(code);

/**
 * **앱 밖에 다녀왔다가 돌아왔는가** — `abandon()` 을 언제 잴지 가르는 장치. `AppState` 변화를 그대로 넣는다.
 *
 * 규칙은 둘뿐이다.
 *  - `background` 에서 **깃발을 올린다**(다른 앱·홈 화면으로 나갔다).
 *  - `active` 에서 **깃발을 내리고**, 올라가 있었으면 참을 돌려준다.
 *  - **`inactive` 는 깃발을 건드리지 않는다.**
 *
 * ⚠ **`inactive` 에서 깃발을 지우면 안 된다.** iOS 는 아이콘으로 나갔다 돌아올 때도 `background → inactive →
 * active` 로 알려 줘서, 중간에 지우면 **진짜 다녀온 경우를 놓친다** — 원래 버그(로그인 버튼이 영영 먹통,
 * 당근캐시 2026-09-18)가 되살아난다(총무님 세션 2026-09-22).
 * 반대로 `inactive → active` 만 오간 것은 **앱 안에서 일어난 일**이다 — iOS 앱 안 로그인 창
 * (`ASWebAuthenticationSession`), 구글 계정 고르기, 제어센터, 알림창. 그걸 「돌아왔다」로 읽으면 사용자가
 * 계정을 고르는 사이에 로그인을 잊어버린다(2026-09-22 영테크 실기기 · 당근 a93c018 · 꿀꿀 82e748c —
 * 앱마다 따로 만들다 세 번 샜다).
 *
 * ```ts
 * // 타이머까지 맡긴다(권장) — 다녀올 때마다 앞서 건 타이머를 끄고 새로 건다
 * const watch = createReturnWatch({
 *   busy: () => stillBusy(),
 *   onStuck: () => { auth.abandon(); clearBusy(); },   // 팝업은 띄우지 않는다
 * });
 * const sub = AppState.addEventListener('change', (next) => watch.saw(next));
 * // 화면을 떠날 때: sub.remove(); watch.stop();
 * ```
 *
 * ⚠ **앞서 건 타이머를 끄지 않으면**, 다녀와서 타이머를 걸고 또 나갔다 왔을 때 옛 타이머가 뒤늦게 울려
 * **그 사이 시작된 정상 로그인을 놓아 버린다**(당근 0079d15 · 영테크 f9f643b). 인자를 넘기면 패키지가 처리한다.
 * 인자 없이 `saw(next)` 만 쓰면 「밖에 다녀왔나」만 알려 준다 — 그때는 앱이 옛 타이머를 직접 무효화해야 한다.
 */
export type ReturnWatchDeps = {
  /** 지금도 로그인이 도는 중인가 — 참일 때만 `onStuck` 을 부른다 */
  busy: () => boolean;
  /** 밖에 다녀와 `wait` 가 지나도 안 끝났을 때 — `auth.abandon()` 과 화면 busy 풀기를 여기서 한다(팝업 금지) */
  onStuck: () => void;
  /** 기다리는 시간(밀리초, 기본 2500) */
  wait?: number;
};

export function createReturnWatch(deps?: ReturnWatchDeps): {
  saw: (next: string | null | undefined) => boolean;
  stop: () => void;
} {
  let wasOutside = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const stop = (): void => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  return {
    stop,
    saw(next) {
      if (next === 'background') {
        wasOutside = true;

        return false;
      }
      if (next !== 'active') {
        return false;   // inactive — 깃발을 건드리지 않는다
      }
      const out = wasOutside;
      wasOutside = false;
      if (out && deps) {
        /*
         | **앞서 건 타이머를 먼저 끈다**(2026-09-22 영테크 f9f643b · 당근 0079d15 가 고쳤던 것).
         | 다녀와서 타이머를 걸고 **또 나갔다 오면**, 옛 타이머가 뒤늦게 울려 그 사이 시작된
         | 정상 로그인을 놓아 버린다(토큰을 받는 중인데 abandon). 복귀마다 새로 건다.
         */
        stop();
        timer = setTimeout(() => {
          timer = null;
          if (deps.busy()) {
            deps.onStuck();
          }
        }, deps.wait ?? 2500);
      }

      return out;
    },
  };
}

/**
 * 복귀 주소에서 티켓·오류를 꺼낸다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 *
 * 구글 재로그인(자동 리다이렉트)은 주소 끝에 `#` 가 남는다. 쿼리에 섞이면 티켓이 `XXXX#` 가 되어
 * 서버가 못 찾는다(꼬꼬농장 2026-08-26, 구글만 로그인 실패).
 */
export function parseReturn(url: string): { ticket?: string; error?: string } {
  const q = String(url ?? '').split('#')[0].split('?')[1];
  if (!q) return {};
  const out: Record<string, string> = {};
  for (const part of q.split('&')) {
    const i = part.indexOf('=');
    const k = i < 0 ? part : part.slice(0, i);
    const v = i < 0 ? '' : part.slice(i + 1);
    try {
      out[decodeURIComponent(k)] = decodeURIComponent(v.replace(/\+/g, ' '));
    } catch {
      // 깨진 % 인코딩 — 그 조각만 버린다
    }
  }

  return { ticket: out.ticket || undefined, error: out.error || undefined };
}

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * 기기와 닿는 것 — **시험에서만** 갈아 끼운다.
 *
 * 네이티브 모듈은 모두 지연 `require` 로만 집는다(②). 모듈이 빠진 빌드에서 정적 import 는
 * 앱 시작 자체를 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */
export type AuthEnv = {
  os: () => string;
  kakaoCore: () => any | null;
  kakaoUser: () => any | null;
  google: () => any | null;
  apple: () => any | null;
  /** expo-web-browser */
  browser: () => any | null;
  /** react-native 의 Linking */
  linking: () => any | null;
  wait: (ms: number) => Promise<void>;
};

/** 모듈이 없으면 null — 크래시 대신 그 버튼만 숨긴다(②) */
function mod<M>(load: () => M): M | null {
  try { return load(); } catch { return null; }
}

function defaultEnv(): AuthEnv {
  const rn = () => mod<any>(() => require('react-native'));
  const os = (): string => String(rn()?.Platform?.OS ?? '');
  // 웹 미리보기에서는 SDK 를 쓰지 않는다 — 모듈은 불러와져도 네이티브가 없다
  const native = <M>(load: () => M) => (): M | null => (os() === 'web' ? null : mod(load));

  return {
    os,
    kakaoCore: native(() => require('@react-native-kakao/core')),
    kakaoUser: native(() => require('@react-native-kakao/user')),
    google: native(() => require('@react-native-google-signin/google-signin')),
    apple: native(() => require('expo-apple-authentication')),
    browser: () => mod<any>(() => require('expo-web-browser')),
    linking: () => rn()?.Linking ?? null,
    wait: (ms) => new Promise((r) => setTimeout(r, ms)),
  };
}

/** 오류에서 판정에 쓸 글자 — 카카오는 `code`, 다른 것은 `message` 에 사유를 둔다 */
const errText = (e: unknown): string =>
  String((e as { code?: unknown })?.code ?? '') + ' ' + String((e as Error)?.message ?? e ?? '');

/** 퍼널 꼬리표로 쓸 짧은 코드 — 영문·숫자만, 20자 */
const shortCode = (e: unknown): string =>
  String((e as { code?: unknown })?.code ?? (e as Error)?.message ?? 'err').replace(/[^A-Za-z0-9_]/g, '').slice(0, 20) || 'err';

/** `abandon()` 으로 잊힌 실행이 멈출 때 — 화면은 이미 풀렸으니 취소처럼 조용히 끝낸다 */
const abandoned = (): AuthError => new AuthError('cancelled', 'abandoned');

/** SDK 로 못 받았다 — 웹 로그인으로 넘긴다는 표시 */
const FALL = Symbol('fallback');

export function createAuth<T>(deps: AuthDeps<T>, env: AuthEnv = defaultEnv()): Auth<T> {
  const { keys, server, web } = deps;
  const track = deps.track ?? (() => undefined);
  let triedAuth = false;
  /*
   | 도는 중인 로그인 — **한 번에 하나만.** 버튼을 연달아 누르면 창이 두 개 뜨고, 둘이 복귀 주소
   | 하나를 나눠 쓰다 서로의 것을 가로챘다(Codex #4). 같은 버튼이면 같은 결과를 기다리고,
   | 다른 버튼이면 `busy` 로 돌려보낸다. OTA 재시작을 막는 `isAuthorizing` 도 이것을 본다.
   */
  let current: { provider: AnyProvider; p: Promise<T> } | null = null;

  /*
   | 늦게 오는 복귀 주소(2.0) — 안드로이드에서 카카오톡 앱을 다녀오면 로그인 창이 **먼저 닫혀**
   | 「취소」로 받고, 복귀 주소는 그 뒤에 따로 온다. 인증은 끝났는데 가입이 안 되어 같은 사람이
   | 서너 번 다시 시도했다(꼬꼬농장 2026-09-14, 미상 계정 13건 — 티켓은 한 장도 안 쓰임).
   |
   | **그런데 아무 주소나 받으면 안 된다**(Codex #1). 다른 앱이 `returnUrl?ticket=<공격자 티켓>` 을
   | 쏘면 그 사람이 **공격자 계정으로 로그인**된다 — 리워드 앱이라 그 뒤 본 광고가 공격자에게 쌓인다.
   | 그래서 **이 앱이 시작한 웹 로그인(`flow`)이 살아 있을 때만** 받고, 그 흐름의 `nonce` 로만 바꾼다.
   | 서버도 nonce 가 다르면 거절한다 — 앱 쪽은 한 겹 더 막는 것이다.
   */
  type Flow = { provider: AnyProvider; nonce: string; at: number; open: boolean };
  let flow: Flow | null = null;
  /*
   | 늦게 온 주소는 **후보**다 — 누가 보냈는지 모른다. 하나만 들고 있으면 뒤에 온 주소가 앞의 것을
   | 덮는데, 밀어 넣은 티켓이 정상 주소를 밀어내고 흐름까지 닫게 만들 수 있었다(Codex 2차 #1).
   | 그래서 여럿(최대 20)을 순서대로 들고, 서버가 거절한 것만 버린다. 서버 티켓 수명(2분)이 지난 것은 쓰지 않는다.
   | 가득 차면 **새 것을 버리지 않고 가장 오래된 것을 밀어낸다** — 밀어 넣은 주소로 자리를 먼저 채워
   | 정상 주소를 못 들어오게 하던 구멍(Codex 3차). 정상 주소를 밀어내려면 그 뒤로 스무 개를 더 쏴야 한다.
   */
  type Candidate = { url: string; ticket: string; at: number };
  let candidates: Candidate[] = [];
  const MAX_CANDIDATES = 20;
  const TICKET_TTL = 2 * 60_000;
  const freshCandidates = (): Candidate[] => {
    candidates = candidates.filter((c) => Date.now() - c.at < TICKET_TTL);

    return candidates;
  };
  /** 이미 바꾼 티켓 — 같은 주소가 뒤늦게 또 와도 다시 잡지 않는다(Codex #2) */
  const used = new Set<string>();
  const lateListeners = new Set<(provider: AnyProvider) => void>();

  /**
   * 후보를 넣는다 — 이미 바꾼 티켓이면 넣지 않는다. **새로** 넣었으면 참.
   *
   * `front` 면 맨 앞에 둔다 — 이미 들어와 있던 티켓이면 **그 자리에서 맨 앞으로 옮긴다**(Codex 4차).
   * 창이 돌려준 티켓이 Linking 으로 먼저 와 있으면, 앞의 다른 후보가 네트워크로 막힐 때 정상 티켓은
   * 불러 보지도 못하고 실패했다.
   */
  function addCandidate(url: string, ticket: string, front = false): boolean {
    if (used.has(ticket)) return false;
    const i = freshCandidates().findIndex((c) => c.ticket === ticket);
    if (i >= 0) {
      if (front && i > 0) candidates.unshift(...candidates.splice(i, 1));

      return false;
    }
    if (candidates.length >= MAX_CANDIDATES) candidates.shift();
    const c = { url, ticket, at: Date.now() };
    if (front) candidates.unshift(c);
    else candidates.push(c);

    return true;
  }

  /** 흐름을 열어 두는 시간 — 서버의 로그인 시작 수명(10분)과 같다 */
  const FLOW_TTL = 10 * 60_000;
  const flowAlive = (): boolean => !!flow && flow.open && Date.now() - flow.at < FLOW_TTL;

  /** 복귀 주소가 **정확히** 우리 것인가 — 앞부분만 같은 `returnUrl/evil` 이나 `returnUrl/` 는 아니다 */
  const base = (u: string): string => u.split('#')[0].split('?')[0];
  const isReturn = (u: string): boolean => !!web && base(u) === base(web.returnUrl);

  const capture = (url: unknown): void => {
    if (typeof url !== 'string' || !isReturn(url)) return;
    const { ticket } = parseReturn(url);
    if (!ticket || used.has(ticket) || !flowAlive()) return;
    if (!addCandidate(url, ticket)) return;
    // 로그인이 도는 중이면 그쪽이 가져간다 — 밖에서 들어왔을 때만 화면에 알린다
    const p = (flow as Flow).provider;
    if (!current) lateListeners.forEach((f) => { try { f(p); } catch { /* 화면 쪽 오류는 삼킨다 */ } });
  };
  if (web) {
    const L = env.linking();
    try { L?.addEventListener?.('url', (e: { url?: string }) => capture(e?.url)); } catch { /* 없으면 창 결과만 쓴다 */ }
    /*
     | 앱이 이 주소로 **켜진** 경우(getInitialURL)는 **읽지도 않는다.** 이 프로세스가 시작한 흐름이
     | 없으니 받을 이유가 없고, 늦게 풀리면 그사이 열린 새 흐름에 끼어든다(Codex 2차 #8).
     | 로그인 도중 앱이 통째로 죽었다 켜진 경우도 여기서 잃는데, 그 한 번은 다시 누르면 된다.
     */
  }

  /*
   | 카카오 초기화는 **끝날 때까지 기다린다**(Codex). `initializeKakaoSDK` 는 Promise 를 돌려주는데,
   | 기다리지 않고 준비됐다고 치면 초기화 전에 네이티브를 부를 수 있다 — 안드로이드는 그 자리에서
   | 죽는다(③). 실패하면 다음에 다시 해 본다.
   */
  let kakaoInit: Promise<boolean> | null = null;
  function initKakao(): Promise<boolean> {
    if (isPlaceholder(keys.kakaoNative)) return Promise.resolve(false);
    if (!kakaoInit) {
      kakaoInit = (async () => {
        const core = env.kakaoCore();
        if (!core?.initializeKakaoSDK) return false;
        await core.initializeKakaoSDK(keys.kakaoNative);

        return true;
      })().catch(() => {
        kakaoInit = null;

        return false;
      });
    }

    return kakaoInit;
  }

  /**
   * 카카오 네이티브를 만지는 **유일한 길**.
   *
   * 초기화를 먼저 **끝내고** 모듈을 준다. 이 길을 거치지 않고 `require` 로 직접 집어 부르면
   * 초기화 전에 네이티브를 건드릴 수 있고, 그러면 **안드로이드가 그 자리에서 죽는다**(③).
   * 초기화가 안 됐으면 `null` 이라 부르는 쪽이 자연스럽게 막힌다.
   */
  async function kakaoApi(): Promise<any | null> {
    const ready = await initKakao();

    return ready ? env.kakaoUser() : null;
  }

  function availableProviders(): Provider[] {
    const list: Provider[] = [];
    /*
     | **여기서는 네이티브를 부르지 않는다.** 이 함수는 로그인 화면이 버튼을 그리려고
     | **화면이 뜨는 순간** 부른다. `?.login` 은 모듈 객체의 필드를 읽을 뿐이라 안전하다 —
     | 괄호를 붙이는 순간 ③ 을 밟는다.
     */
    if (!isPlaceholder(keys.kakaoNative) && env.kakaoUser()?.login) list.push('kakao');
    if (!isPlaceholder(keys.googleWeb) && env.google()?.GoogleSignin) list.push('google');
    // 애플 로그인은 iOS 에서만 — 소셜 로그인만 제공하는 앱은 심사지침 4.8 로 필수다
    if (env.os() === 'ios' && env.apple()) list.push('apple');

    return list;
  }

  async function kakaoTalkAvailable(): Promise<boolean> {
    const user = await kakaoApi();
    if (typeof user?.isKakaoTalkLoginAvailable !== 'function') return false;
    try {
      return (await user.isKakaoTalkLoginAvailable()) === true;
    } catch {
      return false;
    }
  }

  /**
   * 카카오 토큰 — **어느 길로 갔는지 남긴다**(④).
   *
   * `login()` 한 줄이면 카카오톡을 먼저 열어 보고 안 되면 웹으로 조용히 떨어진다.
   * 그러면 카카오 가입이 0 명이어도 **왜인지 알 수 없다.** 갈래마다 사유를 남긴다.
   *
   * 웹 로그인이 있으면 SDK 가 안 될 때 `FALL` 을 돌려 그리로 넘긴다. 없으면 1.0 처럼
   * 카카오톡 실패 뒤 카카오 계정 로그인을 한 번 더 해 보고, 그래도 안 되면 던진다.
   */
  async function kakaoToken(): Promise<string | typeof FALL> {
    const user = await kakaoApi();
    if (!user?.login) {
      /*
       | 여기까지 온 것은 **초기화가 실패했거나 이 빌드에 모듈이 없다**는 뜻이다.
       | 남기지 않으면 **버튼을 눌렀는데 아무 일도 안 일어나는** 것으로만 보인다.
       */
      track('login_native_fallback', { provider: 'kakao', code: 'no_sdk' });
      if (web) return FALL;
      throw new Error('kakao_unavailable');
    }
    const grab = (r: unknown): string => String((r as { accessToken?: unknown })?.accessToken ?? '');

    /*
     | 카카오톡이 깔려 있는지 — **옛 네이티브 모듈에는 이 함수가 아예 없다**(OTA 는 옛 빌드에도
     | 같은 JS 를 내린다). 그때 「안 깔렸다」로 읽으면 기록은 안 틀려도 사용자가 겪는 경로가
     | 달라진다. 못 가린 것은 못 가렸다고 남긴다(2026-09-18, 당근캐시 세션 제보).
     */
    const canAsk = typeof user.isKakaoTalkLoginAvailable === 'function';
    if (!canAsk) track('login_native_fallback', { provider: 'kakao', code: 'cannot_tell' });
    const talk = canAsk ? await kakaoTalkAvailable() : false;
    if (canAsk && !talk) track('login_native_fallback', { provider: 'kakao', code: 'no_talk' });

    try {
      // 판단할 수단이 없으면 SDK 에 맡긴다(카카오톡 → 계정 순으로 알아서 한다)
      const token = grab(await user.login(talk || !canAsk ? undefined : { useKakaoAccountLogin: true }));
      if (!token) throw new Error('kakao_no_token');
      if (talk) track('login_native_ok', { provider: 'kakao' });

      return token;
    } catch (e) {
      // 그만둔 것은 넘기지 않는다 — 웹 창이 또 뜨면 놀란다
      if (isCancel(errText(e))) throw new AuthError('cancelled', 'kakao');
      track('login_native_fallback', { provider: 'kakao', code: 'sdk_' + shortCode(e) });
      if (web) return FALL;
      if (!talk) throw e;
    }

    // 1.0 방식 — 카카오톡이 실패했으면 카카오 계정 로그인을 한 번 더
    try {
      const token = grab(await user.login({ useKakaoAccountLogin: true }));
      if (!token) throw new Error('kakao_no_token');

      return token;
    } catch (e) {
      if (isCancel(errText(e))) throw new AuthError('cancelled', 'kakao');
      throw e;
    }
  }

  async function googleToken(): Promise<string | typeof FALL> {
    const g = env.google();
    if (!g?.GoogleSignin || isPlaceholder(keys.googleWeb)) {
      track('login_native_fallback', { provider: 'google', code: 'no_sdk' });
      if (web) return FALL;
      throw new Error('google_unavailable');
    }
    try {
      g.GoogleSignin.configure({
        webClientId: keys.googleWeb,
        iosClientId: isPlaceholder(keys.googleIos) ? undefined : keys.googleIos,
      });
      await g.GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      const r = await g.GoogleSignin.signIn();
      /*
       | **취소는 예외가 아니라 반환값이다**(⑤). 이걸 못 알아보면 아래에서 빈 토큰을 보고
       | `google_no_token` 을 던져, 그냥 취소한 사람에게 오류창이 뜬다.
       | 던지는 말은 `isCancel` 에 걸리는 글자여야 한다.
       */
      if (r?.type === 'cancelled') throw new Error('user_cancel');
      const token = String(r?.data?.idToken ?? r?.idToken ?? '');
      /*
       | 로그인 뒤 반드시 signOut — 안 하면 다음부터 계정 선택 없이 이전 계정으로 붙어
       | **계정을 바꿀 수 없다**(함정 E-3). 우리 세션은 서버가 들고 있으므로 끊어도 된다.
       */
      await g.GoogleSignin.signOut().catch(() => undefined);
      if (!token) throw new Error('google_no_token');

      return token;
    } catch (e) {
      if (isCancel(errText(e))) throw new AuthError('cancelled', 'google');
      track('login_native_fallback', { provider: 'google', code: 'sdk_' + shortCode(e) });
      if (web) return FALL;
      throw e;
    }
  }

  /**
   * 다시 보낼 만한 실패인가 — **닿지 못한 것**만 다시 보낸다.
   *
   * 1.0 은 「메시지가 한 단어면 서버가 거절한 코드」로 보고 안 보냈는데, 앱이 네트워크 오류를
   * `ApiError('network', 0)` 처럼 **한 단어로 바꿔 던지면** 첫 실패에 그만뒀다(당근캐시, Codex #5).
   * 상태 0·네트워크·끊김·시간 초과는 다시 보내고, 4xx 나 코드 한 단어(`ticket_invalid`)는 안 보낸다.
   */
  function retryable(e: unknown): boolean {
    const x = e as { status?: unknown; statusCode?: unknown; code?: unknown; name?: unknown; message?: unknown };
    const status = Number(x?.status ?? x?.statusCode ?? NaN);
    const msg = String(x?.message ?? '');
    const kind = String(x?.code ?? '') + ' ' + String(x?.name ?? '');
    // HTTP 응답이 있었으면 그것이 먼저다 — 401 인데 메시지에 「request failed」가 있어도 거절이다(Codex 2차 #10)
    if (status === 0) return true;
    if (Number.isFinite(status) && status >= 400) return false;
    if (/network|request failed|failed to fetch|abort|timed? ?out|offline|socket/i.test(msg + ' ' + kind)) return true;

    return !/^[a-z0-9_]+$/i.test(msg);
  }

  /**
   * 서버가 **거절한 것이 아니라 잠깐 못 받은 것**인가 — 시간 초과·요청 과다·5xx(Codex 4차).
   *
   * 곧바로 다시 보내지는 않지만(1.0 대로 「닿지 못한 것」만 다시 보낸다) **후보는 버리지 않는다.**
   * 서버가 세션을 만든 뒤 프록시가 502/504 를 주는 경우, 다시 누르면 서버의 재교환이 같은 세션을 돌려준다.
   */
  function transient(e: unknown): boolean {
    const x = e as { status?: unknown; statusCode?: unknown };
    const status = Number(x?.status ?? x?.statusCode ?? NaN);

    return retryable(e) || status === 408 || status === 425 || status === 429 || status >= 500;
  }

  /**
   * 인증 창이 닫히며 앱이 돌아오는 순간 보낸 fetch 가 iOS 에서 「취소됨」으로 끊긴다(⑦).
   * 같은 값으로 두 번까지 다시 보낸다.
   *
   * 서버가 이미 받아 세션을 만든 뒤 **응답만** 끊긴 경우, 다시 보내면 티켓이 「이미 씀」이다 —
   * 2.0 서버는 같은 `nonce` 로 다시 온 교환에 **같은 세션을 돌려준다**(Codex #6). 옛 서버에서는 실패한다.
   * 8초를 넘긴 요청은 다시 보내지 않는다 — 사용자가 이미 오래 기다렸다.
   */
  async function withRetry<R>(fn: () => Promise<R>): Promise<R> {
    const waits = [700, 1500];
    const t0 = Date.now();
    for (let i = 0; ; i++) {
      try {
        return await fn();
      } catch (e) {
        if (i >= waits.length || !retryable(e) || Date.now() - t0 > 8000) throw e;
        await env.wait(waits[i]);
      }
    }
  }

  /**
   * SDK 토큰을 서버 세션으로 바꾼다. **서버가 거절한 것도 남긴다** — 앱 키가 다른 앱 것이면
   * 여기서 막히는데, 앱 기록만 보면 「카카오톡으로 잘 받았다」로 끝나 원인이 안 보인다.
   * 꼬꼬농장이 카카오 가입 0 명을 한동안 못 알아챈 것도 이런 자리였다.
   */
  async function exchange(provider: 'kakao' | 'google', call: () => Promise<T>): Promise<T | typeof FALL> {
    try {
      return await withRetry(call);
    } catch (e) {
      track('login_native_fallback', { provider, code: 'server_reject', detail: shortCode(e) });
      if (web) return FALL;   // 서버 웹 로그인으로 한 번 더 기회를 준다
      throw e;
    }
  }

  async function appleNative(): Promise<T> {
    const a = env.apple();
    if (!a) throw new AuthError('failed', 'apple_unavailable');   // 이 빌드엔 애플 네이티브가 없다
    let c: any;
    try {
      c = await a.signInAsync({
        requestedScopes: [a.AppleAuthenticationScope.FULL_NAME, a.AppleAuthenticationScope.EMAIL],
      });
    } catch (e) {
      if (isCancel(errText(e))) throw new AuthError('cancelled', 'apple');
      throw e;
    }
    const token = String(c?.identityToken ?? '');
    if (!token) throw new Error('apple_no_token');
    // 이름은 **최초 1회만** 온다(⑥)
    const name = [c?.fullName?.familyName, c?.fullName?.givenName].filter(Boolean).join('');

    return withRetry(() => server.apple(token, name));
  }

  /**
   * 흐름마다 쓸 1회용 값 — 서버는 영숫자 16~64자만 받는다.
   *
   * **서버가 만든 것(`web.nonce`)을 먼저 쓴다.** 못 받으면 앱이 준 보안 난수(`random`) → 기기의
   * `crypto.getRandomValues` → 마지막으로 `Math.random`. 마지막 것은 짐작될 수 있는 값이라 **그때만**
   * 떨어진다(서버에 못 닿았다면 어차피 로그인 창도 못 연다).
   */
  async function makeNonce(): Promise<string> {
    if (web?.nonce) {
      try {
        const n = String(await web.nonce());
        if (/^[A-Za-z0-9]{16,64}$/.test(n)) return n;
      } catch { /* 아래로 */ }
    }
    const bytes = new Uint8Array(24);
    const c = (globalThis as { crypto?: { getRandomValues?: (a: Uint8Array) => Uint8Array } }).crypto;
    if (deps.random) deps.random(bytes);
    else if (c?.getRandomValues) c.getRandomValues(bytes);
    else for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);

    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }

  /** 흐름을 끝낸다 — 늦은 후보도 함께 버린다 */
  function closeFlow(): void {
    if (flow) flow.open = false;
    candidates = [];
  }


  /**
   * 들어온 **후보**를 차례로 바꿔 본다 — 누가 보냈는지 모른다(창이 돌려준 것도 마찬가지다).
   *
   * 서버가 **거절한** 후보(밀어 넣은 티켓·만료)만 버리고 다음으로 간다. **흐름은 성공했을 때만 닫는다** —
   * 거절 때 닫으면 뒤에 오는 정상 주소를 못 받는다(Codex 2차 #1). **닿지 못한** 후보(네트워크)는 버리지
   * 않고 되돌려 둔다 — 다시 부르면 이어서 바꾼다(Codex 3차, 정상 티켓을 네트워크 한 번에 잃던 것).
   */
  async function tryCandidates(f: Flow, alive: () => boolean): Promise<T> {
    /*
     | **흐름이 그대로일 때만** 후보를 만진다(Codex 5차). `abandon()` 으로 잊힌 실행의 교환이 뒤늦게
     | 끝났을 때 그사이 새 로그인이 시작됐으면, 옛 후보를 새 목록에 되돌려 놓거나 새 흐름을 닫으면 안 된다.
     */
    const same = (): boolean => flow === f && f.open;
    let c: Candidate | undefined;
    // 전부 거절되면 마지막 거절을 그대로 던진다 — `exg:` 꼬리표(무엇이·몇 ms 만에)가 남아야 제보로 가른다
    let last: unknown = new AuthError('failed', 'late:rejected');
    // 잊힌 실행은 다음 후보로 넘어가지 않는다 — 새 실행이 같은 후보를 처리한다
    while (alive() && same() && (c = freshCandidates().shift())) {
      try {
        const r = await exchangeTicket(c.ticket, f.nonce);
        used.add(c.ticket);
        // 이 흐름으로 로그인이 **끝났다** — 잊힌 실행이 끝냈어도 흐름의 목적은 이뤘으니 닫는다
        if (same()) closeFlow();

        return r;
      } catch (e) {
        if (!same()) throw e;
        if ((e as AuthError & { retryable?: boolean }).retryable) {
          candidates.unshift(c);
          if (candidates.length > MAX_CANDIDATES) candidates.pop();
          throw e;
        }
        used.add(c.ticket);
        last = e;
      }
    }
    if (!alive()) throw abandoned();
    throw last;
  }

  /** 티켓 → 세션. 실패에는 걸린 시간·시도 횟수를 붙인다 — 즉시 끊겼는지 제한 시간인지 캡처 한 장으로 가른다 */
  async function exchangeTicket(ticket: string, nonce: string): Promise<T> {
    const w = web as WebLogin<T>;
    const t0 = Date.now();
    let tries = 0;
    try {
      return await withRetry(() => { tries++; return w.exchange(ticket, nonce); });
    } catch (e) {
      const err = new AuthError('failed', 'exg:' + shortCode(e) + '·' + (Date.now() - t0) + 'ms×' + tries);
      (err as AuthError & { retryable?: boolean }).retryable = transient(e);
      throw err;
    }
  }

  /** 브라우저 창 → 티켓 → 세션(2.0) */
  async function webLogin(provider: AnyProvider, alive: () => boolean): Promise<T> {
    if (!web) throw new AuthError('failed', provider + '_unavailable');
    // 잊힌 실행(SDK 가 실패해 넘어온 것)은 연결 코드 요청 같은 서버 호출도 하지 않는다
    if (!alive()) throw abandoned();

    // 이 제공자로 시작한 흐름에 늦게 온 후보가 있다 — 창을 다시 열지 않고 그것부터
    if (flowAlive() && flow && flow.provider === provider && freshCandidates().length > 0) return tryCandidates(flow, alive);

    const B = env.browser();
    if (!B?.openAuthSessionAsync) throw new AuthError('failed', 'open:no_browser');
    let link: string | undefined;
    try {
      /*
       | 안드로이드: Custom Tabs 서비스에 **먼저 붙는다**. 바인딩 전에 열면 시스템이 일반 인텐트로
       | 넘겨 다른 앱이 링크를 가로챈다 — 구글 로그인을 처음 누르면 **메일 쓰기가 열리고**, 뒤로
       | 나와 다시 누르면 되던 증상이 이것이다(꼬꼬농장 2026-09-10). iOS 에서는 아무 일도 안 한다.
       */
      await Promise.resolve(B.warmUpAsync?.()).catch(() => undefined);
      /*
       | 게스트가 가입하는 중이면 연결 코드를 먼저 받는다 — **못 받으면 창을 열지 않는다.**
       | 코드 없이 가입하면 서버가 새 회원을 만들고, 게스트로 키운 것은 계정이 바뀐 것으로 보고
       | 비워진다. 서버가 실패로 답하면 던지지만 200 인데 코드만 비어 오는 경우가 남는다 —
       | 그때 그냥 열면 **오류 없이 새 회원이 생기고 농장만 사라진다**(2026-09-19 당근캐시 세션).
       */
      if (deps.guest?.active()) {
        link = (await deps.guest.link()) || undefined;
        if (!link) throw new AuthError('failed', 'open:no_guest_link');
      }
    } catch (e) {
      if (e instanceof AuthError) throw e;
      throw new AuthError('failed', 'open:' + shortCode(e));
    }

    /*
     | 여기부터 공유 상태(`flow`·후보)를 바꾼다 — **기다린 뒤마다 아직 내 차례인지 본다**(Codex 5차).
     | `abandon()` 으로 잊힌 실행이 연결 코드·nonce·창을 기다리다 풀려서 새 로그인의 흐름을 닫거나 덮으면,
     | 새 흐름의 정상 티켓을 옛 nonce 로 바꿔 보다 **태워 버렸다.**
     */
    if (!alive()) throw abandoned();
    // 새 흐름 — 앞 흐름과 그 후보는 버린다(그 nonce 로는 어차피 못 바꾼다)
    closeFlow();
    const nonce = await makeNonce();
    if (!alive()) throw abandoned();
    const f: Flow = { provider, nonce, at: Date.now(), open: true };
    flow = f;
    const same = (): boolean => flow === f && f.open;
    let res: { type: string; url?: string };
    try {
      res = await B.openAuthSessionAsync(web.start(provider, link, f.nonce), web.returnUrl);
    } catch (e) {
      /*
       | 흐름이 그대로여도 **내 차례가 아니면 닫지 않는다**(Codex 6차). 잊힌 뒤 같은 제공자로 다시 누르면
       | 새 실행이 **같은 흐름**을 이어 쓰므로 `same()` 만으로는 남의 흐름인지 가를 수 없다.
       */
      if (alive() && same()) closeFlow();
      if (!alive()) throw abandoned();
      throw new AuthError('failed', 'open:' + shortCode(e));
    }
    if (!alive()) {
      // 잊힌 뒤에 창이 돌아왔다 — 흐름이 그대로면 받은 주소만 후보로 남긴다(다시 누르면 쓴다)
      if (same() && res.type === 'success') capture(res.url);
      throw abandoned();
    }

    if (res.type === 'success' && res.url && isReturn(res.url)) {
      /*
       | 창의 `success` 도 **서버가 확인하기 전에는 정답이 아니다**(Codex 3차). 안드로이드 Expo 는 창이
       | 열려 있는 동안 들어온 **아무 딥링크**로도 success 를 만든다 — 밀어 넣은 주소일 수 있다. 그래서
       | 후보 맨 앞에 두고 같은 확인을 거친다. 거절되면 흐름은 열어 둔 채 진짜 주소를 기다린다.
       */
      const { ticket, error } = parseReturn(res.url);
      if (ticket) addCandidate(res.url, ticket, true);
      /*
       | 오류 주소(`error=`)여도 **이미 받아 둔 후보가 있으면 그것부터** 바꿔 본다(Codex 4차). 창이 도는
       | 동안 들어온 후보는 화면에 알리지 않으므로(`current` 중), 여기서 버리면 다시 누를 때까지 묻힌다.
       */
      if (freshCandidates().length > 0) return tryCandidates(f, alive);
      if (error === 'cancelled') throw new AuthError('cancelled', provider);
      throw new AuthError('failed', ticket ? 'late:rejected' : 'ret:' + (error ?? 'no_ticket'));
    }

    // 창이 먼저 닫혔어도 복귀 주소가 곧 따로 올 수 있다(안드로이드) — 잠깐 기다려 본다
    if (env.os() === 'android') {
      for (let i = 0; i < 12 && freshCandidates().length === 0; i++) await env.wait(200);
    }
    // 창이 도는 동안 받아 둔 것도 여기서 쓴다 — 어느 OS 든(Codex 4차)
    if (freshCandidates().length > 0) return tryCandidates(f, alive);
    /*
     | 닫았으면 취소다. **흐름은 열어 둔다** — 복귀 주소가 창 밖으로 더 늦게 올 수 있고,
     | 그러면 `onLateReturn` 으로 화면이 알고 같은 제공자로 다시 부른다.
     */
    if (res.type === 'cancel' || res.type === 'dismiss') throw new AuthError('cancelled', provider);
    if (same()) closeFlow();
    throw new AuthError('failed', 'win:' + res.type);
  }

  async function run(provider: AnyProvider, alive: () => boolean): Promise<T> {
    const list = deps.providers?.() ?? [];
    // 카카오는 REST 키(kakao)든 앱 키(kakao_native)든 하나만 켜져도 켜진 것이다(2.1.2) — 서버는 앱 키만 있으면
    // kakao_native 만 준다. 'kakao' 만 찾아서, 카카오톡 로그인만 켠 앱(총무님)의 버튼이 서버에 가지도 않고 막혔다
    const on = list.includes(provider) || (provider === 'kakao' && list.includes('kakao_native'));
    if (list.length > 0 && !on) throw new AuthError('disabled', provider);

    /*
     | 이 제공자로 시작한 웹 로그인에 **늦게 온 복귀 주소가 있으면 SDK 보다 먼저** 그것으로 끝낸다.
     | SDK 부터 다시 띄우면, 그 창을 닫는 순간 받아 둔 정상 티켓을 버리게 된다(Codex #3).
     */
    if (web && flowAlive() && flow && flow.provider === provider && freshCandidates().length > 0) return webLogin(provider, alive);

    /*
     | 여기부터는 **새 로그인**이다 — 앞 웹 흐름을 끝낸다. 안 끝내면 네이버 창을 닫고 구글로 로그인한 뒤에도
     | 네이버 흐름이 살아 있어, 늦게 온 네이버 주소가 방금 고른 계정을 덮어쓸 수 있었다(Codex 2차 #2).
     */
    closeFlow();

    if (provider === 'apple') {
      // iOS 는 네이티브 창, 안드로이드는 서버 웹 로그인(애플 Services ID — 서버에 apple_web 이 있어야)
      if (env.os() === 'ios') return appleNative();
      if (web && list.includes('apple_web')) return webLogin('apple', alive);
      throw new AuthError('failed', 'apple_unavailable');
    }
    if (provider === 'naver') {
      if (!web) throw new AuthError('failed', 'naver_needs_web');

      return webLogin('naver', alive);
    }

    if (provider === 'kakao') {
      // 서버 목록을 **받아 본 결과** 카카오 SDK 가 꺼져 있을 때만 SDK 를 건너뛴다(비어 있으면 모르는 것)
      if (web && list.length > 0 && !list.includes('kakao_native')) {
        track('login_native_fallback', { provider: 'kakao', code: 'server_off' });
      } else {
        const t = await kakaoToken();
        if (t !== FALL) {
          const s = await exchange('kakao', () => server.kakao(t));
          if (s !== FALL) return s;
        }
      }
    } else {
      const t = await googleToken();
      if (t !== FALL) {
        const s = await exchange('google', () => server.google(t));
        if (s !== FALL) return s;
      }
    }

    return webLogin(provider, alive);
  }

  function signIn(provider: AnyProvider): Promise<T> {
    triedAuth = true;   // 여기서부터는 앱이 스스로 재시작하면 안 된다
    if (current) {
      // 같은 버튼을 또 눌렀다 — 같은 결과를 기다린다. 다른 버튼이면 앞의 것이 끝날 때까지 받지 않는다
      if (current.provider === provider) return current.p;

      return Promise.reject(new AuthError('busy', provider));
    }
    /*
     | 끝나면 **자기 것일 때만** 비운다 — `abandon()` 뒤에 새 로그인이 돌고 있는데, 잊었던 옛 약속이
     | 뒤늦게 끝나며 새 것을 지우면 두 로그인이 겹친다.
     */
    const entry = { provider } as { provider: AnyProvider; p: Promise<T> };
    current = entry;
    // 이 실행이 아직 「지금 로그인」인가 — `abandon()` 뒤에는 거짓이라 공유 상태를 건드리지 않는다
    const alive = (): boolean => current === entry;
    entry.p = run(provider, alive).finally(() => { if (current === entry) current = null; });

    return entry.p;
  }

  function onLateReturn(fn: (provider: AnyProvider) => void): () => void {
    lateListeners.add(fn);

    return () => { lateListeners.delete(fn); };
  }

  return {
    initKakao,
    availableProviders,
    kakaoTalkAvailable,
    signIn,
    hasTriedAuth: () => triedAuth,
    isAuthorizing: () => current !== null,
    onLateReturn,
    abandon: () => { current = null; },
  };
}
