import { describe, expect, it, vi } from 'vitest';
import { createIdentity, identityMessage, openAuth, parseQuery } from './identity';

describe('복귀 URL 읽기 — URLSearchParams 를 믿지 않는다', () => {
  it('값을 꺼낸다', () => {
    expect(parseQuery('kko://kiap?ok=1&sid=abc&t=xyz')).toEqual({ ok: '1', sid: 'abc', t: 'xyz' });
  });

  it('URL 인코딩을 푼다 — 사유에 한글이 올 수 있다', () => {
    expect(parseQuery('a://b?reason=%EC%B7%A8%EC%86%8C').reason).toBe('취소');
  });

  it('쿼리가 없으면 빈 것', () => {
    expect(parseQuery('kko://kiap')).toEqual({});
  });
});

describe('사유 문구', () => {
  it('아는 사유는 사람 말로', () => {
    expect(identityMessage('DUPLICATE_CI')).toContain('1인 1개');
    expect(identityMessage('CANCELED')).toContain('취소');
  });

  it('모르는 사유도 빈 문자열을 내지 않는다 — 화면이 비면 사람은 아무것도 모른다', () => {
    const m = identityMessage('NEW_THING');
    expect(m).not.toBe('');
    expect(m).toContain('NEW_THING');   // 문의할 때 쓸 수 있게 코드를 남긴다
  });
});

const deps = {
  base: 'https://x/v1/app', appToken: 'pub', ret: 'app://kiap',
  token: () => 'session-token',
};

describe('켜져 있는가', () => {
  it('서버가 enabled 를 주면 참', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ json: async () => ({ enabled: true }) }));
    expect(await createIdentity(deps).enabled()).toBe(true);
  });

  it('앱 토큰을 헤더에 싣는다 — 빼먹으면 늘 「꺼짐」으로 읽힌다', async () => {
    const spy = vi.fn(async () => ({ json: async () => ({ enabled: true }) }));
    (globalThis as any).fetch = spy;
    await createIdentity(deps).enabled();
    expect((spy.mock.calls[0] as any)[1].headers['X-App-Token']).toBe('pub');
  });

  it('통신이 죽으면 꺼짐으로 본다 — 던지지 않는다', async () => {
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('down'); });
    expect(await createIdentity(deps).enabled()).toBe(false);
  });
});

describe('인증 실행', () => {
  it('세션이 없으면 시작도 안 한다', async () => {
    const spy = vi.fn();
    (globalThis as any).fetch = spy;
    const r = await createIdentity({ ...deps, token: () => null }).verify();
    expect(r).toEqual({ ok: false, reason: 'NO_SESSION' });
    expect(spy).not.toHaveBeenCalled();
  });

  it('init 이 죽으면 NETWORK', async () => {
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('down'); });
    const r = await createIdentity(deps).verify();
    expect(r.ok).toBe(false);
    if (!r.ok) expect(['NETWORK', 'NEED_UPDATE']).toContain(r.reason);
  });
});

describe('2026-09-30 공용화 — 스터디숲에서 고친 것', () => {
  const back = 'app://kiap?ok=1&sid=' + 'a'.repeat(32) + '&t=' + 'b'.repeat(32);

  it('iOS 로그인 확인 창 없이(ephemeral) 연다(#303)', async () => {
    const open = vi.fn(async () => ({ type: 'success', url: back }));
    await openAuth({ openAuthSessionAsync: open }, 'https://x/page', 'app://kiap');
    expect(open).toHaveBeenCalledWith('https://x/page', 'app://kiap', { preferEphemeralSession: true });
  });

  it('결과에 생년월일(#308) · 가입 전 흐름의 signupToken 을 넘긴다', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ json: async () => ({ ok: true, name: '홍길동', phone: '01012345678', provider: 'KAKAO', birth: '1990-01-02', signupToken: 'st' }) }));
    const r = await createIdentity(deps).finish({ type: 'success', url: back });
    expect(r).toMatchObject({ ok: true, name: '홍길동', birth: '1990-01-02', signupToken: 'st' });
  });

  it('실패 복귀는 사유 그대로', async () => {
    expect(await createIdentity(deps).finish({ type: 'success', url: 'app://kiap?ok=0&reason=CI_MISSING' })).toEqual({ ok: false, reason: 'CI_MISSING' });
  });

  it('켠 기관 목록을 status 에서 읽는다', async () => {
    (globalThis as any).fetch = vi.fn(async () => ({ json: async () => ({ enabled: true, providers: ['KAKAO', 'TOSS'] }) }));
    expect(await createIdentity(deps).providers()).toEqual(['KAKAO', 'TOSS']);
  });

  it('오류 문구 끝에 코드 — 취소는 빼고 · KICA 오류는 KIAP_ 코드 그대로(#304 · #305)', () => {
    expect(identityMessage('CI_MISSING')).toMatch(/\(CI_MISSING\)$/);
    expect(identityMessage('KIAP_E4108')).toContain('허용 도메인');
    expect(identityMessage('KIAP_E9999')).toMatch(/\(KIAP_E9999\)$/);
    expect(identityMessage('CANCELED')).not.toContain('(');
  });
});
