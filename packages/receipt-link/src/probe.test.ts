import { describe, expect, it } from 'vitest';

// './card' → './client' → '../api' → react-native(Flow 구문)이라 노드에서 못 읽는다 — card.test.ts 와 같이 api 를 막아 둔다
import { buildPayload, probeCollectScript, probeObserveScript, shapeName, shapePath, showProbeButton } from './probe';
import { isConnected, parseLinkState } from './model';
import { LOGIN_URL } from './card';

const ALLOWED = /^[A-Za-z0-9 _\-:./\[\]=#,*()>+~|@'"가]*$/;
const EMAIL = /[^\s@]+@[^\s@]+\.[A-Za-z]{2,}/;
const SEVEN_DIGITS = /\d{7}/;

describe('shaping helpers', () => {
  it('turns every Hangul syllable into 가', () => {
    expect(shapeName('주문 내역 abc')).toBe('가가 가가 abc');
    expect(shapeName('ㄱㄴ')).toBe('가가');
  });
  it('shortens long hash-like names to 8 chars and a ~', () => {
    expect(shapeName('x'.repeat(30))).toBe('xxxxxxxx~');
    expect(shapeName('abc-def')).toBe('abc-def');
  });
  it('never leaves 7 or more digits in a row', () => {
    expect(shapeName('order-12345678')).not.toMatch(SEVEN_DIGITS);
    expect(shapeName('a1234567b')).toBe('a:nb');
    expect(shapeName('123456')).toBe('123456');
  });
  it('shapes path segments: numbers, UUIDs and long tokens', () => {
    expect(shapePath('/order/10293/detail')).toBe('/order/:n/detail');
    expect(shapePath('/x/123e4567-e89b-12d3-a456-426614174000/y')).toBe('/x/:id/y');
    expect(shapePath('/t/abcdefghijklmnop1234')).toBe('/t/:id');
    expect(shapePath('')).toBe('');
  });
});

describe('buildPayload keeps only allowed characters and caps', () => {
  const dirty = {
    host: 'shop.example.com',
    path: '/orders/2026102712345/주문상세/abcdefghijklmnopqrstuvwxyz',
    queryKeys: ['page', '주소', 'a=b'],
    cookieNames: ['NID_SES', 'token=abc', 'me@mail.com', '쿠키'],
    outline: ['div#main.list[data-id]', '<script>', 'p 본문 내용 010-1234-5678'],
    repeat: { 'ul > li.item': 4, '가나다 > div': 2, 'x': 99 },
    requests: [{ method: 'get', host: 'api.example.com', path: '/a/1234567', status: 200, responseKeys: ['items', 'name=김'] }],
  };
  const out = buildPayload(dirty);
  const text = JSON.stringify(out);

  it('drops Hangul-free junk, email shapes and cookie strings with =', () => {
    expect(out.cookie_names).toEqual(['NID_SES', '가가']);
    expect(text).not.toContain('@');
    expect(text).not.toMatch(EMAIL);
    expect(text).not.toMatch(SEVEN_DIGITS);
    expect(out.page.path).toBe('/orders/:n/가가가가/:id');
  });

  it('keeps only server-allowed characters in every string', () => {
    const strings: string[] = [out.page.host, out.page.path, ...out.page.query_keys, ...out.cookie_names, ...out.dom.outline, ...Object.keys(out.dom.repeat_counts), ...out.requests.flatMap(r => [r.method, r.host, r.path, ...r.response_keys])];
    for (const s of strings) expect(s).toMatch(ALLOWED);
  });

  it('applies the caps and only keeps repeats of three or more', () => {
    const many = { outline: Array.from({ length: 500 }, (_, i) => 'div.c' + i), requests: Array.from({ length: 80 }, () => ({ method: 'GET', path: '/a', status: 200 })) };
    const big = buildPayload(many);
    expect(big.dom.outline.length).toBe(300);
    expect(big.requests.length).toBe(40);
    expect(out.dom.repeat_counts).toEqual({ 'ul > li.item': 4, 'x': 99 });
  });

  it('falls back to an empty, well-formed body for garbage input', () => {
    expect(buildPayload(null)).toEqual({
      platform: 'naver', page: { host: '', path: '', query_keys: [] }, cookie_names: [], dom: { outline: [], repeat_counts: {} }, requests: [],
    });
    expect(buildPayload({ requests: [{ status: 200.5 }] }).requests[0].status).toBe(0);
  });
});

describe('probe button visibility', () => {
  it('shows only when the server says probe is true', () => {
    expect(showProbeButton(parseLinkState({ probe: true }))).toBe(true);
    expect(showProbeButton(parseLinkState({ probe: false }))).toBe(false);
    expect(showProbeButton(parseLinkState({}))).toBe(false);
    expect(showProbeButton(parseLinkState({ probe: 'yes' }))).toBe(false);
    expect(showProbeButton(null)).toBe(false);
  });
});

describe('in-page scripts never read text, values or auth', () => {
  const forbidden = ['innerText', 'textContent', '.value', 'Authorization', 'getAttribute(\'value\')', 'nodeValue'];
  it('collect script', () => {
    const s = probeCollectScript();
    for (const w of forbidden) expect(s).not.toContain(w);
    expect(s).toContain('postMessage');
  });
  it('observe script records keys only', () => {
    const s = probeObserveScript();
    for (const w of forbidden) expect(s).not.toContain(w);
    expect(s).toContain('__ytProbe');
    expect(s).toContain('responseKeys');
  });
});

describe('musinsa and kurly test platforms', () => {
  it('carries the site name into the probe body (default naver)', () => {
    expect(buildPayload({}, 'musinsa').platform).toBe('musinsa');
    expect(buildPayload({}, 'kurly').platform).toBe('kurly');
    expect(buildPayload({}).platform).toBe('naver');
  });
  it('reads their link state and keeps them out of other platforms', () => {
    const s = parseLinkState({ links: { musinsa: { linkedAt: '2026-10-28 10:00:00', revokedAt: null } } });
    expect(isConnected(s, 'musinsa')).toBe(true);
    expect(isConnected(s, 'kurly')).toBe(false);
  });
  it('uses each site official login page and does not restrict navigation to one host', () => {
    expect(LOGIN_URL.musinsa).toMatch(/^https:\/\/www\.musinsa\.com\//);
    expect(LOGIN_URL.kurly).toMatch(/^https:\/\/www\.kurly\.com\//);
  });
});
