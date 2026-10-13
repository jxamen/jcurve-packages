import React from 'react';
import { type Lang } from './i18n';
import { type StateKind } from './copy';
/** 색만 받는다 — 문구 · 모양은 패키지가 정한다(앱마다 달라지지 않게). 피그마 시안이 오면 이 화면들이 그 모양으로 바뀐다 */
export type MissionTheme = {
    bg: string;
    card: string;
    text: string;
    sub: string;
    accent: string;
    accentText: string;
    line: string;
};
export declare const DEFAULT_THEME: MissionTheme;
export type { StateKind } from './copy';
export declare function MissionState({ kind, theme, window, onRetry, onClose, lang }: {
    kind: StateKind;
    theme?: MissionTheme; /** 점검 시간 글(예 「매일 23:55 ~ 00:10」) — 점검 화면에서만 */
    window?: string;
    onRetry?: () => void;
    onClose?: () => void; /** (0.2.1) 문구 언어 — 앱이 넘긴다. 없거나 'ko' 면 한국어 */
    lang?: Lang;
}): React.JSX.Element;
export declare function MissionLoading({ theme, lang }: {
    theme?: MissionTheme; /** (0.2.1) 없거나 'ko' 면 한국어 */
    lang?: Lang;
}): React.JSX.Element;
