import { describe, expect, it } from 'vitest';
import { endNoteLine, endOfNothingRead } from './appKit';

describe('endOfNothingRead — 새 주문 0건으로 끝난 까닭', () => {
  it('목록을 끝까지 읽었고 못 가져온 줄이 없으면 실패가 아니다(새 영수증 없음)', () => {
    for (const reason of ['all-rows', 'max-orders', 'first-page-only']) {
      expect(endOfNothingRead(reason)).toEqual({ mode: 'ended', note: 'none-new' });
    }
    // 영수증 없는 결제 · 취소 주문(none)과 가져온 줄(done)은 실패가 아니다
    expect(endOfNothingRead('all-rows', [{ state: 'none' }, { state: 'none', why: 'cancelled' }, { state: 'done' }])).toEqual({ mode: 'ended', note: 'none-new' });
  });

  it('로그인이 풀려 끝났으면 로그인 안내 — 흐름 까닭이 login · login-timeout 이거나, 정상 종료여도 줄 결과에 login 실패가 있을 때', () => {
    expect(endOfNothingRead('login-timeout')).toEqual({ mode: 'stalled', note: 'login' });
    expect(endOfNothingRead('login')).toEqual({ mode: 'stalled', note: 'login' });
    expect(endOfNothingRead('all-rows', [{ state: 'failed', code: 'login' }])).toEqual({ mode: 'stalled', note: 'login' });
  });

  it('정상 종료여도 못 가져온 줄이 있으면 「가져올 게 없다」고 하지 않는다', () => {
    expect(endOfNothingRead('all-rows', [{ state: 'failed', code: 'unreadable' }])).toEqual({ mode: 'stalled', note: 'unreadable' });
    expect(endOfNothingRead('all-rows', [{ state: 'failed', code: 'network' }, { state: 'done' }])).toEqual({ mode: 'stalled', note: 'unreadable' });
    expect(endOfNothingRead('all-rows', [{ state: 'failed', code: 'blocked' }])).toEqual({ mode: 'stalled', note: 'blocked' });
  });

  it('시간 초과 · 막힘 · 화면 확인 · 목록 못 읽음은 각각 다른 까닭으로 못 읽음', () => {
    for (const reason of ['timeout', 'timeouts', 'site-cap', 'budget', 'max-steps', 'too-many-steps']) {
      expect(endOfNothingRead(reason)).toEqual({ mode: 'stalled', note: 'slow' });
    }
    for (const reason of ['blocked', 'cross-origin']) expect(endOfNothingRead(reason)).toEqual({ mode: 'stalled', note: 'blocked' });
    expect(endOfNothingRead('attention-timeout')).toEqual({ mode: 'stalled', note: 'attention' });
    for (const reason of ['list-failed', 'list-shape', 'unexpected-page', 'unexpected-api', 'unexpected-event', 'unknown', 'bad-action', '']) {
      expect(endOfNothingRead(reason)).toEqual({ mode: 'stalled', note: 'unreadable' });
    }
  });
});

describe('endNoteLine — 진행 줄 글자', () => {
  it('새 영수증이 없으면 이미 받은 것은 그대로라고 말하고 적립 가능 건수를 보인다 — 「못 읽었어요」가 아니다', () => {
    const t = endNoteLine('none-new', '네이버', { total: 167, claimable: 160 });
    expect(t).toContain('새로 가져올 영수증이 없어요');
    expect(t).toContain('적립 가능 160건');
    expect(t).not.toContain('못 읽');
  });

  it('서버에 받은 줄이 하나도 없으면 주문이 없는 것인지 로그인 확인인지 같이 알린다', () => {
    for (const counts of [null, { total: 0, claimable: 0 }]) {
      const t = endNoteLine('none-new', '무신사', counts);
      expect(t).toContain('불러올 주문을 찾지 못했어요');
      expect(t).toContain('무신사 로그인을 확인');
    }
  });

  it('로그인 풀림은 로그인 화면을 여는 길(다시 시도)을 알려 준다', () => {
    const t = endNoteLine('login', '무신사', null);
    expect(t).toContain('무신사 로그인이 풀렸어요');
    expect(t).toContain('다시 시도');
  });

  it('실패 문구는 까닭마다 다르고, 다음 할 일(다시 시도 · 종이·사진)을 항상 말한다', () => {
    const notes = ['login', 'attention', 'slow', 'blocked', 'unreadable'] as const;
    const lines = notes.map((n) => endNoteLine(n, '쿠팡', { total: 3, claimable: 1 }));
    expect(new Set(lines).size).toBe(notes.length);
    for (const t of lines) expect(t).toMatch(/다시 시도|종이·사진/);
    for (const t of lines) expect(t.startsWith('쿠팡')).toBe(true);
  });
});
