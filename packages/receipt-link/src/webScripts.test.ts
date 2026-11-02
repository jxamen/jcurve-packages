import { describe, expect, it } from 'vitest';
import { beforeContentLoaded, beforeContentLoadedScripts } from './webScripts';
import { NEUTRALIZE_NEW_WINDOW_SCRIPT, QUIET_DIALOGS_SCRIPT } from './navCommon';
import { NAV_API_INTERCEPT_SCRIPT, NAV_HELPERS_SCRIPT, NAV_INTERCEPT_SCRIPT } from './naverReceipt';
import { createFlowDriver, type FlowHost } from './flowDriver';
import { FLOW_FACTORIES, type FlowSite } from './flows';

const SITES: FlowSite[] = ['naver', 'coupang', 'kurly', 'musinsa'];

describe('로드 전에 심는 스크립트 (webScripts)', () => {
  it('모든 사이트에 새 창 막기 · 알림 삼키기만 이 순서로 들어간다 — 옛 도구 · 번호 가로채기 · API 주소 학습 · 사이트별 가로채기는 들어가지 않는다', () => {
    for (const site of SITES) {
      const list = beforeContentLoadedScripts(site);
      expect(list).toEqual([NEUTRALIZE_NEW_WINDOW_SCRIPT, QUIET_DIALOGS_SCRIPT]);
      const all = beforeContentLoaded(site);
      expect(all).toContain(QUIET_DIALOGS_SCRIPT);
      for (const gone of [NAV_HELPERS_SCRIPT, NAV_INTERCEPT_SCRIPT, NAV_API_INTERCEPT_SCRIPT]) expect(all).not.toContain(gone);
    }
  });

  it('호스트가 얹는 스크립트(구조 기록 관찰 래퍼)는 맨 뒤에 붙는다', () => {
    const list = beforeContentLoadedScripts('kurly', ['/*probe*/']);
    expect(list[list.length - 1]).toBe('/*probe*/');
    expect(beforeContentLoaded('kurly', ['/*probe*/']).endsWith('/*probe*/')).toBe(true);
  });

  it('쿠키 · 저장소를 읽지 않는다', () => {
    for (const site of SITES) expect(beforeContentLoaded(site)).not.toMatch(/document\.cookie|localStorage|sessionStorage|indexedDB/);
  });

  it('이어 붙인 스크립트가 문법 오류 없이 하나로 돈다(각 조각이 true; 로 끝난다)', () => {
    for (const site of SITES) {
      for (const part of beforeContentLoadedScripts(site)) expect(part.trimEnd().endsWith('true;')).toBe(true);
      expect(() => new Function(beforeContentLoaded(site))).not.toThrow();
    }
  });
});

describe('구동기가 누르기 동작 앞에 새 창 막기를 다시 넣는다', () => {
  it('click · clickNth 는 NEUTRALIZE 가 앞에 붙고, read · tokens 는 붙지 않는다', () => {
    const injected: string[] = [];
    const host: FlowHost = { goto: () => undefined, back: () => undefined, inject: (s) => { injected.push(s); }, probe: () => undefined, now: () => 1 };
    let i = 0;
    const outs = [{ kind: 'click', labels: ['영수증보기'] }, { kind: 'clickNth', labels: ['영수증'], index: 1, prepare: 'neutralizeNewWindow' }, { kind: 'read' }];
    const factory = () => ({ next: () => outs[Math.min(i++, outs.length - 1)] as never, progress: () => ({ phase: 'x', done: 0, total: 0, orders: 0 }) });
    const d = createFlowDriver({ site: 'kurly', factory, host, onDone: () => undefined });
    d.start();
    d.onMessage({ type: 'nav', step: 'clicked', ok: true });
    d.onMessage({ type: 'nav', step: 'clicked', ok: true });
    expect(injected).toHaveLength(3);
    expect(injected[0].startsWith(NEUTRALIZE_NEW_WINDOW_SCRIPT)).toBe(true);
    expect(injected[1].startsWith(NEUTRALIZE_NEW_WINDOW_SCRIPT)).toBe(true);
    expect(injected[2].startsWith(NEUTRALIZE_NEW_WINDOW_SCRIPT)).toBe(false);
  });
});

describe('사이트 흐름이 구동기와 맞는다 (진짜 흐름으로 시작 동작 확인)', () => {
  it('네 사이트 모두 start 에 goto 를 내고, 그 주소는 허용 도메인 안이다', () => {
    for (const site of SITES) {
      const gotos: string[] = [];
      const host: FlowHost = { goto: (u) => { gotos.push(u); }, back: () => undefined, inject: () => undefined, probe: () => undefined, now: () => Date.now() };
      const d = createFlowDriver({ site, factory: FLOW_FACTORIES[site], host, onDone: () => undefined });
      d.start();
      expect(gotos).toHaveLength(1);
      expect(gotos[0].startsWith('https://')).toBe(true);
      d.stop();
    }
  });
});
