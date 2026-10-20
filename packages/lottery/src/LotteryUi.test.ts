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
import { GoldenLotteryPopup, LotteryChip, LotteryResult, LotterySheet, RESULT, lotteryResultTopHeight, sheetMaxHeight } from './LotteryUi';
import { parseLotteryState, type LotteryState, type LotteryTier, type LotteryWinner } from './lottery';

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
  const sheet = (over: Record<string, unknown> = {}) => nodes(LotterySheet({ fullScreen: false, open: true, state: missionsState(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), ...over } as any));
  const rowBtn = (tree: any[], title: string) => buttons(tree).find(b => String(b.props.accessibilityLabel).startsWith(title));

  it('닫혀 있거나 상태가 없으면 아무것도 그리지 않는다', () => {
    expect(LotterySheet({ open: false, state: missionsState(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
    expect(LotterySheet({ fullScreen: false, open: true, state: null, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
  });

  it('위에서 아래로: 딤 → 손잡이 → X → 큰 제목 → 회색 한 줄 → 줄들 → 알림 링크 (0.1.6: 맨 아래 「한 번 더」 큰 버튼은 없다)', () => {
    const tree = sheet({ winners: [winner()], notify: { visible: true, onPress: vi.fn() } });
    const dim = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)');
    const handle = idx(tree, n => n?.type === 'View' && flat(n.props.style).width === 44 && flat(n.props.style).height === 5);
    const x = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기' && n.props?.hitSlop === 12);
    const title = idx(tree, n => n?.type === 'Text' && n.props?.accessibilityRole === 'header');
    const sub = idx(tree, n => n === '받은 복권은 매일 자정에 사라져요');
    const row = idx(tree, n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('최대 100원 복권'));
    const link = idx(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기');
    const order = [dim, handle, x, title, sub, row, link];
    expect(buttons(tree).some(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))).toBe(false);
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

  it('줄: 왼쪽 숫자 박스(1 · 5 · 10 · 황금 ★)는 없다 · 「최대 ○ 복권」 굵게 · 회색 설명 · 오른쪽 열기/받기/받기 완료 (0.1.5)', () => {
    const tree = sheet();
    expect(text(tree)).toContain('최대 100원 복권');
    expect(text(tree)).toContain('최대 500원 복권');
    expect(text(tree)).toContain('최대 1000원 복권'.replace('1000', '1,000'));
    // 숫자 박스(굵은 큰 숫자 · ★ 가 든 색 카드)가 없다 — 황금 줄도 같은 정렬
    expect(tree.filter(n => n?.type === 'Text' && n.props?.adjustsFontSizeToFit && flat(n.props.style).fontWeight === '900')).toEqual([]);
    expect(tree.filter(n => n?.type === 'View' && flat(n.props.style).borderRadius === 12 && flat(n.props.style).width === 44)).toEqual([]);
    expect(text(tree)).not.toContain('★');
    expect(text(tree)).toContain('쇼핑 · 플레이스 퀴즈 1개 하면 받아요');       // ready 줄도 같은 말(「미션 1개로 받았어요」 폐지)
    expect(text(tree)).toContain('쇼핑 · 플레이스 퀴즈 10개 하면 받아요');      // opened 줄도
    expect(text(tree)).toContain('쇼핑 · 플레이스 퀴즈 3개 더 하면 받아요');
    expect(text(tree)).not.toContain('받았어요');
    // 제목이 맨 왼쪽부터 — 각 줄의 첫 자식은 설명 묶음(rowCopy)
    const rows = buttons(tree).filter(b => String(b.props.accessibilityLabel).startsWith('최대 '));
    expect(rows).toHaveLength(4);
    for (const r of rows) expect(flat(r.props.children[0].props.style)).toMatchObject({ flex: 1 });
  });

  it('미션 줄: ready → 열기(onOpen(tier, mission)) · locked → 받기(onEarn) · opened → 받기 완료(눌리지 않음) · capped → 내일 받아요', () => {
    const onOpen = vi.fn(); const onEarn = vi.fn();
    const st = state([{ missionState: 'ready', unopened: 1 }, { missionState: 'locked' }, { missionState: 'opened' }, { missionState: 'capped' }], 1);
    const tree = nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen, onEarn, onClose: vi.fn() }));
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
    const t2 = nodes(LotterySheet({ fullScreen: false, open: true, state: opened, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(buttons(t2).some(b => String(b.props.accessibilityLabel) === '최대 1,000원 복권, 받기 완료')).toBe(true);
    // 기본 복권이 없으면 황금 줄이 없다
    const none = nodes(LotterySheet({ fullScreen: false, open: true, state: state([{ missionState: 'locked' }], 0), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(tree.filter(n => n?.props?.adjustsFontSizeToFit).length - none.filter(n => n?.props?.adjustsFontSizeToFit).length).toBeGreaterThan(0);
    expect(none.some(n => n?.props?.children === '★')).toBe(false);
  });

  it('포인트 표(unit:points): 「최대 1,000P 복권」 — 원 표시가 없다', () => {
    const tree = nodes(LotterySheet({ fullScreen: false, open: true, state: missionsState('points'), winners: [winner({ unit: 'points', points: 1000, tierMaxPoints: 1000 })], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    const t = text(tree);
    expect(t).toContain('최대 1,000P 복권');
    expect(t).not.toContain('원 복권');
    expect(buttons(tree).some(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))).toBe(false);
    const pill = tree.find(n => n?.type === 'Text' && n.props?.numberOfLines === 1)!;
    const kids = nodes(pill.props.children);
    expect(kids).toContain('1,000P');
    const plain = kids.filter(x => typeof x === 'string').join('');
    expect(plain).toBe('Noe****님이 1,000P 당첨됐어요!');
  });

  it('당첨 띠는 서버 winners 에 실제 기록이 있을 때만 — 없으면 숨긴다(가짜 이름 없음) · 원 당첨도 P 로(state.wonToPoint, 0.1.6)', () => {
    expect(text(sheet({ winners: [] }))).not.toContain('님이');
    expect(text(sheet({ winners: undefined }))).not.toContain('님이');
    const tree = sheet({ winners: [winner({ nick: 'Kim****', tierMax: 500 })] });
    const pill = tree.find(n => n?.type === 'Text' && n.props?.numberOfLines === 1)!;
    const joined = nodes(pill.props.children).filter(x => typeof x === 'string').join('');
    expect(joined).toBe('Kim****님이 160P 당첨됐어요!');                       // 100원 × wonToPoint 160 ÷ 100 — 최대액(500원)이 아니라 실제 당첨액
  });

  it('맨 아래 큰 「한 번 더! ○ 복권 받기」 버튼은 없다(0.1.6, 대표님 17:18) — 못 받은 단계가 남아도 · onMore 를 넘겨도', () => {
    const onMore = vi.fn(); const onEarn = vi.fn();
    const tree = sheet({ onMore, onEarn });
    expect(buttons(tree).some(b => String(b.props.accessibilityLabel).startsWith('한 번 더!'))).toBe(false);
    expect(text(tree)).not.toContain('한 번 더!');
    expect(onMore).not.toHaveBeenCalled();
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
    expect(flat(head.props.style).fontSize).toBeGreaterThanOrEqual(30);       // 0.1.4: 광고 카드가 보이게 줄였지만 여전히 가장 큰 글자
    const panel = find(tree, n => n?.type === 'View' && flat(n.props.style).paddingHorizontal === 24 && flat(n.props.style).top === 0)!;
    expect(flat(panel.props.style)).toMatchObject({ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, paddingTop: 47 + RESULT.top, paddingBottom: 34 + RESULT.bottom });
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

  it('남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」(+nextAd 일 때만 광고 칩) · 없으면 큰 버튼 없이 「확인」뿐 — 「한 번 더! ○ 복권 받기」는 없다(0.1.7)', () => {
    const onOpenNext = vi.fn(); const onMore = vi.fn();
    const withNext = full({ result: { won: 100, points: 5, unopened: 2, unit: 'points' }, onOpenNext, nextAd: true });
    const next = buttons(withNext).find(b => b.props.accessibilityLabel === '다음 복권 열기')!;
    expect(nodes(next.props.children).filter(x => typeof x === 'string' || typeof x === 'number').join('')).toContain('다음 복권 열기 (2장 남았어요)');
    expect(nodes(next.props.children).some(n => n?.type === 'Text' && n.props?.children === '광고')).toBe(true);
    next.props.onPress();
    expect(onOpenNext).toHaveBeenCalledOnce();
    expect(nodes(buttons(full({ result: { won: 100, points: 5, unopened: 2 }, onOpenNext })).find(b => b.props.accessibilityLabel === '다음 복권 열기')!.props.children).some(n => n?.props?.children === '광고')).toBe(false);
    // 남은 복권이 없고 다음 단계가 있어도(state · onMore 를 넘겨도) 「한 번 더」 버튼은 없다 — 닫기와 「확인」뿐
    const st = state([{ missionState: 'opened', unit: 'points', maxPoints: 1000, maxWon: 625 }, { missionState: 'locked', missions: 5, unit: 'points', maxPoints: 1000, maxWon: 625 }], 0);
    const none = full({ state: st, onMore });
    expect(buttons(none).map(b => b.props.accessibilityLabel)).toEqual(['닫기', '확인']);
    expect(text(none)).not.toContain('한 번 더!');
    expect(onMore).not.toHaveBeenCalled();
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
  const golden = (over: Record<string, unknown> = {}) => nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, maxPoints: 1600, onOpen: vi.fn(), onClose: vi.fn(), ...over } as any));

  it('닫혀 있으면 null · 「광고 보고 황금 복권 열기」 · busy 동안은 눌리지 않는다', () => {
    expect(GoldenLotteryPopup({ open: false, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() })).toBeNull();
    const onOpen = vi.fn();
    const tree = nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, onOpen, onClose: vi.fn(), icon: React.createElement('Gold') }));
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
      sheet: (n: any) => nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify: n })),
      golden: (n: any) => nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn(), notify: n })),
      result: (n: any) => nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: n })),
    };
    for (const [name, fn] of Object.entries(make)) {
      expect(link(fn(undefined)), name + ' 없음').toBeUndefined();
      expect(link(fn(notify(false))), name + ' 이미 켜져 있음').toBeUndefined();
      const shown = fn(notify(true, { onPress: p }));
      expect(link(shown), name).toBeTruthy();
      // 설명 줄은 시트 · 팝업만 — 당첨 전체 화면은 광고 카드가 보이게 한 줄로 줄였다(0.1.4)
      if (name === 'result') expect(text(shown)).not.toContain('매일 새 복권이 나오면 알려 드릴게요'); else expect(text(shown)).toContain('매일 새 복권이 나오면 알려 드릴게요');
      expect(shown.some(n => n?.type === 'Text' && n.props?.children === '›')).toBe(true);        // 글자 링크 모양(오른쪽 화살표)
      link(shown)!.props.onPress();
    }
    expect(p).toHaveBeenCalledTimes(3);
  });
  it('busy 동안은 눌리지 않고, 글자는 바꿀 수 있다 · 옛 onEnableNotify 줄은 그대로', () => {
    const busy = nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: notify(true, { busy: true, label: '알림 켜기', hint: '힌트' }) }));
    expect(link(busy, '알림 켜기')!.props.disabled).toBe(true);
    expect(text(busy)).not.toContain('힌트');                                  // 당첨 화면은 설명 줄 없이 한 줄(0.1.4)
    const busySheet = nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify: notify(true, { label: '알림 켜기', hint: '힌트' }) }));
    expect(text(busySheet)).toContain('힌트');                                 // 글자는 바꿀 수 있다
    const legacy = nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), onEnableNotify: vi.fn() }));
    expect(text(legacy)).toContain('복권 받게 알림 켜기');
  });
});

