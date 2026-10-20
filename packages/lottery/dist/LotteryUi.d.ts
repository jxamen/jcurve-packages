import React, { type ReactNode } from 'react';
import { type LotteryOpenResult, type LotteryState, type LotteryWinner } from './lottery';
/** 색 — 앱이 넘기는 값(@jcurve/mission 의 MissionPageTheme 을 그대로 넘겨도 된다, 필요한 칸만 쓴다) */
export type LotteryTheme = {
    bg: string;
    card: string;
    text: string;
    sub: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    done: string;
};
export declare const DEFAULT_LOTTERY_THEME: LotteryTheme;
/**
 * 복권 화면 조각들(mission 0.6.0 에서 옮겨 왔다 — 이름 · props 그대로) — 모두 **상태가 없다**(앱이 useLottery 의 값을 넘긴다). 색만 theme 으로 받고 모양은 패키지가 정한다.
 * Modal 이 아니라 화면 위 덮개다 — 보상형 광고가 Modal 뒤에 깔리지 않게(앱의 TicketSheet 와 같은 이유). 앱이 화면 맨 위(탭 바 위)에 둔다.
 */
type ThemeProp = {
    theme?: Partial<LotteryTheme>;
};
/**
 * 안 연 복권이 있을 때만 — 다 열면 사라진다(count 0 이면 null).
 * 기본은 **띠 없이 떠 있는 흰 알약**(그림자, FloatingRewardChip 과 같은 모양 · 대표님 「떠 있는 알약」): 안쪽 화면의 탭 바 위에 두고 `bottomOffset`(아래에서 띄울 거리)만 준다.
 * `floating={false}` 면 줄 안에 놓는 작은 색 알약(0.6.0 모양).
 */
export declare function LotteryChip({ count, onPress, label, bottomOffset, floating, icon, theme }: {
    count: number;
    onPress: () => void;
    label?: string;
    bottomOffset?: number;
    floating?: boolean;
    icon?: ReactNode;
} & ThemeProp): React.JSX.Element | null;
/** 복권 시트 — 3단계 줄 · 받기 / 열기 / 획득 완료 · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 */
export declare function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, theme, renderNative }: {
    open: boolean;
    state: LotteryState | null;
    winners?: readonly LotteryWinner[];
    busy?: boolean;
    /** 「열기」 — 그 단계 복권을 연다(앱이 useLottery.open 을 부르고 결과 창을 띄운다) */
    onOpen: (tier: number) => void;
    /** 「받기」 — 아직 못 받은 단계: 미션 화면으로 보낸다 */
    onEarn: (tier: number) => void;
    /** 아래 큰 버튼 「한 번 더! ○원 복권 받기」 — 안 주면 onEarn(다음 단계) */
    onMore?: (tier: number) => void;
    onClose: () => void;
    onEnableNotify?: () => void;
    notifyLabel?: string;
    renderNative?: () => ReactNode;
} & ThemeProp): React.JSX.Element | null;
/**
 * 결과 창 — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**(대표님 13:56). 버튼 아래에 앱이 넘기는 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」로 닫는다.
 */
export declare function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme }: {
    result: Pick<LotteryOpenResult, 'won' | 'points' | 'unopened'>;
    state?: LotteryState | null;
    /** 남은 복권이 있을 때 「다음 복권 열기」 */
    onOpenNext?: () => void;
    /** 남은 복권이 없을 때 「미션 하고 복권 더 받기」 */
    onMore?: () => void;
    onClose: () => void;
    renderNative?: () => ReactNode;
} & ThemeProp): React.JSX.Element;
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번. 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤**
 * `useLottery.open(tier, 'basic')` 을 부른다 — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다).
 * `icon` 은 앱이 넘기는 그림(없으면 글자만). busy 동안은 다시 눌리지 않는다.
 */
export declare function GoldenLotteryPopup({ open, maxWon, busy, onOpen, onClose, buttonLabel, icon, theme }: {
    open: boolean;
    maxWon: number;
    busy?: boolean;
    onOpen: () => void;
    onClose: () => void;
    buttonLabel?: string;
    icon?: ReactNode;
} & ThemeProp): React.JSX.Element | null;
export {};
