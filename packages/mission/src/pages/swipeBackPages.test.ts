import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
// 화면을 함수로 직접 부르는 시험 틀(StepsPage.test.ts 와 같음) — hook 은 흉내만 낸다
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useEffect: vi.fn(), useRef: (v: any) => ({ current: v }), useMemo: (f: any) => f() }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'ios' }, PanResponder: { create: () => ({ panHandlers: {} }) },
}));
import { PageFrame } from './PageFrame';
import { AppHubPage } from './AppHubPage';
import { FreeItemPage } from './FreeItemPage';
import { InvitePage } from './InvitePage';
import { LuckyChancePage } from './LuckyChancePage';
import { StepsPage } from './StepsPage';
import { TodayMissionPage } from './TodayMissionPage';

const fn = vi.fn();
// 화면마다 필수 값만 최소로 — 이 시험은 PageFrame 에 swipeBack 이 그대로 넘어가는지만 본다
const pages: Record<string, (over: Record<string, unknown>) => ReactElement<any>> = {
  AppHubPage: over => AppHubPage({ apps: [], onBack: fn, ...over } as any) as ReactElement<any>,
  FreeItemPage: over => FreeItemPage({ slots: [], onClaim: fn, onBack: fn, ...over } as any) as ReactElement<any>,
  InvitePage: over => InvitePage({ code: 'ABC', inviterPoint: 100, inviteePoint: 100, onBack: fn, ...over } as any) as ReactElement<any>,
  LuckyChancePage: over => LuckyChancePage({ freeLeft: 1, adLeft: 0, onDraw: fn, onBack: fn, ...over } as any) as ReactElement<any>,
  StepsPage: over => StepsPage({ todaySteps: 0, stages: [], stepsAvailable: true, onUpdate: fn, onClaim: fn, onBack: fn, ...over } as any) as ReactElement<any>,
  TodayMissionPage: over => TodayMissionPage({ rows: [], onClaim: fn, onBack: fn, ...over } as any) as ReactElement<any>,
};

describe('6개 하위 화면이 swipeBack 을 PageFrame 으로 그대로 넘긴다(0.7.10) — 한 화면이라도 빠지면 그 화면만 조용히 안 꺼진다', () => {
  for (const [name, page] of Object.entries(pages)) {
    it(name, () => {
      expect(page({}).type).toBe(PageFrame);
      expect(page({}).props.swipeBack).toBeUndefined();                  // 생략 = PageFrame 기본(켜짐)
      expect(page({ swipeBack: false }).props.swipeBack).toBe(false);    // 이미 앱에서 감싼 화면이 끄는 길
      expect(page({ swipeBack: true }).props.swipeBack).toBe(true);
    });
  }
});
