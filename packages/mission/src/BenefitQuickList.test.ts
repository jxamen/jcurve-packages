import React, { type ReactElement } from 'react';
import { describe, it, expect, vi } from 'vitest';
vi.mock('react-native', () => ({ View: 'View', Text: 'Text', Pressable: 'Pressable', StyleSheet: { create: (v: unknown) => v } }));
// 단추를 센다 — 0.4.3 부터 줄 하나가 Pressable 하나(안쪽 버튼은 그림 View)
const isButton = (n: any) => n?.type === 'Pressable' && n.props?.accessibilityRole === 'button';
const cta = (tree: any[]) => tree.find(n => n?.type === 'View' && n.props?.pointerEvents === 'none' && n.props.style?.[1]?.width !== undefined);
import { BenefitQuickList, iconKind, pressOnce, resetTapGuard, TAP_GUARD_MS, type BenefitQuickItem } from './BenefitQuickList';
import { HOME_ORDER, type HomeActions } from './homeDefs';
const everyAction = (): HomeActions => Object.fromEntries(HOME_ORDER.map(k => [k, vi.fn()])) as HomeActions;
import { beforeEach } from 'vitest';
beforeEach(() => resetTapGuard());
// Walk the rendered React element tree, including functional icon components.
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const element = node as ReactElement<any>;
  if (typeof element.type === 'function') return nodes((element.type as any)(element.props));
  return [element, ...nodes(element.props.children)];
}
const item = (overrides: Partial<BenefitQuickItem> = {}): BenefitQuickItem => ({ key: 'a', title: '출석', subtitle: '매일 참여', ctaLabel: '출석하기', icon: 'calendar', tint: '#EEE', onPress: vi.fn(), ...overrides });
describe('BenefitQuickList', () => {
  it('renders default title, all built-in icons, custom node and footer; delegates presses', () => {
    const onSeeAll = vi.fn();
    const rows = ['calendar', 'bag', 'pin', 'star', 'ticket', 'friend'].map((icon, i) => item({ key: String(i), icon }));
    rows.push(item({ key: 'custom', icon: React.createElement('CustomIcon') }));
    const tree = nodes(BenefitQuickList({ items: rows, seeAllLabel: '전체', onSeeAll, footer: React.createElement('NativeAd') }));
    expect(tree).toContain('바로 받는 혜택');
    expect(tree.filter(n => isButton(n))).toHaveLength(8);
    expect(tree.some(n => n?.type === 'CustomIcon')).toBe(true);
    expect(tree.some(n => n?.type === 'NativeAd')).toBe(true);
    tree.find(n => isButton(n)).props.onPress();
    expect(onSeeAll).toHaveBeenCalledOnce();
    tree.filter(n => isButton(n))[1].props.onPress();
    expect(rows[0].onPress).toHaveBeenCalledOnce();
  });
  it('shows a disabled grey 완료 button and ignores even a direct callback invocation', () => {
    const row = item({ done: true });
    const tree = nodes(BenefitQuickList({ items: [row] }));
    const button = tree.find(n => isButton(n));
    expect(tree).toContain('완료');
    expect(tree).not.toContain('출석하기');
    expect(button.props.disabled).toBe(true);
    expect(button.props.accessibilityState.disabled).toBe(true);
    expect(cta(tree).props.style[1].backgroundColor).toBe('#D3D7DD');
    button.props.onPress();
    expect(row.onPress).not.toHaveBeenCalled();
  });
  it('omits hidden rows and optional controls, supports custom heading/accent and empty items', () => {
    const tree = nodes(BenefitQuickList({ title: '혜택', accentColor: '#123456', items: [item(), item({ key: 'hidden', title: '숨김', hidden: true })] }));
    expect(tree).toContain('혜택');
    expect(tree).not.toContain('숨김');
    const buttons = tree.filter(n => isButton(n));
    expect(buttons).toHaveLength(1);
    expect(cta(tree).props.style[1].backgroundColor).toBe('#123456');
    expect(nodes(BenefitQuickList({ items: [] })).filter(n => isButton(n))).toHaveLength(0);
  });
});

it('uses translated done text in button and accessibility label, and renders title badge', () => {
  const tree = nodes(BenefitQuickList({ doneLabel: 'Done', items: [item({ done: true, badge: '광고' })] }));
  expect(tree).toContain('Done');
  expect(tree).toContain('광고');
  expect(tree).not.toContain('완료');
  expect(tree.find(n => isButton(n)).props.accessibilityLabel).toBe('출석, Done');
});
it('gives all buttons the same fixed default width and allows overriding it', () => {
  const rows = [item(), item({ key: 'long', ctaLabel: '뽑으러 가기' }), item({ key: 'done', done: true })];
  for (const buttonWidth of [undefined, 120]) {
    const tree = nodes(BenefitQuickList({ items: rows, buttonWidth }));
    const ctas = tree.filter(n => n?.type === 'View' && n.props?.pointerEvents === 'none' && n.props.style?.[1]?.width !== undefined);
    expect(ctas.map(n => n.props.style[1].width)).toEqual(Array(3).fill(buttonWidth ?? 100));
  }
});

