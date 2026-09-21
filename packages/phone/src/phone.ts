/**
 * 번호 인증 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * 이 파일은 **앱도 화면도 모른다.** 주소와 헤더를 받아 서버를 부르고, 화면이 그릴 값만 돌려준다.
 * 그래서 앱마다 다른 디자인을 그대로 둘 수 있다.
 */

/** 인증번호 자릿수 — 서버가 정한 값이다. 화면의 `maxLength` 도 이것을 쓴다 */
export const CODE_LEN = 6;

/** 서버가 돌려주는 오류 코드 — 여기 없는 값은 `unknown` 으로 다룬다 */
export type PhoneError =
  | 'phone_taken' | 'same_phone' | 'signup_required' | 'sms_off' | 'bad_phone'
  | 'too_soon' | 'too_many' | 'daily_max'
  | 'expired' | 'not_sent' | 'wrong'
  | 'network' | 'unknown';

export type PhoneStatus = {
  /** 확인이 끝난 번호. 없으면 빈 문자열 */
  phone: string;
  verified: boolean;
  /**
   * 서버가 문자를 보낼 수 있는 상태인가.
   *
   * **false 면 인증 화면을 아예 열지 않는다.** 열어 봐야 문자가 안 가고, 꼬꼬농장에서
   * 「인증 문자가 안 와요」 리뷰가 달린 전례가 있다.
   */
  smsReady: boolean;
};

export type SendResult =
  | { ok: true; ttlMs: number; leftToday: number }
  | { ok: false; error: PhoneError; waitMs?: number };

export type VerifyResult =
  | { ok: true; phone: string }
  | { ok: false; error: PhoneError; left?: number };

/** 숫자만 남긴다 — 서버로는 항상 이 모양으로 보낸다 */
export const digits = (v: string): string => v.replace(/\D/g, '');

/** 010-1234-5678 로 보이게만 한다. 값은 숫자만 들고 다닌다 */
export function format(v: string): string {
  const d = digits(v).slice(0, 11);
  if (d.length < 4) return d;
  if (d.length < 8) return `${d.slice(0, 3)}-${d.slice(3)}`;

  return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}

/**
 * 보낼 수 있는 번호인가 — **서버와 같은 규칙**이어야 한다.
 *
 * 화면이 더 느슨하면 서버가 `bad_phone` 으로 거절하고, 더 빡빡하면 멀쩡한 번호를 못 넣는다.
 * 둘 다 「왜 안 되지」가 되고, 그때 사람은 번호를 의심한다.
 */
export const looksValid = (v: string): boolean => /^01[016789]\d{7,8}$/.test(digits(v));

export const codeLooksValid = (v: string): boolean => digits(v).length === CODE_LEN;

/**
 * 오류 → 사람이 읽는 말.
 *
 * **무엇을 하면 되는지까지 적는다.** 「실패했어요」로 끝내면 그 사람이 할 수 있는 일이 없다.
 * 앱마다 다시 쓰면 같은 오류가 앱마다 다른 말로 나와서, 문의가 오면 어느 앱인지부터 묻게 된다.
 */
export function message(error: PhoneError | string, extra?: { waitMs?: number; left?: number }): string {
  switch (error) {
    case 'phone_taken': return '이미 다른 계정에서 쓰고 있는 번호예요.';
    // 확인해 둔 내 번호로 다시 받기(서버 409, jcurve-api 209e8ba) — 문자를 보내지 않는다
    case 'same_phone': return '지금 확인된 번호와 같아요. 다른 번호를 넣어 주세요.';
    case 'signup_required': return '가입한 뒤에 번호를 인증할 수 있어요.';
    case 'sms_off': return '문자 인증을 준비하고 있어요. 조금만 기다려 주세요.';
    case 'bad_phone': return '휴대폰 번호를 다시 확인해 주세요.';
    case 'too_soon': return extra?.waitMs
      ? `잠시 후에 다시 보낼 수 있어요. (${Math.ceil(extra.waitMs / 1000)}초)`
      : '잠시 후에 다시 보낼 수 있어요.';
    case 'too_many': return '너무 여러 번 틀렸어요. 번호를 다시 받아 주세요.';
    case 'daily_max': return '오늘은 더 보낼 수 없어요. 내일 다시 시도해 주세요.';
    case 'expired': return '인증 시간이 지났어요. 번호를 다시 받아 주세요.';
    case 'not_sent': return '먼저 인증번호를 받아 주세요.';
    case 'wrong': return extra?.left
      ? `인증번호가 맞지 않아요. (${extra.left}번 남음)`
      : '인증번호가 맞지 않아요.';
    default: return '잠시 후에 다시 시도해 주세요.';
  }
}

