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
/**
 * (0.1.2 · 0.1.3 링크 모양) 「🔔 복권 받게 알림 켜기 ›」 — `useLotteryNotify` 가 돌려주는 값을 그대로 넘긴다. visible 이 거짓이면(알림이 이미 켜져 있거나 모르면) 없다.
 * 서버 발송은 이 패키지에 없다 — 버튼과 권한 유도만. 큰 버튼 아래의 글자 링크(참고 캡처 IMG_9331)
 */
export type LotteryNotify = {
    visible: boolean;
    busy?: boolean;
    onPress: () => void;
    label?: string;
    hint?: string;
};
/**
 * 시트 · 팝업 · 전체 화면이 올라오는 층(0.1.3) — 기본 `overlay` 는 Modal 이 아니라 부모 영역을 덮는 absolute 판(뒤 화면을 어둡게 하는 딤 포함)이다: 보상형 광고가 Modal 뒤에 깔리지 않게
 * (iOS 는 RN Modal 이 떠 있으면 AdMob 이 광고를 못 연다). **앱 루트(탭 메뉴 · 상태줄 바깥)에 그려야** 탭 메뉴까지 덮는다. `presentation="modal"` 이면 RN Modal(탭 · 상태줄 위) —
 * 그때는 광고를 열기 전에 먼저 닫을 것. Android 뒤로 가기는 닫기로 쓴다.
 */
export type LotteryPresentation = 'overlay' | 'modal';
/**
 * 시트가 차지할 수 있는 높이 — 화면 높이에서 위 여백(상태줄 · 노치)과 숨 쉴 자리를 뺀다. 앱이 안전 영역 위 값을 `topInset` 으로 주면 그것을, 안 주면 안드로이드 상태줄 높이 · iOS 는 44 로 짐작한다.
 * 내용이 이보다 길면 시트 안에서 스크롤한다(0.1.1 — 시트 맨 위 줄이 상태줄 밑으로 밀려 잘리던 것, 감자밭 시뮬)
 */
export declare function sheetMaxHeight(windowHeight: number, topInset?: number, os?: string, statusBar?: number | null | undefined): number;
/**
 * 복권 목록 — (0.1.6) 기본은 **전체 화면**(감자밭 화면 그대로): 행운 찬스와 같은 머리글(‹ · 가운데 제목 「꽝 없는 복권」 · theme.bg 바탕, 안드 뒤로가기 → onClose) 아래 흰 카드(theme.card · 둥근 모서리 · 그림자)에
 * 「지금 열고 행운 받아가요!」 한 줄 + 회색 한 줄 → 당첨 띠(**서버 winners 의 실제 기록이 있을 때만**, 원 당첨도 P 로) → 단계 줄 + 황금 줄 → 「🔔 복권 받게 알림 켜기」(가운데). 「한 번 더」 버튼은 없다.
 * 맨 아래 `renderNative` 광고는 카드 아래 12. `fullScreen={false}` 면 예전 바텀 시트(딤 · X · 손잡이 · 큰 제목 2줄).
 * 줄: 서버 단계 수대로(같은 표 + 문턱이 10 의 배수는 한 줄로 묶음, 0.1.5) + 하루 기본(황금) 복권 줄(있을 때). 포인트 표 단계는 「최대 1,000P 복권」(unit:'points'), 원 표는 「최대 100원 복권」.
 * 광고가 바로 열리는 줄(황금 복권을 여는 버튼)에만 「광고」 칩. `onOpen(tier, src)` — 미션 줄은 'mission', 황금 줄은 'basic'(앱은 'basic' 일 때 보상형 광고를 먼저 보여 준다).
 */
