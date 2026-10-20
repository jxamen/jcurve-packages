import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 훅과 애니메이션을 흉내 낸다(FloatingRewardChip.test 와 같은 방식) — 칩의 위아래 움직임이 켜지고 꺼지는 조건을 본다
const h = vi.hoisted(() => ({ effects: [] as (() => any)[], reduced: true, start: vi.fn(), stop: vi.fn(), remove: vi.fn(), set: vi.fn(), listener: null as any, back: null as any }));
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useRef: (v: any) => ({ current: v }), useState: () => [h.reduced, vi.fn()], useEffect: (fn: any) => h.effects.push(fn) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', Modal: 'Modal', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: (_: string, fn: any) => { h.back = fn; return { remove: h.remove }; } },
  Dimensions: { get: () => ({ width: 360, height: 800 }) }, Platform: { OS: 'android' }, StatusBar: { currentHeight: 24 },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(true), addEventListener: (_: any, fn: any) => { h.listener = fn; return { remove: h.remove }; } },
  Easing: { inOut: (v: any) => v, sin: 'sin' },
  Animated: { View: 'AnimatedView', Value: class { setValue = h.set; }, timing: vi.fn(), sequence: vi.fn(), loop: () => ({ start: h.start, stop: h.stop }) },
}));
beforeEach(() => { vi.clearAllMocks(); h.effects = []; h.reduced = true; h.back = null; });
import { GoldenLotteryPopup, LotteryChip, LotteryResult, LotterySheet, sheetMaxHeight } from './LotteryUi';
import { parseLotteryState, type LotteryTier, type LotteryWinner } from './lottery';

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const buttons = (tree: any[]) => tree.filter(n => n?.type === 'Pressable' && n.props?.accessibilityRole === 'button');
const text = (tree: any[]) => tree.filter(x => typeof x === 'string').join('|');
const tier = (over: Partial<LotteryTier>): LotteryTier => ({ tier: 1, missions: 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null, unit: 'won', ...over });
const state = (tiers: Partial<LotteryTier>[], unopened = 0) => parseLotteryState({ ok: true, day: 'd', wonToPoint: 160, participated: 0, unopened, tiers: tiers.map((t, i) => tier({ tier: i + 1, ...t })) })!;

