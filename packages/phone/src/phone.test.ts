import { describe, expect, it, vi } from 'vitest';
import {
  CODE_LEN, codeLooksValid, createPhone, digits, format, looksValid, message, needsResend,
} from './phone';

describe('번호 보이기', () => {
  it('자릿수에 따라 하이픈을 넣는다', () => {
    expect(format('010')).toBe('010');
    expect(format('0101234')).toBe('010-1234');
    expect(format('01012345678')).toBe('010-1234-5678');
  });

  it('이미 하이픈이 있어도 같은 값이 된다 — 화면이 넣은 값을 되먹여도 안전해야 한다', () => {
    expect(format('010-1234-5678')).toBe('010-1234-5678');
  });

  it('11자리를 넘겨도 잘라 낸다', () => {
    expect(format('010123456789999')).toBe('010-1234-5678');
  });

  it('숫자만 남긴다', () => {
    expect(digits('010-1234-5678')).toBe('01012345678');
  });
});

describe('번호 검증 — 서버와 같은 규칙이어야 한다', () => {
  it('통과', () => {
    expect(looksValid('010-1234-5678')).toBe(true);
    expect(looksValid('01112345678')).toBe(true);
    expect(looksValid('0161234567')).toBe(true);       // 10자리도 있다
  });

  it('거절', () => {
    expect(looksValid('010-1234-56')).toBe(false);     // 짧다
    expect(looksValid('02012345678')).toBe(false);     // 011~019 가 아니다
    expect(looksValid('010123456789')).toBe(false);    // 길다
    expect(looksValid('')).toBe(false);
  });

  it('010 + 7자리도 통과한다 — **서버가 그렇게 받기 때문**이다', () => {
    // 실제 010 번호는 11자리라 0101234567 은 쓰이지 않는다. 그래도 통과시키는 이유는
    // 서버 정규식이 같기 때문이다. 앱이 더 빡빡하면 서버가 받는 값을 화면이 막아
    // 「왜 안 되지」가 되고, 그 차이는 아무 데도 안 적힌다. 조이려면 서버부터 조인다.
    expect(looksValid('0101234567')).toBe(true);
  });
});

describe('인증번호', () => {
  it('여섯 자리여야 한다', () => {
    expect(CODE_LEN).toBe(6);
    expect(codeLooksValid('123456')).toBe(true);
    expect(codeLooksValid('12345')).toBe(false);
    expect(codeLooksValid('1234567')).toBe(false);
  });
});

describe('오류 문구 — 무엇을 하면 되는지까지 적는다', () => {
  it('아는 오류는 사람 말로 바꾼다', () => {
    expect(message('phone_taken')).toContain('다른 계정');
    expect(message('sms_off')).toContain('준비');
    expect(message('expired')).toContain('다시 받아');
  });

  it('남은 횟수·대기 초를 같이 말한다', () => {
    expect(message('wrong', { left: 3 })).toContain('3번');
    expect(message('too_soon', { waitMs: 42000 })).toContain('42초');
  });

  it('모르는 오류도 빈 문자열을 내지 않는다 — 화면이 비면 사람은 아무것도 모른다', () => {
    expect(message('무언가_새로운_오류')).not.toBe('');
  });
});

describe('다시 받아야 하는가', () => {
  it('시간이 지났거나 다 틀렸으면 처음부터', () => {
    expect(needsResend('expired')).toBe(true);
    expect(needsResend('too_many')).toBe(true);
  });

  it('한 번 틀린 것으로는 다시 받지 않는다', () => {
    expect(needsResend('wrong')).toBe(false);
  });
});

/** fetch 를 갈아 끼워 서버 없이 확인한다 */
function withFetch(reply: unknown, status = 200) {
  const spy = vi.fn(async () => ({ json: async () => reply, status } as unknown as Response));
  (globalThis as any).fetch = spy;

  return spy;
}

const deps = { base: 'https://x/v1/app', headers: () => ({ Authorization: 'Bearer t' }) };

describe('서버 호출', () => {
  it('보내기 성공', async () => {
    withFetch({ ok: true, ttlMs: 300000, leftToday: 4 });
    const r = await createPhone(deps).send('010-1234-5678');
    expect(r).toEqual({ ok: true, ttlMs: 300000, leftToday: 4 });
  });

  it('보낼 때 숫자만 보낸다 — 하이픈째 보내면 서버가 거절한다', async () => {
    const spy = withFetch({ ok: true });
    await createPhone(deps).send('010-1234-5678');
    const body = JSON.parse((spy.mock.calls[0] as any)[1].body);
    expect(body.phone).toBe('01012345678');
  });

  it('오류 코드를 그대로 전한다', async () => {
    withFetch({ ok: false, error: 'phone_taken' });
    const r = await createPhone(deps).send('01012345678');
    expect(r).toEqual({ ok: false, error: 'phone_taken', waitMs: undefined });
  });

  it('헤더를 못 만들면 부르지 않는다 — 로그인 전에 서버를 두드리지 않는다', async () => {
    const spy = withFetch({ ok: true });
    const r = await createPhone({ ...deps, headers: () => null }).send('01012345678');
    expect(spy).not.toHaveBeenCalled();
    expect(r).toEqual({ ok: false, error: 'network' });
  });

  it('통신이 죽으면 network — 던지지 않는다', async () => {
    (globalThis as any).fetch = vi.fn(async () => { throw new Error('down'); });
    const r = await createPhone(deps).verify('01012345678', '123456');
    expect(r).toEqual({ ok: false, error: 'network' });
  });

  it('smsReady 칸이 없는 옛 서버는 보낼 수 있는 것으로 읽는다', async () => {
    withFetch({ ok: true, phone: '01012345678', phoneVerified: true });
    const s = await createPhone(deps).status();
    expect(s).toEqual({ phone: '01012345678', verified: true, smsReady: true });
  });

  it('smsReady: false 는 그대로 읽는다', async () => {
    withFetch({ ok: true, smsReady: false });
    expect((await createPhone(deps).status())?.smsReady).toBe(false);
  });
});
