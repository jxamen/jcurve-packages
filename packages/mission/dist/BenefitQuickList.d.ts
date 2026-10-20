import React, { type ReactNode } from 'react';
export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
    key: string;
    title: string;
    subtitle: string;
    badge?: string;
    ctaLabel: string;
    icon: BenefitQuickIcon | ReactNode;
    tint: string;
    onPress: () => void;
    done?: boolean;
    hidden?: boolean;
    /** 부제 대신 칸 막대로 몇 개 했는지 보여 준다(2026-10-19 당근 대표님 「여기처럼 몇 개 있는지 표기」) */
    progress?: {
        done: number;
        total: number;
    };
    /** 칸 막대 옆 한 줄(예: 「3개 남았어요」, 대표님 10-19 「아래 줄 남은 횟수 표기」) */
    progressLabel?: string;
};
export type BenefitQuickListProps = {
    title?: string;
    doneLabel?: string;
    buttonWidth?: number;
    /** 버튼 높이(기본 40) — 당근 대표님 10-19 「버튼 사이즈 좀 더 작게」 */
    buttonHeight?: number;
    seeAllLabel?: string;
    onSeeAll?: () => void;
    accentColor?: string;
    items: readonly BenefitQuickItem[];
    footer?: ReactNode;
};
/** 빠른 두 번 누름을 막는 시간(0.4.3) — 잠금 상태가 없어 영영 남을 수 없다. 이 시간이 지나면 다음 누름은 늘 들어간다 */
export declare const TAP_GUARD_MS = 700;
/** 줄 누름 — 직전 누름에서 TAP_GUARD_MS 안이면 무시. 처리 함수가 던져도 다음 누름은 막히지 않는다 */
export declare function pressOnce(run: () => void, now?: number): boolean;
/** 시험용 — 누름 기록을 지운다 */
export declare function resetTapGuard(): void;
export declare function BenefitQuickList({ title, seeAllLabel, onSeeAll, accentColor, items, footer, doneLabel, buttonWidth, buttonHeight }: BenefitQuickListProps): React.JSX.Element;
