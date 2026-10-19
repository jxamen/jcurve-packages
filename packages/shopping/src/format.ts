import type { Partner, RecentReward, RewardKind, ShoppingTheme } from './types';

export const won = (n: number): string => Math.max(0, Math.round(n)).toLocaleString('ko-KR') + '원';

export const num = (n: number): string => Math.max(0, Math.round(n)).toLocaleString('ko-KR');

/** 남은 시간 hh:mm:ss — 끝났으면 null(특가 줄을 안 그린다) */
export function countdown(endsAt: number, now: number): string | null {
  const left = Math.floor((endsAt - now) / 1000);
  if (!Number.isFinite(left) || left <= 0) return null;
  const p = (v: number) => String(v).padStart(2, '0');

  return `${p(Math.floor(left / 3600))}:${p(Math.floor((left % 3600) / 60))}:${p(left % 60)}`;
}

/** 적립 이름 — 포인트형은 앱 포인트 이름, 할인권형은 할인권 이름 */
export const rewardName = (kind: RewardKind, theme: ShoppingTheme): string =>
  kind === 'none' ? '' : kind === 'coupon' ? theme.couponName || '할인권' : theme.pointName;

/** 제휴처 안내 한 줄 — 「구매 금액의 3%를 P로 드려요」 */
/** 제휴처 지급 형태 이름 — 서버 설정(rewardLabel)이 있으면 그것, 없으면 테마 이름 */
export const partnerRewardName = (p: Partner, theme: ShoppingTheme): string => p.rewardKind === 'none' ? '' : (p.rewardLabel ?? '').trim() || rewardName(p.rewardKind, theme);

/** 받침이 있으면 「으로」 */
const ro = (word: string): string => {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0 && (c - 0xac00) % 28 !== 8 ? '으로' : '로';
};

export const partnerLine = (p: Partner, theme: ShoppingTheme): string => {
  if (p.rewardKind === 'none') return p.rateText;
  const name = partnerRewardName(p, theme);
  return `구매 금액의 ${p.rateText}를 ${name}${ro(name)} 드려요`;
};

/** 띠에 보일 실제 적립 기록 — 서버가 준 것 중 금액 · 이름이 있는 것만. 없으면 띠를 안 그린다(가짜 문구 금지) */
export const realRecent = (list?: RecentReward[] | null): RecentReward[] =>
  (list ?? []).filter(r => r && typeof r.maskedName === 'string' && r.maskedName.trim() !== '' && Number(r.amount) > 0);
