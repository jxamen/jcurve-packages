import React from 'react';
import { type Requester } from './entry';
import { type MissionWebViewProps } from './MissionWebView';
export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange' | 'traceStage'> & {
    fetchJson: Requester;
    onClose: () => void;
    title?: string;
    adId?: string;
    /** 단계 기록 요청 출처 — 기본값 'other' */
    source?: 'popup' | 'push' | 'tab' | 'card' | 'other';
    /** Modal 바깥에서 읽은 useSafeAreaInsets() 값을 전달한다. */
    safeAreaInsets: {
        top: number;
        bottom: number;
        left?: number;
        right?: number;
    };
};
/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 커스터마이징 */
export declare function ShoppingMission({ fetchJson, onClose, title, adId, source, safeAreaInsets, theme, lang, hint, hintText, ...webViewProps }: ShoppingMissionProps & {
    hint?: boolean;
    hintText?: string;
}): React.JSX.Element;
