/**
 * 복권 흐름의 순수 로직(0.1.7) — 감자밭 앱의 `useHomeLottery` · `lottery/golden.ts` 가 하던 일을 패키지로 옮겼다. RN 을 부르지 않아 시험이 바로 돈다.
 * 훅(`useLotteryFlow`)은 이 함수들을 상태에 이어 붙일 뿐이다.
 */
import { goldenTier, opensWithAd, readyTiers, type LotteryOpenResult, type LotteryState, type LotteryTier, type OpenOutcome } from './lottery';

/** 황금(기본) 복권을 열기 전에 앱이 보여 주는 보상형 광고의 용도 이름 — 서버가 이 용도의 구글 SSV 를 확인한다 */
export const LOTTERY_AD_PURPOSE = 'lottery_basic';

/** 황금 복권 화면을 띄운 날짜를 기기에 남기는 기본 키 — 앱이 `goldenDayKey` 로 바꿀 수 있다 */
export const GOLDEN_DAY_KEY = 'jcurve.lottery.golden-day';

/** 광고 확인이 늦을 때(ad_required) 몇 초 뒤 다시 시도하는 간격 — 모두 쓰면 그만둔다 */
export const GOLDEN_RETRY_MS: readonly number[] = [2500, 4000];

/** 보상형 광고를 보여 주는 앱 함수의 결과 — 열렸으면 opened, 끝까지 봤으면 earned. message 는 못 봤을 때 알려 줄 말 */
export type LotteryAdResult = { earned?: boolean; opened?: boolean; message?: string };

/** 한국 날짜(YYYY-MM-DD) — 황금 복권이 하루 한 번 뜨는 기준 */
export function lotteryDayKey(now: number = Date.now()): string {
  return new Date(now + 9 * 3600 * 1000).toISOString().slice(0, 10);
}

/**
 * 결과 창 「다음 복권 열기」가 열 단계와 방법 — 그 단계에 미션 복권이 있으면 'mission'(광고 없이), 황금(기본) 복권만 남았으면 'basic'(보상형 광고를 먼저 보여 준 뒤 연다).
 * 광고 칩(`nextOpensWithAd`)이 붙는 때와 같아야 한다 — 칩이 있는데 광고 없이 열려 서버가 ad_required 로 막는 일이 없게
 */
export function nextOpen(state: LotteryState | null): { tier: number; src: 'basic' | 'mission' } | null {
  const t = readyTiers(state)[0];
  if (!t) return null;

  return { tier: t.tier, src: opensWithAd(t) ? 'basic' : 'mission' };
}

/** 오늘 황금 복권 화면을 띄울 단계 — 안 연 황금(기본) 복권이 있고 오늘 아직 안 띄웠을 때만(없으면 null) */
export function goldenToShow(state: LotteryState | null, shownDay: string | null, today: string): LotteryTier | null {
  if (shownDay === today) return null;

  return goldenTier(state);
}

/** 열기 오류 → 사람 말(null 이면 말하지 않는다 — 이미 열고 있는 중) */
export function lotteryErrorText(error: string): string | null {
  switch (error) {
    case 'busy': return null;
    case 'ad_required': return '광고 확인이 늦어지고 있어요. 잠시 뒤 다시 눌러 주세요';
    case 'not_ready':
    case 'not_reached': return '아직 열 수 있는 복권이 없어요';
    case 'already_opened': return '이미 연 복권이에요';
    case 'network': return '연결이 끊겼어요. 잠시 후 다시 시도해 주세요';
    default: return '복권을 열지 못했어요. 잠시 후 다시 시도해 주세요';
  }
}

const realSleep = (ms: number): Promise<void> => new Promise<void>(ok => setTimeout(ok, ms));

/** 황금(기본) 복권 열기 — 서버가 구글 확인을 늦게 받으면(ad_required) 간격마다 한 번씩 더. 다른 오류나 성공이면 바로 끝 */
export async function openBasicWithRetry(
  open: (tier: number) => Promise<OpenOutcome>, tier: number, waits: readonly number[] = GOLDEN_RETRY_MS, sleep: (ms: number) => Promise<void> = realSleep,
): Promise<OpenOutcome> {
  let out = await open(tier);
  for (const wait of waits) {
    if (out.ok || out.error !== 'ad_required') break;
    await sleep(wait);
    out = await open(tier);
  }

  return out;
}

/**
 * 복권 한 장 열기 — 미션 복권('mission')은 광고 없이, 황금(기본) 복권('basic')은 보상형 광고(`lottery_basic`)를 먼저 보여 준 뒤 연다.
 * 서버가 광고 시청을 구글 SSV 로 확인한다 — 앱 말만 믿지 않는다. 광고가 열렸는데 보상 이벤트가 앱에 안 온 경우(미디에이션)도 서버에 물어본다.
 * 광고가 열리지도 않았으면 여기서 멈추고 `ad.message` 를 알린다. `onOutcome` 은 결과를 화면에 반영하고 열었으면 true 를 돌려준다. 열었으면 true.
 */
export async function openLotteryTier(a: {
  tier: number;
  src: 'basic' | 'mission';
  open: (tier: number, src: 'basic' | 'mission') => Promise<OpenOutcome>;
  showRewardedAd?: (purpose: string) => Promise<LotteryAdResult>;
  say: (text: string) => void;
  onOutcome: (o: OpenOutcome) => boolean;
  waits?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}): Promise<boolean> {
  if (a.src === 'mission') return a.onOutcome(await a.open(a.tier, 'mission'));
  if (!a.showRewardedAd) {
    a.say('광고를 준비하지 못했어요. 잠시 후 다시 시도해 주세요');

    return false;
  }
  const ad = await a.showRewardedAd(LOTTERY_AD_PURPOSE);
  if (!ad.earned && !ad.opened) {
    a.say(ad.message ?? '광고를 끝까지 보지 않았어요');

    return false;
  }

  return a.onOutcome(await openBasicWithRetry(t => a.open(t, 'basic'), a.tier, a.waits, a.sleep));
}

/**
 * 황금 복권 광고를 열어 둔 채 앱이 꺼졌으면 — 다음 실행에 서버에 구글 확인이 와 있는지 보고 복권을 이어 연다(앱이 `recoverPending` 에 이 함수를 감싸 준다).
 * 이미 열었으면(남은 황금 복권이 없으면) 서버가 거절하거나 열 복권이 없어 조용히 끝난다. 실패는 알리지 않는다.
 */
export async function claimPendingBasic(a: {
  refresh: () => Promise<LotteryState | null>;
  open: (tier: number, src: 'basic') => Promise<OpenOutcome>;
  onOutcome: (o: OpenOutcome) => boolean;
  waits?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
}): Promise<void> {
  const st = await a.refresh();
  const tier = st ? readyTiers(st).find(t => t.basicUnopened > 0)?.tier : undefined;
  if (!tier) return;
  const out = await openBasicWithRetry(t => a.open(t, 'basic'), tier, a.waits, a.sleep);
  if (out.ok) a.onOutcome(out);
}

export type { LotteryOpenResult };
