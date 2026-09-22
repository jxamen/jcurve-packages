/**
 * 2.0 의 동작을 **가짜 기기**로 직접 돌려 본다.
 *
 * 로그인은 실기기에서만 드러나는 갈래가 많아서, 글자만 보는 시험(`auth.test.ts`)으로는
 * 「넘어가야 할 때 넘어가는지」를 못 잡는다. 여기서는 SDK·브라우저·복귀 주소를 흉내 내고
 * 갈래마다 **실제로 무엇이 불렸는지**를 본다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AuthError, createAuth, isCancel, parseReturn, type AuthDeps, type AuthEnv } from './auth';

type Session = { s: string };

/* eslint-disable @typescript-eslint/no-explicit-any */

/** 카카오 SDK 흉내 — 무엇으로 불렸는지 남긴다 */
function kakaoFake(opts: { talk?: boolean; canAsk?: boolean; login?: (arg?: any) => Promise<any> } = {}) {
  const calls: any[] = [];
  const user: any = {
    login: async (arg?: any) => {
      calls.push(arg ?? 'default');

      return opts.login ? opts.login(arg) : { accessToken: 'KTOKEN' };
    },
  };
  if (opts.canAsk !== false) user.isKakaoTalkLoginAvailable = async () => opts.talk ?? true;

  return { user, calls };
}

/** 브라우저 흉내 — 연 주소를 남긴다 */
function browserFake(result: { type: string; url?: string } | (() => Promise<{ type: string; url?: string }>)) {
  const opened: string[] = [];

  return {
    opened,
    mod: {
      warmUpAsync: async () => undefined,
      openAuthSessionAsync: async (u: string) => {
        opened.push(u);

        return typeof result === 'function' ? result() : result;
      },
    },
  };
}

const RET = 'myapp://auth';

function setup(o: {
  os?: string;
  kakao?: ReturnType<typeof kakaoFake> | null;
  google?: any;
  apple?: any;
  browser?: ReturnType<typeof browserFake> | null;
  web?: boolean;
  providers?: string[];
  guest?: AuthDeps<Session>['guest'];
  server?: Partial<AuthDeps<Session>['server']>;
  exchange?: (t: string) => Promise<Session>;
  onWait?: () => void | Promise<void>;
  kakaoInit?: () => Promise<void>;
  initialUrl?: string;
  /** 서버가 주는 nonce(`web.nonce`) */
  nonce?: () => Promise<string>;
  /** 앱이 주는 보안 난수(`random`) */
  random?: (b: Uint8Array) => void;
} = {}) {
  const tracked: Array<[string, any]> = [];
  const server: string[] = [];
  /** 시작 때 받은 nonce 들, 교환 때 받은 nonce 들 — 같아야 한다 */
  const nonces: { start: string[]; exchange: string[] } = { start: [], exchange: [] };
  /** 서버처럼 **티켓은 한 번만** 바꿔 준다 — 두 번 써도 성공하던 가짜는 #2 를 가렸다(Codex) */
  const spent = new Set<string>();
  /** 서버처럼 **티켓은 시작한 흐름의 nonce 에 묶인다** — 다른 nonce 로는 못 바꾼다 */
  const bound = new Map<string, string>();
  const nonceOf = (u: string) => (u.match(/[?&]nonce=([0-9a-f]+)/) ?? [])[1] ?? '';
  const ticketOf = (u: string) => (u.match(/[?&]ticket=([^&#]+)/) ?? [])[1] ?? '';
  let urlHandler: ((e: { url: string }) => void) | null = null;
  const env: AuthEnv = {
    os: () => o.os ?? 'android',
    kakaoCore: () => ({ initializeKakaoSDK: o.kakaoInit ?? (async () => undefined) }),
    kakaoUser: () => (o.kakao === undefined ? kakaoFake().user : o.kakao?.user ?? null),
    google: () => o.google ?? null,
    apple: () => o.apple ?? null,
    browser: () => (o.browser ? {
      ...o.browser.mod,
      // 창이 돌려준 티켓은 **그 창을 연 주소의 nonce** 에 묶인다 — 서버 콜백이 하는 일
      openAuthSessionAsync: async (u: string, r: string) => {
        const res = await o.browser!.mod.openAuthSessionAsync(u);
        if (res?.url && ticketOf(res.url) && !bound.has(ticketOf(res.url))) bound.set(ticketOf(res.url), nonceOf(u));

        return res;
      },
    } : null),
    linking: () => ({ addEventListener: (_: string, h: any) => { urlHandler = h; }, getInitialURL: async () => o.initialUrl ?? null }),
    wait: async () => { await o.onWait?.(); },
  };
  const auth = createAuth<Session>({
    keys: { kakaoNative: 'realkey123', googleWeb: 'web.apps.googleusercontent.com' },
    server: {
      kakao: o.server?.kakao ?? (async (t) => { server.push('kakao:' + t); return { s: 'K' }; }),
      google: o.server?.google ?? (async (t) => { server.push('google:' + t); return { s: 'G' }; }),
      apple: o.server?.apple ?? (async (t, n) => { server.push('apple:' + t + ':' + n); return { s: 'A' }; }),
    },
    track: (n, p) => { tracked.push([n, p]); },
    web: o.web === false ? undefined : {
      start: (p, link, nonce) => {
        nonces.start.push(nonce);

        return `https://api/auth/start?provider=${p}` + (link ? `&link=${link}` : '') + `&nonce=${nonce}`;
      },
      returnUrl: RET,
      nonce: o.nonce,
      exchange: async (t, nonce) => {
        nonces.exchange.push(nonce);
        if (o.exchange) return o.exchange(t);
        // 서버와 같은 규칙 — 묶인 nonce 와 다르면 401(밀어 넣은 티켓), 이미 쓴 것도 401
        if (bound.get(t) !== nonce) throw Object.assign(new Error('ticket_invalid'), { status: 401 });
        if (spent.has(t)) throw Object.assign(new Error('ticket_invalid'), { status: 401 });
        spent.add(t);
        server.push('exchange:' + t);

        return { s: 'W' };
      },
    },
    providers: o.providers ? () => o.providers as string[] : undefined,
    guest: o.guest,
    random: o.random,
  }, env);

  /**
   * Linking 으로 주소를 쏜다. `who` — `me` 면 지금 흐름(마지막 시작)의 nonce 에 묶인 정상 티켓,
   * `attacker` 면 남의 nonce 에 묶인 티켓(공격자가 자기 로그인으로 받은 것).
   */
  const fireUrl = (url: string, who: 'me' | 'attacker' = 'me') => {
    const t = ticketOf(url);
    if (t && !bound.has(t)) bound.set(t, who === 'me' ? nonces.start[nonces.start.length - 1] ?? '' : 'f'.repeat(48));
    urlHandler?.({ url });
  };

  return { auth, tracked, server, nonces, fireUrl };
}

/** 시작 주소에서 nonce 를 뗀 것 — 흐름마다 다른 값이라 단언에서는 뺀다 */
const plain = (u: string) => u.replace(/&nonce=[0-9a-f]+/, '');

const codes = (t: Array<[string, any]>) => t.filter(([n]) => n === 'login_native_fallback').map(([, p]) => p.code);

describe('1.0 처럼 쓰면 1.0 처럼 돈다 (웹 로그인 없음)', () => {
  it('카카오톡으로 받아 서버에 넘긴다', async () => {
    const k = kakaoFake({ talk: true });
    const { auth, server, tracked } = setup({ web: false, kakao: k });
    expect(await auth.signIn('kakao')).toEqual({ s: 'K' });
    expect(server).toEqual(['kakao:KTOKEN']);
    expect(tracked.map(([n]) => n)).toContain('login_native_ok');
  });

  it('카카오톡이 실패하면 카카오 계정 로그인을 한 번 더 한다', async () => {
    let n = 0;
    const k = kakaoFake({ talk: true, login: async () => { if (n++ === 0) throw new Error('KakaoTalkError'); return { accessToken: 'K2' }; } });
    const { auth, server } = setup({ web: false, kakao: k });
    await auth.signIn('kakao');
    expect(k.calls).toEqual(['default', { useKakaoAccountLogin: true }]);
    expect(server).toEqual(['kakao:K2']);
  });

  it('모듈이 없으면 던진다(넘어갈 곳이 없다)', async () => {
    const { auth } = setup({ web: false, kakao: null });
    await expect(auth.signIn('kakao')).rejects.toThrow('kakao_unavailable');
  });
});

describe('취소는 취소다 — 웹 창을 또 열지 않는다', () => {
  it('카카오 동의 화면 「취소」(AccessDenied)', async () => {
    const k = kakaoFake({ talk: true, login: async () => { throw Object.assign(new Error('user denied'), { code: 'AccessDenied' }); } });
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth, server } = setup({ kakao: k, browser: b });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e).toBeInstanceOf(AuthError);
    expect(e.code).toBe('cancelled');
    expect(isCancel(e.message)).toBe(true);
    expect(b.opened, '꼬꼬농장이 여기서 웹 창을 한 번 더 열었다').toEqual([]);
    expect(server).toEqual([]);
  });

  it('구글은 취소가 반환값이다', async () => {
    const google = { GoogleSignin: { configure: () => undefined, hasPlayServices: async () => true, signIn: async () => ({ type: 'cancelled' }), signOut: async () => undefined } };
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth } = setup({ google, browser: b });
    const e = await auth.signIn('google').catch((x) => x);
    expect(e.code).toBe('cancelled');
    expect(b.opened).toEqual([]);
  });

  it('웹 창을 닫으면 취소다', async () => {
    const b = browserFake({ type: 'dismiss' });
    const { auth } = setup({ os: 'ios', kakao: null, browser: b });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e.code).toBe('cancelled');
  });

  it('실패 메시지는 태그에 cancel 이 섞여도 취소로 읽히지 않는다', () => {
    expect(isCancel(new AuthError('failed', 'open:ERR_CANCELED').message)).toBe(false);
    expect(isCancel(new AuthError('cancelled', 'kakao').message)).toBe(true);
  });
});

