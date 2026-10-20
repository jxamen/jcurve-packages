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
 * (0.1.2) 「🔔 복권 받기 알림 켜기」 줄 — `useLotteryNotify` 가 돌려주는 값을 그대로 넘긴다. visible 이 거짓이면(알림이 이미 켜져 있거나 모르면) 줄이 없다.
 * 서버 발송은 이 패키지에 없다 — 버튼과 권한 유도만
 */
export type LotteryNotify = {
    visible: boolean;
    busy?: boolean;
    onPress: () => void;
    label?: string;
    hint?: string;
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
/**
 * 시트가 차지할 수 있는 높이 — 화면 높이에서 위 여백(상태줄 · 노치)과 숨 쉴 자리를 뺀다. 앱이 안전 영역 위 값을 `topInset` 으로 주면 그것을, 안 주면 안드로이드 상태줄 높이 · iOS 는 44 로 짐작한다.
 * 내용이 이보다 길면 시트 안에서 스크롤한다(0.1.1 — 시트 맨 위 줄이 상태줄 밑으로 밀려 잘리던 것, 감자밭 시뮬)
 */
export declare function sheetMaxHeight(windowHeight: number, topInset?: number, os?: string, statusBar?: number | null | undefined): number;
/** 복권 시트 — 3단계 줄 · 받기 / 열기 / 획득 완료 · 당첨 띠 · 「한 번 더! ○원 복권 받기」 · 알림 켜기 */
export declare function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onMore, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, basicAd, adLabel }: {
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
    /** (옛 방식) 있으면 늘 보이는 「알림 켜기」 줄 — 새 앱은 `notify`(useLotteryNotify)를 쓴다: 꺼져 있을 때만 보인다 */
    onEnableNotify?: () => void;
    notifyLabel?: string;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받기 알림 켜기」 줄 */
    notify?: LotteryNotify;
    renderNative?: () => ReactNode;
    /** 안전 영역 위 여백(`useSafeAreaInsets().top`) — 시트가 이 아래에서 끝난다. 안 주면 짐작한다 */
    topInset?: number;
    /** (0.1.2) 황금(기본) 복권을 열 때 광고가 열리나 — 서버 설정 daily_basic.ad(기본 true). 미션 복권만 남은 줄에는 늘 광고 칩이 없다 */
    basicAd?: boolean;
    /** (0.1.2) 광고 칩 글자(기본 「광고」) */
    adLabel?: string;
} & ThemeProp): React.JSX.Element | null;
/**
 * 결과 창 — 「축하해요 보상 ○P 당첨!」, **큰 아이콘 없음**(대표님 13:56). 버튼 아래에 앱이 넘기는 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기」, 없으면 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수), 둘 다 「다음에 할게요」로 닫는다.
 */
export declare function LotteryResult({ result, state, onOpenNext, onMore, onClose, renderNative, theme, nextAd, adLabel, notify }: {
    result: Pick<LotteryOpenResult, 'won' | 'points' | 'unopened'>;
    state?: LotteryState | null;
    /** 남은 복권이 있을 때 「다음 복권 열기」 */
    onOpenNext?: () => void;
    /** 남은 복권이 없을 때 「미션 하고 복권 더 받기」 */
    onMore?: () => void;
    onClose: () => void;
    renderNative?: () => ReactNode;
    /** (0.1.2) 「다음 복권 열기」가 광고를 여는가 — `nextOpensWithAd(state, basicAd)` 를 넘긴다(안 주면 광고 칩 없음) */
    nextAd?: boolean;
    adLabel?: string;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받기 알림 켜기」 줄 — 「다음에 할게요」 아래, 네이티브 광고 위 */
    notify?: LotteryNotify;
} & ThemeProp): React.JSX.Element;
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 하루 한 번(0.1.2: 읽기 쉽게 다시 짰다 — 대표님 15:48 「가독성이 떨어진다. 간격 좀 넣고 설명 좀 잘 넣어」).
 * 위에서 아래로: 닫기(X, 자기 줄 — 제목과 겹치지 않는다) → 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints`(없으면 금액만 보인다). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음).
 * busy 동안은 다시 눌리지 않는다. `bottomInset` 은 아래 안전 영역(`useSafeAreaInsets().bottom`).
 */
export declare function GoldenLotteryPopup({ open, maxWon, maxPoints, busy, onOpen, onClose, buttonLabel, icon, theme, ad, adLabel, closeLabel, lines, note, bottomInset, notify }: {
    open: boolean;
    maxWon: number;
    maxPoints?: number | null;
    busy?: boolean;
    onOpen: () => void;
    onClose: () => void;
    buttonLabel?: string;
    icon?: ReactNode;
    /** 열 때 광고가 열리나(서버 daily_basic.ad, 기본 true) — false 면 「광고」 칩을 빼고 문구도 「바로 열 수 있어요」 */
    ad?: boolean;
    adLabel?: string;
    /** 버튼 아래 글자 버튼(기본 「다음에 열기」) */
    closeLabel?: string;
    /** 설명 줄 · 작은 글씨를 통째로 바꾼다(기본은 goldenLines) */
    lines?: string[];
    note?: string;
    bottomInset?: number;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받기 알림 켜기」 줄 — 「다음에 열기」 아래 */
    notify?: LotteryNotify;
} & ThemeProp): React.JSX.Element | null;
export {};
