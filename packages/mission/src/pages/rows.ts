/**
 * 표준 줄 두 개 — 홈 「바로 받는 혜택」 목록에 그대로 넣는다(0.4.0, 대표님 #24).
 * 앱은 아이템 이름 · 남은 수 · 누를 곳만 준다. react-native 를 가져오지 않는다(시험이 바로 돈다).
 */
import type { ReactNode } from 'react';
import type { BenefitQuickItem } from '../BenefitQuickList';

/** 「무료 {item} 받기 · 하루 3번 광고 없이 받기 [받기]」 줄 — carrot 홈 freeHeart 줄과 같은 모양 */
export function freeItemRow(args: {
  /** 아이템 이름 — 양분 · 캡슐 · 열매 · 먹이 */
  itemName: string;
  /** 오늘 남은 방문 수(0~total). 주면 칸 막대 「N번 남았어요」, 0 이면 「완료」 */
  left?: number;
  /** 하루 방문 수 — 기본 3 */
  total?: number;
  onPress: () => void;
  /** 아이콘 — 기본 🌱 글자 */
  icon?: ReactNode;
  /** 바탕색 — 기본 연한 주황 */
  tint?: string;
  hidden?: boolean;
  /** 줄 key — 기본 'freeItem' */
  key?: string;
}): BenefitQuickItem {
  const total = args.total ?? 3;
  const hasLeft = args.left !== undefined;
  const left = Math.max(0, Math.min(total, args.left ?? total));
  const done = hasLeft && left === 0;

  return {
    key: args.key ?? 'freeItem',
    title: `무료 ${args.itemName} 받기`,
    subtitle: `하루 ${total}번 광고 없이 받기`,
    ctaLabel: '받기',
    icon: args.icon ?? '🌱',
    tint: args.tint ?? '#FDE6D6',
    hidden: args.hidden,
    done,
    onPress: args.onPress,
    ...(hasLeft ? {
      progress: { done: total - left, total },
      progressLabel: done ? '오늘 다 받았어요' : `${left}번 남았어요`,
    } : {}),
  };
}

/** 「추천 앱 둘러보기 · 보러가기」 줄 — 앱이 추천 앱 기능을 켰을 때만 hidden 을 끈다 */
export function appHubRow(args: {
  onPress: () => void;
  /** 줄 부제 — 기본 「추천 앱 둘러보기」(carrot 과 같은 기본) */
  subtitle?: string;
  icon?: ReactNode;
  tint?: string;
  hidden?: boolean;
  key?: string;
}): BenefitQuickItem {
  return {
    key: args.key ?? 'apphub',
    title: '추천 앱 둘러보기',
    subtitle: args.subtitle ?? '추천 앱 둘러보기',
    ctaLabel: '보러가기',
    icon: args.icon ?? '⭐',
    tint: args.tint ?? '#FFF1E6',
    hidden: args.hidden,
    onPress: args.onPress,
  };
}