export declare function LotterySheet({ open, state, winners, busy, onOpen, onEarn, onClose, onEnableNotify, notifyLabel, notify, theme, renderNative, topInset, bottomInset, basicAd, adLabel, presentation, quiz, fullScreen, headerTitle }: {
    open: boolean;
    state: LotteryState | null;
    winners?: LotteryWinner[];
    /** 열기 요청 중 — 줄이 눌리지 않는다 */
    busy?: boolean;
    onOpen: (tier: number, src?: 'basic' | 'mission') => void;
    /** 「받기」 — 아직 못 받은 단계(미션으로 가기) */
    onEarn: (tier: number) => void;
    /** (0.1.6 사용 안 함) 「한 번 더! ○ 복권 받기」 버튼이 없어졌다 — 예전 앱이 넘겨도 오류 없이 무시한다 */
    onMore?: (tier: number) => void;
    onClose: () => void;
    /** (옛 방식) 있으면 늘 보이는 「알림 켜기」 줄 — 새 앱은 `notify`(useLotteryNotify)를 쓴다: 꺼져 있을 때만 보인다 */
    onEnableNotify?: () => void;
    notifyLabel?: string;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 */
    notify?: LotteryNotify;
    renderNative?: () => ReactNode;
    /** 안전 영역 위 여백(`useSafeAreaInsets().top`). 전체 화면은 기본 0(안전 영역을 앱 바깥 틀이 잡을 때), 바텀 시트는 시트가 이 아래에서 끝난다(안 주면 짐작) */
    topInset?: number;
    /** (0.1.3) 아래 안전 영역(`useSafeAreaInsets().bottom`) */
    bottomInset?: number;
    /** (0.1.2) 황금(기본) 복권을 열 때 광고가 열리나 — 서버 설정 daily_basic.ad(기본 true). */
    basicAd?: boolean;
    adLabel?: string;
    presentation?: LotteryPresentation;
    /** (0.1.5) 줄 설명의 이름 — 기본 「쇼핑 · 플레이스 퀴즈」(「쇼핑 · 플레이스 퀴즈 5개 하면 받아요」). 앱마다 다르면 바꾼다 */
    quiz?: string;
    /** (0.1.6) 전체 화면(기본 true, 행운 찬스와 같은 틀) — false 면 예전 바텀 시트 */
    fullScreen?: boolean;
    /** (0.1.6) 전체 화면 머리글 제목 — 기본 「꽝 없는 복권」 */
    headerTitle?: string;
} & ThemeProp): React.JSX.Element | null;
/**
 * 당첨 결과 — **전체 화면**(0.1.3, 대표님 15:57 「당첨 화면은 전체 화면으로 나오게 해」): 탭 메뉴 · 상태줄까지 덮는다(앱 루트에 그리거나 `presentation="modal"`).
 * 위: X(오른쪽) → 가운데 「축하해요!」 + 큰 「5P 당첨!」 + 복권 그림(`icon` 이 있으면 그것) → 아래: 큰 버튼 + 「확인」 + 알림 켜기 링크 + 네이티브 광고(`renderNative`).
 * 남은 복권이 있으면 「다음 복권 열기 (N장 남았어요)」 — 없으면 큰 버튼 없이 X(와 `confirm` 일 때 「확인」)만. **「한 번 더! ○ 복권 받기」 버튼은 없다**(0.1.7, 대표님 17:38 「빼」). 원 표 단계는 「○원 복권」 한 줄이 더 붙고 포인트 표는 P 만 보인다.
 * `topInset`/`bottomInset` 은 안전 영역(상태줄 · 홈 바) 값.
 */
export declare function LotteryResult({ result, onOpenNext, onClose, renderNative, theme, nextAd, adLabel, notify, icon, topInset, bottomInset, presentation, open, confirm }: {
    result: Pick<LotteryOpenResult, 'won' | 'points' | 'unopened'> & {
        unit?: 'won' | 'points';
    };
    /** (0.1.7 사용 안 함) 예전에는 「한 번 더」 문구를 만들 때 읽었다 — 넘겨도 무시한다 */
    state?: LotteryState | null;
    /** 남은 복권이 있을 때 「다음 복권 열기」 */
    onOpenNext?: () => void;
    /** (0.1.7 사용 안 함) 「한 번 더! ○ 복권 받기」 버튼이 없어졌다 — 예전 앱이 넘겨도 오류 없이 무시한다 */
    onMore?: () => void;
    onClose: () => void;
    renderNative?: () => ReactNode;
    /** (0.1.2) 「다음 복권 열기」가 광고를 여는가 — `nextOpensWithAd(state, basicAd)` 를 넘긴다(안 주면 광고 칩 없음) */
    nextAd?: boolean;
    adLabel?: string;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 */
    notify?: LotteryNotify;
    /** 복권 그림(없으면 기본 황금 티켓) */
    icon?: ReactNode;
    topInset?: number;
    bottomInset?: number;
    presentation?: LotteryPresentation;
    open?: boolean;
    /** (0.1.4) 글자 버튼 「확인」 — 기본 true(예전 그대로). false 면 닫기는 오른쪽 위 X 뿐(대표님 16:39 「확인 글자 버튼 삭제」, 감자밭은 false) */
    confirm?: boolean;
} & ThemeProp): React.JSX.Element;
/**
 * 황금 복권 팝업 — 「황금 복권이 나타났어요!」 (**앱이 켤 때 자동으로 띄우지 않는다** — 황금은 복권 목록의 황금 줄 「열기」로만 연다, 대표님 17:36 「앱 열릴 때 이게 실행이 돼」. 0.1.2: 읽기 쉽게, 0.1.3: **바텀 시트**로 — 딤 · X · 손잡이 · 안전 영역). 위에서 아래로: 황금 복권 그림(`icon` 이 있으면 그것) → 제목 → 쉬운 말 3줄 → 작은 글씨 → 버튼 → 「다음에 열기」.
 * 값(최대 금액 · 포인트)은 서버 state 에서 읽어 넘긴다 — `maxWon`(필수) · `maxPoints` · **`unit`**(포인트 표면 'points' → 「최대 1,000P가 바로 들어와요」, 원 병기 없음). 문구는 `lines`/`note` 로 통째로 바꿀 수 있다(다국어).
 * 버튼은 「광고 보고 황금 복권 열기」: 앱이 `onOpen` 에서 **보상형 광고(용도 lottery_basic)를 보여 준 뒤** `useLottery.open(tier, 'basic')` 을 부른다
 * — 광고 시청은 서버가 구글 SSV 로 확인한다(앱 말만 믿지 않는다). 광고가 바로 열리므로 버튼 안 오른쪽에 「광고」 칩(`ad` 가 false 면 칩 · 광고 문구 없음). busy 동안은 다시 눌리지 않는다.
 */
