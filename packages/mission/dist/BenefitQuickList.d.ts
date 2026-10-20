import React, { type ReactNode } from 'react';
import type { Requester } from './entry';
import { type HomeRowKey } from './home';
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
    /**
     * (0.4.4) 앱의 요청 함수 — 있으면 서버 `GET mission/home` 의 home_rows(어드민 mission.home_rows)를 **스스로 읽어** items 에 적용한다(제목 · 설명 · 버튼 · 배지 · 보임 · 순서).
     * 실패하면 앱 기본 그대로, 60초 캐시, 앱이 앞으로 돌아올 때 · `refreshKey` 가 바뀔 때 다시. 없으면 예전 그대로(적용 없음).
     */
    fetchJson?: Requester;
    /** (0.4.4) 앱 줄 key → 서버 줄 key(9개 고정) 맞춤표. 안 적은 줄은 key 가 서버 key 와 같으면 그대로. 예: { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' } */
    homeKeys?: Readonly<Record<string, HomeRowKey>>;
    /** (0.4.4) 기본 free_item 줄(「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」)의 ○○ — 앱 아이템 이름. 없으면 「아이템」 */
    itemName?: string;
    /** (0.4.4) 기본 free_item 줄을 눌렀을 때. **없으면 그 줄을 만들지 않는다**. 앱 items 에 이미 free_item(맞춤표 기준)이 있으면 겹치지 않는다 */
    onFreeItem?: () => void;
    /** (0.4.4) 서버 home_rows 에 있는데 앱 items 에 짝이 없는 줄(퀴즈 · 출석 · 만보기 · 오늘 미션 · 행운 찬스 · 초대 · 추천 앱 …)을 누르면. **없으면 그 줄은 그리지 않는다** */
    onRow?: (key: HomeRowKey) => void;
    /** (0.4.4) 홈으로 돌아올 때마다 바꿔 주면(예: tab === 'home') 서버 목록을 다시 읽는다 */
    refreshKey?: unknown;
};
/** 빠른 두 번 누름을 막는 시간(0.4.3) — 잠금 상태가 없어 영영 남을 수 없다. 이 시간이 지나면 다음 누름은 늘 들어간다 */
export declare const TAP_GUARD_MS = 700;
/** 줄 누름 — 직전 누름에서 TAP_GUARD_MS 안이면 무시. 처리 함수가 던져도 다음 누름은 막히지 않는다 */
export declare function pressOnce(run: () => void, now?: number): boolean;
/** 시험용 — 누름 기록을 지운다 */
export declare function resetTapGuard(): void;
/**
 * 「바로 받는 혜택」 목록. (0.4.4) `fetchJson` 을 주면 서버 home_rows 를 스스로 적용하고, `onFreeItem` 을 주면 free_item 기본 줄이 생긴다 — 둘 다 없으면 0.4.3 과 똑같이 그린다.
 */
export declare function BenefitQuickList(props: BenefitQuickListProps): React.JSX.Element;