describe('한글 줄바꿈(0.1.4) — 단어 단위, 한 글자만 남지 않게', () => {
  const allText = (tree: any[]) => tree.filter(n => n?.type === 'Text');
  it('모든 글자가 lineBreakStrategyIOS="hangul-word" 를 가진다(시트 · 황금 팝업 · 당첨 화면)', () => {
    const st = state([{ missionState: 'ready', unopened: 1, basic: 1, basicUnopened: 1 }, { missions: 5, missionState: 'locked', missionsLeft: 3 }], 1);
    const trees = [
      nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify: { visible: true, onPress: vi.fn() } })),
      nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() })),
      nodes(LotteryResult({ result: { won: 100, points: 5, unopened: 1, unit: 'points' }, onOpenNext: vi.fn(), onClose: vi.fn() })),
    ];
    for (const tree of trees) {
      const texts = allText(tree);
      expect(texts.length).toBeGreaterThan(5);
      expect(texts.every(x => x.props.lineBreakStrategyIOS === 'hangul-word')).toBe(true);
    }
  });
  it('제목은 두 줄 안에서 · 줄 제목은 한 줄로 줄어들고 · 줄 설명은 두 줄까지 — 너비에 맞춘다', () => {
    const st = state([{ missionState: 'locked' }], 0);
    const tree = nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    const title = tree.find(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header')!;
    expect(title.props).toMatchObject({ numberOfLines: 2, adjustsFontSizeToFit: true });
    expect(flat(title.props.style).fontSize).toBeLessThanOrEqual(24);
    const rowTitle = tree.find(n => n?.type === 'Text' && n.props?.children === '최대 100원 복권')!;
    expect(rowTitle.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
    const hint = tree.find(n => n?.type === 'Text' && n.props?.children === '쇼핑 · 플레이스 퀴즈 1개 하면 받아요')!;
    expect(hint.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true, minimumFontScale: 0.85 });     // 한 줄(0.1.4 대표님 16:47) — 넘칠 때만 조금 줄어든다
    const head = nodes(LotteryResult({ result: { won: 100, points: 1000, unopened: 0, unit: 'points' }, onClose: vi.fn() })).find(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header')!;
    expect(head.props).toMatchObject({ numberOfLines: 1, adjustsFontSizeToFit: true });
  });
});

