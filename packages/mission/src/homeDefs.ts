/**
 * 홈 「바로 받는 혜택」 목록 9줄의 **정의 전체**(0.7.5, 대표님 10-20 20:23 「패키지잖아 갖다 넣으면 똑같은 게 그냥 튀어 나와야 하는데」).
 * 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서를 **패키지가 가진다** — 기준은 당근캐시 홈(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS).
 * 앱은 **아이템 이름 · 포인트 이름 · 줄마다 누르기 동작**과 값(걸음 수 · 무료 받은/남은 횟수 · 추천 부제)만 넘긴다 — 앱이 아이콘 · 부제 · 숨김을 덮어쓰지 못한다.
 * **동작(actions)을 안 넘긴 줄은 그 앱에서 빠진다**(예: 기능이 없는 앱의 무료 아이템 줄). 서버 home_rows 가 덮는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐이고 아이콘 · 바탕색은 늘 여기 정의다.
 *
 * 순수 TS — react / react-native 를 가져오지 않는다(타입만 `import type`). 시험이 바로 돈다. 다른 줄(0.4.x)에 파일 그대로 옮길 수 있게 `pages/rows` 등 다른 모듈에 기대지 않는다.
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { HomeRowKey } from './home';

/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
export const HOME_ORDER: readonly HomeRowKey[] = ['quiz1', 'quiz2', 'checkin', 'steps', 'free_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'];

/** 줄마다 누르면 할 일 — 넣은 줄만 그려진다 */
export type HomeActions = Partial<Record<HomeRowKey, () => void>>;

/** 앱이 넘기는 이름 · 값 — 아이콘 · 부제 · 숨김은 받지 않는다 */
export type HomeContext = {
  /** 앱 이름(접근성 등에 쓸 자리 — 지금 문구에는 안 들어간다) */
  appName?: string;
  /** 아이템 이름 — 「무료 ○○ 받기」 · 「하루 기회로 ○○ 뽑기」. 당근 「당근」, 감자밭 「감자」. 기본 「포인트」 */
  itemName?: string;
  /** 포인트 이름 — 「포인트 받기」. 기본 「포인트」 */
  pointName?: string;
  /** 포인트 단위 — 「최대 100P」. 기본 「P」 */
  pointUnit?: string;
  /** 오늘 걸음 수 — 주면 「오늘 N걸음」, 없으면 「만보기」 */
  steps?: number | null;
  /** (0.7.7) 걸음 권한이 아직 없다(묻기 전 · 거부) — true 면 걸음 줄 버튼이 「걸음 켜기」(누르면 권한부터 받는다), 아니면 「보상 받기」(대표님 20:11 아이폰 만보기 줄) */
  stepsNeedsPermission?: boolean;
  /** (0.7.8) 오늘 출석을 이미 했다 — `=== true` 일 때만 출석 줄이 완료 모양(회색 · 「출석 완료」, 다른 줄의 done 과 같음) */
  checkinDone?: boolean;
  /** 무료 아이템 줄 — 하루 방문 칸 수(기본 3) · 남은 칸(left) · 받은 횟수(received) */
  free?: { total?: number; left?: number; received?: number; claimableNow?: boolean };
  /** 무료 아이템 그림(앱 아이템 그림) — 없으면 🌱 */
  itemIcon?: BenefitQuickItem['icon'];
  /** 오늘의 미션 줄의 앱 제목(보너스 문구 같은 동적 제목) · 막대 — 서버 제목이 비어 있으면 이것이 보인다 */
  todayMissions?: { title?: string; progress?: { done: number; total: number }; progressLabel?: string };
  /** 추천 앱 줄 부제(서버 promo.desc) · 캐릭터 그림(앱 자산) */
  recommend?: { desc?: string; icon?: BenefitQuickItem['icon'] };
  /**
   * (0.7.6) **앱 테마색을 따르는 세 줄만** 바탕색을 앱이 넘길 수 있다 — 걸음 · 추천은 당근 carrotSoft(#FFEEE2), 무료 아이템은 heartSoft(#E6F5EA)가 기본이고 앱 테마의 soft 색이 있으면 그것이 우선.
   * 나머지 줄(퀴즈 · 출석 · 오늘의 미션 · 행운 찬스 · 초대)의 바탕색과 모든 아이콘은 못 바꾼다
   */
  tints?: Partial<Record<'steps' | 'free_item' | 'recommend', string>>;
};

