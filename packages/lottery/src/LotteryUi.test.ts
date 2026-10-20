import React, { type ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
// 훅과 애니메이션을 흉내 낸다(FloatingRewardChip.test 와 같은 방식) — 칩의 위아래 움직임이 켜지고 꺼지는 조건을 본다
const h = vi.hoisted(() => ({ effects: [] as (() => any)[], reduced: true, start: vi.fn(), stop: vi.fn(), remove: vi.fn(), set: vi.fn(), listener: null as any }));
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useRef: (v: any) => ({ current: v }), useState: () => [h.reduced, vi.fn()], useEffect: (fn: any) => h.effects.push(fn) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', StyleSheet: { create: (v: unknown) => v },
  Dimensions: { get: () => ({ width: 360, height: 800 }) }, Platform: { OS: 'android' }, StatusBar: { currentHeight: 24 },
  AccessibilityInfo: { isReduceMotionEnabled: () => Promise.resolve(true), addEventListener: (_: any, fn: any) => { h.listener = fn; return { remove: h.remove }; } },
  Easing: { inOut: (v: any) => v, sin: 'sin' },
  Animated: { View: 'AnimatedView', Value: class { setValue = h.set; }, timing: vi.fn(), sequence: vi.fn(), loop: () => ({ start: h.start, stop: h.stop }) },
}));
beforeEach(() => { vi.clearAllMocks(); h.effects = []; h.reduced = true; });
import { GoldenLotteryPopup, LotteryChip, LotteryResult, LotterySheet, sheetMaxHeight } from './LotteryUi';
import { parseLotteryState, type LotteryTier } from './lottery';

function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const buttons = (tree: any[]) => tree.filter(n => n?.type === 'Pressable' && n.props?.accessibilityRole === 'button');
const text = (tree: any[]) => tree.filter(x => typeof x === 'string').join('|');
const tier = (over: Partial<LotteryTier>): LotteryTier => ({ tier: 1, missions: 1, maxWon: 100, maxPoints: 160, state: 'locked', missionState: 'locked', missionsLeft: 1, tickets: 0, unopened: 0, basic: 0, basicUnopened: 0, prize: null, ...over });
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

