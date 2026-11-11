"use strict";
/**
 * 페이지 계산 — 화면 없이 시험하는 순수 함수(react-native 를 가져오지 않는다, 0.4.0).
 * 앱이 이미 가진 값(완료 · 놓침 · 걸음 수 · 남은 시간)을 넘기면 글자 · 칸 · 상태만 정한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UPDATE_NOTICE = void 0;
exports.slotButtonLabel = slotButtonLabel;
exports.slotStatusLine = slotStatusLine;
exports.slotWindowLabel = slotWindowLabel;
exports.slotCount = slotCount;
exports.missionProgress = missionProgress;
exports.bonusButtonLabel = bonusButtonLabel;
exports.stepsSummary = stepsSummary;
exports.stepsBubble = stepsBubble;
exports.waitLeftMs = waitLeftMs;
exports.clockText = clockText;
exports.drawLabel = drawLabel;
exports.drawSubLine = drawSubLine;
exports.prizeLine = prizeLine;
exports.normalizeInviteCode = normalizeInviteCode;
exports.inviteHeadline = inviteHeadline;
exports.boostLine = boostLine;
/** 칸 버튼 글자 — 받았으면 「받았어요」, 지났으면 「놓쳤어요」, 받을 수 있으면 「받기」, 그 밖은 「아직」 */
function slotButtonLabel(slot) {
    if (slot.done)
        return '받았어요';
    if (slot.missed)
        return '놓쳤어요';
    if (slot.claimable)
        return '받기';
    return '아직';
}
/** 칸 아래 한 줄 — 「아침 9시~11시」 옆 글(받았어요 · 시간이 지났어요 · 회차 · 양) */
function slotStatusLine(slot, itemName) {
    if (slot.done)
        return `${slot.step}회차로 받았어요`;
    if (slot.missed)
        return '시간이 지났어요';
    return `${slot.step}회차 · ${itemName} ${slot.reward}`;
}
/** 「아침 9시~11시」 */
function slotWindowLabel(slot) {
    return `${slot.name} ${slot.fromHour}시~${slot.toHour}시`;
}
/** 「3칸 중 몇 칸」 — 받은 칸 수와 전체 칸 수 */
function slotCount(slots) {
    return { done: slots.filter(x => x.done).length, total: slots.length };
}
/** 진행 수 · 퍼센트 · 전부 끝났는지 — 보이는 줄만 넘긴다(앱이 hidden 을 거른다) */
function missionProgress(rows) {
    const total = rows.length;
    const done = rows.filter(r => r.done === true).length;
    return { done, total, allDone: total > 0 && done === total, percent: total > 0 ? (done / total) * 100 : 0 };
}
/** 오늘 미션 보너스 큰 단추 글 — 보너스가 0 이면 단추를 그리지 않는다(호출하지 않는다) */
function bonusButtonLabel(bonus) {
    return `모두 완료하고 ${bonus.toLocaleString()}P 받기`;
}
/** 오늘 걸음 수 기준으로 받을 수 있는 단계 · 다음 단계 · 남은 걸음 */
function stepsSummary(todaySteps, stages) {
    const claimable = stages.filter(x => !x.claimed && todaySteps >= x.threshold);
    const next = stages.find(x => !x.claimed && todaySteps < x.threshold);
    return {
        claimable,
        next,
        remaining: next ? next.threshold - todaySteps : 0,
        allClaimed: stages.length > 0 && stages.every(x => x.claimed),
    };
}
/** 말풍선 글 — 업데이트 전이면 「업데이트하면…」, 아니면 받을 수 있는 횟수 · 다음 단계 · 다 받음 순 */
function stepsBubble(args) {
    if (!args.available)
        return '업데이트하면 걸음 보상을 받을 수 있어요';
    const s = stepsSummary(args.todaySteps, args.stages);
    const points = args.stages[0]?.points ?? 0;
    if (s.claimable.length > 0)
        return `포인트를 ${s.claimable.length}번 받을 수 있어요`;
    if (s.next)
        return `${s.remaining.toLocaleString()}걸음 더 걸으면 ${s.next.points || points}P`;
    return '오늘 걸음 보상을 다 받았어요';
}
/** 「업데이트하면 걸음 보상을 받을 수 있어요」 — 걸음 기능이 없는 옛 빌드에서 쓰는 안내(대표님 10-19 22:30 · 패키지 0.4.0) */
exports.UPDATE_NOTICE = '업데이트하면 걸음 보상을 받을 수 있어요';
/** 행운 찬스 · 무료 뽑기 — 대기 남은 시간(ms). 서버 기준 시각 `until` 과 지금 `now` 로 정한다 */
function waitLeftMs(until, now) {
    if (!until)
        return 0;
    return Math.max(0, until - now);
}
/** 「1:05」 — 남은 시간 글 */
function clockText(ms) {
    const sec = Math.max(0, Math.ceil(ms / 1000));
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
}
/** 뽑기 단추 글 — 대기 중이면 남은 시간, 무료 한 번이면 「무료로 뽑기」, 광고를 봐야 하면 「광고 보고 한 번 더」 */
function drawLabel(args) {
    if (args.waitMs > 0)
        return `${clockText(args.waitMs)} 뒤에 뽑아요`;
    return args.free ? '무료로 뽑기' : '광고 보고 한 번 더 뽑기';
}
/** 뽑기 카드 한 줄 — 대기 · 무료 남음 · 광고로 한 번 더 · 오늘 끝 */
function drawSubLine(args) {
    if (args.waitMs > 0)
        return '조금 뒤에 다시 뽑을 수 있어요';
    if (args.free > 0)
        return `오늘 무료 뽑기가 ${args.free}번 남았어요`;
    if (args.ad > 0)
        return '광고를 보면 한 번 더 뽑을 수 있어요';
    return '오늘은 여기까지예요. 내일 또 뽑아요';
}
/** 「꽝 없이 A / B」 — 뽑으면 받는 것 목록 */
function prizeLine(prizes) {
    return prizes.length > 0 ? `꽝 없이 ${prizes.join(' / ')}` : null;
}
/** 초대 코드 입력 정리 — 영문 대문자 · 숫자만, 14자 이내(carrot InviteCard 와 같은 규칙) */
function normalizeInviteCode(raw) {
    return raw.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 14);
}
/** 초대 카드 제목 줄 — 「{n}P 받으세요」 */
function inviteHeadline(inviterPoint) {
    return `${inviterPoint.toLocaleString()}P 받으세요`;
}
/** 확률권 줄 — 「확률권 N장」, 앱 설명이 있으면 「 — 설명」을 붙인다(앱 이름이 박히지 않게, 0.4.1) */
function boostLine(boost, text) {
    const t = text?.trim();
    return t ? `확률권 ${boost}장 — ${t}` : `확률권 ${boost}장`;
}