const DEFAULT_NAME = '포인트';
/** 당근의 soft 주황(carrotSoft) — 걸음 · 추천 줄 바탕. 당근 theme.ts(814f2f4) 값 */
const CARROT_SOFT = '#FFEEE2';
/** 당근의 soft 초록 — 무료 아이템 줄 바탕(heartSoft) */
const HEART_SOFT = '#E6F5EA';

/** 아이콘 이름 + 바탕색 + 버튼 — 당근 기준 고정값(앱이 못 바꾼다) */
const LOOK: Record<HomeRowKey, { icon: BenefitQuickItem['icon']; tint: string; ctaLabel: string }> = {
  quiz1: { icon: 'bag', tint: '#FDEBE2', ctaLabel: '참여하기' },
  quiz2: { icon: 'pin', tint: '#E4F3EA', ctaLabel: '참여하기' },
  checkin: { icon: 'calendar', tint: '#E8F0FD', ctaLabel: '출석하기' },
  steps: { icon: '👟', tint: CARROT_SOFT, ctaLabel: '보상 받기' },
  free_item: { icon: '🌱', tint: HEART_SOFT, ctaLabel: '받기' },
  today_missions: { icon: 'star', tint: '#FBF1DC', ctaLabel: '보러가기' },
  lucky_chance: { icon: 'ticket', tint: '#EFE8FB', ctaLabel: '뽑기' },
  invite: { icon: 'friend', tint: '#FDEBDD', ctaLabel: '초대하기' },
  recommend: { icon: 'star', tint: CARROT_SOFT, ctaLabel: '보러가기' },
};

/** 무료 아이템 줄의 완료 버튼 글자 — 방문형이라 오늘 칸이 끝나면 「내일 다시」(대표님 10-20 19:01) */
export const FREE_DONE_LABEL = '내일 다시';

/** 출석을 이미 했을 때 출석 줄의 완료 버튼 글자(0.7.8) */
export const CHECKIN_DONE_LABEL = '출석 완료';

/** 지금 받을 수 있는 칸이 있을 때 무료 아이템 줄의 배지(0.7.8) — 서버 home_rows 에 배지가 있으면 서버 값이 우선 */
export const FREE_NOW_BADGE = '지금 받기';

/** 걸음 권한이 없을 때 걸음 줄의 버튼 글자(0.7.7) */
export const STEPS_PERMISSION_LABEL = '걸음 켜기';

/** 무료 아이템 줄 상태 — 막대(받은 횟수) · 글자 · 완료. 0.7.4 freeItemRow 와 같은 규칙(이 파일 안에서 끝낸다) */
function freeState(total: number, left: number | undefined, received: number | undefined): Pick<BenefitQuickItem, 'done' | 'progress' | 'progressLabel'> {
  const hasLeft = left !== undefined;
  const hasReceived = received !== undefined;
  if (!hasLeft && !hasReceived) return {};
  const l = Math.max(0, Math.min(total, Math.floor(left ?? total)));
  const r = Math.max(0, Math.min(total, Math.floor(received ?? 0)));
  const done = hasLeft && l === 0;
  const receivedLabel = r >= total ? '오늘 다 받았어요' : r > 0 ? `오늘 ${r}번 받았어요` : '오늘은 시간이 지났어요';

  return {
    done,
    progress: { done: hasReceived ? r : total - l, total },
    progressLabel: hasLeft && !done ? `${l}번 남았어요` : hasReceived ? receivedLabel : '오늘 다 받았어요',
  };
}