export declare function GoldenLotteryPopup({ open, maxWon, maxPoints, unit, busy, onOpen, onClose, buttonLabel, icon, theme, ad, adLabel, closeLabel, lines, note, topInset, bottomInset, notify, presentation, fullScreen, headerTitle }: {
    open: boolean;
    maxWon: number;
    maxPoints?: number | null;
    unit?: 'won' | 'points';
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
    topInset?: number;
    bottomInset?: number;
    /** (0.1.2) 알림이 꺼져 있을 때만 보이는 「🔔 복권 받게 알림 켜기 ›」 링크 — 「다음에 열기」 아래 */
    notify?: LotteryNotify;
    presentation?: LotteryPresentation;
    /** (0.1.6) 전체 화면(기본 true, 목록과 같은 머리글 · 흰 카드) — false 면 예전 바텀 시트 */
    fullScreen?: boolean;
    /** (0.1.6) 전체 화면 머리글 제목 — 기본 「황금 복권」 */
    headerTitle?: string;
} & ThemeProp): React.JSX.Element | null;
/**
 * (0.1.4, 대표님 16:40 「당첨 화면 아래 네이티브 광고 카드가 잘려요」) 당첨 전체 화면 위쪽 영역의 칸 높이(pt) — 스타일과 `lotteryResultTopHeight` 가 같은 값을 쓴다.
 * 광고 카드(앱이 넘기는 `renderNative`, 폭 375 기준 약 360pt)가 iPhone SE(375×667)에서 스크롤 없이 끝까지 보이도록 광고 위 모든 것을 줄였다.
 */
export declare const RESULT: {
    readonly top: 4;
    readonly header: 32;
    readonly kicker: 20;
    readonly headline: 40;
    readonly headlineGap: 2;
    readonly sub: 24;
    readonly subGap: 4;
    readonly art: 52;
    readonly artGap: 8;
    readonly centerBottom: 8;
    readonly actionsTop: 4;
    readonly big: 48;
    readonly bigGap: 8;
    readonly confirm: 40;
    readonly notify: 32;
    readonly nativeGap: 8;
    readonly bottom: 12;
};
/**
 * 당첨 전체 화면에서 **네이티브 광고 위**가 차지하는 높이(pt, 위 안전 영역 `topInset` 은 빼고) — 광고 카드 밑 여백(`RESULT.bottom`)도 뺀 값.
 * 큰 버튼(`big`: 다음 복권 열기) · 「확인」(`confirm`) · 알림 줄(`notify`) · 원 표 한 줄(`wonLine`) 이 있으면 더해진다. 시험에서 SE 기준 270pt 이하인지 본다.
 */
export declare function lotteryResultTopHeight(o?: {
    big?: boolean;
    confirm?: boolean;
    notify?: boolean;
    wonLine?: boolean;
    native?: boolean;
}): number;
export {};
