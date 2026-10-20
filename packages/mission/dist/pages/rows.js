"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.freeItemRow = freeItemRow;
exports.appHubRow = appHubRow;
/**
 * 「무료 {item} 받기 · 하루 3번 들르면 {item} 받기 [받기]」 줄 — carrot 홈 freeHeart 줄과 같은 모양.
 * 부제 기본은 **방문형** 「하루 N번 들르면 ○○ 받기」(0.7.1, 대표님 10-20 — 당근 문구). 광고형 앱은 `subtitle` 로 바꾼다(예: 「하루 3번 광고 없이 받기」).
 */
function freeItemRow(args) {
    const total = args.total ?? 3;
    const hasLeft = args.left !== undefined;
    const left = Math.max(0, Math.min(total, args.left ?? total));
    const done = hasLeft && left === 0;
    return {
        key: args.key ?? 'freeItem',
        title: `무료 ${args.itemName} 받기`,
        subtitle: args.subtitle ?? `하루 ${total}번 들르면 ${args.itemName} 받기`,
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