describe('당첨 전체 화면 — 「확인」 삭제 · 위쪽 압축 (0.1.4, 대표님 16:39 · 16:40)', () => {
  const res = (over: Record<string, unknown> = {}) => nodes(LotteryResult({ result: { won: 100, points: 5, unopened: 7, unit: 'points' }, onOpenNext: vi.fn(), onClose: vi.fn(), ...over } as any));
  const labels = (tree: any[]) => buttons(tree).map(b => b.props.accessibilityLabel);

  it('confirm={false} 면 글자 버튼 「확인」이 없고 닫기는 오른쪽 위 X 뿐 — 큰 제목 · 그림 · 버튼 · 네이티브 광고는 그대로', () => {
    const onClose = vi.fn();
    const tree = res({ confirm: false, onClose, renderNative: () => React.createElement('NativeAd'), notify: { visible: true, onPress: vi.fn() } });
    expect(labels(tree)).not.toContain('확인');
    expect(text(tree)).not.toContain('확인');
    expect(labels(tree).filter(l => l === '닫기')).toHaveLength(1);
    buttons(tree).find(b => b.props.accessibilityLabel === '닫기')!.props.onPress();
    expect(onClose).toHaveBeenCalledOnce();
    expect(text(tree)).toContain('5P 당첨!');
    expect(nodes(buttons(tree).find(b => b.props.accessibilityLabel === '다음 복권 열기')!.props.children).filter(x => typeof x === 'string' || typeof x === 'number').join('')).toContain('다음 복권 열기 (7장 남았어요)');
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(true);
    expect(tree.some(n => n?.type === 'View' && flat(n.props.style).transform?.[0]?.scale === 0.6)).toBe(true);        // 그림은 약 60%
    // 남은 복권 0 이면 X 만 — 다음 단계가 있고 onMore 를 넘겨도 「한 번 더!」 버튼은 없다(0.1.7)
    const done = { won: 100, points: 5, unopened: 0, unit: 'points' };
    expect(labels(res({ confirm: false, result: done, onOpenNext: undefined }))).toEqual(['닫기']);
    const st = state([{ missionState: 'opened', unit: 'points', maxPoints: 1000, maxWon: 625 }, { missionState: 'locked', missions: 5, unit: 'points', maxPoints: 1000, maxWon: 625 }], 0);
    expect(labels(res({ confirm: false, result: done, state: st, onOpenNext: undefined, onMore: vi.fn() }))).toEqual(['닫기']);        // 0.1.7: 다음 단계가 있어도 「한 번 더」 버튼은 없다
    // 안 주면 예전 그대로(다른 앱이 쓰는 경우)
    expect(labels(res())).toContain('확인');
  });

  it('위쪽 높이 합 — iPhone SE(375×667, 위 안전 영역 20)에서 네이티브 광고 카드(약 360pt)가 스크롤 없이 끝까지: 큰 버튼 · 알림 줄이 있어도 270pt 이하', () => {
    const AD = 360; const SE = 667; const TOP = 20;
    const worst = lotteryResultTopHeight({ big: true, notify: true });
    expect(worst).toBeLessThanOrEqual(270);
    expect(TOP + worst + AD + RESULT.bottom).toBeLessThanOrEqual(SE);
    expect(TOP + lotteryResultTopHeight({ big: true, wonLine: true }) + AD + RESULT.bottom).toBeLessThanOrEqual(SE);     // 원 표 한 줄이 붙어도(알림 줄 없이)
    expect(lotteryResultTopHeight({ big: true, notify: true, confirm: true })).toBeGreaterThan(270);                      // 「확인」을 남기면 넘친다 — 그래서 감자밭은 confirm={false}
    // 계산식과 실제 스타일이 같은 값을 쓴다
    const tree = res({ confirm: false, topInset: TOP, notify: { visible: true, onPress: vi.fn() }, renderNative: () => React.createElement('NativeAd') });
    const panel = find(tree, n => n?.type === 'View' && flat(n.props.style).paddingHorizontal === 24 && flat(n.props.style).top === 0)!;
    expect(flat(panel.props.style)).toMatchObject({ paddingTop: TOP + RESULT.top, paddingBottom: RESULT.bottom });
    expect(find(tree, n => n?.type === 'View' && flat(n.props.style).height === RESULT.header && flat(n.props.style).alignItems === 'flex-end')).toBeTruthy();
    expect(find(tree, n => n?.type === 'View' && flat(n.props.style).height === RESULT.art && flat(n.props.style).marginTop === RESULT.artGap)).toBeTruthy();
    expect(flat(buttons(tree).find(b => b.props.accessibilityLabel === '다음 복권 열기')!.props.style)).toMatchObject({ height: RESULT.big, marginTop: RESULT.bigGap });
    expect(flat(buttons(tree).find(b => b.props.accessibilityLabel === '복권 받게 알림 켜기')!.props.style).minHeight).toBe(RESULT.notify);
    expect(flat(find(tree, n => n?.type === 'Text' && n.props?.accessibilityRole === 'header')!.props.style)).toMatchObject({ fontSize: 34, lineHeight: RESULT.headline });
    expect(find(tree, n => n?.type === 'View' && flat(n.props.style).marginTop === RESULT.nativeGap && flat(n.props.style).alignItems === undefined && n.props.children?.type === 'NativeAd')).toBeTruthy();
  });
});