describe('SDK 가 안 되면 서버 웹 로그인으로 넘어간다', () => {
  it('SDK 실패 → 웹 → 티켓 교환', async () => {
    const k = kakaoFake({ talk: true, login: async () => { throw Object.assign(new Error('keyhash'), { code: 'KeyHashError' }); } });
    const b = browserFake({ type: 'success', url: RET + '?ticket=T1' });
    const { auth, server, tracked } = setup({ kakao: k, browser: b });
    expect(await auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(b.opened.map(plain)).toEqual(['https://api/auth/start?provider=kakao']);
    expect(server).toEqual(['exchange:T1']);
    expect(codes(tracked)).toContain('sdk_KeyHashError');
    expect(k.calls, '웹이 있으면 SDK 는 한 번만 — 창이 세 번 뜨지 않게').toHaveLength(1);
  });

  it('서버가 SDK 토큰을 거절하면 웹으로 한 번 더 기회를 준다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T2' });
    const { auth, server, tracked } = setup({
      browser: b,
      server: { kakao: async () => { throw new Error('invalid_token'); } },
    });
    expect(await auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(codes(tracked)).toContain('server_reject');
    expect(server).toEqual(['exchange:T2']);
  });

  it('어드민이 카카오 SDK 를 꺼 뒀으면 SDK 를 건드리지 않는다', async () => {
    const k = kakaoFake();
    const b = browserFake({ type: 'success', url: RET + '?ticket=T3' });
    const { auth, tracked } = setup({ kakao: k, browser: b, providers: ['kakao', 'google'] });
    await auth.signIn('kakao');
    expect(k.calls).toEqual([]);
    expect(codes(tracked)).toContain('server_off');
  });

  it('목록이 비어 있으면(아직 모르면) SDK 를 쓴다 — 막았더니 카카오 가입이 0 이 됐다', async () => {
    const k = kakaoFake();
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth, server } = setup({ kakao: k, browser: b, providers: [] });
    await auth.signIn('kakao');
    expect(k.calls).toHaveLength(1);
    expect(server).toEqual(['kakao:KTOKEN']);
    expect(b.opened).toEqual([]);
  });

  it('(2.1.2) 카카오 앱 키만 켠 앱(kakao_native)도 카카오 버튼이 SDK 로 간다 — disabled 로 막지 않는다', async () => {
    const k = kakaoFake();
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth, server } = setup({ kakao: k, browser: b, providers: ['google', 'apple', 'kakao_native'] });
    await auth.signIn('kakao');
    expect(k.calls).toHaveLength(1);
    expect(server).toEqual(['kakao:KTOKEN']);
  });

  it('어드민이 끈 로그인은 시작도 안 한다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth } = setup({ browser: b, providers: ['google'] });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e.code).toBe('disabled');
    expect(b.opened).toEqual([]);
  });
});

