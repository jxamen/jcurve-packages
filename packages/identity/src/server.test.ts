import { createCipheriv } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { extractBirth, extractCi, KIAP_HOST, PAGE_HEADERS, publicBase, startPageHtml, verifyCallback } from './server';

const AUTH = Buffer.from('0123456789abcdef').toString('base64');
const enc = (s: string) => {
  const c = createCipheriv('aes-128-cbc', Buffer.from('0123456789abcdef'), Buffer.from('secureiv12345678'));
  return Buffer.concat([c.update(s, 'utf8'), c.final()]).toString('base64');
};
const form = { code: '0000', auth_token: AUTH, provider_id: 'kakao', client_tx_id: 'c1', server_tx_id: 's1', access_token: 'dyn' };
const fakeResult = (extra: Record<string, unknown>) => {
  (globalThis as any).fetch = vi.fn(async () => ({ status: 200, json: async () => ({ code: '0000', client_tx_id: 'c1', server_tx_id: 's1', provider_id: 'KAKAO', service_code: 'AUTH', ...extra }) }));
};
const person = { name: enc('홍길동'), phone: enc('+821012345678'), birthday: enc('19900102') };

afterEach(() => vi.restoreAllMocks());

describe('CI — 칸 이름 · 원문 · 테스트 키', () => {
  it('원문 CI(88자 base64)는 그대로 · 칸 이름 CI 도', () => {
    const raw = 'A'.repeat(86) + '==';
    expect(extractCi({ CI: raw }, AUTH, { dev: false, phone: '010' })).toMatchObject({ ci: raw, from: 'raw', key: 'CI' });
  });
  it('암호화된 CI 는 풀어서', () => {
    expect(extractCi({ connInfo: enc('ci-plain') }, AUTH, { dev: false, phone: '010' })).toMatchObject({ ci: 'ci-plain', from: 'dec' });
  });
  it('없으면 개발 주소만 번호로 대신 — 운영은 빈 값', () => {
    expect(extractCi({ ci: '' }, AUTH, { dev: true, phone: '01012345678' }).ci).toBe('dev-noci:01012345678');
    expect(extractCi({ ci: '' }, AUTH, { dev: false, phone: '01012345678' }).ci).toBe('');
  });
});

describe('생년월일', () => {
  it('YYYYMMDD → YYYY-MM-DD, 없는 날짜는 null', () => {
    expect(extractBirth({ birthday: enc('19900102') }, AUTH)).toBe('1990-01-02');
    expect(extractBirth({ birthday: enc('19900230') }, AUTH)).toBeNull();
  });
});

describe('콜백 판정', () => {
  it('통과하면 이름 · 번호 · 생년월일 · CI', async () => {
    fakeResult({ ...person, ci: enc('ci-plain') });
    const r = await verifyCallback(form, { host: KIAP_HOST.prod });
    expect(r).toMatchObject({ ok: true, name: '홍길동', phone: '01012345678', birth: '1990-01-02', ci: 'ci-plain', provider: 'KAKAO' });
  });
  it('운영 주소에서 CI 가 없으면 CI_MISSING, 개발 주소면 통과', async () => {
    fakeResult({ ...person, ci: '' });
    expect(await verifyCallback(form, { host: KIAP_HOST.prod })).toEqual({ ok: false, reason: 'CI_MISSING' });
    expect((await verifyCallback(form, { host: KIAP_HOST.dev })).ok).toBe(true);
  });
  it('KICA 오류 코드는 KIAP_ 를 붙여', async () => {
    expect(await verifyCallback({ ...form, code: 'E4108' }, { host: KIAP_HOST.dev })).toEqual({ ok: false, reason: 'KIAP_E4108' });
  });
  it('다른 거래의 결과면 RESULT_BINDING_MISMATCH', async () => {
    fakeResult({ ...person, client_tx_id: 'other' });
    expect(await verifyCallback(form, { host: KIAP_HOST.prod })).toEqual({ ok: false, reason: 'RESULT_BINDING_MISMATCH' });
  });
});

describe('시작 페이지', () => {
  const base = { title: 't', host: KIAP_HOST.dev, clientId: 'c', accessToken: 'a', sdkUrl: '/sdk.js', callbackUrl: '/cb', cancelUrl: 'app://x?ok=0' };
  it('도메인을 보내는 Referrer-Policy', () => {
    expect(PAGE_HEADERS['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
  });
  it('기관이 하나면 바로 연다 · 여럿이면 켠 것만 버튼', () => {
    expect(startPageHtml({ ...base, providers: [{ code: 'TOSS', label: '토스' }] })).toContain('var PICK = "TOSS", MANY = false');
    const many = startPageHtml({ ...base, providers: [{ code: 'KAKAO', label: '카카오' }, { code: 'NAVER', label: '네이버' }] });
    expect(many).toContain('MANY = true');
    expect(many).toContain('>카카오<');
    expect(many).not.toContain('>토스<');
  });
  it('값에 < 가 섞여도 스크립트를 깨지 않는다', () => {
    expect(startPageHtml({ ...base, cancelUrl: 'app://x?</script>' })).not.toContain('</script>"');
  });
});

describe('공개 주소', () => {
  it('KIAP_PUBLIC_BASE 가 있으면 그것, 없으면 프록시 머리글', () => {
    expect(publicBase(null, 'https://dev-api.j-curve.co.kr/sf/v1/')).toBe('https://dev-api.j-curve.co.kr/sf/v1');
    const req = { url: 'http://127.0.0.1:3000/x', headers: { get: (k: string) => ({ 'x-forwarded-proto': 'https', 'x-forwarded-host': 'a.example' } as any)[k] ?? null } };
    expect(publicBase(req, '')).toBe('https://a.example/api/v1');
  });
});
