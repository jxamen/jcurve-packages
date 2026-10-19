import type { Partner, RecentReward, RewardKind, ShoppingTheme } from './types';

export const isFiniteNumber = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export const num = (n: unknown): string => isFiniteNumber(n) ? Math.max(0, Math.round(n)).toLocaleString('ko-KR') : '';

export const won = (n: unknown): string => isFiniteNumber(n) ? num(n) + '원' : '';

/** 유효한 종료 시각이 없으면 다음 한국 시각(UTC+9) 자정. */
export function dealEndsAt(endsAt: number | null | undefined, now: number): number {
  if (isFiniteNumber(endsAt) && endsAt > now) return endsAt;
  const day = 86_400_000;
  const korea = 9 * 3_600_000;
  return (Math.floor((now + korea) / day) + 1) * day - korea;
}

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

/** 기기 현지 날짜 기준 확정일까지 남은 날. 지난 날짜도 D-day로 표시한다. */
export function proofDday(confirmAt: number, now: number): string {
  const day = (at: number) => {
    const d = new Date(at);
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  };
  const left = Math.max(0, Math.round((day(confirmAt) - day(now)) / 86_400_000));
  return Number.isFinite(left) && left > 0 ? `D-${left}` : 'D-day';
}