describe('게스트 농장 잇기', () => {
  it('연결 코드를 못 받으면 창을 열지 않는다 — 열면 농장만 사라진다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth, server } = setup({ kakao: null, browser: b, guest: { active: () => true, link: async () => '' } });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e.code).toBe('failed');
    expect(e.tag).toBe('open:no_guest_link');
    expect(b.opened).toEqual([]);
    expect(server).toEqual([]);
  });

  it('받으면 시작 주소에 싣는다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth } = setup({ kakao: null, browser: b, guest: { active: () => true, link: async () => 'L1' } });
    await auth.signIn('kakao');
    expect(b.opened.map(plain)).toEqual(['https://api/auth/start?provider=kakao&link=L1']);
  });

  it('게스트가 아니면 코드를 받지 않는다', async () => {
    let asked = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=T' });
    const { auth } = setup({ kakao: null, browser: b, guest: { active: () => false, link: async () => { asked++; return 'X'; } } });
    await auth.signIn('kakao');
    expect(asked).toBe(0);
  });
});

describe('늦게 오는 복귀 주소 (안드로이드)', () => {
  it('창이 먼저 닫혀도 곧 온 주소로 끝낸다', async () => {
    const b = browserFake({ type: 'dismiss' });
    let fire: (u: string) => void = () => undefined;
    const s = setup({ os: 'android', kakao: null, browser: b, onWait: () => fire(RET + '?ticket=LATE') });
    fire = s.fireUrl;
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:LATE']);
  });

  it('창을 닫은 뒤 창 밖으로 온 주소는 화면에 알리고, 다시 부르면 창을 새로 열지 않고 쓴다', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    const told: string[] = [];
    const off = s.auth.onLateReturn((p) => { told.push(p); });
    const e = await s.auth.signIn('kakao').catch((x) => x);
    expect(e.code, '창을 닫으면 일단 취소다').toBe('cancelled');
    s.fireUrl(RET + '?ticket=OUT');                 // 흐름은 열려 있다 — 창 밖으로 늦게 온다
    expect(told, '어느 제공자였는지 알려 줘야 화면이 같은 것으로 다시 부른다').toEqual(['kakao']);
    await s.auth.signIn('kakao');
    expect(b.opened, '창을 다시 열면 안 된다').toHaveLength(1);
    expect(s.server).toEqual(['exchange:OUT']);
    off();
  });

  it('**이 앱이 시작하지 않은 주소는 버린다** — 밀어 넣은 티켓으로 남의 계정에 로그인되지 않게(Codex #1)', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=MINE' });
    const s = setup({ kakao: null, browser: b });
    let told = 0;
    s.auth.onLateReturn(() => { told++; });
    s.fireUrl(RET + '?ticket=ATTACKER', 'attacker'); // 로그인을 누르기도 전에 누가 쏜다
    expect(told, '화면에 알리지도 않는다').toBe(0);
    await s.auth.signIn('kakao');
    expect(b.opened, '창을 정상적으로 연다').toHaveLength(1);
    expect(s.server).toEqual(['exchange:MINE']);
  });

  it('로그인이 끝난 뒤 들어온 주소도 버린다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=A1' });
    const s = setup({ kakao: null, browser: b });
    let told = 0;
    s.auth.onLateReturn(() => { told++; });
    await s.auth.signIn('kakao');
    s.fireUrl(RET + '?ticket=ATTACKER', 'attacker');
    expect(told).toBe(0);
  });

  it('창이 받은 주소가 먼저 따로도 들어왔으면 비운다 — 다음에 이미 쓴 티켓을 또 쓰지 않게', async () => {
    let n = 0;
    let s!: ReturnType<typeof setup>;
    const b = browserFake(async () => {
      const url = RET + '?ticket=SAME' + (n++);
      s.fireUrl(url);                                          // 같은 주소가 Linking 으로도 먼저 들어온다

      return { type: 'success', url };
    });
    s = setup({ kakao: null, browser: b });
    await s.auth.signIn('kakao');
    await s.auth.signIn('kakao');
    expect(b.opened, '두 번째 로그인은 창을 새로 열어야 한다').toHaveLength(2);
    expect(s.server).toEqual(['exchange:SAME0', 'exchange:SAME1']);
  });

  it('남의 주소·티켓 없는 주소·비슷한 주소는 잡지 않는다', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    let told = 0;
    s.auth.onLateReturn(() => { told++; });
    await s.auth.signIn('kakao').catch(() => undefined);   // 흐름을 연다
    s.fireUrl('otherapp://auth?ticket=X');
    s.fireUrl(RET + '?error=cancelled');
    s.fireUrl(RET + '/evil?ticket=X');                       // 앞부분만 같은 주소
    expect(told).toBe(0);
  });

  it('창이 받은 주소가 **나중에** 또 와도 다시 잡지 않는다(Codex #2)', async () => {
    const tickets = ['DUP', 'NEW'];                            // 새 창은 새 티켓을 받는다
    const b = browserFake(async () => ({ type: 'success', url: RET + '?ticket=' + tickets.shift() }));
    const s = setup({ kakao: null, browser: b });
    await s.auth.signIn('kakao');
    s.fireUrl(RET + '?ticket=DUP');                          // 교환이 끝난 뒤 Linking 으로 또
    await s.auth.signIn('kakao');
    expect(b.opened, '두 번째는 창을 새로 열어야 한다 — 쓴 티켓을 붙잡고 있으면 안 연다').toHaveLength(2);
    expect(s.server).toEqual(['exchange:DUP', 'exchange:NEW']);
  });

  it('늦게 온 정상 주소가 있으면 SDK 보다 먼저 쓴다 — SDK 창을 닫아도 티켓을 잃지 않게(Codex #3)', async () => {
    const k = kakaoFake({ talk: true, login: async () => { throw Object.assign(new Error('keyhash'), { code: 'KeyHashError' }); } });
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: k, browser: b });
    await s.auth.signIn('kakao').catch(() => undefined);     // SDK 실패 → 웹 → 창 닫힘(흐름은 열림)
    s.fireUrl(RET + '?ticket=LATE2');
    const sdkBefore = k.calls.length;
    await s.auth.signIn('kakao');
    expect(k.calls.length, 'SDK 를 다시 띄우면 안 된다').toBe(sdkBefore);
    expect(s.server).toEqual(['exchange:LATE2']);
  });
});