describe('LotterySheet', () => {
  it('닫혀 있거나 상태가 없으면 아무것도 그리지 않는다', () => {
    expect(LotterySheet({ open: false, state: state([{}]), onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
    expect(LotterySheet({ open: true, state: null, onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() })).toBeNull();
  });
  it('단계 줄마다 열기 · 받기 · 획득 완료, 줄 하나는 단추 하나(겹침 없음), 열기는 onOpen · 받기는 onEarn', () => {
    const onOpen = vi.fn(); const onEarn = vi.fn(); const onMore = vi.fn();
    const s = state([{ state: 'ready', missionState: 'ready', unopened: 1 }, { missions: 5, maxWon: 500, missionsLeft: 3 }, { missions: 10, maxWon: 1000, state: 'opened', missionState: 'opened', missionsLeft: 0 }], 1);
    const tree = nodes(LotterySheet({ open: true, state: s, winners: [{ nick: '김철****', tierMax: 500, won: 100 }], onOpen, onEarn, onMore, onClose: vi.fn(), onEnableNotify: vi.fn() }));
    const t = text(tree);
    expect(t).toContain('꽝 없는 복권');
    expect(t).toContain('김철****님이 500원 복권에 당첨됐어요!');
    expect(t).toContain('최대 1,000원 복권');
    expect(t).toContain('획득 완료');
    const rows = buttons(tree).filter(b => /복권, /.test(b.props.accessibilityLabel ?? ''));
    expect(rows).toHaveLength(3);
    for (const r of rows) expect(nodes(r.props.children).filter(n => n?.type === 'Pressable')).toHaveLength(0);
    rows[0].props.onPress();
    rows[1].props.onPress();
    rows[2].props.onPress();                                    // 획득 완료 줄은 눌러도 아무 일 없다
    expect(onOpen).toHaveBeenCalledWith(1);
    expect(onEarn).toHaveBeenCalledWith(2);
    expect(onOpen).toHaveBeenCalledTimes(1);
    expect(rows[2].props.disabled).toBe(true);
    const more = buttons(tree).find(b => b.props.accessibilityLabel === '한 번 더! 500원 복권 받기')!;
    more.props.onPress();
    expect(onMore).toHaveBeenCalledWith(2);
    expect(text(tree)).toContain('복권 받게 알림 켜기');
  });
  it('시트는 화면에서 위 여백을 뺀 높이 안에서 스크롤한다(맨 위 줄이 상태줄 밑으로 잘리지 않게) — topInset 을 주면 그 값, 없으면 짐작', () => {
    expect(sheetMaxHeight(800, 40)).toBe(736);
    expect(sheetMaxHeight(800, undefined, 'android', 24)).toBe(752);
    expect(sheetMaxHeight(800, undefined, 'ios')).toBe(732);
    expect(sheetMaxHeight(300, 200)).toBe(240);                       // 아주 작은 화면에서도 최소 높이
    const s = state([{ state: 'ready', missionState: 'ready', unopened: 2 }, { missions: 5, maxWon: 500 }, { missions: 10, maxWon: 1000 }], 2);
    const tree = nodes(LotterySheet({ open: true, state: s, winners: [{ nick: 'a****', tierMax: 100, won: 10 }], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), topInset: 40, onEnableNotify: vi.fn(), renderNative: () => React.createElement('NativeAd') }));
    const sheet = tree.find(n => n?.type === 'View' && n.props?.style?.[1]?.maxHeight !== undefined)!;
    expect(sheet.props.style[1].maxHeight).toBe(736);
    const scroll = tree.find(n => n?.type === 'ScrollView')!;
    expect(nodes(scroll.props.children).some(n => typeof n === 'string' && /최대 100원 복권/.test(n))).toBe(true);   // 제목 · 줄 · 광고가 스크롤 안에 있다
    expect(nodes(scroll.props.children).some(n => n?.type === 'NativeAd')).toBe(true);
  });
  it('열기가 진행 중(busy)이면 줄이 눌리지 않는다 · 다 받았으면 「한 번 더」 버튼이 없다', () => {
    const s = state([{ state: 'ready', missionState: 'ready', unopened: 1 }]);
    const tree = nodes(LotterySheet({ open: true, state: s, busy: true, onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    expect(buttons(tree).find(b => /복권, 열기/.test(b.props.accessibilityLabel ?? ''))!.props.disabled).toBe(true);
    expect(buttons(tree).some(b => /한 번 더/.test(b.props.accessibilityLabel ?? ''))).toBe(false);
  });
});

describe('LotteryResult', () => {
  it('「축하해요 보상 ○P 당첨!」 · 큰 그림 없음 · 네이티브 자리는 버튼 위가 아니라 아래 영역', () => {
    const tree = nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), renderNative: () => React.createElement('NativeAd') }));
    expect(text(tree)).toContain('축하해요 보상 160P 당첨!');
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(true);
    // 네이티브 광고는 **버튼 아래**(대표님 13:56) — 닫기 버튼(「다음에 할게요」)보다 뒤에 온다
    const withNext = nodes(LotteryResult({ result: { won: 10, points: 16, unopened: 1 }, onOpenNext: vi.fn(), onClose: vi.fn(), renderNative: () => React.createElement('NativeAd') }));
    const order = withNext.map((n, i) => (n?.props?.accessibilityLabel === '다음 복권 열기' ? 'next@' + i : n?.props?.accessibilityLabel === '다음에 할게요' ? 'close@' + i : n?.type === 'NativeAd' ? 'ad@' + i : null)).filter(Boolean) as string[];
    expect(order.map(x => x.split('@')[0])).toEqual(['next', 'close', 'ad']);
    expect(tree.some(n => n?.type === 'Image')).toBe(false);
  });
  it('남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(남은 미션 수), 둘 다 「다음에 할게요」', () => {
    const onOpenNext = vi.fn(); const onMore = vi.fn(); const onClose = vi.fn();
    const withNext = nodes(LotteryResult({ result: { won: 10, points: 16, unopened: 2 }, onOpenNext, onMore, onClose }));
    buttons(withNext).find(b => b.props.accessibilityLabel === '다음 복권 열기')!.props.onPress();
    expect(onOpenNext).toHaveBeenCalledOnce();
    expect(buttons(withNext).some(b => /미션/.test(b.props.accessibilityLabel ?? ''))).toBe(false);
    const s = state([{ state: 'opened', missionState: 'opened' }, { missions: 5, maxWon: 500, missionsLeft: 4 }]);
    const none = nodes(LotteryResult({ result: { won: 10, points: 16, unopened: 0 }, state: s, onOpenNext, onMore, onClose }));
    buttons(none).find(b => b.props.accessibilityLabel === '미션 4개 더 하고 500원 복권 받기')!.props.onPress();
    expect(onMore).toHaveBeenCalledOnce();
    buttons(none).find(b => b.props.accessibilityLabel === '다음에 할게요')!.props.onPress();
    expect(onClose).toHaveBeenCalledOnce();
    expect(buttons(none).some(b => b.props.accessibilityLabel === '다음 복권 열기')).toBe(false);
  });
});

describe('GoldenLotteryPopup', () => {
  const golden = (over: Record<string, unknown> = {}) => nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, maxPoints: 1600, onOpen: vi.fn(), onClose: vi.fn(), ...over } as any));
  const flat = (style: any): Record<string, any> => (Array.isArray(style) ? Object.assign({}, ...style.filter(Boolean).map(flat)) : style ?? {});

  it('닫혀 있으면 null · 「광고 보고 황금 복권 열기」 · busy 동안은 눌리지 않는다', () => {
    expect(GoldenLotteryPopup({ open: false, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn() })).toBeNull();
    const onOpen = vi.fn();
    const tree = nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, onOpen, onClose: vi.fn(), icon: React.createElement('Gold') }));
    expect(text(tree)).toContain('황금 복권이 나타났어요!');
    expect(text(tree)).toContain('최대 1,000원');
    expect(tree.some(n => n?.type === 'Gold')).toBe(true);
    const b = buttons(tree).find(x => x.props.accessibilityLabel === '광고 보고 황금 복권 열기')!;
    b.props.onPress();
    expect(onOpen).toHaveBeenCalledOnce();
    const busy = buttons(nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, busy: true, onOpen, onClose: vi.fn() }))).find(x => x.props.accessibilityLabel === '광고 보고 황금 복권 열기')!;
    expect(busy.props.disabled).toBe(true);
  });

  it('(0.1.2) 쉬운 말 3줄 + 작은 글씨 — 값은 서버 state 에서 온 것을 그대로 보여 준다(하드코딩 없음)', () => {
    const tree = golden();
    const t = text(tree);
    expect(t).toContain('하루에 한 장, 무료로 드려요');
    expect(t).toContain('광고 1번 보면 바로 열 수 있어요');
    expect(t).toContain('최대 1,000원(1,600P)이 포인트로 바로 들어와요');
    expect(t).toContain('오늘 자정까지 열 수 있어요');
    const other = text(golden({ maxWon: 500, maxPoints: 800 }));
    expect(other).toContain('최대 500원(800P)이 포인트로 바로 들어와요');
    expect(other).not.toContain('1,000원');
    expect(text(golden({ maxPoints: undefined }))).toContain('최대 1,000원이 포인트로 바로 들어와요');   // 포인트를 모르면 금액만
  });

  it('(0.1.2) 위에서 아래로: 닫기(자기 줄) → 그림 → 제목 → 설명 → 버튼(광고 칩) → 「다음에 열기」', () => {
    const tree = golden();
    const idx = (pred: (n: any) => boolean) => tree.findIndex(pred);
    const close = idx(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '닫기' && n.props?.hitSlop === 12);
    const art = idx(n => n?.type === 'Text' && n.props?.children === '★');
    const title = idx(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header');
    const cta = idx(n => n?.type === 'Pressable' && String(n.props?.accessibilityLabel).startsWith('광고 보고 황금 복권 열기'));
    const later = idx(n => n?.type === 'Pressable' && n.props?.accessibilityLabel === '다음에 열기');
    expect([close, art, title, cta, later].every(i => i >= 0)).toBe(true);
    expect(close).toBeLessThan(art);
    expect(art).toBeLessThan(title);
    expect(title).toBeLessThan(cta);
    expect(cta).toBeLessThan(later);
    // 닫기는 제목과 겹치지 않는다 — 제목에는 absolute 가 없고, 닫기 단추도 자기 줄(헤더)의 흐름 안에 있다
    const titleStyle = flat(tree[title].props.style);
    expect(titleStyle.position).toBeUndefined();
    expect(flat(tree[close].props.style).position).toBeUndefined();
  });

  it('(0.1.2) 여백이 넉넉하다 — 좌우 · 위 · 아래 24 이상, 제목 ↔ 설명 ↔ 버튼 16 이상, 설명 줄 높이 24 이상', () => {
    const tree = golden({ bottomInset: 20 });
    const sheet = tree.find(n => n?.type === 'View' && flat(n.props.style).borderTopLeftRadius === 28)!;
    const st = flat(sheet.props.style);
    expect(st.paddingHorizontal).toBeGreaterThanOrEqual(24);
    expect(st.paddingBottom).toBeGreaterThanOrEqual(24 + 20);                       // 아래 안전 영역을 더한다
    const header = tree.find(n => n?.type === 'View' && flat(n.props.style).height === 40 && flat(n.props.style).alignItems === 'flex-end')!;
    expect(header).toBeTruthy();                                                    // 닫기 줄이 위에 자기 자리를 차지한다
    const title = tree.find(n => n?.type === 'Text' && n.props?.accessibilityRole === 'header')!;
    expect(flat(title.props.style).marginTop).toBeGreaterThanOrEqual(16);
    const lines = tree.find(n => n?.type === 'View' && flat(n.props.style).gap === 8)!;
    expect(flat(lines.props.style).marginTop).toBeGreaterThanOrEqual(16);
    const line = tree.find(n => n?.type === 'Text' && n.props?.children === '하루에 한 장, 무료로 드려요')!;
    expect(flat(line.props.style).lineHeight).toBeGreaterThanOrEqual(24);
    const note = tree.find(n => n?.type === 'Text' && n.props?.children === '오늘 자정까지 열 수 있어요')!;
    expect(flat(note.props.style).marginBottom).toBeGreaterThanOrEqual(16);        // 작은 글씨 ↔ 버튼
  });

  it('(0.1.2) 버튼 안 오른쪽에 「광고」 칩 — 광고 없이 열리는 설정(ad:false)이면 칩 · 광고 문구가 없다', () => {
    const withAd = golden();
    const btn = buttons(withAd).find(x => String(x.props.accessibilityLabel).startsWith('광고 보고 황금 복권 열기'))!;
    expect(btn.props.accessibilityLabel).toBe('광고 보고 황금 복권 열기');           // 라벨에 이미 「광고」가 있어 중복하지 않는다
    const kids = nodes(btn.props.children);
    const label = kids.findIndex(n => n === '광고 보고 황금 복권 열기');
    const chip = kids.findIndex(n => n?.type === 'Text' && n.props?.children === '광고');
    expect(label).toBeGreaterThanOrEqual(0);
    expect(chip).toBeGreaterThan(label);                                            // 칩이 글자 뒤(오른쪽)
    expect(flat(btn.props.style).flexDirection).toBe('row');
    const noAd = golden({ ad: false });
    expect(text(noAd)).not.toContain('광고');
    expect(buttons(noAd).some(x => x.props.accessibilityLabel === '황금 복권 열기')).toBe(true);
    expect(text(noAd)).toContain('바로 열 수 있어요');
    expect(text(golden({ adLabel: 'AD' }))).toContain('AD');
  });

  it('(0.1.2) 버튼 아래에 「다음에 열기」 — 누르면 닫는다 · 기본 그림은 앱 그림(icon)이 있으면 대신한다 · 문구 통째로 바꾸기', () => {
    const onClose = vi.fn();
    const tree = golden({ onClose });
    buttons(tree).find(x => x.props.accessibilityLabel === '다음에 열기')!.props.onPress();
    expect(onClose).toHaveBeenCalledOnce();
    expect(tree.some(n => n?.type === 'Text' && n.props?.children === '★')).toBe(true);
    const custom = golden({ icon: React.createElement('AppGold'), lines: ['a', 'b', 'c'], note: 'n', closeLabel: 'Later', buttonLabel: 'Open' });
    expect(custom.some(n => n?.type === 'AppGold')).toBe(true);
    expect(custom.some(n => n?.type === 'Text' && n.props?.children === '★')).toBe(false);
    expect(text(custom)).toContain('a|b|c');
    expect(buttons(custom).some(x => x.props.accessibilityLabel === 'Later')).toBe(true);
    expect(buttons(custom).some(x => String(x.props.accessibilityLabel).startsWith('Open'))).toBe(true);
  });
});

