import React from 'react';
import { type Requester } from './entry';
import { type MissionWebViewProps } from './MissionWebView';
export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange'> & {
    fetchJson: Requester;
    onClose: () => void;
    title?: string;
    adId?: string;
    /** Modal 바깥에서 읽은 useSafeAreaInsets() 값을 전달한다. */
    safeAreaInsets: {
        top: number;
        bottom: number;
        left?: number;
        right?: number;
    };
};
/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
export declare function ShoppingMission({ fetchJson, onClose, title, adId, safeAreaInsets, theme, lang, ...webViewProps }: ShoppingMissionProps): React.JSX.Element;
