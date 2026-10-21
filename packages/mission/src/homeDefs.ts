/**
 * 홈 「바로 받는 혜택」 목록 10줄의 **정의 전체**(0.7.5, 대표님 10-20 20:23 「패키지잖아 갖다 넣으면 똑같은 게 그냥 튀어 나와야 하는데」).
 * 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서를 **패키지가 가진다** — 기준은 당근캐시 홈(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS).
 * 앱은 **아이템 이름 · 포인트 이름 · 줄마다 누르기 동작**과 값(걸음 수 · 무료 받은/남은 횟수 · 추천 부제)만 넘긴다 — 앱이 아이콘 · 부제 · 숨김을 덮어쓰지 못한다.
 * **줄은 앱에서 빠지지 않는다**(0.7.13, 대표님 10-21 07:07 「이거 패키지잖아 왜 다르냐고 매번」) — 동작(actions)은 전 줄 필수(타입). 숨기는 길은 원격설정 `home.row.<줄id>`('0'/'false') · 걸음 줄의 `steps.on` · 서버 home_rows 의 visible:false 뿐이다. 서버 home_rows 가 덮는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐이고 아이콘 · 바탕색은 늘 여기 정의다.
 *
 * 순수 TS — react / react-native 를 가져오지 않는다(타입만 `import type`). 시험이 바로 돈다. 다른 줄(0.4.x)에 파일 그대로 옮길 수 있게 `pages/rows` 등 다른 모듈에 기대지 않는다.
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { HomeRowKey as RemoteHomeRowKey } from './home';
// Coupang owns its authenticated action internally; existing apps still provide ten actions.
type HomeRowKey = Exclude<RemoteHomeRowKey, 'coupang_visit'>;

/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
export const HOME_ORDER: readonly HomeRowKey[] = ['quiz1', 'quiz2', 'checkin', 'steps', 'free_item', 'ad_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'];

/** 줄마다 누르면 할 일 — **전 줄 필수**(0.7.13: 빼면 컴파일 오류. 기능이 아직 없는 줄은 그 앱이 만들어 넘긴다). 런타임에 빠져 있으면 줄은 그려지고 누름은 아무 일도 안 한다 */
export type HomeActions = Record<HomeRowKey, () => void>;

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
  /**
   * (0.4.10) 걸음 권한이 없다 — `true` 일 때만 걸음 줄 버튼이 「걸음 켜기」(아니면 「보상 받기」). 앱이 권한 상태를 보고 넘긴다(대표님 20:11 아이폰 만보기 줄).
   * 제목 · 부제 · 아이콘 · 바탕색은 그대로, 다른 줄은 영향 없음. 서버 home_rows 가 걸음 줄 `button` 을 적어 두면 그 값이 덮는다(서버 규칙 그대로)
   */
  stepsNeedsPermission?: boolean;
  /**
   * (0.4.11) 오늘 출석을 마쳤다 — `=== true` 일 때만 출석 줄이 완료 모양(`done` + 버튼 「출석 완료」, 다른 줄 done 과 같은 회색). 제목 · 부제 · 아이콘 · 바탕색은 그대로, 다른 값은 완료로 안 읽는다
   */
  checkinDone?: boolean;
  /** 무료 아이템 줄 — 하루 방문 칸 수(기본 3) · 남은 칸(left) · 받은 횟수(received) */
  free?: { total?: number; left?: number; received?: number; claimableNow?: boolean };
  /** 무료 · 광고 아이템 그림(앱 아이템 그림) — 없으면 🌱 */
  itemIcon?: BenefitQuickItem['icon'];
  /** 오늘의 미션 줄의 앱 제목(보너스 문구 같은 동적 제목) · 막대 — 서버 제목이 비어 있으면 이것이 보인다 */
  todayMissions?: { title?: string; progress?: { done: number; total: number }; progressLabel?: string };
  /** 추천 앱 줄 부제(서버 promo.desc) · 캐릭터 그림(앱 자산) */
  recommend?: { desc?: string; icon?: BenefitQuickItem['icon'] };
  /**
   * (0.7.6) **앱 테마색을 따르는 네 줄만** 바탕색을 앱이 넘길 수 있다 — 걸음 · 추천은 당근 carrotSoft(#FFEEE2), 무료 · 광고 아이템은 heartSoft(#E6F5EA)가 기본이고 앱 테마의 soft 색이 있으면 그것이 우선.
   * 나머지 줄(퀴즈 · 출석 · 오늘의 미션 · 행운 찬스 · 초대)의 바탕색과 모든 아이콘은 못 바꾼다
   */
  tints?: Partial<Record<'steps' | 'free_item' | 'ad_item' | 'recommend', string>>;
};

/** 걸음 권한이 없을 때 걸음 줄 버튼 글자(stepsNeedsPermission) */
export const STEPS_PERMISSION_LABEL = '걸음 켜기';

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
  ad_item: { icon: '🌱', tint: HEART_SOFT, ctaLabel: '광고 보기' },
  today_missions: { icon: 'star', tint: '#FBF1DC', ctaLabel: '보러가기' },
  lucky_chance: { icon: 'ticket', tint: '#EFE8FB', ctaLabel: '뽑기' },
  invite: { icon: 'friend', tint: '#FDEBDD', ctaLabel: '초대하기' },
  recommend: { icon: 'star', tint: CARROT_SOFT, ctaLabel: '보러가기' },
};