it('drops the heading row when title is empty and there is no see-all', () => {
  const tree = JSON.stringify(nodes(BenefitQuickList({ title: '', items: [] })));
  expect(tree).not.toContain('바로 받는 혜택');
});

it('tapping anywhere on a row delegates, but not on a done row', () => {
  const go = vi.fn(); const done = vi.fn();
  const rows = nodes(BenefitQuickList({ items: [
    { key: 'a', title: 'A', subtitle: 'a', ctaLabel: 'Go', icon: 'calendar', onPress: go },
    { key: 'b', title: 'B', subtitle: 'b', ctaLabel: 'Go', icon: 'calendar', onPress: done, done: true },
  ] })).filter((n: any) => isButton(n));
  expect(rows).toHaveLength(2);
  rows[0].props.onPress(); rows[1].props.onPress();
  expect(go).toHaveBeenCalledTimes(1); expect(done).not.toHaveBeenCalled();
  expect(rows[1].props.disabled).toBe(true);
});

describe('0.4.3 한 줄 = 한 단추 · 두 번 누름 막기는 시간이 지나면 반드시 풀린다', () => {
  it('줄 안에 Pressable 이 겹치지 않는다 — 줄마다 단추 하나, 버튼 자리는 누름을 받지 않는 View', () => {
    const tree = nodes(BenefitQuickList({ title: '', items: [item(), item({ key: 'b', title: '행운 찬스', ctaLabel: '뽑기' })] }));
    const pressables = tree.filter(n => n?.type === 'Pressable');
    expect(pressables).toHaveLength(2);
    for (const p of pressables) expect(nodes(p.props.children).filter(n => n?.type === 'Pressable')).toHaveLength(0);
    expect(pressables[1].props.accessibilityLabel).toBe('행운 찬스, 뽑기');
    expect(pressables[0].props.style({ pressed: true })[2]).toEqual({ opacity: 0.85 });
  });
  it('빠른 두 번째 누름만 무시하고, 시간이 지나면 다시 들어간다(처리 함수가 던져도)', () => {
    const run = vi.fn();
    expect(pressOnce(run, 10_000)).toBe(true);
    expect(pressOnce(run, 10_000 + TAP_GUARD_MS - 1)).toBe(false);
    expect(pressOnce(run, 10_000 + TAP_GUARD_MS)).toBe(true);
    expect(run).toHaveBeenCalledTimes(2);
    expect(() => pressOnce(() => { throw new Error('x'); }, 20_000)).toThrow();
    expect(pressOnce(run, 20_000 + TAP_GUARD_MS)).toBe(true);
    // 시계가 뒤로 가도 막히지 않는다
    expect(pressOnce(run, 5_000)).toBe(true);
  });
  it('줄을 누르면 그 줄 onPress 가 한 번 — 바로 다른 줄을 눌러도 막힌다(화면 이동 중 두 곳 열림 방지)', () => {
    const a = item({ key: 'a' }); const b = item({ key: 'b' });
    const rows = nodes(BenefitQuickList({ items: [a, b] })).filter(n => isButton(n));
    rows[0].props.onPress(); rows[1].props.onPress();
    expect(a.onPress).toHaveBeenCalledOnce();
    expect(b.onPress).not.toHaveBeenCalled();
  });
});