describe('로그인 중에는 재시작하지 않는다', () => {
  it('누르기 전에는 거짓, 누른 뒤에는 참', async () => {
    const { auth } = setup({ web: false });
    expect(auth.hasTriedAuth()).toBe(false);
    await auth.signIn('kakao');
    expect(auth.hasTriedAuth()).toBe(true);
  });

  it('창을 다녀오는 동안 isAuthorizing 이 참이고, 끝나면 거짓', async () => {
    let seen: boolean | null = null;
    const s = setup({ web: false, server: { kakao: async () => { seen = s.auth.isAuthorizing(); return { s: 'K' }; } } });
    await s.auth.signIn('kakao');
    expect(seen).toBe(true);
    expect(s.auth.isAuthorizing()).toBe(false);
  });

  it('실패해도 isAuthorizing 이 풀린다 — 안 풀리면 OTA 가 영영 못 들어온다', async () => {
    const { auth } = setup({ web: false, kakao: null });
    await auth.signIn('kakao').catch(() => undefined);
    expect(auth.isAuthorizing()).toBe(false);
  });
});

describe('티켓 교환', () => {
  it('도중에 끊긴 요청은 다시 보낸다', async () => {
    let n = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=R' });
    const { auth } = setup({
      kakao: null, browser: b,
      exchange: async () => { if (n++ === 0) throw new Error('Network request failed'); return { s: 'W' }; },
    });
    expect(await auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(n).toBe(2);
  });

  it('서버가 거절한 것은 다시 보내지 않고, 어디서 끊겼는지 남긴다', async () => {
    let n = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=R' });
    const { auth } = setup({ kakao: null, browser: b, exchange: async () => { n++; throw new Error('ticket_invalid'); } });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(n).toBe(1);
    expect(e.tag).toMatch(/^exg:ticket_invalid·\d+ms×1$/);
  });

  it('시작 때 실은 nonce 로 바꾼다 — 흐름마다 새 값', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=N1' });
    const s = setup({ kakao: null, browser: b });
    await s.auth.signIn('kakao');
    b.mod.openAuthSessionAsync = async (u: string) => { b.opened.push(u); return { type: 'success', url: RET + '?ticket=N2' }; };
    await s.auth.signIn('kakao');
    expect(s.nonces.start).toHaveLength(2);
    expect(s.nonces.exchange).toEqual(s.nonces.start);
    expect(b.opened.map((u) => (u.match(/&nonce=([0-9a-f]+)/) ?? [])[1]), '시작 주소에 실려야 서버가 묶는다').toEqual(s.nonces.start);
    expect(s.nonces.start[0]).toMatch(/^[0-9a-f]{48}$/);
    expect(s.nonces.start[0], '흐름마다 달라야 한다').not.toBe(s.nonces.start[1]);
  });

  it('앱이 네트워크 오류를 한 단어로 바꿔 던져도 다시 보낸다(Codex #5, 당근캐시 ApiError)', async () => {
    let n = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=R' });
    const { auth } = setup({
      kakao: null, browser: b,
      exchange: async () => {
        if (n++ === 0) throw Object.assign(new Error('network'), { status: 0 });

        return { s: 'W' };
      },
    });
    expect(await auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(n).toBe(2);
  });

  it('4xx 로 거절한 것은 다시 보내지 않는다', async () => {
    let n = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=R' });
    const { auth } = setup({
      kakao: null, browser: b,
      exchange: async () => { n++; throw Object.assign(new Error('Unauthorized request'), { status: 401 }); },
    });
    await auth.signIn('kakao').catch(() => undefined);
    expect(n).toBe(1);
  });

  it('서버가 티켓 대신 오류를 주면 ret: 로 남긴다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?error=provider_error' });
    const { auth } = setup({ kakao: null, browser: b });
    const e = await auth.signIn('kakao').catch((x) => x);
    expect(e.tag).toBe('ret:provider_error');
  });
});

describe('애플·네이버', () => {
  it('안드로이드 애플은 apple_web 이 켜져 있을 때만 웹으로', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=AP' });
    const on = setup({ browser: b, providers: ['apple', 'apple_web'] });
    expect(await on.auth.signIn('apple')).toEqual({ s: 'W' });
    const off = setup({ browser: b, providers: ['apple'] });
    expect((await off.auth.signIn('apple').catch((x) => x)).tag).toBe('apple_unavailable');
  });

  it('iOS 애플은 이름을 최초 1회 서버에 넘긴다', async () => {
    const apple = {
      AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
      signInAsync: async () => ({ identityToken: 'AT', fullName: { familyName: '김', givenName: '철수' } }),
    };
    const { auth, server } = setup({ os: 'ios', apple });
    await auth.signIn('apple');
    expect(server).toEqual(['apple:AT:김철수']);
  });

  it('네이버는 웹 로그인이 있어야 한다', async () => {
    const without = setup({ web: false });
    expect((await without.auth.signIn('naver').catch((x) => x)).tag).toBe('naver_needs_web');
    const b = browserFake({ type: 'success', url: RET + '?ticket=N' });
    const withWeb = setup({ browser: b });
    await withWeb.auth.signIn('naver');
    expect(b.opened.map(plain)).toEqual(['https://api/auth/start?provider=naver']);
  });
});

describe('복귀 주소 읽기', () => {
  it('# 뒤를 버린다 — 구글 재로그인이 남긴다', () => {
    expect(parseReturn(RET + '?ticket=ABC#_=_').ticket).toBe('ABC');
  });

  it('인코딩과 + 를 푼다', () => {
    expect(parseReturn(RET + '?error=a+b%21').error).toBe('a b!');
  });

  it('쿼리가 없거나 깨져도 던지지 않는다', () => {
    expect(parseReturn(RET)).toEqual({});
    expect(() => parseReturn(RET + '?ticket=%E0%A4%A')).not.toThrow();
  });
});

