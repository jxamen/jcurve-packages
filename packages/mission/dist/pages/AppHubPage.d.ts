/**
 * 추천 앱 — 홈 「추천 앱 둘러보기」 줄을 누르면 여는 목록 (0.4.0).
 * 목록 · 열기는 앱이 준다(carrot 은 @jcurve/apphub 시트를 쓴다 — 이 패키지는 그 시트에 기대지 않는다).
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
export type AppHubItem = {
    key: string;
    name: string;
    /** 한 줄 설명 — 없으면 생략 */
    desc?: string;
    /** 앱 그림 — 없으면 ⭐ */
    icon?: ReactNode;
    /** 「보러가기」 — 앱이 연다(스토어 · 링크) */
    onOpen: () => void;
};
export type AppHubPageProps = {
    apps: readonly AppHubItem[];
    onBack: () => void;
    /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
    swipeBack?: boolean;
    title?: string;
    /** 목록이 비었을 때 글 */
    emptyText?: string;
    theme?: Partial<MissionPageTheme>;
    footer?: ReactNode;
};
export declare function AppHubPage({ apps, onBack, swipeBack, title, emptyText, theme: themeIn, footer }: AppHubPageProps): React.JSX.Element;