/** 무료 아이템 줄의 완료 버튼 글자 — 방문형이라 오늘 칸이 끝나면 「내일 다시」(대표님 10-20 19:01) */
export const FREE_DONE_LABEL = '내일 다시';
/** 출석을 마친 출석 줄의 버튼 글자(checkinDone) */
export const CHECKIN_DONE_LABEL = '출석 완료';
/** 지금 받을 수 있는 칸이 있을 때 무료 아이템 줄 배지(free.claimableNow) — 서버 home_rows 의 badge 가 있으면 서버 값이 이긴다 */
export const FREE_NOW_BADGE = '지금 받기';

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

/** 「을/를」 — 아이템 이름 끝 글자의 받침으로 고른다(한글이 아니면 「을(를)」) */
function eulReul(word: string): string {
  const code = word.trim().slice(-1).charCodeAt(0);
  if (code >= 0xAC00 && code <= 0xD7A3) return (code - 0xAC00) % 28 === 0 ? '를' : '을';

  return '을(를)';
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
    case 'ad_item': return { title: `광고 보고 ${item} 받기`, subtitle: `짧은 광고를 보면 ${item}${eulReul(item)} 더 드려요` };
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
  const icon = key === 'free_item' || key === 'ad_item' ? (c.itemIcon ?? look.icon) : key === 'recommend' ? (c.recommend?.icon ?? look.icon) : look.icon;
  // 바탕색은 고정 — 앱 테마색을 따르는 걸음 · 무료 · 추천 세 줄만 앱 값(tints)이 우선
  const themed = key === 'steps' || key === 'free_item' || key === 'ad_item' || key === 'recommend' ? c.tints?.[key]?.trim() : undefined;
  const ctaLabel = key === 'steps' && c.stepsNeedsPermission === true ? STEPS_PERMISSION_LABEL : look.ctaLabel;
  const item: BenefitQuickItem = { key, title, subtitle, ctaLabel, icon, tint: themed || look.tint, onPress };
  if (key === 'checkin' && c.checkinDone === true) {
    return { ...item, done: true, doneLabel: CHECKIN_DONE_LABEL };
  }
  if (key === 'free_item') {
    const state = freeState(Math.max(1, Math.floor(c.free?.total ?? 3)), c.free?.left, c.free?.received);

    return { ...item, doneLabel: FREE_DONE_LABEL, ...state, ...(c.free?.claimableNow === true && !state.done ? { badge: FREE_NOW_BADGE } : {}) };
  }
  if (key === 'today_missions' && c.todayMissions?.progress) {
    return { ...item, progress: c.todayMissions.progress, ...(c.todayMissions.progressLabel ? { progressLabel: c.todayMissions.progressLabel } : {}) };
  }

  return item;
}

/** 원격설정 값 맵(앱 설정 `values` — 키는 「그룹.항목」) */
export type RemoteValues = Readonly<Record<string, unknown>>;

/** 줄마다 숨기기/보이기 원격설정 키(어드민 앱 설정 그룹 `home` · 항목 `row.<줄id>`) — 값 '0' / 'false' 면 숨김, 값이 없으면 켜짐 */
export const homeRowRemoteKey = (key: HomeRowKey): string => `home.row.${key}`;

const isOff = (v: unknown): boolean => v === false || v === 0 || (typeof v === 'string' && ['0', 'false'].includes(v.trim().toLowerCase()));
const isOn = (v: unknown): boolean => v === true || v === 1 || (typeof v === 'string' && ['1', 'true'].includes(v.trim().toLowerCase()));

/**
 * 원격설정으로 이 줄을 숨겨야 하나 — `values` 가 없으면(앱이 안 넘김) 아무것도 적용하지 않는다(앱 기존 게이팅 그대로).
 * ① `home.row.<줄id>` 가 '0' / 'false' ② 걸음 줄은 기존 키 `steps.on` 이 '1' / 'true' 가 **아니면**(없음 포함) 숨김 — 지금 당근 규칙 그대로.
 * 오퍼월(찬스 탭)은 줄이 아니라 탭이라 여기 범위 밖
 */
export function homeRowOff(key: HomeRowKey, values: RemoteValues | undefined): boolean {
  if (!values) return false;
  if (isOff(values[homeRowRemoteKey(key)])) return true;

  return key === 'steps' && !isOn(values['steps.on']);
}

declare const __DEV__: boolean | undefined;
const warned = new Set<string>();

/**
 * 목록 기본 줄 — **전 줄**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작이 빠져 있으면(타입을 우회한 옛 코드) 줄은 그려지고 누름은 아무 일도 안 한다 — 개발 중에는 경고를 한 번 낸다.
 * 숨김은 `homeRowOff`(원격설정)로만 — 앱이 줄을 뺄 수 없다
 */
export function buildHomeItems(c: HomeContext, actions: Partial<HomeActions>, values?: RemoteValues): BenefitQuickItem[] {
  return HOME_ORDER.map(key => {
    const given = actions[key];
    if (typeof given !== 'function' && typeof __DEV__ !== 'undefined' && __DEV__ && !warned.has(key)) {
      warned.add(key);
      console.warn(`[@jcurve/mission] homeActions.${key} 가 없습니다 — 줄은 그려지지만 누르면 아무 일도 하지 않아요`);
    }
    const item = homeItem(key, c, typeof given === 'function' ? given : () => {});

    return homeRowOff(key, values) ? { ...item, hidden: true } : item;
  });
}
