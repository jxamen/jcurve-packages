import React from 'react';
import { type BridgeMessage } from './bridge';
import { type MissionTheme } from './states';
import type { Lang } from './i18n';
export type MissionEvent = 'mission_open' | 'mission_loaded' | 'mission_error' | 'mission_target_open' | 'mission_target_blocked' | 'mission_overlay_request' | 'mission_floating_popup' | 'mission_external_link';
export type MissionWebViewProps = {
    /** 서버 apihub/entry 가 준 웹뷰 주소(fetchEntry 결과) — 승인된 APIHUB 주소가 아니면 열지 않고 오류 화면 */
    url: string;
    /** 화면 머리글용 웹 히스토리 상태와 뒤로가기 동작 */
    onNavigationChange?: (navigation: MissionNavigation) => void;
    theme?: MissionTheme;
    onClose?: () => void;
    /** 단계 기록 함수 */
    traceStage?: (stage: 'entry' | 'load_ok' | 'load_fail' | 'close' | 'reward', params?: {
        code?: number;
        url?: string;
        ms?: number;
    }) => void;
    /** 계측 — 패키지는 아무 데도 보내지 않는다(앱이 자기 track 으로) */
    onEvent?: (name: MissionEvent, props?: Record<string, unknown>) => void;
    /** 페이지가 showFloatingPopup 을 불렀을 때(오버레이는 네이티브 빌드에서만 — 이 판은 알리기만) */
    onFloatingPopup?: (params: Extract<BridgeMessage, {
        method: 'showFloatingPopup';
    }>['params']) => void;
    /** 페이지가 「다른 앱 위에 표시」 권한을 요청했을 때 */
    onOverlayRequest?: () => void;
    /** 네이티브 오버레이가 들어간 빌드면 true(hasOverlayPermission 응답) */
    overlayReady?: boolean;
    /** (0.3.0) 오류 · 점검 · 로딩 화면 문구 언어 — 앱이 넘긴다(패키지는 기기 언어를 읽지 않는다). 없거나 'ko' 면 한국어. 웹 페이지 안 글은 APIHUB 것 */
    lang?: Lang;
};
export type MissionNavigation = {
    canGoBack: boolean;
    goBack: () => void;
};
/** 주소가 바뀌었거나 다시 시도할 때마다 상태를 처음부터 */
export declare function MissionWebView({ url, theme, onClose, onEvent, onFloatingPopup, onOverlayRequest, overlayReady: overlayReadyProp, onNavigationChange, traceStage, lang }: MissionWebViewProps): React.JSX.Element;