/**
 * 틀린 뒤 처음부터 다시 받아야 하는가.
 *
 * 시간이 지났거나 다섯 번 다 틀리면 **서버가 그 코드를 버린다.** 화면이 그대로 두면
 * 이미 없는 코드에 계속 숫자를 넣게 된다.
 */
export const needsResend = (error: PhoneError | string): boolean =>
  error === 'expired' || error === 'too_many';

export type PhoneDeps = {
  /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
  base: string;
  /**
   * 요청마다 헤더를 만든다 — 세션 토큰이 바뀌므로 **값이 아니라 함수로 받는다.**
   * 로그인 전이라 보낼 수 없으면 `null` 을 주면 된다(그때는 부르지 않는다).
   *
   * `Accept` · `Content-Type`(본문이 있을 때)은 **패키지가 붙인다**(1.1). 빠지면 서버가 본문을 못 읽어
   * 번호가 빈칸이 되고, 어떤 번호든 `bad_phone` 이 난다(2026-09-22 당근캐시 실기기). 여기서 같은
   * 이름을 주면 그 값이 이긴다.
   */
  headers: () => Record<string, string> | null;
  /** 밀리초. 기본 8초 */
  timeoutMs?: number;
};

export type Phone = {
  /** 지금 상태 — 화면이 「인증하기」를 띄울지 정한다. 못 읽으면 `null` */
  status: () => Promise<PhoneStatus | null>;
  send: (phone: string) => Promise<SendResult>;
  verify: (phone: string, code: string) => Promise<VerifyResult>;
};

export function createPhone(deps: PhoneDeps): Phone {
  const call = async (path: string, body?: unknown): Promise<any | null> => {
    const h = deps.headers();
    if (!h) return null;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), deps.timeoutMs ?? 8000);
    try {
      const res = await fetch(deps.base + path, {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}), ...h },
        signal: ctrl.signal,
        body: body ? JSON.stringify(body) : undefined,
      });

      return (await res.json().catch(() => null)) ?? null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  return {
    async status() {
      const j = await call('/me/profile');
      if (!j?.ok) return null;

      return {
        phone: String(j.phone ?? ''),
        verified: !!j.phoneVerified,
        // 칸이 없는 옛 서버에서는 **보낼 수 있는 것으로 읽는다** — 모르는 값을 막는 쪽으로
        // 읽으면 앱이 서버보다 먼저 나갔을 때 멀쩡하던 인증이 사라진다.
        smsReady: j.smsReady !== false,
      };
    },

    async send(phone) {
      const j = await call('/phone/send', { phone: digits(phone) });
      if (!j) return { ok: false, error: 'network' };
      if (j.ok) return { ok: true, ttlMs: Number(j.ttlMs) || 300000, leftToday: Number(j.leftToday) || 0 };

      return { ok: false, error: (String(j.error ?? 'unknown') as PhoneError), waitMs: Number(j.waitMs) || undefined };
    },

    async verify(phone, code) {
      const j = await call('/phone/verify', { phone: digits(phone), code: digits(code) });
      if (!j) return { ok: false, error: 'network' };
      if (j.ok) return { ok: true, phone: String(j.phone ?? '') };

      return { ok: false, error: (String(j.error ?? 'unknown') as PhoneError), left: Number(j.left) || undefined };
    },
  };
}
