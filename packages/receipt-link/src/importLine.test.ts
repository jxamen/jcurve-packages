import { describe, expect, it } from 'vitest';
import { runView, settledMode, statusLine, type ImportMode, type LineInput } from './importLine';
import { listCounts, rowViews, type LinkOrder } from './ordersModel';

const base: LineInput = {
  label: '네이버', mode: 'reading', state: 'running', total: 0, timeouts: 0, pending: 0, failed: false, partial: false,
  listTotal: 0, fetched: 0, claimable: 0, missed: 0,
};

describe('머리 줄 (statusLine) — 읽는 중', () => {
  it('목록 읽는 단계는 「주문 목록 읽는 중…」 → 다 찾으면 「주문 N건 찾음」 (짧은 줄, 대표님 10-30 단어 중간에서 안 끊김)', () => {
    expect(statusLine({ ...base, listTotal: null })).toBe('주문 목록 읽는 중…');
    expect(statusLine({ ...base, listTotal: 0 })).toBe('주문 0건 찾음');
    expect(statusLine({ ...base, listTotal: 213 })).toBe('주문 213건 찾음');
  });

  it('영수증 받는 단계는 짧은 줄 — 「주문 N건 찾음」 + 「새 영수증 받는 중 n/받아야 할 수」 + 「이미 받은 X건」 따로 (대표님 10-30)', () => {
    // 전체 213 · 이미 받은 64(fetched-newFetched) · 이번에 10 받음 → 받아야 할 149(all-이미받은)
    expect(statusLine({ ...base, total: 133, listTotal: 213, fetched: 74, newFetched: 10 })).toBe('주문 213건 찾음\n새 영수증 받는 중 10/149건\n이미 받은 64건');
    // 시작(아직 0 받음): 이미 받은 64 · 받아야 할 149
    expect(statusLine({ ...base, total: 133, listTotal: 213, fetched: 64, newFetched: 0 })).toBe('주문 213건 찾음\n새 영수증 받는 중 0/149건\n이미 받은 64건');
    // 목록을 아직 못 받았으면 수 없이
    expect(statusLine({ ...base, total: 133, listTotal: null, fetched: 5, newFetched: 5 })).toBe('영수증 받는 중…\n새 영수증 받는 중 5건');
  });

  it('영수증 없음 K · 못 가져옴 F 는 각각 짧은 줄로 따로 (· 로 붙여 단어 중간에서 안 끊기게)', () => {
    expect(statusLine({ ...base, total: 133, listTotal: 213, fetched: 64, newFetched: 0, none: 5, missed: 3 })).toBe('주문 213건 찾음\n새 영수증 받는 중 0/149건\n이미 받은 64건\n영수증 없음 5건\n못 가져옴 3건');
    // 목록을 읽는 단계(영수증 단계 전)에는 붙이지 않는다
    expect(statusLine({ ...base, total: 0, listTotal: 213, none: 12, missed: 3 })).toBe('주문 213건 찾음');
  });

  it('느려지면 다시 확인 중이라고, 올리기가 실패했으면 다시 보낸다고 말한다', () => {
    expect(statusLine({ ...base, timeouts: 2 })).toContain('응답이 느려요, 다시 확인하는 중');
    expect(statusLine({ ...base, failed: true })).toContain('올리지 못한 주문은 다시 보내요');
  });

  it('로그인 · 확인이 필요할 때 무엇을 하면 되는지 말한다', () => {
    expect(statusLine({ ...base, state: 'login' })).toBe('네이버 로그인 후 자동으로 이어져요');
    expect(statusLine({ ...base, state: 'attention' })).toContain('화면에서 확인이 필요해요');
    expect(statusLine({ ...base, state: 'attention' })).toContain('확인 끝났어요');
  });
});