describe('LotteryChip', () => {
  it('안 연 복권이 있을 때만 그리고, 누르면 열고, 다 열면 사라진다', () => {
    expect(LotteryChip({ count: 0, onPress: vi.fn() })).toBeNull();
    const onPress = vi.fn();
    const tree = nodes(LotteryChip({ count: 2, onPress }));
    expect(text(tree)).toContain('복권 2장');
    buttons(tree)[0].props.onPress();
    expect(onPress).toHaveBeenCalledOnce();
    expect(buttons(tree)[0].props.accessibilityLabel).toBe('복권 2장');
  });
  it('기본은 띠 없이 떠 있는 흰 알약(아래에서 bottomOffset 만큼) — 안쪽에 Pressable 이 겹치지 않는다', () => {
    const tree = nodes(LotteryChip({ count: 1, onPress: vi.fn(), bottomOffset: 84 }));
    const anchor = tree.find(n => n?.type === 'View' && n.props?.pointerEvents === 'box-none')!;
    expect(anchor.props.style[0]).toMatchObject({ position: 'absolute', alignItems: 'center' });
    expect(anchor.props.style[1]).toEqual({ bottom: 84 });
    const pill = buttons(tree)[0];
    expect(pill.props.style({ pressed: false })[0]).toMatchObject({ backgroundColor: '#FFFFFF', borderRadius: 999, elevation: 6 });
    expect(nodes(pill.props.children).filter(n => n?.type === 'Pressable')).toHaveLength(0);
    expect(buttons(nodes(LotteryChip({ count: 1, onPress: vi.fn() })))).toHaveLength(1);
    expect(nodes(LotteryChip({ count: 1, onPress: vi.fn() })).find(n => n?.type === 'View' && n.props?.pointerEvents === 'box-none')!.props.style[1]).toEqual({ bottom: 16 });
  });
  it('떠 있는 칩은 위아래로 움직이고(동작 줄이기가 꺼졌을 때만), 꺼지면 멈추고 제자리로 돌아온다', () => {
    h.reduced = false;
    LotteryChip({ count: 2, onPress: vi.fn() });
    const cleanup = h.effects[1]();
    expect(h.start).toHaveBeenCalledOnce();
    cleanup();
    expect(h.stop).toHaveBeenCalledOnce();
    expect(h.set).toHaveBeenLastCalledWith(0);
    const sub = h.effects[0]();                                  // 접근성 설정 구독은 끝나면 끊긴다
    expect(h.listener).toBeTypeOf('function');
    sub();
    expect(h.remove).toHaveBeenCalledOnce();
  });
  it('동작 줄이기가 켜져 있거나 · 복권이 없거나 · inline 모양이면 움직이지 않는다', () => {
    h.reduced = true;
    LotteryChip({ count: 2, onPress: vi.fn() });
    h.effects[1]();
    expect(h.start).not.toHaveBeenCalled();
    h.effects = []; h.reduced = false;
    LotteryChip({ count: 0, onPress: vi.fn() });
    h.effects[1]();
    expect(h.start).not.toHaveBeenCalled();
    h.effects = [];
    LotteryChip({ count: 2, onPress: vi.fn(), floating: false });
    h.effects[1]();
    expect(h.start).not.toHaveBeenCalled();
  });
  it('움직이는 칸(Animated.View) 안에 단추 하나 — 겹친 Pressable 이 없다', () => {
    const tree = nodes(LotteryChip({ count: 1, onPress: vi.fn() }));
    expect(tree.some(n => n?.type === 'AnimatedView')).toBe(true);
    expect(buttons(tree)).toHaveLength(1);
  });
  it('floating={false} 면 줄 안에 놓는 작은 색 알약', () => {
    const tree = nodes(LotteryChip({ count: 3, onPress: vi.fn(), floating: false, label: '복권 3장' }));
    expect(tree.some(n => n?.type === 'View' && n.props?.pointerEvents === 'box-none')).toBe(false);
    expect(buttons(tree)[0].props.style({ pressed: false })[0]).toMatchObject({ paddingHorizontal: 12, borderRadius: 16 });
  });
});

const flat = (style: any): Record<string, any> => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style ?? {});
const find = (tree: any[], pred: (n: any) => boolean) => tree.find(pred);
const idx = (tree: any[], pred: (n: any) => boolean) => tree.findIndex(pred);
const winner = (over: Partial<LotteryWinner> = {}): LotteryWinner => ({ nick: 'Noe****', tierMax: 100, won: 100, unit: 'won', ...over });