/** 한 줄의 글자(제목 · 부제) — 이름만 앱 값 */
function copy(key: HomeRowKey, c: HomeContext): { title: string; subtitle: string } {
  const item = c.itemName?.trim() || DEFAULT_NAME;
  const point = c.pointName?.trim() || DEFAULT_NAME;
  const unit = c.pointUnit?.trim() || 'P';
  switch (key) {
    case 'quiz1': return { title: '쇼핑 태그 퀴즈1', subtitle: `참여하고 최대 100${unit} 받기` };
    case 'quiz2': return { title: '플레이스 & 쇼핑 태그 퀴즈2', subtitle: `참여하고 최대 100${unit} 받기` };
    case 'checkin': return { title: '매일 출석 체크', subtitle: `10초 구경하고 ${point} 받기` };
    case 'steps': return { title: c.steps == null ? '만보기' : `오늘 ${Math.max(0, Math.floor(c.steps)).toLocaleString('ko-KR')}걸음`, subtitle: `오늘 걸음으로 ${point} 받기` };
    case 'free_item': return { title: `무료 ${item} 받기`, subtitle: `하루 ${c.free?.total ?? 3}번 들르면 ${item} 받기` };
    case 'today_missions': return { title: c.todayMissions?.title || '오늘의 미션', subtitle: `간단한 미션으로 ${point} 더 받기` };
    case 'lucky_chance': return { title: '행운 찬스', subtitle: `하루 기회로 ${item} 뽑기` };
    case 'invite': return { title: '친구 초대하기', subtitle: '친구가 가입하면 같이 받기' };
    case 'recommend': return { title: '추천 앱 둘러보기', subtitle: c.recommend?.desc?.trim() || '추천 앱 둘러보기' };
  }
}

/** 한 줄을 만든다 — 줄 key 는 서버 key 그대로라 `homeKeys` 맞춤표가 필요 없다 */
export function homeItem(key: HomeRowKey, c: HomeContext, onPress: () => void): BenefitQuickItem {
  const look = LOOK[key];
  const { title, subtitle } = copy(key, c);
  const icon = key === 'free_item' ? (c.itemIcon ?? look.icon) : key === 'recommend' ? (c.recommend?.icon ?? look.icon) : look.icon;
  // 바탕색은 고정 — 앱 테마색을 따르는 걸음 · 무료 · 추천 세 줄만 앱 값(tints)이 우선
  const themed = key === 'steps' || key === 'free_item' || key === 'recommend' ? c.tints?.[key]?.trim() : undefined;
  const ctaLabel = key === 'steps' && c.stepsNeedsPermission === true ? STEPS_PERMISSION_LABEL : look.ctaLabel;
  const item: BenefitQuickItem = { key, title, subtitle, ctaLabel, icon, tint: themed || look.tint, onPress };
  if (key === 'free_item') {
    const state = freeState(Math.max(1, Math.floor(c.free?.total ?? 3)), c.free?.left, c.free?.received);
    // 지금 받을 수 있는 칸이 있고 아직 끝나지 않았을 때만 「지금 받기」 배지(0.7.8)
    const now = c.free?.claimableNow === true && state.done !== true;

    return { ...item, doneLabel: FREE_DONE_LABEL, ...state, ...(now ? { badge: FREE_NOW_BADGE } : {}) };
  }
  if (key === 'checkin' && c.checkinDone === true) return { ...item, done: true, doneLabel: CHECKIN_DONE_LABEL };
  if (key === 'today_missions' && c.todayMissions?.progress) {
    return { ...item, progress: c.todayMissions.progress, ...(c.todayMissions.progressLabel ? { progressLabel: c.todayMissions.progressLabel } : {}) };
  }

  return item;
}

/**
 * 목록 기본 줄 — **actions 에 있는 줄만**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작을 안 넘긴 줄(그 앱에 기능이 없음)은 만들지 않는다.
 */
export function buildHomeItems(c: HomeContext, actions: HomeActions): BenefitQuickItem[] {
  const out: BenefitQuickItem[] = [];
  for (const key of HOME_ORDER) {
    const press = actions[key];
    if (typeof press === 'function') out.push(homeItem(key, c, press));
  }

  return out;
}