describe('머리 줄 (statusLine) — 끝 상태', () => {
  it('모두 가져왔으면 「다 가져왔어요 · 적립 가능 N건」', () => {
    expect(statusLine({ ...base, mode: 'ended', listTotal: 180, fetched: 180, claimable: 175 })).toBe('다 가져왔어요 · 적립 가능 175건');
  });

  it('못 가져온 줄이 있으면 「못 가져옴 N건」을 둘째 줄에 덧붙이고, 「다 가져왔어요」라고는 하지 않는다', () => {
    const line = statusLine({ ...base, mode: 'ended', listTotal: 180, fetched: 170, claimable: 170, missed: 10 });
    expect(line).toBe('가져오기를 마쳤어요 · 적립 가능 170건\n못 가져옴 10건');
    expect(line).not.toContain('다 가져왔어요');
  });

  it('영수증이 없는 결제(포인트 · 계좌이체)만 남았으면 실패가 아니라 「다 가져왔어요」 + 「영수증 없음 K건」', () => {
    expect(statusLine({ ...base, mode: 'ended', listTotal: 180, fetched: 168, claimable: 168, none: 12 })).toBe('다 가져왔어요 · 적립 가능 168건\n영수증 없음 12건');
    expect(statusLine({ ...base, mode: 'ended', listTotal: 180, fetched: 160, claimable: 160, none: 12, missed: 8 })).toBe('가져오기를 마쳤어요 · 적립 가능 160건\n영수증 없음 12건 · 못 가져옴 8건');
  });

  it('끝까지 못 가고 멈춰 끝났으면(시간 초과 등) 「멈췄어요 · 가져온 건 N건」', () => {
    expect(statusLine({ ...base, mode: 'ended', partial: true, listTotal: 180, fetched: 36, missed: 144 })).toBe('멈췄어요 · 가져온 건 36건\n못 가져옴 144건');
    expect(statusLine({ ...base, mode: 'ended', partial: true, listTotal: 5, fetched: 5 })).toBe('멈췄어요 · 가져온 건 5건');
  });

  it('사용자가 중단했으면 「중단했어요 · 가져온 건 N건」 + 남은 것만 이어서 가져온다는 안내 — 남은 건은 실패로 세지 않는다', () => {
    expect(statusLine({ ...base, mode: 'stopped', listTotal: 30, fetched: 12 })).toBe('중단했어요 · 가져온 건 12건\n「주문 불러오기」를 다시 하면 남은 것만 이어서 가져와요');
    expect(statusLine({ ...base, mode: 'stopped', listTotal: 30, fetched: 12, none: 2, missed: 1 })).toBe('중단했어요 · 가져온 건 12건 · 영수증 없음 2건 · 못 가져옴 1건\n「주문 불러오기」를 다시 하면 남은 것만 이어서 가져와요');
  });

  it('못 읽었을 때 · 못 올렸을 때 · 보내는 중', () => {
    expect(statusLine({ ...base, mode: 'stalled' })).toBe('네이버에서 주문을 못 읽었어요. 잠시 뒤 다시 시도하거나 종이·사진으로 올려 주세요');
    expect(statusLine({ ...base, mode: 'sendFailed', pending: 3 })).toContain('3건');
    expect(statusLine({ ...base, mode: 'sending' })).toBe('주문을 보내는 중…');
  });

  it('주문 내용(번호 · 금액 · 판매처)이나 영문 코드는 글자에 들어가지 않는다 — 개수만', () => {
    for (const mode of ['reading', 'ended', 'stopped'] as ImportMode[]) {
      expect(statusLine({ ...base, mode, total: 4, listTotal: 4, fetched: 3, claimable: 2, missed: 1 })).not.toMatch(/\d{5,}|원|[a-z]{3,}/);
    }
  });
});

