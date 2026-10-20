import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: unknown) => v } }));
import { GoldenLotteryPopup, LotteryChip, LotteryResult, LotterySheet } from './LotteryUi';
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
});
