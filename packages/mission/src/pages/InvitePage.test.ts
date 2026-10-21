import React, { type ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
vi.mock('react', async () => ({ ...await vi.importActual<any>('react'), useState: (v: any) => [v, vi.fn()], useEffect: vi.fn(), useRef: (v: any) => ({ current: v }) }));
vi.mock('react-native', () => ({
  View: 'View', Text: 'Text', Pressable: 'Pressable', ScrollView: 'ScrollView', TextInput: 'TextInput', StyleSheet: { create: (v: unknown) => v },
  BackHandler: { addEventListener: () => ({ remove: vi.fn() }) },
  Platform: { OS: 'ios' }, PanResponder: { create: (cfg: unknown) => ({ panHandlers: cfg }) },
}));
import { InvitePage } from './InvitePage';
import { PageButton, resolvePageTheme } from './PageFrame';

/** 렌더 트리를 납작하게 편다(함수 컴포넌트는 불러서 펼친다) */
function nodes(node: any): any[] {
  if (Array.isArray(node)) return node.flatMap(nodes);
  if (!React.isValidElement(node)) return [node];
  const el = node as ReactElement<any>;
  if (typeof el.type === 'function') return nodes((el.type as any)(el.props));
  return [el, ...nodes(el.props.children)];
}
const base = { code: 'ABC123', onVerify: vi.fn(), inviterPoint: 500, inviteePoint: 300, inviterBoost: 1, inviteeBoost: 2, invited: 2, waiting: 1, onJoin: vi.fn(), onShare: vi.fn(), onBack: vi.fn() };
const page = (over: Record<string, unknown> = {}) => nodes(InvitePage({ ...base, ...over } as any));
const strings = (tree: any[]) => tree.filter(x => typeof x === 'string');
/** 스타일(배열 · 함수 · 중첩)을 하나의 객체로 */
const flat = (style: any): Record<string, any> => {
  const s = typeof style === 'function' ? style({ pressed: false }) : style;
  return Object.assign({}, ...([] as any[]).concat(s).flat(Infinity).filter(Boolean));
};
const pressable = (tree: any[], label: string) => tree.find(n => n?.type === 'Pressable' && n.props.accessibilityLabel === label);
const labelText = (tree: any[], label: string) => tree.find(n => n?.type === 'Text' && n.props.children === label && n.props.numberOfLines === 1);

describe('친구 초대 화면 — 제목 · 첫 줄 · 현황 칸 · 단추(0.4.14, 대표님 10-20 23:09)', () => {
  it('기본 제목은 「친구 초대하고」, 카드 첫 줄의 「친구 초대하고」는 없다 — 카드는 「500P 받으세요」로 시작', () => {
    const text = strings(page());
    expect(text.filter(t => t === '친구 초대하고'), '머리에 한 번뿐').toHaveLength(1);
    expect(text).not.toContain('친구 초대');                                       // 옛 기본 제목
    expect(text[text.indexOf('친구 초대하고') + 1]).toBe('500P 받으세요');
  });
  it('앱이 title 을 주면 그 제목을 쓴다(기본값만 바뀌었다)', () => {
    const text = strings(page({ title: '내 제목' }));
    expect(text).toContain('내 제목');
    expect(text).not.toContain('친구 초대하고');
  });
  it('「미션 현황(친구 · 나)」 칸과 「내 친구 초대 현황」 두 줄이 없다 — 값도 안 나온다', () => {
    const text = strings(page());
    for (const gone of ['미션 현황', '친구', '나', '내 친구 초대 현황', '초대 성공한 친구', '아직 받지 않은 친구', '2명', '1명', '300P', '500P', '확률권 1장', '확률권 2장']) {
      expect(text, gone).not.toContain(gone);
    }
  });
  it('나머지는 그대로 — 부제 · 내 초대 코드 · 안내사항 · 받은 코드 넣기', () => {
    const text = strings(page());
    expect(text).toContain('친구가 코드를 넣고 한 번 받으면 둘 다 받아요');
    expect(text).toContain('내 초대 코드');
    expect(text).toContain('ABC123');
    expect(text).toContain('친구 초대 안내사항');
    expect(text).toContain('보상은 초대받은 친구가 한 번 받아야 지급돼요');
    expect(text).toContain('받은 코드 넣기');
  });

  describe('단추 세 개 — 높이 48 · 글자 15 · 모서리 12', () => {
    const tree = page();
    for (const label of ['넣기', '링크 복사', '카톡으로 공유하기']) {
      it(`「${label}」`, () => {
        const btn = pressable(tree, label);
        expect(btn, '단추가 있다').toBeDefined();
        expect(flat(btn.props.style)).toMatchObject({ height: 48, borderRadius: 12 });
        expect(flat(labelText(tree, label).props.style).fontSize).toBe(15);
      });
    }
    it('「넣기」는 폭 72 그대로, 아래 두 개는 가로를 가득 채운다', () => {
      expect(flat(pressable(tree, '넣기').props.style).width).toBe(72);
      expect(flat(pressable(tree, '링크 복사').props.style).alignSelf).toBe('stretch');
      expect(flat(pressable(tree, '카톡으로 공유하기').props.style).alignSelf).toBe('stretch');
    });
    it('「링크 복사」와 「카톡으로 공유하기」는 반반 한 줄', () => {
      const row = tree.find(n => n?.type === 'View' && flat(n.props.style).flexDirection === 'row'
        && strings(nodes(n.props.children)).includes('링크 복사') && strings(nodes(n.props.children)).includes('카톡으로 공유하기'));
      expect(row, '두 단추를 담은 한 줄').toBeDefined();
      const halves = ([] as any[]).concat(row.props.children).filter(Boolean);
      expect(halves).toHaveLength(2);
      for (const half of halves) expect(flat(half.props.style).flex).toBe(1);        // 똑같이 반
      expect(strings(nodes(halves[0].props.children))).toEqual(['링크 복사']);
      expect(strings(nodes(halves[1].props.children))).toEqual(['카톡으로 공유하기']);
    });
    it('눌렀을 때 하는 일은 그대로 — 두 단추 모두 공유', () => {
      const onShare = vi.fn();
      const t = page({ onShare });
      pressable(t, '링크 복사').props.onPress();
      pressable(t, '카톡으로 공유하기').props.onPress();
      expect(onShare).toHaveBeenCalledTimes(2);
    });
  });

  it('자격이 없으면(locked) 코드 · 넣기 · 공유 단추가 없고 인증 단추만 — 예전과 같다', () => {
    const tree = page({ locked: true });
    expect(pressable(tree, '넣기')).toBeUndefined();
    expect(pressable(tree, '링크 복사')).toBeUndefined();
    expect(pressable(tree, '간편 인증하기')).toBeDefined();
    expect(strings(tree)).toContain('간편 인증하면 초대할 수 있어요');
  });

  it('광고 자리(footer)는 그대로 — 카드 뒤 같은 스크롤 안에 한 번', () => {
    const tree = page({ footer: React.createElement('NativeAd') });
    const inScroll = nodes(tree.find(n => n?.type === 'ScrollView').props.children);
    const share = inScroll.findIndex(n => n === '카톡으로 공유하기');
    const ad = inScroll.findIndex(n => n?.type === 'NativeAd');
    expect(share).toBeGreaterThanOrEqual(0);
    expect(ad).toBeGreaterThan(share);
    expect(tree.filter(n => n?.type === 'NativeAd')).toHaveLength(1);
  });
});

describe('PageButton — 새 선택값을 안 주면 모양이 예전과 같다(0.4.14)', () => {
  const theme = resolvePageTheme(undefined);
  const render = (props: Record<string, unknown>) => nodes(PageButton({ label: '단추', onPress: vi.fn(), theme, ...props } as any));
  const parts = (props: Record<string, unknown>) => { const t = render(props); return { box: flat(t.find(n => n?.type === 'Pressable').props.style), text: flat(t.find(n => n?.type === 'Text').props.style) }; };

  it('줄 단추: 72 x 34 · 모서리 12 · 글자 14', () => {
    const { box, text } = parts({});
    expect(box).toMatchObject({ width: 72, height: 34, borderRadius: 12 });
    expect(text.fontSize).toBe(14);
  });
  it('큰 단추: 높이 52 · 모서리 14 · 글자 16 · 가로 가득', () => {
    const { box, text } = parts({ big: true });
    expect(box).toMatchObject({ height: 52, borderRadius: 14, alignSelf: 'stretch' });
    expect(text.fontSize).toBe(16);
  });
  it('줄 단추에 줄 때: 높이 · 폭은 지금처럼 (다른 화면이 쓰는 방식)', () => {
    expect(parts({ width: 100, height: 40 }).box).toMatchObject({ width: 100, height: 40, borderRadius: 12 });
  });
  it('높이 · 글자 · 모서리를 주면 큰 단추도 그대로 따른다', () => {
    const { box, text } = parts({ big: true, height: 48, fontSize: 15, radius: 12 });
    expect(box).toMatchObject({ height: 48, borderRadius: 12, alignSelf: 'stretch' });
    expect(text.fontSize).toBe(15);
  });
});
