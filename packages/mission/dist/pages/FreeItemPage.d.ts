/**
 * 무료 아이템 받기 — 하루 3번 들르면 양분(캡슐 · 열매 · 먹이) 받는 화면(0.4.0, carrot FreeHeartScreen · HeartCard visits 그대로).
 * 광고 · 보상 규칙은 앱이 정한다. 패키지는 칸 상태를 그리고 누르면 onClaim(id) 만 부른다.
 * 맨 아래 광고 자리는 footer 로 받는다(carrot 은 네이티브 광고).
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
import { type FreeItemSlot } from './logic';
export type FreeItemPageProps = {
    /** 「하루 3번」 칸들 — 앱이 done · missed · claimable 을 정해 준다 */
    slots: readonly FreeItemSlot[];
    /** 칸 받기 — 광고 · 서버 지급은 앱이 한다. Promise 를 주면 그동안 누름을 막지 않는다(앱이 상태로 막는다) */
    onClaim: (slotId: string) => void | Promise<void>;
    onBack: () => void;
    /** 머리 제목 — 기본 「무료 {아이템} 받기」 */
    title?: string;
    /** 카드 아래 한 줄 — 기본 「하루 {칸 수}번 들르면 {아이템} 받기」 */
    subtitle?: string;
    /** 색 · 아이템 이름(theme.itemName) · 아이템 그림(theme.itemIcon) — 일부만 줘도 된다 */
    theme?: Partial<MissionPageTheme>;
    /** 맨 아래 광고 자리 */
    footer?: ReactNode;
    /** 칸 버튼 크기 — 기본 72x34 */
    buttonWidth?: number;
    buttonHeight?: number;
};
export declare function FreeItemPage({ slots, onClaim, onBack, title, subtitle, theme: themeIn, footer, buttonWidth, buttonHeight }: FreeItemPageProps): React.JSX.Element;
