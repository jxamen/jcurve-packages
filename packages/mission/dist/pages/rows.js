"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freeItemRow = freeItemRow;
exports.appHubRow = appHubRow;
/** 「무료 {item} 받기 · 하루 3번 광고 없이 받기 [받기]」 줄 — carrot 홈 freeHeart 줄과 같은 모양 */
function freeItemRow(args) {
    const total = args.total ?? 3;
    const hasLeft = args.left !== undefined;
    const left = Math.max(0, Math.min(total, args.left ?? total));
    const done = hasLeft && left === 0;
    const hasReceived = args.received !== undefined;
    const received = Math.max(0, Math.min(total, Math.floor(args.received ?? 0)));
    // 받은 횟수 글자 — 다 받음 · 일부 받음 · (놓쳐서) 하나도 못 받음. received 가 없으면 예전처럼 「다 받았어요」(left=0)
    const receivedLabel = received >= total ? '오늘 다 받았어요' : received > 0 ? `오늘 ${received}번 받았어요` : '오늘은 시간이 지났어요';
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
        ...(args.doneLabel !== undefined ? { doneLabel: args.doneLabel } : {}),
        ...(hasLeft || hasReceived ? {
            progress: { done: hasReceived ? received : total - left, total },
            progressLabel: hasLeft && !done ? `${left}번 남았어요` : hasReceived ? receivedLabel : '오늘 다 받았어요',
        } : {}),
    };
}
/** 「추천 앱 둘러보기 · 보러가기」 줄 — 앱이 추천 앱 기능을 켰을 때만 hidden 을 끈다 */
function appHubRow(args) {
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
