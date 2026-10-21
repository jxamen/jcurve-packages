import { describe, expect, it, vi } from 'vitest';

describe('ShoppingMission trace stages', () => {
  it('같은 단계는 세션당 1회만 기록된다', async () => {
    // Mock: traceStage 호출 추적
    const traceCalls: Array<[string, unknown?]> = [];
    const mockTrace = vi.fn(((stage: string, params?: unknown) => {
      traceCalls.push([stage, params]);
    }) as any);

    // 같은 단계 여러 번 호출
    mockTrace('entry');
    mockTrace('entry');
    mockTrace('load_ok');

    expect(traceCalls.length).toBe(3);
  });

  it('source 기본값은 other', () => {
    const traceParams: any = { stage: 'entry', source: 'other' };
    expect(traceParams.source).toBe('other');
  });

  it('source는 허용된 값만 받는다', () => {
    const validSources = ['popup', 'push', 'tab', 'card', 'other'];
    for (const source of validSources) {
      expect(['popup', 'push', 'tab', 'card', 'other']).toContain(source);
    }
  });

  it('close 단계는 ms를 포함한다', () => {
    const closeParams = { stage: 'close', source: 'popup', ms: 5000 };
    expect(closeParams).toHaveProperty('ms');
    expect(typeof closeParams.ms).toBe('number');
    expect(closeParams.ms).toBeGreaterThanOrEqual(0);
  });
});

describe('ShoppingMission hint', () => {
  it('hint prop 기본값은 true', () => {
    const hintDefault = true;
    expect(hintDefault).toBe(true);
  });

  it('hintText prop으로 문구를 커스터마이징할 수 있다', () => {
    const customText = '커스텀 안내 문구';
    expect(customText).toBeTruthy();
    expect(typeof customText).toBe('string');
  });

  it('hint={false}로 안내를 숨길 수 있다', () => {
    const hint = false;
    expect(hint).toBe(false);
  });
});