describe('두 번 빠르게 눌러도 (Codex #4)', () => {
  it('같은 버튼이면 창은 하나, 결과도 하나', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const b = browserFake(async () => { await gate; return { type: 'success', url: RET + '?ticket=ONE' }; });
    const s = setup({ kakao: null, browser: b });
    const p1 = s.auth.signIn('kakao');
    const p2 = s.auth.signIn('kakao');
    expect(s.auth.isAuthorizing()).toBe(true);
    release();
    expect(await p1).toEqual(await p2);
    expect(b.opened, '창이 두 개 뜨면 서로의 복귀 주소를 가로챈다').toHaveLength(1);
    expect(s.auth.isAuthorizing()).toBe(false);
  });

  it('다른 버튼이면 busy — 화면은 무시하면 된다', async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const b = browserFake(async () => { await gate; return { type: 'success', url: RET + '?ticket=K' }; });
    const s = setup({ kakao: null, browser: b });
    const p1 = s.auth.signIn('kakao');
    const e = await s.auth.signIn('naver').catch((x) => x);
    expect(e.code).toBe('busy');
    expect(isCancel(e.message)).toBe(false);
    release();
    await p1;
  });
});

describe('카카오 초기화는 끝날 때까지 기다린다(Codex)', () => {
  it('초기화가 끝나기 전에는 로그인을 부르지 않는다 — 안드로이드는 그 자리에서 죽는다', async () => {
    let done = false;
    let release!: () => void;
    const gate = new Promise<void>((r) => { release = r; });
    const k = kakaoFake({ talk: true, login: async () => { expect(done, '초기화 전에 불렸다').toBe(true); return { accessToken: 'K' }; } });
    const s = setup({ web: false, kakao: k, kakaoInit: async () => { await gate; done = true; } });
    const p = s.auth.signIn('kakao');
    await Promise.resolve();
    expect(k.calls).toHaveLength(0);
    release();
    await p;
    expect(k.calls).toHaveLength(1);
  });

  it('초기화가 실패해도 앱을 죽이지 않고, 다음에 다시 해 본다', async () => {
    let tries = 0;
    const s = setup({ web: false, kakaoInit: async () => { tries++; if (tries === 1) throw new Error('init'); } });
    await expect(s.auth.signIn('kakao')).rejects.toThrow('kakao_unavailable');
    await s.auth.signIn('kakao');
    expect(tries).toBe(2);
  });
});


afterEach(() => { vi.useRealTimers(); });

describe('Codex 2차 — 늦은 주소는 후보다', () => {
  it('밀어 넣은 티켓이 먼저 와도 뒤의 정상 주소로 끝낸다(#1)', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    await s.auth.signIn('kakao').catch(() => undefined);    // 창을 닫았다 — 흐름은 열림
    s.fireUrl(RET + '?ticket=ATTACKER', 'attacker');
    s.fireUrl(RET + '?ticket=MINE');
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server, '공격 티켓은 서버가 거절, 정상 티켓으로 끝난다').toEqual(['exchange:MINE']);
    expect(b.opened, '창을 다시 열지 않는다').toHaveLength(1);
  });

  it('밀어 넣은 티켓이 거절돼도 흐름을 닫지 않는다 — 정상 주소가 나중에 와도 받는다(#1)', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    const told: string[] = [];
    s.auth.onLateReturn((p) => { told.push(p); });
    await s.auth.signIn('kakao').catch(() => undefined);
    s.fireUrl(RET + '?ticket=ATTACKER', 'attacker');
    const e = await s.auth.signIn('kakao').catch((x) => x);
    expect(e.tag, '거절 사유(exg:)가 그대로 남는다').toMatch(/^exg:ticket_invalid/);
    s.fireUrl(RET + '?ticket=MINE2');
    expect(told, '정상 주소가 오면 화면에 알린다').toEqual(['kakao', 'kakao']);
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:MINE2']);
  });

  it('2분 지난 후보는 쓰지 않는다 — 서버 티켓 수명이 지났다', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    await s.auth.signIn('kakao').catch(() => undefined);
    s.fireUrl(RET + '?ticket=OLD');
    vi.setSystemTime(Date.now() + 3 * 60_000);
    await s.auth.signIn('kakao').catch(() => undefined);    // 후보가 없으니 새 창을 연다
    expect(b.opened).toHaveLength(2);
    expect(s.server).toEqual([]);
  });
});

describe('Codex 2차 — 새 로그인은 앞 흐름을 끝낸다(#2)', () => {
  it('네이버 창을 닫고 구글로 로그인하면, 늦게 온 네이버 주소는 받지 않는다', async () => {
    const google = { GoogleSignin: { configure: () => undefined, hasPlayServices: async () => true, signIn: async () => ({ data: { idToken: 'GT' } }), signOut: async () => undefined } };
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', google, browser: b });
    const told: string[] = [];
    s.auth.onLateReturn((p) => { told.push(p); });
    await s.auth.signIn('naver').catch(() => undefined);    // 네이버 흐름 열림
    expect(await s.auth.signIn('google')).toEqual({ s: 'G' });
    s.fireUrl(RET + '?ticket=NAVER_LATE');
    expect(told, '끝난 흐름의 주소로 화면을 흔들지 않는다').toEqual([]);
    await s.auth.signIn('naver').catch(() => undefined);
    expect(b.opened, '네이버는 창을 새로 연다').toHaveLength(2);
    expect(s.server).toEqual(['google:GT']);
  });
});

describe('Codex 2차 — 앱이 주소로 켜진 경우는 읽지 않는다(#8)', () => {
  it('getInitialURL 의 티켓은 흐름이 열려 있어도 쓰지 않는다', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b, initialUrl: RET + '?ticket=INIT' });
    await s.auth.signIn('kakao').catch(() => undefined);
    await new Promise((r) => setTimeout(r, 0));
    await s.auth.signIn('kakao').catch(() => undefined);
    expect(b.opened, '받아 둔 것이 없으니 창을 새로 연다').toHaveLength(2);
    expect(s.server).toEqual([]);
  });
});

