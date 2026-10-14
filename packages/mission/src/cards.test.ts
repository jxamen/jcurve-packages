import { describe, expect, it, vi } from 'vitest';
import { fetchCards, normalizeCards, parseCardsResponse, type MissionCard } from './cards';

const shopping: MissionCard = { id: 'shopping', type: 'apihub_shopping', title: '쇼핑' };
const place: MissionCard = { id: 'place', type: 'place_stamp', title: '장소' };
const fallback = [shopping, place];

describe('normalizeCards', () => {
  it('sorts numeric orders stably, with server defaults', () => {
    expect(normalizeCards([{ ...shopping, order: '30' }, { ...place, order: 10 }, { ...shopping, id: 'third', order: 10 }]).map(c => c.id)).toEqual(['place', 'third', 'shopping']);
    expect(normalizeCards(fallback).map(c => c.order)).toEqual([10, 20]);
  });
  it.each([false, 0, '0', 'false', 'off', 'no', ''])('filters disabled cards (%s)', enabled => {
    expect(normalizeCards([{ ...shopping, enabled }, place]).map(c => c.id)).toEqual(['place']);
  });
  it('skips unknown types and malformed rows', () => {
    expect(normalizeCards([null, 1, {}, { ...shopping, type: 'future' }, { ...shopping, id: 'Bad-id' }, { ...shopping, title: ' ' }, place]).map(c => c.id)).toEqual(['place']);
  });
  it('keeps first valid unique id', () => {
    expect(normalizeCards([{ ...shopping, enabled: false }, shopping, { ...shopping, title: 'duplicate' }])).toHaveLength(1);
    expect(normalizeCards([shopping, { ...shopping, title: 'duplicate' }])[0].title).toBe('쇼핑');
  });
  it('trims copy, limits Unicode length, validates icons and finite orders', () => {
    const [card] = normalizeCards([{ ...shopping, title: '  쇼핑  ', desc: '😀'.repeat(100), icon: 'http://example.test/a', order: Infinity }]);
    expect(card).toMatchObject({ title: '쇼핑', icon: null, order: 10 });
    expect(Array.from(card.desc!)).toHaveLength(80);
    expect(normalizeCards([{ ...shopping, icon: 'https://example.test/icon.png' }])[0].icon).toBe('https://example.test/icon.png');
  });
  it('does not mutate input and handles non-arrays', () => {
    const input = Object.freeze([Object.freeze({ ...shopping, order: 20 }), Object.freeze({ ...place, order: 10 })]);
    expect(normalizeCards(input)[0].id).toBe('place');
    expect(input[0].id).toBe('shopping');
    expect(normalizeCards(null)).toEqual([]);
  });
});

describe('parseCardsResponse', () => {
  it('parses the controller envelope including desc and icon', () => {
    expect(parseCardsResponse({ ok: true, cards: [{ ...shopping, desc: '매일 참여', icon: null }] }, [place])[0]).toMatchObject({ id: 'shopping', desc: '매일 참여', icon: null });
  });
  it.each([undefined, null, {}, { ok: false, cards: [] }, { ok: true, cards: null }, { ok: 'true', cards: [] }])('uses fallback for unavailable or invalid responses (%j)', response => {
    expect(parseCardsResponse(response, fallback)).toEqual(normalizeCards(fallback));
  });
  it('preserves empty success and skips future cards without reviving fallback', () => {
    expect(parseCardsResponse({ ok: true, cards: [] }, fallback)).toEqual([]);
    expect(parseCardsResponse({ ok: true, cards: [{ ...shopping, type: 'future' }] }, fallback)).toEqual([]);
  });
});

describe('fetchCards', () => {
  it('requests GET mission/cards through the app adapter', async () => {
    const request = vi.fn().mockResolvedValue({ ok: true, cards: [place] });
    expect(await fetchCards(request, fallback)).toEqual(normalizeCards([place]));
    expect(request).toHaveBeenCalledWith('mission/cards', { method: 'GET' });
  });
  it('uses normalized fallback on rejection', async () => {
    expect(await fetchCards(vi.fn().mockRejectedValue(new Error('offline')), fallback)).toEqual(normalizeCards(fallback));
  });
  it('defaults to empty fallback', async () => {
    expect(await fetchCards(vi.fn().mockResolvedValue(null))).toEqual([]);
  });
});
