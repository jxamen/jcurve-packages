import React from 'react';
import { type Requester } from './entry';
import { type MissionWebViewProps } from './MissionWebView';
export type ShoppingMissionProps = Omit<MissionWebViewProps, 'url' | 'onClose' | 'onNavigationChange' | 'traceStage' | 'nativeSwipeBack'> & {
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
    /** (0.4.3) 이 화면의 뒤로가기(웹 기록 → 없으면 닫기)를 받아 간다 — 앱이 자기 Modal 의 onRequestClose 에 물릴 때 */
    backRef?: {
        current: (() => void) | null;
    };
};
/** 앱이 Modal 또는 내비게이션 화면 안에 넣는 쇼핑 미션 화면. */
/** (0.3.0) @jcurve/overlay 통합 — AppState 감시로 권한 상태 갱신, 기본 핸들러 제공 */
/** (0.3.1) `source` — 요청 출처('popup'|'push'|'tab'|'card'|'other'), 단계 기록(apihub/trace). `hint` — 「10초 구경하면 포인트」 안내 표시(기본값 true). `hintText` — 안내 문구 */
/** (0.2.1) `lang` — 머리글 · 상태 화면 문구 언어(앱이 넘긴다). 없거나 'ko' 면 지금과 같은 한국어. `title` 을 주면 그 글 그대로 */
export declare function ShoppingMission({ fetchJson, onClose, title, adId, source, safeAreaInsets, theme, lang, hint, hintText, backRef: outerBack, ...webViewProps }: ShoppingMissionProps & {
    hint?: boolean;
    hintText?: string;
}): React.JSX.Element;
/**
 * (0.4.3) 쇼핑 미션을 전체 화면 Modal 로 — 안드로이드 뒤로 버튼은 Modal 안에서 BackHandler 가 아니라 onRequestClose 로 온다.
 * 앱이 `onRequestClose={() => 닫기}` 로 물리면 웹 기록을 건너뛰고 바로 닫혔다. 이 껍데기는 같은 뒤로가기 규칙(웹 기록 → 닫기)을 쓴다
 */
export declare function ShoppingMissionModal({ visible, ...props }: ShoppingMissionProps & {
    visible: boolean;
    hint?: boolean;
    hintText?: string;
}): React.JSX.Element;