describe('5단계 시트(1 · 5 · 10 · 20 · 30) — 10 · 20 · 30 은 한 줄로 (0.1.5, 대표님 17:06)', () => {
  // state() 의 단계는 표가 같아서(100원) 10 · 20 · 30 이 같은 표 + 10 의 배수 → 한 줄
  const mk = (s: ('ready' | 'locked' | 'opened' | 'capped')[]) => state([1, 5, 10, 20, 30].map((m, i) => ({
    missions: m, missionState: s[i], state: s[i], missionsLeft: s[i] === 'locked' ? m : 0, unopened: s[i] === 'ready' ? 1 : 0, basic: i === 4 ? 1 : 0, basicUnopened: i === 4 ? 1 : 0,
  })) as Partial<LotteryTier>[], 1);
  const sheet5 = (st: any, over: Record<string, unknown> = {}) => nodes(LotterySheet({ fullScreen: false, open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), ...over } as any));
  const rowsOf = (tree: any[]) => buttons(tree).filter(b => String(b.props.accessibilityLabel).startsWith('최대 '));
  const rowHints = (tree: any[]) => tree.filter(n => n?.type === 'Text' && n.props?.numberOfLines === 1 && flat(n.props.style).fontSize === 14 && flat(n.props.style).lineHeight === 20).map(n => String(n.props.children));

  it('줄은 1 · 5 · 10(묶음) + 황금 = 4개 — 20 · 30 줄이 없고 설명은 「10개마다 받아요」 · 「쇼핑」 말고 이름을 바꿀 수 있다 · 「받았어요」 없음', () => {
    const tree = sheet5(mk(['ready', 'locked', 'locked', 'locked', 'locked']));
    expect(rowsOf(tree)).toHaveLength(4);                                   // 1 · 5 · 10(10 · 20 · 30) · 황금
    expect(rowHints(tree)).toEqual(['쇼핑 · 플레이스 퀴즈 1개 하면 받아요', '쇼핑 · 플레이스 퀴즈 5개 하면 받아요', '쇼핑 · 플레이스 퀴즈 10개마다 받아요', '하루 1번 광고 보고 받아요']);
    expect(text(tree)).not.toMatch(/받았어요|20개|30개|미션/);
    expect(rowHints(sheet5(mk(['ready', 'locked', 'locked', 'locked', 'locked']), { quiz: '미션' }))).toEqual(['미션 1개 하면 받아요', '미션 5개 하면 받아요', '미션 10개마다 받아요', '하루 1번 광고 보고 받아요']);
    expect(text(sheet5(mk(['ready', 'locked', 'locked', 'locked', 'locked']), { basicAd: false }))).toContain('하루 1번 받아요');
  });

  it('묶인 줄 버튼 — 열 수 있는 장이 둘이면 「열기 2」, 누르면 안 연 첫 단계(onOpen(3, mission)) · 못 받은 단계가 남으면 「받기」 → onEarn(첫 못 받은 단계)', () => {
    const onOpen = vi.fn(); const onEarn = vi.fn();
    const two = sheet5(mk(['opened', 'opened', 'ready', 'ready', 'locked']), { onOpen, onEarn });
    const grouped = rowsOf(two)[2];
    expect(grouped.props.accessibilityLabel).toBe('최대 100원 복권, 열기 2');
    grouped.props.onPress();
    expect(onOpen).toHaveBeenCalledWith(3, 'mission');
    expect(onEarn).not.toHaveBeenCalled();
    const earn = rowsOf(sheet5(mk(['opened', 'opened', 'opened', 'locked', 'locked']), { onOpen, onEarn }))[2];
    expect(earn.props.accessibilityLabel).toBe('최대 100원 복권, 받기');
    earn.props.onPress();
    expect(onEarn).toHaveBeenCalledWith(4);                                 // 아직 못 받은 첫 단계
    expect(onOpen).toHaveBeenCalledOnce();
    const done = rowsOf(sheet5(mk(['opened', 'opened', 'opened', 'opened', 'opened'])))[2];
    expect([done.props.accessibilityLabel, done.props.disabled]).toEqual(['최대 100원 복권, 받기 완료', true]);
  });

  it('숫자 박스 없이 — 줄 목록이 늘어도 시트 안에서 스크롤(높이는 화면에서 위 여백을 뺀 값 이하)', () => {
    const tree = sheet5(mk(['ready', 'locked', 'locked', 'locked', 'locked']));
    expect(tree.filter(n => n?.type === 'View' && flat(n.props.style).borderRadius === 12 && flat(n.props.style).width === 44)).toEqual([]);
    expect(tree.some(n => n?.type === 'ScrollView')).toBe(true);
    const sheetBox = find(tree, n => n?.type === 'View' && flat(n.props.style).borderTopLeftRadius === 28)!;
    expect(flat(sheetBox.props.style).maxHeight).toBe(sheetMaxHeight(800, undefined, 'android', 24));
    expect(sheetMaxHeight(667, 20)).toBe(623);                              // iPhone SE 도 시트가 화면 안에
  });
});

