"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.homeRowRemoteKey = exports.FREE_NOW_BADGE = exports.CHECKIN_DONE_LABEL = exports.FREE_DONE_LABEL = exports.STEPS_PERMISSION_LABEL = exports.HOME_ORDER = void 0;
exports.homeItem = homeItem;
exports.homeRowOff = homeRowOff;
exports.buildHomeItems = buildHomeItems;
/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
exports.HOME_ORDER = ['quiz1', 'quiz2', 'checkin', 'steps', 'free_item', 'ad_item', 'today_missions', 'lucky_chance', 'invite', 'recommend'];
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
    ad_item: { icon: '🌱', tint: HEART_SOFT, ctaLabel: '광고 보기' },
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
/** 「을/를」 — 아이템 이름 끝 글자의 받침으로 고른다(한글이 아니면 「을(를)」) */
function eulReul(word) {
    const code = word.trim().slice(-1).charCodeAt(0);
    if (code >= 0xAC00 && code <= 0xD7A3)
        return (code - 0xAC00) % 28 === 0 ? '를' : '을';
    return '을(를)';
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
        case 'ad_item': return { title: `광고 보고 ${item} 받기`, subtitle: `짧은 광고를 보면 ${item}${eulReul(item)} 더 드려요` };
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
    const icon = key === 'free_item' || key === 'ad_item' ? (c.itemIcon ?? look.icon) : key === 'recommend' ? (c.recommend?.icon ?? look.icon) : look.icon;
    // 바탕색은 고정 — 앱 테마색을 따르는 걸음 · 무료 · 추천 세 줄만 앱 값(tints)이 우선
    const themed = key === 'steps' || key === 'free_item' || key === 'ad_item' || key === 'recommend' ? c.tints?.[key]?.trim() : undefined;
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
/** 줄마다 숨기기/보이기 원격설정 키(어드민 앱 설정 그룹 `home` · 항목 `row.<줄id>`) — 값 '0' / 'false' 면 숨김, 값이 없으면 켜짐 */
const homeRowRemoteKey = (key) => `home.row.${key}`;
exports.homeRowRemoteKey = homeRowRemoteKey;
const isOff = (v) => v === false || v === 0 || (typeof v === 'string' && ['0', 'false'].includes(v.trim().toLowerCase()));
const isOn = (v) => v === true || v === 1 || (typeof v === 'string' && ['1', 'true'].includes(v.trim().toLowerCase()));
/**
 * 원격설정으로 이 줄을 숨겨야 하나 — `values` 가 없으면(앱이 안 넘김) 아무것도 적용하지 않는다(앱 기존 게이팅 그대로).
 * ① `home.row.<줄id>` 가 '0' / 'false' ② 걸음 줄은 기존 키 `steps.on` 이 '1' / 'true' 가 **아니면**(없음 포함) 숨김 — 지금 당근 규칙 그대로.
 * 오퍼월(찬스 탭)은 줄이 아니라 탭이라 여기 범위 밖
 */
function homeRowOff(key, values) {
    if (!values)
        return false;
    if (isOff(values[(0, exports.homeRowRemoteKey)(key)]))
        return true;
    return key === 'steps' && !isOn(values['steps.on']);
}
const warned = new Set();
/**
 * 목록 기본 줄 — **전 줄**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작이 빠져 있으면(타입을 우회한 옛 코드) 줄은 그려지고 누름은 아무 일도 안 한다 — 개발 중에는 경고를 한 번 낸다.
 * 숨김은 `homeRowOff`(원격설정)로만 — 앱이 줄을 뺄 수 없다
 */
function buildHomeItems(c, actions, values) {
    return exports.HOME_ORDER.map(key => {
        const given = actions[key];
        if (typeof given !== 'function' && typeof __DEV__ !== 'undefined' && __DEV__ && !warned.has(key)) {
            warned.add(key);
            console.warn(`[@jcurve/mission] homeActions.${key} 가 없습니다 — 줄은 그려지지만 누르면 아무 일도 하지 않아요`);
        }
        const item = homeItem(key, c, typeof given === 'function' ? given : () => { });
        return homeRowOff(key, values) ? { ...item, hidden: true } : item;
    });
}