describe('끝난 뒤 낡은 목록 보호 (settledMode)', () => {
  it('끝난 모드인데 서버 목록이 아직 끝난 뒤 것이 아니면 「보내는 중」으로 둔다', () => {
    for (const mode of ['ended', 'stopped', 'sendFailed'] as ImportMode[]) {
      expect(settledMode(mode, false)).toBe('sending');
      expect(settledMode(mode, true)).toBe(mode);
    }
  });
  it('읽는 중 · 못 읽음(목록을 안 쓰는 글)은 그대로', () => {
    expect(settledMode('reading', false)).toBe('reading');
    expect(settledMode('sending', false)).toBe('sending');
    expect(settledMode('stalled', false)).toBe('stalled');
  });
});

describe('읽기 진행 (runView)', () => {
  it('영수증 단계 대상이 없으면 목록 단계, 있으면 영수증 단계 — 읽는 중이든 보내는 중이든', () => {
    expect(runView('reading', 0, '')).toEqual({ stage: 'list', reason: '' });
    expect(runView('reading', 133, '')).toEqual({ stage: 'receipt', reason: '' });
    expect(runView('sending', 133, '')).toEqual({ stage: 'receipt', reason: '' });
  });
  it('줄 결과(outcomes)가 있으면 그대로 실어 보낸다 — 없으면 키 자체를 싣지 않는다', () => {
    const outcomes = { 'k': { state: 'none' as const } };
    expect(runView('reading', 133, '', outcomes)).toEqual({ stage: 'receipt', reason: '', outcomes });
    expect(runView('stopped', 133, 'stopped', outcomes)).toEqual({ stage: 'ended', reason: 'stopped', outcomes });
    expect('outcomes' in runView('reading', 133, '')).toBe(false);
  });
  it('끝난 모드는 끝남 + 끝난 까닭', () => {
    for (const mode of ['ended', 'stopped', 'sendFailed', 'stalled'] as ImportMode[]) {
      expect(runView(mode, 133, 'receipt-bounced')).toEqual({ stage: 'ended', reason: 'receipt-bounced' });
    }
  });
});

describe('머리 숫자와 줄 수 — 같은 목록에서 나온다', () => {
  const row = (id: number, over: Partial<LinkOrder> = {}): LinkOrder => ({
    id, platform: 'naver', orderNo: `N-${id}`, seller: '', title: '', amount: 1000, orderedAt: `2026-10-${String(10 + (id % 18)).padStart(2, '0')} 10:00`, claimed: false, claimedAt: null, kind: 'list', duplicate: false, ...over,
  });
  // 180 줄: 36 건 가져옴(card), 144 건 목록 행
  const rows = Array.from({ length: 180 }, (_, i) => row(i + 1, i < 36 ? { kind: 'card' } : {}));

  it('분모 180 은 줄 수와 같고, 가져온 건은 목록 행이 아닌 줄 수와 같다', () => {
    const c = listCounts(rows);
    expect(c).toEqual({ total: 180, fetched: 36, claimable: 36 });
    expect(rowViews(rows, { stage: 'receipt', reason: '' }).size).toBe(c.total);
    // 진행 문구(r4, 11b9c65): 「주문 N건 찾음」 + 「새 영수증 받는 중 가져온/전체」 — 분모는 줄 수(180), 분자는 영수증 가져온 줄 수(36)
    expect(statusLine({ ...base, total: 133, listTotal: c.total, fetched: c.fetched })).toBe('주문 180건 찾음\n새 영수증 받는 중 36/180건');
  });

  it('끝났는데 못 가져온 줄 수(분모 − 분자)는 「못 가져옴」 줄 수와 같다', () => {
    const c = listCounts(rows);
    const failed = [...rowViews(rows, { stage: 'ended', reason: 'receipt-bounced' }).values()].filter((v) => v.state === 'failed').length;
    expect(failed).toBe(c.total - c.fetched);
    expect(statusLine({ ...base, mode: 'ended', partial: true, listTotal: c.total, fetched: c.fetched, missed: failed })).toBe('멈췄어요 · 가져온 건 36건\n못 가져옴 144건');
  });
});
