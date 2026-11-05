/**
 * 바텀시트 동작 고르개 — 「○○ 연동됨」 시트(주문 불러오기 · 불러온 주문 보기 · 사용 방법 보기 · 연동 해제 · 닫기).
 * 두 OS 모두 같은 앱 자체 시트 하나로 보인다(대표님 10-30: 안드 Alert 는 버튼 3개 한계로 「연동 해제 · 닫기」가 잘렸다).
 * 영수증 올리기 화면(Modal) 안에서 덮는 층(absoluteFill)으로 쓴다 — 중첩 Modal 을 피한다.
 * 항목 순서 · 글자는 호출한 쪽이 정해 넘긴다(연동됨 시트는 linkedMenuItems). 바깥(어둑한 바탕) · 「닫기」를 누르면 onClose.
 * 색 · 둥글기 · 글자 크기는 theme 으로(빠진 값은 기본값) — 영테크 ui/ActionMenu 를 옮겼다(2026-11-05 대표님 「화면도 패키지로 · 디자인만 앱마다」).
 */
import React from 'react';
export type ActionMenuItem = {
    label: string;
    onPress: () => void;
    destructive?: boolean;
};
export type ActionMenuTheme = {
    /** 시트 바탕 */
    bg: string;
    /** 항목 바탕 */
    card: string;
    text: string;
    sub: string;
    danger: string;
    /** 시트 윗모서리 둥글기 · 항목 둥글기 */
    radius: number;
    itemRadius: number;
    /** 제목 · 항목 글자 크기 */
    titleSize: number;
    itemSize: number;
    /** 안쪽 여백(옆 · 위) · 항목 사이 틈 · 맨 아래 여백(안전 영역 위에 더한다) */
    pad: number;
    gap: number;
    bottomPad: number;
};
export declare const DEFAULT_MENU_THEME: ActionMenuTheme;
export type ActionMenuProps = {
    title: string;
    items: ActionMenuItem[];
    cancelLabel?: string;
    onClose: () => void;
    theme?: Partial<ActionMenuTheme>;
    /** 아래 안전 영역(홈 막대) 높이 — 앱이 useSafeAreaInsets().bottom 을 넘긴다 */
    insetBottom?: number;
};
export declare function ActionMenu({ title, items, cancelLabel, onClose, theme, insetBottom }: ActionMenuProps): React.JSX.Element;
