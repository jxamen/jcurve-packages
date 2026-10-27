import React from 'react';
import { act, create } from 'react-test-renderer';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({
 Platform: { OS: 'ios' }, StyleSheet: { create: (s: unknown) => s },
 Text: 'Text', View: 'View', Pressable: 'Pressable', ScrollView: 'ScrollView', RefreshControl: 'RefreshControl',
 AppState: { currentState: 'inactive', addEventListener: () => ({ remove() {} }) },
 BackHandler: { addEventListener: () => ({ remove() {} }) }, Linking: { openSettings: vi.fn() },
}));
vi.mock('./source', () => ({ readToday: vi.fn(), watchSteps: () => () => {}, requestStepsPermission: vi.fn() }));
import { readToday } from './source';
import { StepsScreen } from './StepsScreen';
import type { StepsState } from './stages';
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
const sample: StepsState = { ok: true, day: '2026-10-20', today_steps: 3450, daily_max: 25, earned_today: 10, stages: [1000, 2000, 3000, 4000, 5000].map((threshold, i) => ({ stage_id: String(i), threshold, points: 5, claimed: i < 2, available: true, ad_purpose: 'steps_' + i })) };
async function screen(options: any = {}) {
 const api = { fetchStages: vi.fn(async () => options.state ?? sample), sync: vi.fn(async () => ({})), claimStage: vi.fn(async () => ({ ...sample, gained: 5, balance: 15 })) };
 const props = { api, showRewardedAd: vi.fn(async () => ({ earned: true })), onBalance: vi.fn(), onPendingClaim: vi.fn(), onClose: vi.fn(), memberId: '1', ...options };
 let root: any; await act(async () => { root = create(React.createElement(StepsScreen, props)); });
 const text = () => root.root.findAllByType('Text').map((n: any) => n.children.filter((c: any) => typeof c === 'string').join('')).join(' ');
 const press = async () => { const button = root.root.findAllByType('Pressable').find((n: any) => n.props.accessibilityRole === 'button' && n.props.disabled !== undefined); await act(async () => { button.props.onPress(); }); };
 return { root, props, text, press };
}
beforeEach(() => { vi.mocked(readToday).mockResolvedValue({ status: 'ready', steps: 3450, days: [], sensorOnly: false }); });
const yesterdayState: StepsState = { ok: true, day: '2026-10-19', today_steps: 2400, daily_max: 250, earned_today: 5, stages: [1000, 2000, 3000].map((threshold, i) => ({ stage_id: 'stage_' + (i + 1), threshold, points: 5, claimed: i === 0, available: true, ad_purpose: 'steps_stage:2026-10-19:stage_' + (i + 1) })) };
const withYesterday = (state: StepsState | (() => Promise<StepsState>) = yesterdayState) => ({ fetchStages: vi.fn(async () => sample), fetchStagesOn: vi.fn(typeof state === 'function' ? state : async () => state), sync: vi.fn(async () => ({})), claimStage: vi.fn(async (_id: string, day: string) => ({ ...(day === yesterdayState.day ? yesterdayState : sample), gained: 5, balance: 40 })) });
// 큰 글씨(접근성 2.0) — 글자 상자에 고정 height · 한 줄 제한이 없다(0.3.1, 앱보조6 지적)
const flat = (style: any): Record<string, any> => (Array.isArray(style) ? style.reduce((all, one) => ({ ...all, ...flat(one) }), {}) : typeof style === 'function' ? flat(style({ pressed: false })) : style ?? {});
describe('large text safety', () => {
 beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T07:00:00Z')); });
 afterEach(() => { vi.useRealTimers(); });
 it('the yesterday card button grows with the text: minHeight, no fixed height, no one-line limit', async () => {
  const s = await screen({ api: withYesterday() });
  const button = s.root.root.findAllByType('Pressable').find((n: any) => String(n.props.accessibilityLabel ?? '').startsWith('어제 걸음'));
  const style = flat(button.props.style);
  expect(style.height).toBeUndefined(); expect(style.minHeight).toBeGreaterThanOrEqual(48); expect(style.paddingVertical).toBeGreaterThan(0);
  const label = button.findAllByType('Text')[0];
  expect(label.props.numberOfLines).toBeUndefined(); expect(flat(label.props.style).textAlign).toBe('center');
  await act(async () => s.root.unmount());
 });
 it('the shared screen claim button and notice buttons also use minHeight and wrap', async () => {
  const s = await screen({});
  const buttons = s.root.root.findAllByType('Pressable').filter((n: any) => n.props.accessibilityRole === 'button' && String(n.props.accessibilityLabel ?? '').includes('광고 보고'));
  expect(buttons.length).toBeGreaterThan(0);
  for (const b of buttons) { const st = flat(b.props.style); expect(st.height).toBeUndefined(); expect(st.minHeight).toBeGreaterThanOrEqual(48); for (const t of b.findAllByType('Text')) expect(t.props.numberOfLines).toBeUndefined(); }
  await act(async () => s.root.unmount());
 });
});
describe('StepsScreen yesterday card', () => {
 beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-20T07:00:00Z')); });
 afterEach(() => { vi.useRealTimers(); });
 it('asks the server for yesterday and shows the card under today with what is left', async () => {
  const api = withYesterday(); const s = await screen({ api });
  expect(api.fetchStagesOn).toHaveBeenCalledWith('2026-10-19');
  expect(s.text()).toContain('어제 받은 포인트 5P'); expect(s.text()).toContain('2,400'); expect(s.text()).toMatch(/남은 횟수\s+1번 오늘 자정\(한국 시간\)까지 받을 수 있어요 · 어제 받은 포인트 5P/);
  expect(s.text().indexOf('어제 받은 포인트')).toBeGreaterThan(s.text().indexOf('오늘 받은 포인트')); // below today's card
  await act(async () => s.root.unmount());
 });
 it('claims yesterday with the server ad purpose and yesterday\'s date, not today\'s', async () => {
  const api = withYesterday(); const showRewardedAd = vi.fn(async () => ({ earned: true })); const s = await screen({ api, showRewardedAd });
  const yesterdayButton = s.root.root.findAllByType('Pressable').find((n: any) => String(n.props.accessibilityLabel ?? '').startsWith('어제 걸음'));
  await act(async () => { yesterdayButton.props.onPress(); });
  expect(showRewardedAd).toHaveBeenCalledWith('steps_stage:2026-10-19:stage_2');
  expect(api.claimStage).toHaveBeenCalledWith('stage_2', '2026-10-19', true);
  await act(async () => s.root.unmount());
 });
 it('hides when yesterday has nothing left, when the server answers with another day, or when the api has no yesterday support', async () => {
  const none = await screen({ api: withYesterday({ ...yesterdayState, today_steps: 0 }) }); expect(none.text()).not.toContain('어제 받은 포인트'); await act(async () => none.root.unmount());
  const wrong = await screen({ api: withYesterday({ ...yesterdayState, day: '2026-10-20' }) }); expect(wrong.text()).not.toContain('어제 받은 포인트'); await act(async () => wrong.root.unmount());
  const off = await screen({}); expect(off.text()).not.toContain('어제 받은 포인트'); await act(async () => off.root.unmount());
 });
 it('a failing yesterday request never breaks today (no card, today still claimable)', async () => {
  const api = withYesterday(async () => { throw new Error('offline'); }); const s = await screen({ api });
  expect(s.text()).not.toContain('어제 받은 포인트'); expect(s.text()).toContain('포인트를 1번 받을 수 있어요');
  await act(async () => s.root.unmount());
 });
 it('claiming yesterday does not need the step sensor (the server already has those steps)', async () => {
  vi.mocked(readToday).mockResolvedValue({ status: 'denied', steps: null, days: [], sensorOnly: false });
  const api = withYesterday(); const s = await screen({ api });
  const yesterdayButton = s.root.root.findAllByType('Pressable').find((n: any) => String(n.props.accessibilityLabel ?? '').startsWith('어제 걸음'));
  await act(async () => { yesterdayButton.props.onPress(); });
  expect(api.claimStage).toHaveBeenCalledWith('stage_2', '2026-10-19', true);
  await act(async () => s.root.unmount());
 });
});
describe('StepsScreen', () => {
 it('calculates remaining stage and claim button after two claims', async () => { const s = await screen(); expect(s.text()).toContain('포인트를 1번 받을 수 있어요'); expect(s.text()).toContain('3,450'); expect(s.text()).toContain('남은 횟수'); expect(s.text()).toContain('1번'); expect(s.text()).not.toContain('👟'); expect(s.text()).toContain('꿀꿀캐시 만보기는'); await act(async () => s.root.unmount()); });
 it('claims only after earned and refreshes balance', async () => { const s = await screen(); await s.press(); expect(s.props.api.claimStage).toHaveBeenCalledWith('2', sample.day, true); expect(s.props.onBalance).toHaveBeenCalled(); expect(s.text()).toContain('5P 받았어요'); await act(async () => s.root.unmount()); });
 it('holds opened ads with an unconfirmed reward', async () => { const s = await screen({ showRewardedAd: vi.fn(async () => ({ earned: false, opened: true })) }); await s.press(); expect(s.props.api.claimStage).not.toHaveBeenCalled(); expect(s.props.onPendingClaim).toHaveBeenCalledWith(expect.objectContaining({ stage_id: '2', earned: false })); expect(s.text()).toContain('광고 확인을 기다리고 있어요'); await act(async () => s.root.unmount()); });
 it('shows ad failure copy', async () => { const s = await screen({ showRewardedAd: async () => ({ earned: false, message: '광고를 불러오지 못했어요' }) }); await s.press(); expect(s.text()).toContain('광고를 불러오지 못했어요'); await act(async () => s.root.unmount()); });
 it('shows read failures', async () => { const s = await screen({ api: { fetchStages: async () => { throw Error('offline'); } } }); expect(s.text()).toContain('걸음 수를 읽지 못했어요. 다시 시도해 주세요.'); await act(async () => s.root.unmount()); });
 it('preserves server failure copy', async () => { const s = await screen({ api: { fetchStages: async () => { throw { code: 'daily_max' }; } } }); expect(s.text()).toContain('오늘은 여기까지예요. 내일 다시 만나요'); await act(async () => s.root.unmount()); });
 it('disables claim at zero steps', async () => { const s = await screen({ state: { ...sample, today_steps: 0, earned_today: 0, stages: sample.stages.map(s => ({ ...s, claimed: false })) } }); expect(s.text()).toContain('1,000걸음 더 걸으면 5P'); await s.press(); expect(s.props.showRewardedAd).not.toHaveBeenCalled(); await act(async () => s.root.unmount()); });
 it('disables claim and offers settings without permission', async () => { vi.mocked(readToday).mockResolvedValue({ status: 'denied', steps: null, days: [], sensorOnly: false }); const s = await screen(); expect(s.text()).toContain('걸음 수 권한이 꺼져 있어요'); await s.press(); expect(s.props.showRewardedAd).not.toHaveBeenCalled(); await act(async () => s.root.unmount()); });
});