describe('광고 칩 — 광고가 바로 열리는 버튼에만', () => {
  const chipIn = (node: any) => nodes(node).some(n => n?.type === 'Text' && n.props?.children === '광고');
  it('시트: 매일 기본(황금) 복권만 남은 줄에만 칩, 미션 복권이 열리는 줄 · 받기 · 완료 줄에는 없다', () => {
    const st = state([
      { state: 'ready', missionState: 'ready', unopened: 1, tickets: 2, basic: 1, basicUnopened: 1 },   // 미션 복권이 먼저 열린다 → 광고 없음
      { state: 'ready', missionState: 'locked', unopened: 1, tickets: 1, basic: 1, basicUnopened: 1 },  // 황금뿐 → 광고
      { state: 'locked', missionState: 'locked' },
    ], 2);
    const tree = nodes(LotterySheet({ open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() }));
    const rows = buttons(tree).filter(b => /열기|받기/.test(String(b.props.accessibilityLabel)));
    const labels = rows.map(r => [String(r.props.accessibilityLabel), chipIn(r.props.children)]);
    expect(labels.filter(([, c]) => c)).toHaveLength(1);
    expect(labels.find(([l]) => String(l).includes(', 열기, 광고'))).toBeTruthy();
    expect(labels[0][1]).toBe(false);
    expect(labels[2][1]).toBe(false);
  });
  it('시트: basicAd=false(서버가 광고 없이 열게 한 설정)이면 칩이 없다 · 광고 글자는 바꿀 수 있다', () => {
    const st = state([{ state: 'ready', missionState: 'locked', unopened: 1, tickets: 1, basic: 1, basicUnopened: 1 }], 1);
    const props = { open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn() } as any;
    expect(chipIn(LotterySheet({ ...props, basicAd: false }))).toBe(false);
    expect(chipIn(LotterySheet({ ...props }))).toBe(true);
    expect(nodes(LotterySheet({ ...props, adLabel: 'AD' })).some(n => n?.type === 'Text' && n.props?.children === 'AD')).toBe(true);
  });
  it('결과 창: nextAd 가 참일 때만 「다음 복권 열기」에 칩', () => {
    const base = { result: { won: 100, points: 160, unopened: 1 }, onOpenNext: vi.fn(), onClose: vi.fn() };
    const on = nodes(LotteryResult({ ...base, nextAd: true }));
    const off = nodes(LotteryResult({ ...base }));
    const nextBtn = (tree: any[]) => buttons(tree).find(b => b.props.accessibilityLabel === '다음 복권 열기')!;
    expect(chipIn(nextBtn(on).props.children)).toBe(true);
    expect(chipIn(nextBtn(off).props.children)).toBe(false);
  });
});