describe('알림 켜기 상자 — 안쪽 가운데 정렬 (0.1.5, 대표님 17:08:49)', () => {
  const notify = { visible: true, onPress: vi.fn(), hint: '매일 새 복권이 나오면 알려 드릴게요 — 아주 긴 설명은 두 줄로 내려가도 가운데에 놓인다' };
  const trees = () => ({
    sheet: nodes(LotterySheet({ fullScreen: false, open: true, state: state([{ missionState: 'locked' }], 0), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify })),
    golden: nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn(), notify })),
    result: nodes(LotteryResult({ result: { won: 100, points: 5, unopened: 0, unit: 'points' }, onClose: vi.fn(), notify } as any)),
  });

  it('상자 · 줄 · 제목 · 설명 모두 가운데 — 시트 · 황금 팝업 · 당첨 화면의 같은 상자', () => {
    for (const [name, tree] of Object.entries(trees())) {
      const box = find(tree, n => n?.type === 'View' && flat(n.props.style).alignSelf === 'stretch' && flat(n.props.style).alignItems === 'center' && flat(n.props.style).gap === 2)!;
      expect(box, name).toBeTruthy();
      const link = buttons(tree).find(b => b.props.accessibilityLabel === '복권 받게 알림 켜기')!;
      expect(flat(link.props.style), name).toMatchObject({ flexDirection: 'row', alignItems: 'center', justifyContent: 'center' });
      const title = find(tree, n => n?.type === 'Text' && n.props?.children === '복권 받게 알림 켜기')!;
      expect(flat(title.props.style).textAlign, name).toBe('center');
      if (name !== 'result') {                                             // 당첨 화면은 광고가 보이게 설명 줄 없이 한 줄(0.1.4)
        const hint = find(tree, n => n?.type === 'Text' && String(n.props?.children).startsWith('매일 새 복권이'))!;
        expect(flat(hint.props.style), name).toMatchObject({ textAlign: 'center', alignSelf: 'stretch' });
      }
    }
  });
});

