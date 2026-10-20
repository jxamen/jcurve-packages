import React, { type ReactNode } from 'react';
/**
 * 페이지 색 · 글자 · 캐릭터(0.4.0) — 색과 이름만 앱이 넘긴다. 모양은 패키지가 정한다(carrot 화면 그대로).
 * 기본값은 당근 홈 「바로 받는 혜택」 줄의 색(주황 #EE7A33).
 */
export type MissionPageTheme = {
    bg: string;
    card: string;
    text: string;
    sub: string;
    accent: string;
    accentText: string;
    accentSoft: string;
    line: string;
    /** 끝난 줄 버튼 바탕(「완료」「받았어요」) */
    done: string;
    /** 캐릭터 그림(ReactNode) — 친구 초대 머리에 쓴다. 없으면 그리지 않는다 */
    character?: ReactNode;
    /** 아이템 이름 — 양분 · 캡슐 · 열매 · 먹이 (2026-10-19 대표님 「이름만 앱마다」). 기본 「아이템」(0.4.1 — 앱 말이 박히지 않게) */
    itemName?: string;
    /** 아이템 그림(ReactNode, 예 🌱) — 없으면 글자만 */
    itemIcon?: ReactNode;
};
export declare const DEFAULT_PAGE_THEME: MissionPageTheme;
/** 앱이 일부만 넘기면 나머지는 기본값 — `character` · `itemIcon` 은 기본이 없다 */
export declare function resolvePageTheme(theme?: Partial<MissionPageTheme>): MissionPageTheme;
/** 줄 버튼 기본 크기 72x34(2026-10-19 당근 대표님 「버튼 사이즈 좀 더 작게」「가로 줄이라니까」) */
export declare const PAGE_BUTTON: {
    readonly width: 72;
    readonly height: 34;
};
/**
 * 독립 페이지 공통 틀 — 상단 「‹ 제목」 한 줄 · 안드로이드 뒤로 가기 → onBack · 본문 스크롤 · 맨 아래 광고 자리(footer).
 * 상태 표시줄 안전영역은 앱 바깥 틀이 잡는다(carrot PageHeader 와 같은 규칙).
 */
export declare function PageFrame({ title, onBack, swipeBack, theme, footer, children }: {
    title: string;
    onBack: () => void;
    /**
     * (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true, `false` 일 때만 끔). 안드로이드는 그대로(뒤로 키). 이미 앱 바깥에서 밀기를 감싼 화면은 false.
     * 새 네이티브 의존 없음(PanResponder) — 가장자리에서 시작한 가로 밀기만 가로채서 안쪽 탭 · 스크롤은 그대로다
     */
    swipeBack?: boolean;
    theme: MissionPageTheme;
    /** 맨 아래 광고 자리 — 앱이 네이티브 광고를 넣는다(패키지는 광고를 모른다) */
    footer?: ReactNode;
    children: ReactNode;
}): React.JSX.Element;
/** 줄 · 카드 안의 작은 버튼 — 기본 72x34, 끝난 상태는 `done` 바탕 */
export declare function PageButton({ label, onPress, disabled, theme, width, height, on, big, fontSize, radius }: {
    label: string;
    onPress: () => void;
    disabled?: boolean;
    theme: MissionPageTheme;
    width?: number;
    /** 높이 — 안 주면 줄 버튼 34 · 큰 단추 52(0.4.14: 큰 단추도 준 높이를 따른다) */
    height?: number;
    /** (0.4.14) 글자 크기 — 안 주면 줄 버튼 14 · 큰 단추 16 */
    fontSize?: number;
    /** (0.4.14) 모서리 — 안 주면 줄 버튼 12 · 큰 단추 14 */
    radius?: number;
    /** 끄면 바탕이 연한 주황 · 글자는 흐리게(받을 수 없는 칸) */
    on?: boolean;
    /** 큰 단추(가로 전체) — `width` 무시 */
    big?: boolean;
}): React.JSX.Element;