describe('Codex 2차 — HTTP 상태를 먼저 본다(#10)', () => {
  it('401 인데 메시지에 request failed 가 있어도 다시 보내지 않는다', async () => {
    let n = 0;
    const b = browserFake({ type: 'success', url: RET + '?ticket=R' });
    const { auth } = setup({
      kakao: null, browser: b,
      exchange: async () => { n++; throw Object.assign(new Error('request failed'), { status: 401 }); },
    });
    await auth.signIn('kakao').catch(() => undefined);
    expect(n).toBe(1);
  });
});

describe('Codex 3차 — nonce 는 서버가 만든 것부터', () => {
  const SERVER_NONCE = 'ab'.repeat(24);

  it('web.nonce 를 주면 그 값으로 시작하고 바꾼다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T1' });
    const s = setup({ kakao: null, browser: b, nonce: async () => SERVER_NONCE });
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.nonces).toEqual({ start: [SERVER_NONCE], exchange: [SERVER_NONCE] });
  });

  it('서버 nonce 를 못 받으면 앱이 준 보안 난수로 — 로그인은 막지 않는다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T2' });
    const s = setup({
      kakao: null, browser: b,
      nonce: async () => { throw new Error('Network request failed'); },
      random: (x) => x.fill(7),
    });
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.nonces.start).toEqual(['07'.repeat(24)]);
  });

  it('서버가 모양이 틀린 값을 주면 쓰지 않는다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?ticket=T3' });
    const s = setup({ kakao: null, browser: b, nonce: async () => 'short&x=1', random: (x) => x.fill(9) });
    await s.auth.signIn('kakao');
    expect(s.nonces.start).toEqual(['09'.repeat(24)]);
  });

  it('패키지는 expo-crypto 를 require 하지 않는다 — 없는 앱(꼬꼬농장)의 번들이 깨진다', async () => {
    const fs = await import('node:fs');
    const src = fs.readFileSync(new URL('./auth.ts', import.meta.url), 'utf8');
    expect(src).not.toMatch(/require\(['"]expo-crypto['"]\)/);
  });
});

describe('Codex 3차 — 창이 돌려준 주소도 서버가 확인하기 전엔 정답이 아니다', () => {
  it('창이 밀어 넣은 주소로 success 를 줘도 흐름을 닫지 않는다 — 뒤의 정상 주소로 끝낸다', async () => {
    // 안드로이드 Expo 는 창이 열린 동안 들어온 아무 딥링크로도 success 를 만든다
    const b = browserFake({ type: 'success', url: RET + '?ticket=INJECTED' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    s.fireUrl(RET + '?ticket=INJECTED', 'attacker');         // 공격자가 자기 로그인으로 받아 둔 티켓
    const told: string[] = [];
    s.auth.onLateReturn((p) => { told.push(p); });
    const e = await s.auth.signIn('kakao').catch((x) => x);
    expect(e.tag).toMatch(/^exg:ticket_invalid/);
    s.fireUrl(RET + '?ticket=MINE');
    expect(told, '흐름이 열려 있어 정상 주소를 받는다').toEqual(['kakao']);
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:MINE']);
    expect(b.opened, '창을 다시 열지 않는다').toHaveLength(1);
  });
});

describe('Codex 3차 — 후보 목록', () => {
  it('밀어 넣은 주소로 자리를 채워도 뒤에 온 정상 주소를 막지 못한다', async () => {
    const b = browserFake({ type: 'dismiss' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    await s.auth.signIn('kakao').catch(() => undefined);
    for (let i = 0; i < 25; i++) s.fireUrl(RET + '?ticket=ATK' + i, 'attacker');
    s.fireUrl(RET + '?ticket=MINE');
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:MINE']);
  });

  it('네트워크로 못 닿은 후보는 버리지 않는다 — 다시 누르면 같은 티켓으로 끝낸다', async () => {
    let down = true;
    const seen: string[] = [];
    const b = browserFake({ type: 'dismiss' });
    const s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async (t) => {
        seen.push(t);
        if (down) throw new TypeError('Network request failed');

        return { s: 'W' };
      },
    });
    await s.auth.signIn('kakao').catch(() => undefined);
    s.fireUrl(RET + '?ticket=MINE');
    const e = await s.auth.signIn('kakao').catch((x) => x);
    expect(e.tag).toMatch(/^exg:/);
    down = false;
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(new Set(seen), '같은 티켓만 다시 보냈다').toEqual(new Set(['MINE']));
    expect(b.opened, '창을 다시 열지 않는다').toHaveLength(1);
  });
});

describe('Codex 4차 — 창이 돌아올 때 받아 둔 후보', () => {
  it('Linking 으로 먼저 온 티켓이 창 success 로 다시 오면 맨 앞으로 — 앞 후보가 막혀도 정상 티켓을 쓴다', async () => {
    const seen: string[] = [];
    let s: ReturnType<typeof setup>;
    const b = browserFake(async () => {
      s.fireUrl(RET + '?ticket=BAD', 'attacker');
      s.fireUrl(RET + '?ticket=GOOD');

      return { type: 'success', url: RET + '?ticket=GOOD' };
    });
    s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async (t) => {
        seen.push(t);
        if (t === 'BAD') throw new TypeError('Network request failed');

        return { s: 'W' };
      },
    });
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(seen, '창이 돌려준 티켓부터').toEqual(['GOOD']);
  });

  it('창이 오류 주소로 돌아와도 받아 둔 정상 후보가 있으면 그것으로 끝낸다', async () => {
    let s: ReturnType<typeof setup>;
    const b = browserFake(async () => {
      s.fireUrl(RET + '?ticket=GOOD');

      return { type: 'success', url: RET + '?error=cancelled' };
    });
    s = setup({ os: 'ios', kakao: null, browser: b });
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:GOOD']);
  });

  it('iOS 에서 창을 닫았어도 창이 도는 동안 받아 둔 후보가 있으면 쓴다', async () => {
    let s: ReturnType<typeof setup>;
    const b = browserFake(async () => {
      s.fireUrl(RET + '?ticket=GOOD');

      return { type: 'dismiss' };
    });
    s = setup({ os: 'ios', kakao: null, browser: b });
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:GOOD']);
  });

  it('후보가 없으면 오류 주소는 예전처럼 취소·실패다', async () => {
    const b = browserFake({ type: 'success', url: RET + '?error=cancelled' });
    const s = setup({ os: 'ios', kakao: null, browser: b });
    await expect(s.auth.signIn('kakao')).rejects.toMatchObject({ code: 'cancelled' });
    const b2 = browserFake({ type: 'success', url: RET + '?error=state_lost' });
    const s2 = setup({ os: 'ios', kakao: null, browser: b2 });
    await expect(s2.auth.signIn('kakao')).rejects.toMatchObject({ tag: 'ret:state_lost' });
  });
});

describe('Codex 4차 — 잠깐 못 받은 것(429·5xx)은 후보를 지킨다', () => {
  it.each([502, 503, 504, 429, 408])('%i 이면 버리지 않고, 다시 누르면 같은 티켓으로 끝낸다', async (status) => {
    let fail = true;
    const seen: string[] = [];
    const b = browserFake({ type: 'dismiss' });
    const s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async (t) => {
        seen.push(t);
        if (fail) throw Object.assign(new Error('server_busy'), { status });

        return { s: 'W' };
      },
    });
    await s.auth.signIn('kakao').catch(() => undefined);
    s.fireUrl(RET + '?ticket=MINE');
    await expect(s.auth.signIn('kakao')).rejects.toBeInstanceOf(AuthError);
    expect(seen, '곧바로 다시 보내지는 않는다').toEqual(['MINE']);
    fail = false;
    expect(await s.auth.signIn('kakao')).toEqual({ s: 'W' });
    expect(b.opened).toHaveLength(1);
  });

  it('401 은 여전히 버린다', async () => {
    const seen: string[] = [];
    const b = browserFake({ type: 'dismiss' });
    const s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async (t) => { seen.push(t); throw Object.assign(new Error('ticket_invalid'), { status: 401 }); },
    });
    await s.auth.signIn('kakao').catch(() => undefined);
    s.fireUrl(RET + '?ticket=X');
    await s.auth.signIn('kakao').catch(() => undefined);
    await s.auth.signIn('kakao').catch(() => undefined);   // 후보가 없으니 창을 새로 연다
    expect(seen).toEqual(['X']);
    expect(b.opened).toHaveLength(2);
  });
});