describe('LotterySheet — 바텀 시트(참고 캡처 구성)', () => {
  const missionsState = (unit: 'won' | 'points' = 'won') => state([
    { missions: 1, state: 'ready', missionState: 'ready', unopened: 1, tickets: 1, unit, maxWon: unit === 'points' ? 625 : 100, maxPoints: unit === 'points' ? 1000 : 160 },
    { missions: 5, missionState: 'locked', missionsLeft: 3, unit, maxWon: unit === 'points' ? 625 : 500, maxPoints: unit === 'points' ? 1000 : 800 },
    { missions: 10, state: 'opened', missionState: 'opened', tickets: 1, basic: 1, basicUnopened: 1, unopened: 1, unit, maxWon: unit === 'points' ? 625 : 1000, maxPoints: unit === 'points' ? 1000 : 1600 },
  ], 2);
  const sheet = (over: Record<string, unknown> = {}) => nodes(LotterySheet({ open: true, state: missionsState(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), ...over } as any));
  const rowBtn = (tree: any[], title: string) => buttons(tree).find(b => String(b.props.accessibilityLabel).startsWith(title));

  it('닫혀 있거나 상태가 없으면 아무것도 그리지 않는다', () => {
    expect(LotterySheet({ open: false, state: missionsState(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
    expect(LotterySheet({ open: true, state: null, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
  });

  it('위에서 아래로: 딤 → 손잡이 → X → 큰 제목 → 회색 한 줄 → 줄들 → 큰 버튼 → 알림 링크', () => {
    const tree = sheet({ winners: [winner()], notify: { visible: true, onPress: vi.fn() } });
    const dim = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)');
    const handle = idx(tree, n => n?.type === 'View' && flat(n.props.style).width === 44 && flat(n.props.style).height === 5);
    const x = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기' && n.props?.hitSlop === 12);
    const title = idx(tree, n => n?.type === 'Text' && n.props?.accessibilityRole === 'header');
    const sub = idx(tree, n => n === '받은 복권은 매일 자정에 사라져요');
    const row = idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('최대 100원 복권'));
    const big = idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('한 번 더!'));
    const link = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기');
    const order = [dim, handle, x, title, sub, row, big, link];
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(text(tree)).toContain('꽝 없는 복권\n지금 열고 행운 받아가요!');
  });

  it('딤을 누르면 · X 를 누르면 닫힌다 · 둥근 위 모서리 흰 판 · 아래 안전 영역(bottomInset)을 더한다 · 위 안전 영역 아래에서 끝난다', () => {
    const onClose = vi.fn();
    const tree = sheet({ onClose, bottomInset: 20, topInset: 40 });
    const closes = tree.filter(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기');
    expect(closes).toHaveLength(2);                                     // 딤 + X
    closes.forEach(c => c.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(2);
    const box = find(tree, n => n?.type === 'View' && flat(n.props.style).borderTopLeftRadius === 28)!;
    const st = flat(box.props.style);
    expect(st.paddingBottom).toBe(24 + 20);
    expect(st.paddingHorizontal).toBe(24);
    expect(st.maxHeight).toBe(sheetMaxHeight(800, 40));
    expect(sheetMaxHeight(800, 40)).toBe(736);
    expect(sheetMaxHeight(300, 200)).toBe(240);
    const overlay = find(tree, n => n?.type === 'View' && flat(n.props.style).zIndex === 60)!;
    expect(flat(overlay.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0 });   // 부모(앱 루트) 전체를 덮는다
    expect(find(sheet({ presentation: 'modal' }), n => n?.type === 'Modal')).toBeTruthy();   // presentation="modal" 이면 RN Modal
  });

  it('Android 뒤로 가기는 닫기 — 열려 있는 동안만 구독하고 끝나면 푼다', () => {
    const onClose = vi.fn();
    sheet({ onClose });
    const cleanup = h.effects[h.effects.length - 1]();
    expect(h.back()).toBe(true);
    expect(onClose).toHaveBeenCalledOnce();
    cleanup();
    expect(h.remove).toHaveBeenCalled();
  });

  it('줄: 숫자 카드(1 · 5 · 10 · 황금 ★) · 「최대 ○ 복권」 굵게 · 회색 설명 · 오른쪽 열기/받기/받기 완료', () => {
    const tree = sheet();
    expect(text(tree)).toContain('최대 100원 복권');
    expect(text(tree)).toContain('최대 500원 복권');
    expect(text(tree)).toContain('최대 1000원 복권'.replace('1000', '1,000'));
    const cards = tree.filter(n => n?.type === 'Text' && n.props?.adjustsFontSizeToFit).map(n => n.props.children);
    expect(cards).toEqual(['1', '5', '10', '★']);
    const colors = tree.filter(n => n?.type === 'View' && flat(n.props.style).borderRadius === 12 && flat(n.props.style).width === 44).map(n => flat(n.props.style).backgroundColor);
    expect(new Set(colors).size).toBe(4);                                       // 색이 다 다르다
    expect(text(tree)).toContain('쇼핑 · 플레이스 미션 1개로 받았어요');
    expect(text(tree)).toContain('미션 3개 더 하면 받아요');
  });

  it('미션 줄: ready → 열기(onOpen(tier, mission)) · locked → 받기(onEarn) · opened → 받기 완료(눌리지 않음) · capped → 내일 받아요', () => {
    const onOpen = vi.fn(); const onEarn = vi.fn();
    const st = state([{ missionState: 'ready', unopened: 1 }, { missionState: 'locked' }, { missionState: 'opened' }, { missionState: 'capped' }], 1);
    const tree = nodes(LotterySheet({ open: true, state: st, winners: [], onOpen, onEarn, onClose: vi.fn() }));
    const rows = buttons(tree).filter(b => String(b.props.accessibilityLabel).startsWith('최대 100원 복권'));
    expect(rows.map(r => String(r.props.accessibilityLabel).split(', ')[1])).toEqual(['열기', '받기', '받기 완료', '내일 받아요']);
    rows[0].props.onPress(); rows[1].props.onPress(); rows[2].props.onPress(); rows[3].props.onPress();
    expect(onOpen).toHaveBeenCalledOnce();
    expect(onOpen).toHaveBeenCalledWith(1, 'mission');
    expect(onEarn).toHaveBeenCalledOnce();
    expect(onEarn).toHaveBeenCalledWith(2);
    expect(rows[2].props.disabled).toBe(true);
    expect(rows[3].props.disabled).toBe(true);
  });

  it('황금 줄: 기본 복권이 있을 때만 · 안 열었으면 열기(+광고 칩, onOpen(tier, basic)) · 열었으면 받기 완료 · basicAd=false 면 칩 없음', () => {
    const onOpen = vi.fn();
    const tree = sheet({ onOpen });
    const gold = rowBtn(tree, '최대 1,000원 복권, 열기')!;
    expect(gold).toBeTruthy();
    expect(String(gold.props.accessibilityLabel)).toBe('최대 1,000원 복권, 열기, 광고');
    expect(nodes(gold.props.children).some(n => n?.type === 'Text' && n.props?.children === '광고')).toBe(true);
    gold.props.onPress();
    expect(onOpen).toHaveBeenCalledWith(3, 'basic');
    const noAd = sheet({ basicAd: false });
    expect(nodes(rowBtn(noAd, '최대 1,000원 복권, 열기')!.props.children).some(n => n?.type === 'Text' && n.props?.children === '광고')).toBe(false);
    // 황금을 이미 열었으면 받기 완료
    const opened = state([{ missionState: 'locked' }, { missionState: 'opened', basic: 1, basicUnopened: 0, maxWon: 1000 }], 0);
    const t2 = nodes(LotterySheet({ open: true, state: opened, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(buttons(t2).some(b => String(b.props.accessibilityLabel) === '최대 1,000원 복권, 받기 완료')).toBe(true);
    // 기본 복권이 없으면 황금 줄이 없다
    const none = nodes(LotterySheet({ open: true, state: state([{ missionState: 'locked' }], 0), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(tree.filter(n => n?.props?.adjustsFontSizeToFit).length - none.filter(n => n?.props?.adjustsFontSizeToFit).length).toBeGreaterThan(0);
    expect(none.some(n => n?.props?.children === '★')).toBe(false);
  });

  it('포인트 표(unit:points): 「최대 1,000P 복권」 — 원 표시가 없다', () => {
    const tree = nodes(LotterySheet({ open: true, state: missionsState('points'), winners: [winner({ unit: 'points', points: 1000, tierMaxPoints: 1000 })], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    const t = text(tree);
    expect(t).toContain('최대 1,000P 복권');
    expect(t).not.toContain('원 복권');
    expect(buttons(tree).some(b => String(b.props.accessibilityLabel).startsWith('한 번 더! 최대 1,000P 복권 받기'))).toBe(true);
    const pill = tree.find(n => n?.type === 'Text' && n.props?.numberOfLines === 1)!;
    const kids = nodes(pill.props.children);
    expect(kids).toContain('1,000P');
    const plain = kids.filter(x => typeof x === 'string').join('');
    expect(plain).toBe('Noe****님이 1,000P 당첨됐어요!');
  });

  it('당첨 띠는 서버 winners 에 실제 기록이 있을 때만 — 없으면 숨긴다(가짜 이름 없음) · 원 표는 예전 문구', () => {
    expect(text(sheet({ winners: [] }))).not.toContain('님이');
    expect(text(sheet({ winners: undefined }))).not.toContain('님이');
    const tree = sheet({ winners: [winner({ nick: 'Kim****', tierMax: 500 })] });
    const pill = tree.find(n => n?.type === 'Text' && n.props?.numberOfLines === 1)!;
    const joined = nodes(pill.props.children).filter(x => typeof x === 'string').join('');
    expect(joined).toBe('Kim****님이 500원 복권에 당첨됐어요!');
  });

  it('맨 아래 큰 「한 번 더! ○ 복권 받기」 — 원 표는 500원 복권, 누르면 onMore(다음 단계) · 없으면 onEarn · 다 받았으면 버튼 없음', () => {
    const onMore = vi.fn(); const onEarn = vi.fn();
    const big = buttons(sheet({ onMore, onEarn })).find(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))!;
    expect(big.props.accessibilityLabel).toBe('한 번 더! 500원 복권 받기');
    big.props.onPress();
    expect(onMore).toHaveBeenCalledWith(2);
    buttons(sheet({ onEarn })).find(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))!.props.onPress();
    expect(onEarn).toHaveBeenCalledWith(2);
    const all = nodes(LotterySheet({ open: true, state: state([{ missionState: 'opened' }], 0), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(buttons(all).some(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))).toBe(false);
  });

  it('열기가 진행 중(busy)이면 줄이 눌리지 않는다', () => {
    const tree = sheet({ busy: true });
    const gold = rowBtn(tree, '최대 1,000원 복권, 열기')!;
    expect(gold.props.disabled).toBe(true);
    expect(rowBtn(tree, '최대 100원 복권, 열기')!.props.disabled).toBe(true);
  });

  it('긴 내용은 시트 안에서 스크롤하고 네이티브 광고 자리는 맨 아래에 둔다', () => {
    const tree = sheet({ renderNative: () => React.createElement('NativeAd') });
    const scroll = find(tree, n => n?.type === 'ScrollView')!;
    expect(nodes(scroll.props.children).some(n => n?.type === 'NativeAd')).toBe(true);
    const lastBtn = idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('한 번 더!'));
    expect(lastBtn).toBeLessThan(idx(tree, n => n?.type === 'NativeAd'));
  });
});

describe('LotteryResult — 당첨 전체 화면', () => {
  const full = (over: Record<string, unknown> = {}) => nodes(LotteryResult({ result: { won: 100, points: 5, unopened: 0, unit: 'points' }, onClose: vi.fn(), ...over } as any));

  it('큰 「5P 당첨!」 · X · 부모 전체(상태줄 · 탭 메뉴)를 덮는 판 — 안전 영역을 더한다', () => {
    const tree = full({ topInset: 47, bottomInset: 34 });
    expect(text(tree)).toContain('5P 당첨!');
    expect(text(tree)).toContain('축하해요!');
    const head = find(tree, n => n?.type === 'Text' && n.props?.accessibilityRole === 'header')!;
    expect(flat(head.props.style).fontSize).toBeGreaterThanOrEqual(44);
    const panel = find(tree, n => n?.type === 'View' && flat(n.props.style).paddingHorizontal === 24 && flat(n.props.style).top === 0)!;
    expect(flat(panel.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, paddingTop: 47 + 8, paddingBottom: 34 + 20 });
    const overlay = find(tree, n => n?.type === 'View' && flat(n.props.style).zIndex === 60)!;
    expect(flat(overlay.props.style).position).toBe('absolute');
    expect(find(full({ presentation: 'modal' }), n => n?.type === 'Modal')).toBeTruthy();
    expect(text(nodes(LotteryResult({ result: { won: 100, points: 5, unopened: 0 }, onClose: vi.fn(), open: false })))).not.toContain('5P 당첨!');
  });

  it('X 와 「확인」은 닫는다 · 포인트 표는 원 표시가 없고 원 표는 「○원 복권」 한 줄', () => {
    const onClose = vi.fn();
    const tree = full({ onClose });
    buttons(tree).find(b => b.props.accessibilityLabel === '닫기')!.props.onPress();
    buttons(tree).find(b => b.props.accessibilityLabel === '확인')!.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(text(tree)).not.toContain('원 복권');
    const won = full({ result: { won: 100, points: 160, unopened: 0 } });
    expect(text(won)).toContain('160P 당첨!');
    expect(text(won)).toContain('100원 복권');
  });

  it('남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」(+nextAd 일 때만 광고 칩) · 없으면 「한 번 더! ○ 복권 받기」 · 둘 다 아래에 「확인」', () => {
    const onOpenNext = vi.fn(); const onMore = vi.fn();
    const withNext = full({ result: { won: 100, points: 5, unopened: 2, unit: 'points' }, onOpenNext, nextAd: true });
    const next = buttons(withNext).find(b => b.props.accessibilityLabel === '다음 복권 열기')!;
    expect(nodes(next.props.children).filter(x => typeof x === 'string' || typeof x === 'number').join('')).toContain('다음 복권 열기 (2장 남았어요)');
    expect(nodes(next.props.children).some(n => n?.type === 'Text' && n.props?.children === '광고')).toBe(true);
    next.props.onPress();
    expect(onOpenNext).toHaveBeenCalledOnce();
    expect(nodes(buttons(full({ result: { won: 100, points: 5, unopened: 2 }, onOpenNext })).find(b => b.props.accessibilityLabel === '다음 복권 열기')!.props.children).some(n => n?.props?.children === '광고')).toBe(false);
    const st = state([{ missionState: 'opened', unit: 'points', maxPoints: 1000, maxWon: 625 }, { missionState: 'locked', missions: 5, unit: 'points', maxPoints: 1000, maxWon: 625 }], 0);
    const more = full({ state: st, onMore });
    const moreBtn = buttons(more).find(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))!;
    expect(moreBtn.props.accessibilityLabel).toBe('한 번 더! 최대 1,000P 복권 받기');
    moreBtn.props.onPress();
    expect(onMore).toHaveBeenCalledOnce();
    const order = (tree: any[]) => [idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('한 번 더!')), idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '확인')];
    const [a, b] = order(more);
    expect(a).toBeLessThan(b);
  });

  it('알림 링크와 네이티브 광고는 버튼 아래에 — 알림이 켜져 있으면 링크가 없다', () => {
    const tree = full({ notify: { visible: true, onPress: vi.fn() }, renderNative: () => React.createElement('NativeAd') });
    const ok = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '확인');
    const link = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기');
    const ad = idx(tree, n => n?.type === 'NativeAd');
    expect(ok).toBeLessThan(link);
    expect(link).toBeLessThan(ad);
    expect(buttons(full({ notify: { visible: false, onPress: vi.fn() } })).some(b => b.props.accessibilityLabel === '복권 받게 알림 켜기')).toBe(false);
    expect(full({ icon: React.createElement('Art') }).some(n => n?.type === 'Art')).toBe(true);
  });
});

describe('GoldenLotteryPopup — 바텀 시트', () => {
  const golden = (over: Record<string, unknown> = {}) => nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, maxPoints: 1600, onOpen: vi.fn(), onClose: vi.fn(), ...over } as any));

  it('닫혀 있으면 null · 「광고 보고 황금 복권 열기」 · busy 동안은 눌리지 않는다', () => {
    expect(GoldenLotteryPopup({ open: false, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() })).toBeNull();
    const onOpen = vi.fn();
    const tree = nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, onOpen, onClose: vi.fn(), icon: React.createElement('Gold') }));
    expect(text(tree)).toContain('황금 복권이 나타났어요!');
    expect(tree.some(n => n?.type === 'Gold')).toBe(true);
    const b = buttons(tree).find(x => x.props.accessibilityLabel === '광고 보고 황금 복권 열기')!;
    b.props.onPress();
    expect(onOpen).toHaveBeenCalledOnce();
    const busy = buttons(golden({ busy: true })).find(x => x.props.accessibilityLabel === '광고 보고 황금 복권 열기')!;
    expect(busy.props.disabled).toBe(true);
  });

  it('딤 · 손잡이 · X 가 있는 바텀 시트 — 딤과 X 와 「다음에 열기」 모두 닫는다', () => {
    const onClose = vi.fn();
    const tree = golden({ onClose });
    expect(idx(tree, n => n?.type === 'View' && flat(n.props.style).width === 44 && flat(n.props.style).height === 5)).toBeGreaterThanOrEqual(0);
    const closers = tree.filter(n => n?.type === 'Pressable' && (n.props?.accessibilityLabel === '닫기' || n.props?.accessibilityLabel === '다음에 열기'));
    expect(closers).toHaveLength(3);
    closers.forEach(c => c.props.onPress());
    expect(onClose).toHaveBeenCalledTimes(3);
  });

  it('쉬운 말 3줄 + 작은 글씨 — 값은 서버 state 에서 · 포인트 표는 「최대 1,000P가 바로 들어와요」(원 병기 없음)', () => {
    const t = text(golden());
    expect(t).toContain('하루에 한 장, 무료로 드려요');
    expect(t).toContain('광고 1번 보면 바로 열 수 있어요');
    expect(t).toContain('최대 1,000원(1,600P)이 포인트로 바로 들어와요');
    expect(t).toContain('오늘 자정까지 열 수 있어요');
    const pts = text(golden({ maxWon: 625, maxPoints: 1000, unit: 'points' }));
    expect(pts).toContain('최대 1,000P가 바로 들어와요');
    expect(pts).not.toContain('625');
    expect(pts).not.toContain('원');
    expect(text(golden({ maxPoints: undefined }))).toContain('최대 1,000원이 포인트로 바로 들어와요');
  });

  it('그림 → 제목 → 설명 → 작은 글씨 → 버튼(광고 칩) → 「다음에 열기」 → 알림 링크 순서 · 여백', () => {
    const tree = golden({ bottomInset: 20, notify: { visible: true, onPress: vi.fn() } });
    const art = idx(tree, n => n?.type === 'Text' && n.props?.children === '★');
    const title = idx(tree, n => n?.type === 'Text' && n.props?.accessibilityRole === 'header');
    const cta = idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('광고 보고 황금 복권 열기'));
    const later = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '다음에 열기');
    const link = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기');
    expect([art, title, cta, later, link].every(i => i >= 0)).toBe(true);
    expect([art, title, cta, later, link]).toEqual([art, title, cta, later, link].slice().sort((a, b) => a - b));
    const box = find(tree, n => n?.type === 'View' && flat(n.props.style).borderTopLeftRadius === 28)!;
    expect(flat(box.props.style).paddingHorizontal).toBeGreaterThanOrEqual(24);
    expect(flat(box.props.style).paddingBottom).toBeGreaterThanOrEqual(24 + 20);
    expect(flat(tree[title].props.style).marginTop).toBeGreaterThanOrEqual(16);
    const lines = find(tree, n => n?.type === 'View' && flat(n.props.style).gap === 8)!;
    expect(flat(lines.props.style).marginTop).toBeGreaterThanOrEqual(16);
    const line = find(tree, n => n?.type === 'Text' && n.props?.children === '하루에 한 장, 무료로 드려요')!;
    expect(flat(line.props.style).lineHeight).toBeGreaterThanOrEqual(24);
  });

  it('버튼 안 오른쪽에 「광고」 칩 — ad:false 면 칩 · 광고 문구가 없다 · 문구 · 그림 바꾸기', () => {
    const btn = buttons(golden()).find(x => String(x.props.accessibilityLabel).startsWith('광고 보고 황금 복권 열기'))!;
    expect(btn.props.accessibilityLabel).toBe('광고 보고 황금 복권 열기');
    const kids = nodes(btn.props.children);
    expect(kids.findIndex(n => n?.type === 'Text' && n.props?.children === '광고')).toBeGreaterThan(kids.findIndex(n => n === '광고 보고 황금 복권 열기'));
    expect(flat(btn.props.style).flexDirection).toBe('row');
    const noAd = golden({ ad: false });
    expect(text(noAd)).not.toContain('광고');
    expect(buttons(noAd).some(x => x.props.accessibilityLabel === '황금 복권 열기')).toBe(true);
    const custom = golden({ icon: React.createElement('AppGold'), lines: ['a', 'b', 'c'], note: 'n', closeLabel: 'Later', buttonLabel: 'Open' });
    expect(custom.some(n => n?.type === 'AppGold')).toBe(true);
    expect(text(custom)).toContain('a|b|c');
    expect(buttons(custom).some(x => x.props.accessibilityLabel === 'Later')).toBe(true);
  });
});

describe('🔔 복권 받게 알림 켜기 링크 — 알림이 꺼져 있을 때만', () => {
  const notify = (visible: boolean, over: Record<string, unknown> = {}) => ({ visible, busy: false, onPress: vi.fn(), ...over });
  const link = (tree: any[], label = '복권 받게 알림 켜기') => buttons(tree).find(b => b.props.accessibilityLabel === label);
  const st = state([{ missionState: 'ready', unopened: 1, tickets: 1 }], 1);

  it('시트 · 황금 팝업 · 결과 화면 모두: visible 일 때만 보이고 누르면 onPress', () => {
    const p = vi.fn();
    const make = {
      sheet: (n: any) => nodes(LotterySheet({ open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify: n })),
      golden: (n: any) => nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn(), notify: n })),
      result: (n: any) => nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: n })),
    };
    for (const [name, fn] of Object.entries(make)) {
      expect(link(fn(undefined)), name + ' 없음').toBeUndefined();
      expect(link(fn(notify(false))), name + ' 이미 켜져 있음').toBeUndefined();
      const shown = fn(notify(true, { onPress: p }));
      expect(link(shown), name).toBeTruthy();
      expect(text(shown)).toContain('매일 새 복권이 나오면 알려 드릴게요');
      expect(shown.some(n => n?.type === 'Text' && n.props?.children === '›')).toBe(true);        // 글자 링크 모양(오른쪽 화살표)
      link(shown)!.props.onPress();
    }
    expect(p).toHaveBeenCalledTimes(3);
  });
  it('busy 동안은 눌리지 않고, 글자는 바꿀 수 있다 · 옛 onEnableNotify 줄은 그대로', () => {
    const busy = nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: notify(true, { busy: true, label: '알림 켜기', hint: '힌트' }) }));
    expect(link(busy, '알림 켜기')!.props.disabled).toBe(true);
    expect(text(busy)).toContain('힌트');
    const legacy = nodes(LotterySheet({ open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), onEnableNotify: vi.fn() }));
    expect(text(legacy)).toContain('복권 받게 알림 켜기');
  });
});