describe('0.4.4 서버 home_rows · free_item 기본 줄', () => {
  it('새 prop 이 없으면 0.4.3 과 똑같이 그린다(줄 수 · 제목)', () => {
    const tree = nodes(BenefitQuickList({ items: [item({ key: 'a' }), item({ key: 'b', title: '퀴즈' })] }));
    expect(tree).toContain('출석');
    expect(tree).toContain('퀴즈');
    expect(tree.filter(isButton)).toHaveLength(2);
  });
  it('onFreeItem 을 주면 free_item 기본 줄이 맨 뒤에 생기고 누르면 onFreeItem — 없으면 줄이 없다', () => {
    const go = vi.fn();
    const tree = nodes(BenefitQuickList({ items: [item({ key: 'a' })], itemName: '양분', onFreeItem: go }));
    expect(tree).toContain('무료 양분 받기');
    expect(tree).toContain('하루 3번 들르면 양분 받기');
    const rows = tree.filter(isButton);
    expect(rows).toHaveLength(2);
    rows[1].props.onPress();
    expect(go).toHaveBeenCalledOnce();
    expect(nodes(BenefitQuickList({ items: [item({ key: 'a' })], itemName: '양분' })).filter(isButton)).toHaveLength(1);
  });
  it('이미 free_item(맞춤표 기준)이 있는 앱에는 겹쳐서 만들지 않는다', () => {
    const out = nodes(BenefitQuickList({ items: [item({ key: 'freeItem', title: '무료 양분 받기' })], homeKeys: { freeItem: 'free_item' }, itemName: '양분', onFreeItem: vi.fn() }));
    expect(out.filter(isButton)).toHaveLength(1);
  });
  it('fetchJson 을 주면 서버 목록을 읽는 층(함수 컴포넌트)으로 넘기고, 없으면 그림을 바로 돌려준다', () => {
    const fetchJson = vi.fn();
    const out: any = BenefitQuickList({ items: [item({ key: 'a' })], fetchJson, onFreeItem: vi.fn(), onRow: vi.fn(), refreshKey: 1 });
    expect(React.isValidElement(out)).toBe(true);
    expect(typeof out.type).toBe('function');
    expect(out.props.fetchJson).toBe(fetchJson);
    expect(out.props.items.map((i: BenefitQuickItem) => i.key)).toEqual(['a', 'free_item']);
    expect(out.props.refreshKey).toBe(1);
    expect((BenefitQuickList({ items: [item()] }) as any).type).toBe('View');
  });
});

describe('BenefitQuickList — 줄별 완료 글자(doneLabel, 0.7.4)', () => {
  it('done 줄은 그 줄의 doneLabel 을 버튼 글자 · 접근성 이름에 쓰고, 없으면 목록의 doneLabel(기본 「완료」)', () => {
    const own = item({ key: 'free', title: '무료 감자', done: true, doneLabel: '내일 다시' });
    const plain = item({ key: 'b', title: '출석', done: true });
    const tree = nodes(BenefitQuickList({ items: [own, plain], doneLabel: '끝' }));
    const buttons = tree.filter(n => isButton(n));
    expect(buttons.map(b => b.props.accessibilityLabel)).toEqual(['무료 감자, 내일 다시', '출석, 끝']);
    expect(tree).toContain('내일 다시');
    expect(tree).toContain('끝');
    expect(tree).not.toContain('완료');
    // 목록 doneLabel 도 안 주면 기본 「완료」, 줄별 값은 여전히 이긴다
    const dflt = nodes(BenefitQuickList({ items: [own, plain] }));
    expect(dflt.filter(n => isButton(n)).map(b => b.props.accessibilityLabel)).toEqual(['무료 감자, 내일 다시', '출석, 완료']);
  });

  it('done 이 아닌 줄은 doneLabel 이 있어도 원래 버튼 글자 · 누를 수 있다', () => {
    const row = item({ key: 'free', ctaLabel: '받기', doneLabel: '내일 다시' });
    const tree = nodes(BenefitQuickList({ items: [row] }));
    expect(tree).toContain('받기');
    expect(tree).not.toContain('내일 다시');
    expect(tree.find(n => isButton(n)).props.disabled).toBeFalsy();
  });
});

