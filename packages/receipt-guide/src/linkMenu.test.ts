import { describe, expect, it, vi } from 'vitest';
import { linkedMenuItems, linkedMenuTitle } from './linkMenu';
import { linkGuide } from './linkGuides';

describe('연동됨 시트', () => {
  const on = { importOrders: vi.fn(), showOrders: vi.fn(), showGuide: vi.fn(), openLogin: vi.fn(), withdraw: vi.fn() };

  it('일반 회원: 4개 · iOS 순서 · 「연동 해제」만 빨강', () => {
    const items = linkedMenuItems(on);
    expect(items.map((i) => i.label)).toEqual(['주문 불러오기', '불러온 주문 보기', '사용 방법 보기', '연동 해제']);
    expect(items.map((i) => i.destructive === true)).toEqual([false, false, false, true]);
    items[0]!.onPress(); expect(on.importOrders).toHaveBeenCalledTimes(1);
    items[3]!.onPress(); expect(on.withdraw).toHaveBeenCalledTimes(1);
  });

  it('probe(어드민 시험 회원)만 「로그인 창 열기 (구조 기록)」이 끼어든다 — 연동 해제 바로 앞', () => {
    expect(linkedMenuItems(on, { probe: true }).map((i) => i.label)).toEqual(['주문 불러오기', '불러온 주문 보기', '사용 방법 보기', '로그인 창 열기 (구조 기록)', '연동 해제']);
    expect(linkedMenuItems({ ...on, openLogin: undefined }, { probe: true })).toHaveLength(4);
  });

  it('제목 · 안내 속 메뉴 장면 글자가 같다', () => {
    expect(linkedMenuTitle('네이버')).toBe('네이버 연동됨');
    const menuStep = linkGuide('naver').steps.find((s) => s.nodes.some((n) => n.type === 'menu'));
    const menu = menuStep?.nodes.find((n) => n.type === 'menu');
    expect(menu && menu.type === 'menu' ? menu.items : []).toEqual(linkedMenuItems(on).map((i) => i.label));
  });
});