describe('abandon() — 영영 안 끝나는 로그인을 잊는다(당근캐시 아이콘 복귀)', () => {
  it('잊으면 다른 버튼이 busy 가 아니고, 옛 약속이 뒤늦게 끝나도 새 로그인을 지우지 않는다', async () => {
    let finishKakao!: (v: any) => void;
    let finishGoogle!: (v: any) => void;
    const kakao = kakaoFake({ talk: false, login: () => new Promise((r) => { finishKakao = r; }) });
    const google = {
      GoogleSignin: {
        configure: () => undefined, hasPlayServices: async () => true, signOut: async () => undefined,
        signIn: () => new Promise((r) => { finishGoogle = r; }),
      },
    };
    const s = setup({ os: 'ios', web: false, kakao, google });
    const k = s.auth.signIn('kakao');
    await new Promise((r) => setTimeout(r, 0));
    await expect(s.auth.signIn('google')).rejects.toMatchObject({ code: 'busy' });
    s.auth.abandon();
    expect(s.auth.isAuthorizing()).toBe(false);
    const g = s.auth.signIn('google');
    await new Promise((r) => setTimeout(r, 0));
    finishKakao({ accessToken: 'LATE' });
    await k;
    expect(s.auth.isAuthorizing(), '뒤늦게 끝난 카카오가 구글 로그인을 지우면 안 된다').toBe(true);
    finishGoogle({ data: { idToken: 'GT' } });
    expect(await g).toEqual({ s: 'G' });
    expect(s.auth.isAuthorizing()).toBe(false);
  });
});

