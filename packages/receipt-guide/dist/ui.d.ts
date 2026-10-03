/**
 * 영수증 안내 공용 조각 — 색 · 글자 · 버튼 · 말풍선.
 *
 * 이 폴더는 나중에 `@jcurve/receipt-guide` 패키지로 나간다. 그래서 **앱의 다른 파일을 부르지 않는다** —
 * 색은 `theme` 으로, 캐릭터 그림은 `renderCharacter` 로, 기록은 `track` 으로 받는다(README).
 * 모양은 영테크 미션 「따라 하기」(말풍선 + 가운데 가짜 화면 + 반짝이는 누를 곳)를 따른다.
 */
import React from 'react';
import { type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
export type GuideTheme = {
    /** 화면 바탕 */
    bg: string;
    /** 카드 · 가짜 화면 바탕 */
    card: string;
    line: string;
    text: string;
    sub: string;
    /** 주요 버튼 */
    brand: string;
    brandSoft: string;
    /** 손가락 · 누를 곳 테두리 */
    hot: string;
    white: string;
    /** 알아 둘 것 카드 */
    noteBg: string;
    noteText: string;
};
export declare const DEFAULT_THEME: GuideTheme;
export type CharacterRender = (seed: string, height: number) => React.ReactNode;
type Ctx = {
    theme: GuideTheme;
    renderCharacter?: CharacterRender;
};
export declare const GuideProvider: React.Provider<Ctx>;
export declare const useGuideTheme: () => GuideTheme;
export declare const useCharacter: () => CharacterRender | undefined;
/** 움직임 줄이기 — 켜져 있으면 저절로 넘기지 않고 [다음] 으로 넘긴다 */
export declare function useReducedMotion(): boolean;
export declare const row: ViewStyle;
/** 글자 — 가짜 화면은 크기 · 굵기가 줄마다 달라 짧게 쓴다 */
export declare function T({ children, size, w, color, lh, center, lines, style }: {
    children: React.ReactNode;
    size?: number;
    w?: 600 | 700 | 800 | 900;
    color?: string;
    lh?: number;
    center?: boolean;
    lines?: number;
    style?: StyleProp<TextStyle>;
}): React.JSX.Element;
/** 큰 버튼 */
export declare function BigButton({ label, onPress, tone, disabled }: {
    label: string;
    onPress: () => void;
    tone?: 'solid' | 'ghost';
    disabled?: boolean;
}): React.JSX.Element;
/** 작은 둥근 버튼 — 재생 조절 */
export declare function SmallButton({ label, onPress, on, a11y }: {
    label: string;
    onPress: () => void;
    on?: boolean;
    a11y?: string;
}): React.JSX.Element;
/** 맨 위 줄 — [닫기] + 제목 */
export declare function Header({ title, onClose }: {
    title: string;
    onClose: () => void;
}): React.JSX.Element;
/** 캐릭터 + 말풍선 */
export declare function Bubble({ say, sub }: {
    say: string;
    sub?: string;
}): React.JSX.Element;
/** 알아 둘 것 한 줄(네이버페이: 「PDF로 저장」은 사진첩에 안 들어감) */
export declare function NoteCard({ text }: {
    text: string;
}): React.JSX.Element;
export {};