describe('🔔 복권 받기 알림 켜기 줄 — 알림이 꺼져 있을 때만', () => {
  const notify = (visible: boolean, over: Record<string, unknown> = {}) => ({ visible, busy: false, onPress: vi.fn(), ...over });
  const row = (tree: any[]) => buttons(tree).find(b => b.props.accessibilityLabel === '복권 받기 알림 켜기');
  const st = state([{ state: 'ready', missionState: 'ready', unopened: 1, tickets: 1 }], 1);

  it('시트 · 황금 팝업 · 결과 창 모두: visible 일 때만 보이고 누르면 onPress', () => {
    const p = vi.fn();
    const trees = {
      sheet: (n: any) => nodes(LotterySheet({ open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), notify: n })),
      golden: (n: any) => nodes(GoldenLotteryPopup({ open: true, maxWon: 1000, onOpen: vi.fn(), onClose: vi.fn(), notify: n })),
      result: (n: any) => nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: n })),
    };
    for (const [name, make] of Object.entries(trees)) {
      expect(row(make(undefined)), name + ' 없음').toBeUndefined();
      expect(row(make(notify(false))), name + ' 꺼진 경우(이미 켜져 있음)').toBeUndefined();
      const shown = make(notify(true, { onPress: p }));
      expect(row(shown), name).toBeTruthy();
      expect(text(shown)).toContain('매일 새 복권이 나오면 알려 드릴게요');
      expect(text(shown)).toContain('켜기');
      row(shown)!.props.onPress();
    }
    expect(p).toHaveBeenCalledTimes(3);
  });
  it('busy 동안은 눌리지 않고, 글자는 바꿀 수 있다 · 옛 onEnableNotify 줄은 그대로', () => {
    const busy = nodes(LotteryResult({ result: { won: 100, points: 160, unopened: 0 }, onClose: vi.fn(), notify: notify(true, { busy: true, label: '알림 켜기', hint: '힌트' }) }));
    const r = buttons(busy).find(b => b.props.accessibilityLabel === '알림 켜기')!;
    expect(r.props.disabled).toBe(true);
    expect(text(busy)).toContain('힌트');
    const legacy = nodes(LotterySheet({ open: true, state: st, winners: [], onOpen: vi.fn(), onEarn: vi.fn(), onClose: vi.fn(), onEnableNotify: vi.fn() }));
    expect(text(legacy)).toContain('복권 받게 알림 켜기');
  });
});