describe('복권 목록 · 황금 복권 전체 화면 — 기본 (0.1.6, 감자밭 화면 그대로)', () => {
  const five = (): LotteryState => state([1, 5, 10, 20, 30].map((m, i) => ({
    missions: m, missionState: i === 0 ? 'ready' : 'locked', state: i === 0 ? 'ready' : 'locked', missionsLeft: i === 0 ? 0 : m, unopened: i === 0 ? 1 : 0, basic: i === 4 ? 1 : 0, basicUnopened: i === 4 ? 1 : 0,
  })) as Partial<LotteryTier>[], 1);
  const list = (over: Record<string, unknown> = {}) => nodes(LotterySheet({ open: true, state: five(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), ...over } as any));
  const gold = (over: Record<string, unknown> = {}) => nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, maxPoints: 1600, onOpen: vi.fn(), onClose: vi.fn(), ...over } as any));

  it('fullScreen 이 기본 — 머리글(‹ · 가운데 제목 「꽝 없는 복권」) 아래 흰 카드, 바텀 시트의 딤 · 손잡이 · X 는 없다', () => {
    const tree = list();
    expect(find(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '뒤로')).toBeTruthy();
    expect(tree.filter(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header').map(n => n.props.children)).toEqual(['꽝 없는 복권', '지금 열고 행운 받아가요!']);
    expect(text(tree).split('꽝 없는 복권').length - 1).toBe(1);                         // 카드 안 「꽝 없는 복권」 첫 줄은 없다 — 머리글 제목 한 번
    expect(tree.some(n => n?.type === 'Pressable' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)')).toBe(false);          // 딤
    expect(tree.some(n => n?.type === 'View' && flat(n.props.style).width === 44 && flat(n.props.style).height === 5)).toBe(false);     // 손잡이
    expect(tree.some(n => n?.type === 'View' && flat(n.props.style).borderTopLeftRadius === 28)).toBe(false);                          // 바텀 시트 모양
    expect(text(tree)).not.toContain('✕');
    expect(text(tree)).toContain('받은 복권은 매일 자정에 사라져요');
  });

  it('머리글 치수는 mission PageFrame 과 같다 — 높이 52 · 옆 44 · ‹ 32 · 제목 18/700 · 본문 padding 16 / 아래 40 / 칸 12, 바탕 theme.bg · 카드 theme.card 둥근 모서리 + 그림자', () => {
    const tree = list({ topInset: 0 });
    const header = find(tree, n => n?.type === 'View' && flat(n.props.style).height === 52)!;
    expect(flat(header.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 8 });
    const side = find(tree, n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '뒤로')!;
    expect(flat(side.props.style)).toMatchObject({ width: 44, height: 44 });
    expect(flat(find(tree, n => n?.type === 'Text' && n.props?.children === '‹')!.props.style)).toMatchObject({ fontSize: 32, marginTop: -4 });
    expect(flat(find(tree, n => n?.type === 'Text' && n.props?.children === '꽝 없는 복권')!.props.style)).toMatchObject({ flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '700' });
    expect(flat(find(tree, n => n?.type === 'ScrollView')!.props.contentContainerStyle)).toMatchObject({ padding: 16, paddingBottom: 40, gap: 12 });
    const page = find(tree, n => n?.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).backgroundColor === '#FBF7F2')!;
    expect(flat(page.props.style)).toMatchObject({ top: 0, bottom: 0, left: 0, right: 0, paddingTop: 0, paddingBottom: 0 });            // 안전 영역은 앱 바깥 틀
    const card = find(tree, n => n?.type === 'View' && flat(n.props.style).borderRadius === 20 && flat(n.props.style).backgroundColor === '#FFFFFF')!;
    expect(flat(card.props.style)).toMatchObject({ padding: 20, elevation: 2 });
    // 앱이 준 색을 따른다
    const themed = list({ theme: { bg: '#E5F5D0', card: '#FAFAFA' } });
    expect(find(themed, n => n?.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).backgroundColor === '#E5F5D0')).toBeTruthy();
    expect(find(themed, n => n?.type === 'View' && flat(n.props.style).borderRadius === 20 && flat(n.props.style).backgroundColor === '#FAFAFA')).toBeTruthy();
    // 안전 영역을 주면 그만큼
    const insets = list({ topInset: 47, bottomInset: 34 });
    expect(flat(find(insets, n => n?.type === 'View' && flat(n.props.style).position === 'absolute' && flat(n.props.style).backgroundColor === '#FBF7F2')!.props.style)).toMatchObject({ paddingTop: 47, paddingBottom: 34 });
  });

  it('‹ 와 안드로이드 뒤로 가기는 닫기 · 카드 안: 제목 → 회색 한 줄 → 당첨 띠 → 줄들 → 알림 → 카드 밖 아래 광고(위 보정 없이)', () => {
    const onClose = vi.fn();
    const tree = list({ onClose, winners: [winner({ nick: 'Kim****', won: 1000, tierMax: 1000 })], notify: { visible: true, onPress: vi.fn() }, renderNative: () => React.createElement('NativeAd') });
    buttons(tree).find(b => b.props.accessibilityLabel === '뒤로')!.props.onPress();
    expect(onClose).toHaveBeenCalledOnce();
    const cleanup = h.effects[h.effects.length - 1]();
    expect(h.back()).toBe(true);
    expect(onClose).toHaveBeenCalledTimes(2);
    cleanup();
    expect(h.remove).toHaveBeenCalled();
    const at = (pred: (n: any) => boolean) => idx(tree, pred);
    const order = [
      at(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '뒤로'),
      at(n => n?.type === 'Text' && n.props?.children === '지금 열고 행운 받아가요!'),
      at(n => n === '받은 복권은 매일 자정에 사라져요'),
      at(n => n === 'Kim****님이 '),
      at(n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('최대 100원 복권')),
      at(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기'),
      at(n => n?.type === 'NativeAd'),
    ];
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    // 광고는 카드 밖(카드 View 의 자손이 아님) — 감싼 View 에 위 여백 스타일이 없어 간격은 본문 칸 사이 12 뿐
    const card = find(tree, n => n?.type === 'View' && flat(n.props.style).borderRadius === 20)!;
    expect(nodes(card.props.children).some(n => n?.type === 'NativeAd')).toBe(false);
    const wrap = find(tree, n => n?.type === 'View' && n.props?.children?.type === 'NativeAd')!;
    expect(wrap.props.style).toBeUndefined();
  });

  it('줄은 서버 단계대로(묶기 0.1.5) · 숫자 박스 없음 · 「한 번 더」 없음 · 당첨 띠는 원 → P(1,000원 × 160 ÷ 100 = 1,600P) · 줄 크기는 행운 찬스 줄처럼 16 / 13 / 72x36', () => {
    const tree = list({ winners: [winner({ nick: 'Kim****', won: 1000, tierMax: 1000 })] });
    const rowBtns = buttons(tree).filter(b => String(b.props.accessibilityLabel).startsWith('최대 '));
    expect(rowBtns.map(b => b.props.accessibilityLabel)).toEqual(['최대 100원 복권, 열기', '최대 100원 복권, 받기', '최대 100원 복권, 받기', '최대 100원 복권, 열기, 광고']);
    expect(text(tree)).not.toContain('한 번 더!');
    expect(tree.some(n => n?.type === 'Text' && n.props?.adjustsFontSizeToFit && flat(n.props.style).fontWeight === '900' && flat(n.props.style).fontSize === 17)).toBe(false);
    const pill = tree.find(n => n?.type === 'Text' && n.props?.numberOfLines === 1 && flat(n.props.style).fontSize === 13.5)!;
    expect(nodes(pill.props.children).filter(x => typeof x === 'string').join('')).toBe('Kim****님이 1,600P 당첨됐어요!');
    const hint = tree.filter(n => n?.type === 'Text' && n.props?.numberOfLines === 1 && flat(n.props.style).fontSize === 13 && flat(n.props.style).fontWeight === '600').map(n => String(n.props.children));
    expect(hint).toEqual(['쇼핑 · 플레이스 퀴즈 1개 하면 받아요', '쇼핑 · 플레이스 퀴즈 5개 하면 받아요', '쇼핑 · 플레이스 퀴즈 10개마다 받아요', '하루 1번 광고 보고 받아요']);
    expect(find(tree, n => n?.type === 'Text' && n.props?.children === '최대 100원 복권')).toBeTruthy();
    expect(flat(find(tree, n => n?.type === 'Text' && n.props?.children === '최대 100원 복권')!.props.style)).toMatchObject({ fontSize: 16, fontWeight: '800' });
    expect(flat(find(tree, n => n?.type === 'View' && flat(n.props.style).minWidth === 72)!.props.style)).toMatchObject({ height: 36, borderRadius: 12 });
    // 묶인 줄을 누르면 안 연 첫 단계 / 못 받은 줄은 onEarn
    const onOpen = vi.fn(); const onEarn = vi.fn();
    const t2 = list({ onOpen, onEarn });
    buttons(t2).find(b => b.props.accessibilityLabel === '최대 100원 복권, 열기')!.props.onPress();
    expect(onOpen).toHaveBeenCalledWith(1, 'mission');
    buttons(t2).filter(b => b.props.accessibilityLabel === '최대 100원 복권, 받기')[0].props.onPress();
    expect(onEarn).toHaveBeenCalledWith(2);
  });

  it('황금 복권 전체 화면: 같은 머리글(제목 「황금 복권」) + 흰 카드(티켓 → 제목 → 쉬운 말 → 작은 글씨 → 큰 버튼+광고 칩 → 다음에 열기 → 알림) · 딤 · 손잡이 없음', () => {
    const onOpen = vi.fn(); const onClose = vi.fn();
    const tree = gold({ onOpen, onClose, notify: { visible: true, onPress: vi.fn() } });
    expect(tree.filter(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header').map(n => n.props.children)).toEqual(['황금 복권', '황금 복권이 나타났어요!']);
    expect(tree.some(n => n?.type === 'Pressable' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)')).toBe(false);
    expect(tree.some(n => n?.type === 'View' && flat(n.props.style).width === 44 && flat(n.props.style).height === 5)).toBe(false);
    const at = (pred: (n: any) => boolean) => idx(tree, pred);
    const order = [
      at(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '뒤로'),
      at(n => n === 'GOLD'),
      at(n => n?.type === 'Text' && n.props?.children === '황금 복권이 나타났어요!'),
      at(n => typeof n === 'string' && n.includes('바로 들어와요')),
      at(n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('광고 보고 황금 복권 열기')),
      at(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '다음에 열기'),
      at(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '복권 받게 알림 켜기'),
    ];
    expect(order.every(i => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    const open = buttons(tree).find(b => String(b.props.accessibilityLabel).startsWith('광고 보고 황금 복권 열기'))!;
    expect(nodes(open.props.children).some(n => n?.type === 'Text' && n.props?.children === '광고')).toBe(true);
    open.props.onPress();
    expect(onOpen).toHaveBeenCalledOnce();
    buttons(tree).find(b => b.props.accessibilityLabel === '다음에 열기')!.props.onPress();
    buttons(tree).find(b => b.props.accessibilityLabel === '뒤로')!.props.onPress();
    expect(onClose).toHaveBeenCalledTimes(2);
    expect(nodes(GoldenLotteryPopup({ open: false, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() }))).toEqual([null]);
  });

  it('fullScreen={false} 면 예전 바텀 시트 그대로(딤 · 손잡이 · X · 큰 제목 2줄) — 목록 · 황금 모두', () => {
    const sheetOld = nodes(LotterySheet({ fullScreen: false, open: true, state: five(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(sheetOld.some(n => n?.type === 'Pressable' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)')).toBe(true);
    expect(text(sheetOld)).toContain('꽝 없는 복권\n지금 열고 행운 받아가요!');
    const goldOld = nodes(GoldenLotteryPopup({ fullScreen: false, open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() }));
    expect(goldOld.some(n => n?.type === 'Pressable' && flat(n.props.style).backgroundColor === 'rgba(0,0,0,0.5)')).toBe(true);
  });
});

describe('황금 줄 「광고」 칩은 제목 옆 · 버튼은 「열기」만 · 카드 머리 글자 가운데 (0.1.8, 대표님 18:58)', () => {
  const stGold = (unopened = 1) => state([{ missions: 10, missionState: 'locked', missionsLeft: 10, basic: 1, basicUnopened: unopened }], 1);
  const list = (over: Record<string, unknown> = {}) => nodes(LotterySheet({ open: true, state: stGold(), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), ...over } as any));
  const goldRow = (tree: any[]) => buttons(tree).find(b => String(b.props.accessibilityLabel).includes('열기, 광고'))!;
  const isChip = (n: any) => n?.type === 'View' && flat(n.props.style).height === 20 && flat(n.props.style).borderRadius === 10;
  const chipTexts = (tree: any[]) => tree.filter(n => n?.type === 'Text' && n.props?.children === '광고');

  for (const fullScreen of [true, false]) {
    it('fullScreen=' + fullScreen + ': 버튼 안에는 「열기」 글자뿐이고 「광고」 칩은 제목 줄(제목 바로 옆)에 있다', () => {
      const row = goldRow(list({ fullScreen }));
      expect(row).toBeTruthy();
      const [copy, button] = row.props.children;
      const inButton = nodes(button.props.children);
      expect(inButton.filter(n => n?.type === 'Text').map(n => n.props.children)).toEqual(['열기']);
      expect(inButton.some(isChip)).toBe(false);
      const titleLine = copy.props.children[0];
      const parts = nodes(titleLine.props.children);
      const titleAt = parts.findIndex(n => n?.type === 'Text' && String(n.props.children).startsWith('최대 '));
      const chipAt = parts.findIndex(isChip);
      expect(titleAt).toBeGreaterThanOrEqual(0);
      expect(chipAt).toBeGreaterThan(titleAt);                                       // 제목 다음, 같은 줄
      expect(flat(titleLine.props.style)).toMatchObject({ flexDirection: 'row', alignItems: 'center' });
      expect(parts.filter(n => n?.type === 'Text' && n.props.children === '광고')).toHaveLength(1);
      expect(chipTexts(list({ fullScreen }))).toHaveLength(1);                       // 줄 전체에서도 한 번뿐
    });
  }

  it('광고 없이 열리는 황금(basicAd=false) · 이미 연 황금(받기 완료) · 미션 줄에는 칩이 없다', () => {
    expect(chipTexts(list({ basicAd: false }))).toHaveLength(0);
    expect(chipTexts(nodes(LotterySheet({ open: true, state: stGold(0), winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() } as any)))).toHaveLength(0);
    expect(buttons(list({ basicAd: false })).some(b => String(b.props.accessibilityLabel).includes('광고'))).toBe(false);
  });

  it('카드 맨 위 「지금 열고 행운 받아가요!」 · 「받은 복권은 매일 자정에 사라져요」는 가운데 정렬', () => {
    const tree = list();
    const title = tree.find(n => n?.type === 'Text' && n.props?.children === '지금 열고 행운 받아가요!')!;
    const sub = tree.find(n => n?.type === 'Text' && n.props?.children === '받은 복권은 매일 자정에 사라져요')!;
    expect(flat(title.props.style).textAlign).toBe('center');
    expect(flat(sub.props.style).textAlign).toBe('center');
  });
});
