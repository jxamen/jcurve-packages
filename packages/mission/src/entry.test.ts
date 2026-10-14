import { describe, expect, it } from 'vitest';
import { fetchEntry, isAllowedOrigin, isEntryUrl } from './entry';

const good = 'https://service.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b&trackingId=c';

describe('isEntryUrl', () => {
  it('약속된 호스트 · https · entry.php 만', () => {
    expect(isEntryUrl(good)).toBe(true);
    expect(isEntryUrl('https://test.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b&trackingId=c')).toBe(true);
    for (const u of ['http://service.mocation.co.kr/alwayz/entry.php', 'https://evil.com/alwayz/entry.php', 'https://service.mocation.co.kr.evil.com/alwayz/entry.php', 'https://service.mocation.co.kr/other.php', 'https://service.mocation.co.kr:8443/alwayz/entry.php?pubKey=a&uid=b&trackingId=c', 'https://user:pw@service.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b&trackingId=c', 'https://service.mocation.co.kr/alwayz/entry.php', 'https://service.mocation.co.kr/alwayz/entry.php?pubKey=a&uid=b', 'https://service.mocation.co.kr/alwayz/entry.php?pubKey=&uid=b&trackingId=c', 'javascript:1', 42, null]) expect(isEntryUrl(u), String(u)).toBe(false);
  });
});

describe('isAllowedOrigin', () => {
  it('승인된 https origin 만(포트 · 계정 정보 · 비슷한 호스트 거절)', () => {
    expect(isAllowedOrigin('https://service.mocation.co.kr/any/path?x=1')).toBe(true);
    expect(isAllowedOrigin('https://test.mocation.co.kr')).toBe(true);
    for (const u of ['http://service.mocation.co.kr/', 'https://service.mocation.co.kr:444/', 'https://a@service.mocation.co.kr/', 'https://service.mocation.co.kr.evil.com/', 'https://evil.com/?service.mocation.co.kr', 'about:blank', '', undefined]) expect(isAllowedOrigin(u), String(u)).toBe(false);
  });
});

describe('fetchEntry', () => {
  it('성공', async () => { expect(await fetchEntry(async () => ({ ok: true, url: good }))).toEqual({ ok: true, url: good }); });
  it('adId 는 있을 때만 보낸다', async () => {
    const seen: unknown[] = [];
    await fetchEntry(async (_p, o) => { seen.push(o?.body); return { ok: true, url: good }; }, 'abc-12345678');
    await fetchEntry(async (_p, o) => { seen.push(o?.body); return { ok: true, url: good }; });
    expect(seen).toEqual([{ adId: 'abc-12345678' }, {}]);
  });
  it('서버 off / not_ready / 네트워크 / 이상한 주소', async () => {
    expect(await fetchEntry(async () => { throw { status: 404 }; })).toEqual({ ok: false, reason: 'off' });
    expect(await fetchEntry(async () => { throw { status: 503 }; })).toEqual({ ok: false, reason: 'not_ready' });
    expect(await fetchEntry(async () => { throw new Error('net'); })).toEqual({ ok: false, reason: 'network' });
    expect(await fetchEntry(async () => ({ ok: true, url: 'https://evil.com/x' }))).toEqual({ ok: false, reason: 'invalid' });
    expect(await fetchEntry(async () => ({ ok: false, error: 'off' }))).toEqual({ ok: false, reason: 'off' });
  });
});
