"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FREE_NOW_BADGE = exports.CHECKIN_DONE_LABEL = exports.FREE_DONE_LABEL = exports.STEPS_PERMISSION_LABEL = exports.HOME_ORDER = void 0;
exports.homeItem = homeItem;
exports.buildHomeItems = buildHomeItems;
/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
exports.HOME_ORDER = ['quiz1', 'quiz2', 'checkin', 'steps', 'free_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'];
/** 걸음 권한이 없을 때 걸음 줄 버튼 글자(stepsNeedsPermission) */
exports.STEPS_PERMISSION_LABEL = '걸음 켜기';
const DEFAULT_NAME = '포인트';
/** 당근의 soft 주황(carrotSoft) — 걸음 · 추천 줄 바탕. 당근 theme.ts(814f2f4) 값 */
const CARROT_SOFT = '#FFEEE2';
/** 당근의 soft 초록 — 무료 아이템 줄 바탕(heartSoft) */
const HEART_SOFT = '#E6F5EA';
/** 아이콘 이름 + 바탕색 + 버튼 — 당근 기준 고정값(앱이 못 바꾼다) */
const LOOK = {
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
exports.FREE_DONE_LABEL = '내일 다시';
/** 출석을 마친 출석 줄의 버튼 글자(checkinDone) */
exports.CHECKIN_DONE_LABEL = '출석 완료';
/** 지금 받을 수 있는 칸이 있을 때 무료 아이템 줄 배지(free.claimableNow) — 서버 home_rows 의 badge 가 있으면 서버 값이 이긴다 */
exports.FREE_NOW_BADGE = '지금 받기';
/** 무료 아이템 줄 상태 — 막대(받은 횟수) · 글자 · 완료. 0.7.4 freeItemRow 와 같은 규칙(이 파일 안에서 끝낸다) */
function freeState(total, left, received) {
    const hasLeft = left !== undefined;
    const hasReceived = received !== undefined;
    if (!hasLeft && !hasReceived)
        return {};
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
function copy(key, c) {
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
function homeItem(key, c, onPress) {
    const look = LOOK[key];
    const { title, subtitle } = copy(key, c);
    const icon = key === 'free_item' ? (c.itemIcon ?? look.icon) : key === 'recommend' ? (c.recommend?.icon ?? look.icon) : look.icon;
    // 바탕색은 고정 — 앱 테마색을 따르는 걸음 · 무료 · 추천 세 줄만 앱 값(tints)이 우선
    const themed = key === 'steps' || key === 'free_item' || key === 'recommend' ? c.tints?.[key]?.trim() : undefined;
    const ctaLabel = key === 'steps' && c.stepsNeedsPermission === true ? exports.STEPS_PERMISSION_LABEL : look.ctaLabel;
    const item = { key, title, subtitle, ctaLabel, icon, tint: themed || look.tint, onPress };
    if (key === 'checkin' && c.checkinDone === true) {
        return { ...item, done: true, doneLabel: exports.CHECKIN_DONE_LABEL };
    }
    if (key === 'free_item') {
        const state = freeState(Math.max(1, Math.floor(c.free?.total ?? 3)), c.free?.left, c.free?.received);
        return { ...item, doneLabel: exports.FREE_DONE_LABEL, ...state, ...(c.free?.claimableNow === true && !state.done ? { badge: exports.FREE_NOW_BADGE } : {}) };
    }
    if (key === 'today_missions' && c.todayMissions?.progress) {
        return { ...item, progress: c.todayMissions.progress, ...(c.todayMissions.progressLabel ? { progressLabel: c.todayMissions.progressLabel } : {}) };
    }
    return item;
}
/**
 * 목록 기본 줄 — **actions 에 있는 줄만**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작을 안 넘긴 줄(그 앱에 기능이 없음)은 만들지 않는다.
 */
function buildHomeItems(c, actions) {
    const out = [];
    for (const key of exports.HOME_ORDER) {
        const press = actions[key];
        if (typeof press === 'function')
            out.push(homeItem(key, c, press));
    }
    return out;
}
