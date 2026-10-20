/**
 * 행운 찬스 — 하루 무료 한 번, 광고를 보면 한 번 더 뽑기 (0.4.0, carrot ChanceScreen · DrawCard 그대로).
 * 상품 · 확률 · 횟수 · 간격은 서버가 정한다. 패키지는 남은 횟수와 대기 시각을 그리고 onDraw(광고 여부) 만 부른다.
 * 참여형 광고(오퍼월)는 `offerwall` 을 줄 때만 그린다 — 주소 · 여는 방법은 앱이 가진다.
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
export type LuckyChancePageProps = {
    /** 오늘 무료로 남은 뽑기 수 */
    freeLeft: number;
    /** 광고를 보고 더 뽑을 수 있는 남은 수 */
    adLeft: number;
    /** 다음 뽑기 가능 시각(앱 기준 epoch ms). 지나지 않았으면 초읽기를 보여 준다 */
    waitUntil?: number;
    /** 뽑으면 받는 것 목록 — 「꽝 없이 A / B」(carrot 은 서버 칸에서 종류별 최대값) */
    prizes?: readonly string[];
    /** 확률권 수 — 0 보다 크면 한 줄(boostText 가 없으면 「확률권 N장」만) */
    boost?: number;
    /** 확률권 줄 뒤 설명 — 앱마다 말이 달라 앱이 준다(예 「다음에 캘 때 좋은 당근이 잘 나와요」) (0.4.1 앱보조2 10-20) */
    boostText?: string;
    /** 카드 제목 — 기본 「행운 뽑기」(0.4.0 은 「당근 뽑기」가 박혀 있었다) */
    drawTitle?: string;
    /** 뽑기 — ad=false 면 무료, true 면 광고를 보고 뽑는다(광고 · 지급은 앱) */
    onDraw: (ad: boolean) => void | Promise<void>;
    /** 뽑기 중 — 단추를 막는다 */
    busy?: boolean;
    /** 참여형 광고 — 주소가 있을 때만 준다. 누르면 onOpen(앱이 연다) */
    offerwall?: {
        name: string;
        onOpen: () => void;
    };
    onBack: () => void;
    /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
    swipeBack?: boolean;
    title?: string;
    theme?: Partial<MissionPageTheme>;
    footer?: ReactNode;
};
export declare function LuckyChancePage({ freeLeft, adLeft, waitUntil, prizes, boost, boostText, drawTitle, onDraw, busy, offerwall, onBack, swipeBack, title, theme: themeIn, footer }: LuckyChancePageProps): React.JSX.Element;