describe('BenefitQuickList — homeActions: 줄 정의는 패키지, 동작만 앱 (0.7.5)', () => {
  it('homeActions 를 주면 패키지 정의(당근 기준)로 10줄을 그리고, 동작이 빠져도 줄은 빠지지 않으며(누름 무반응), 앱 items 는 쓰지 않는다', () => {
    const quiz = vi.fn(); const invite = vi.fn();
    const tree = nodes(BenefitQuickList({ homeActions: { quiz1: quiz, invite } as unknown as HomeActions, homeContext: { pointName: '캐시' }, items: [item({ key: 'x', title: '앱이 만든 줄' })] }));
    expect(tree).toContain('쇼핑 태그 퀴즈1');
    expect(tree).toContain('친구 초대하기');
    expect(tree).toContain('매일 출석 체크');                                           // 동작을 안 넘겨도 줄은 그려진다(0.7.13)
    expect(tree).toContain('광고 보고 포인트 받기');                                     // 광고 아이템 줄
    expect(tree).not.toContain('앱이 만든 줄');
    const rows = tree.filter(n => isButton(n));
    expect(rows).toHaveLength(10);
    rows[0].props.onPress();
    expect(quiz).toHaveBeenCalledOnce();
    expect(invite).not.toHaveBeenCalled();
    expect(() => rows[2].props.onPress()).not.toThrow();                                // 동작 없는 출석 줄 — 무반응
    // 아이콘 바탕색은 패키지 값 — 퀴즈1 #FDEBE2, 초대 #FDEBDD
    expect(JSON.stringify(tree.filter(n => n?.props?.style).map(n => n.props.style))).toContain('#FDEBE2');
    expect(JSON.stringify(tree.filter(n => n?.props?.style).map(n => n.props.style))).toContain('#FDEBDD');
  });

  it('무료 아이템 줄은 값(받은 횟수)과 완료 글자 「내일 다시」까지 패키지가 정한다', () => {
    const tree = nodes(BenefitQuickList({ homeActions: everyAction(), homeContext: { itemName: '감자', free: { left: 0, received: 1 } } }));
    expect(tree).toContain('무료 감자 받기');
    expect(tree).toContain('오늘 1번 받았어요');
    expect(tree).toContain('내일 다시');
    expect(tree.find(n => isButton(n) && String(n.props.accessibilityLabel).startsWith('무료 감자 받기')).props.disabled).toBe(true);
  });

  it('remoteValues: home.row.<줄id> 가 0 / false 면 그 줄만 숨기고, 값이 없으면 켜짐, 걸음 줄은 steps.on 이 1 이어야 보인다 (0.7.13)', () => {
    const count = (props: Record<string, unknown>) => nodes(BenefitQuickList({ homeActions: everyAction(), ...props })).filter(n => isButton(n)).length;
    expect(count({})).toBe(10);                                                          // 값 맵을 안 주면 원격 규칙 없음
    expect(count({ remoteValues: { 'steps.on': '1' } })).toBe(10);
    expect(count({ remoteValues: {} })).toBe(9);                                         // 맵은 줬는데 steps.on 이 없다 → 걸음만 숨김
    const tree = nodes(BenefitQuickList({ homeActions: everyAction(), remoteValues: { 'steps.on': '1', 'home.row.invite': '0', 'home.row.ad_item': 'false' } }));
    expect(tree.filter(n => isButton(n))).toHaveLength(8);
    expect(tree).not.toContain('친구 초대하기');
    expect(tree).not.toContain('광고 보고 포인트 받기');
    expect(tree).toContain('무료 포인트 받기');
  });

  it('서버 목록을 읽는 층에는 homeActions 방식일 때만 keepUnlisted 가 켜진다(없다고 줄을 빼지 않음)', () => {
    const fetchJson = vi.fn();
    expect((BenefitQuickList({ homeActions: everyAction(), fetchJson }) as ReactElement<any>).props.keepUnlisted).toBe(true);
    expect((BenefitQuickList({ items: [item()], fetchJson }) as ReactElement<any>).props.keepUnlisted).toBe(false);
  });

  it('homeActions 가 없으면 예전 items 방식 그대로이고, items 도 없으면 빈 목록(오류 없음)', () => {
    const tree = nodes(BenefitQuickList({ items: [item({ key: 'a', title: '앱 줄' })] }));
    expect(tree).toContain('앱 줄');
    expect(nodes(BenefitQuickList({})).filter(n => isButton(n))).toHaveLength(0);
  });

  it('글자 아이콘(👟 🌱)은 <Text> 로 감싸 그린다 — <View> 안에 글자만 두면 RN 이 빈 칸으로 그린다 (0.7.9, 감자밭 「오늘 N걸음」 빈 칸)', () => {
    const tree = nodes(BenefitQuickList({ items: [item({ key: 's', icon: '👟' }), item({ key: 'f', icon: '🌱' })] }));
    const textOf = (g: string) => tree.filter(n => n?.type === 'Text' && n.props.children === g);
    expect([textOf('👟').length, textOf('🌱').length]).toEqual([1, 1]);                                       // 줄마다 글자 하나
    expect(textOf('👟')[0].props.style).toMatchObject({ fontSize: 22, textAlign: 'center' });
    const bare = tree.filter(n => n?.type === 'View' && [n.props.children].flat(3).some((c: unknown) => c === '👟' || c === '🌱'));
    expect(bare).toHaveLength(0);                                                                            // View 의 바로 아래에 글자가 없다
  });

  it('iconKind: 기본 그림 이름 = palette, 그 밖의 글자 = text(Object 이름 toString 같은 것도), 앱 노드 = node (0.7.9)', () => {
    expect(['calendar', 'bag', 'pin', 'star', 'ticket', 'friend'].map(n => iconKind(n as any))).toEqual(Array(6).fill('palette'));
    expect(['👟', '🌱', 'toString', 'constructor', '__proto__', 'Calendar'].map(n => iconKind(n as any))).toEqual(Array(6).fill('text'));
    expect([iconKind(React.createElement('CustomIcon')), iconKind(null), iconKind(undefined), iconKind(false)]).toEqual(['node', 'node', 'node', 'node']);
    // 앱 노드는 감싸지 않고 그대로, 기본 그림 이름은 글자로 나오지 않는다
    const tree = nodes(BenefitQuickList({ items: [item({ key: 'n', icon: React.createElement('CustomIcon') }), item({ key: 'c', icon: 'calendar' })] }));
    expect(tree.filter(n => n?.type === 'CustomIcon')).toHaveLength(1);
    expect(tree).not.toContain('calendar');
  });
});