describe('Codex 5차 — 잊힌 실행은 새 로그인을 건드리지 않는다', () => {
  /** 창을 연 순서대로 손으로 닫는 브라우저 */
  function windows() {
    const wins: Array<{ resolve: (r: any) => void; reject: (e: any) => void }> = [];
    const b = browserFake(() => new Promise((resolve, reject) => { wins.push({ resolve, reject }); }));

    return { b, wins };
  }
  const tick = () => new Promise((r) => setTimeout(r, 0));

  it('옛 네이버 창이 뒤늦게 닫혀도 새 구글 흐름의 티켓을 옛 nonce 로 태우지 않는다', async () => {
    const { b, wins } = windows();
    const s = setup({ os: 'android', kakao: null, browser: b });
    const n = s.auth.signIn('naver');
    await tick();
    s.auth.abandon();
    const g = s.auth.signIn('google');
    await tick();
    s.fireUrl(RET + '?ticket=G1');                 // 새 구글 흐름의 정상 티켓
    wins[0].resolve({ type: 'dismiss' });          // 옛 네이버 창
    await expect(n).rejects.toMatchObject({ code: 'cancelled', tag: 'abandoned' });
    wins[1].resolve({ type: 'success', url: RET + '?ticket=G1' });
    expect(await g).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:G1']);
    expect(s.nonces.exchange, '구글 nonce 로 한 번만').toEqual([s.nonces.start[1]]);
  });

  it('옛 창이 오류로 끝나도 새 흐름을 닫지 않는다', async () => {
    const { b, wins } = windows();
    const s = setup({ os: 'android', kakao: null, browser: b });
    const n = s.auth.signIn('naver');
    await tick();
    s.auth.abandon();
    const g = s.auth.signIn('google');
    await tick();
    s.fireUrl(RET + '?ticket=G2');
    wins[0].reject(new Error('boom'));
    await expect(n).rejects.toMatchObject({ tag: 'abandoned' });
    s.fireUrl(RET + '?ticket=G2b');                // 흐름이 살아 있으면 더 받는다
    wins[1].resolve({ type: 'dismiss' });
    expect(await g).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:G2']);
  });

  it('옛 교환이 뒤늦게 503 이어도 옛 후보를 새 목록에 되돌리지 않는다', async () => {
    const { b, wins } = windows();
    const seen: string[] = [];
    let rejectOld!: (e: any) => void;
    const s = setup({
      os: 'android', kakao: null, browser: b,
      exchange: async (t) => {
        seen.push(t);
        if (t === 'OLD') {
          if (seen.filter((x) => x === 'OLD').length === 1) return new Promise((_, rej) => { rejectOld = rej; });
          throw Object.assign(new Error('busy'), { status: 503 });
        }

        return { s: 'W' };
      },
    });
    const n1 = s.auth.signIn('naver');
    await tick();
    wins[0].resolve({ type: 'dismiss' });
    await n1.catch(() => undefined);               // 흐름은 열림
    s.fireUrl(RET + '?ticket=OLD');
    const n2 = s.auth.signIn('naver');             // 받아 둔 OLD 를 바꾸는 중
    await tick();
    s.auth.abandon();
    const g = s.auth.signIn('google');
    await tick();
    s.fireUrl(RET + '?ticket=G3');
    rejectOld(Object.assign(new Error('busy'), { status: 503 }));
    await n2.catch(() => undefined);
    wins[1].resolve({ type: 'dismiss' });
    expect(await g).toEqual({ s: 'W' });
    expect(seen).toEqual(['OLD', 'G3']);
  });

  it('안드로이드 대기 **도중** 잊히고 새 로그인이 시작돼도, 옛 실행은 새 흐름의 후보를 쓰지 않는다', async () => {
    const { b, wins } = windows();
    let n = 0;
    let g: Promise<any> | undefined;
    // eslint-disable-next-line prefer-const
    let s: ReturnType<typeof setup>;
    s = setup({
      os: 'android', kakao: null, browser: b,
      onWait: async () => {
        if (++n !== 1) return;
        s.auth.abandon();
        g = s.auth.signIn('google');
        await tick();
        s.fireUrl(RET + '?ticket=GW');
      },
    });
    const old = s.auth.signIn('naver');
    await tick();
    wins[0].resolve({ type: 'dismiss' });
    await expect(old).rejects.toMatchObject({ tag: 'abandoned' });
    wins[1].resolve({ type: 'success', url: RET + '?ticket=GW' });
    expect(await g).toEqual({ s: 'W' });
    expect(s.server).toEqual(['exchange:GW']);
  });

  it('교환 **도중** 잊히면 다음 후보로 넘어가지 않는다 — 남은 것은 다시 누를 때 쓴다', async () => {
    const seen: string[] = [];
    let rejectA!: (e: any) => void;
    const b = browserFake({ type: 'dismiss' });
    const s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async (t) => {
        seen.push(t);
        if (t === 'A') return new Promise((_, rej) => { rejectA = rej; });

        return { s: 'W' };
      },
    });
    await s.auth.signIn('naver').catch(() => undefined);
    s.fireUrl(RET + '?ticket=A');
    s.fireUrl(RET + '?ticket=B');
    const old = s.auth.signIn('naver');
    await tick();
    s.auth.abandon();
    rejectA(Object.assign(new Error('ticket_invalid'), { status: 401 }));
    await expect(old).rejects.toMatchObject({ tag: 'abandoned' });
    expect(seen).toEqual(['A']);
    expect(await s.auth.signIn('naver')).toEqual({ s: 'W' });
    expect(seen).toEqual(['A', 'B']);
  });

  it('같은 제공자로 다시 눌러 **같은 흐름**을 이어 쓰는 중에 옛 창이 오류로 끝나도 흐름을 닫지 않는다(Codex 6차)', async () => {
    const { b, wins } = windows();
    let calls = 0;
    let rejectFirst!: (e: any) => void;
    const s = setup({
      os: 'ios', kakao: null, browser: b,
      exchange: async () => {
        if (++calls === 1) return new Promise((_, rej) => { rejectFirst = rej; });

        return { s: 'W' };
      },
    });
    const old = s.auth.signIn('naver');
    await tick();
    s.auth.abandon();
    s.fireUrl(RET + '?ticket=A');                  // 옛 창이 열린 흐름의 정상 티켓
    const again = s.auth.signIn('naver');          // 같은 흐름을 이어 쓴다 — A 교환 중
    await tick();
    wins[0].reject(new Error('boom'));             // 옛 창이 오류로 끝난다
    await expect(old).rejects.toMatchObject({ tag: 'abandoned' });
    rejectFirst(Object.assign(new Error('busy'), { status: 503 }));
    await expect(again).rejects.toBeInstanceOf(AuthError);
    expect(await s.auth.signIn('naver'), '흐름이 살아 있어 A 로 끝낸다').toEqual({ s: 'W' });
    expect(b.opened, '창을 새로 열지 않는다').toHaveLength(1);
  });

  it('잊힌 SDK 로그인이 뒤늦게 실패해도 웹으로 넘어가 게스트 연결 코드를 받지 않는다', async () => {
    let failKakao!: (e: any) => void;
    let links = 0;
    const b = browserFake({ type: 'dismiss' });
    const s = setup({
      os: 'ios', browser: b,
      kakao: kakaoFake({ talk: false, login: () => new Promise((_, rej) => { failKakao = rej; }) }),
      guest: { active: () => true, link: async () => { links++; return 'L1'; } },
    });
    const old = s.auth.signIn('kakao');
    await tick();
    s.auth.abandon();
    failKakao(new Error('sdk_boom'));              // SDK 가 실패 → 원래는 웹으로 넘어간다
    await expect(old).rejects.toMatchObject({ tag: 'abandoned' });
    expect(links, '잊힌 실행은 서버에 연결 코드를 요청하지 않는다').toBe(0);
    expect(b.opened).toHaveLength(0);
  });

  it('잊힌 뒤에 창이 정상 주소로 돌아오면 흐름이 그대로일 때 후보로 남긴다 — 다시 누르면 쓴다', async () => {
    const { b, wins } = windows();
    const s = setup({ os: 'ios', kakao: null, browser: b });
    const told: string[] = [];
    s.auth.onLateReturn((p) => { told.push(p); });
    const k = s.auth.signIn('naver');
    await tick();
    s.auth.abandon();
    wins[0].resolve({ type: 'success', url: RET + '?ticket=LATE_OK' });
    await expect(k).rejects.toMatchObject({ tag: 'abandoned' });
    expect(told).toEqual(['naver']);
    expect(await s.auth.signIn('naver')).toEqual({ s: 'W' });
    expect(b.opened).toHaveLength(1);
  });
});
