import { describe, expect, it } from 'vitest';
import { FLOW_FACTORIES, FLOW_HOSTS, type FlowSite } from './flows';

describe('flows 등록표', () => {
  const sites: FlowSite[] = ['naver', 'coupang', 'kurly', 'musinsa', 'daiso', 'oliveyoung'];
  it('여섯 사이트 모두 흐름을 만들 수 있고 도메인 목록이 있다', () => {
    for (const s of sites) {
      const f = FLOW_FACTORIES[s]();
      expect(typeof f.next).toBe('function');
      expect(f.progress().phase).toBeTypeOf('string');
      expect(FLOW_HOSTS[s].length).toBeGreaterThan(0);
    }
  });
});
