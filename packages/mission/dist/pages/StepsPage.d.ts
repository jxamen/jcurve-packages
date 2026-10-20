/**
 * 만보기 — 1,000걸음마다 광고 보고 포인트 (0.4.0, carrot StepsScreen 의 보이는 모양만).
 *
 * (0.4.6, 대표님 10-20 19:00) **신발 그림을 지우고 광고를 위로** — 위에서 아래로: 걸음 수 · 말풍선 → 「남은 횟수」 카드 → **광고(`footer`, 안내사항 위)** → 「만보기 안내사항」.
 * `footer` 는 예전엔 맨 아래였다 — 앱 코드를 바꾸지 않아도 광고가 안내사항 위로 올라온다.
 *
 * **이 패키지는 @jcurve/steps 를 가져오지 않는다.** 걸음 수 · 단계 · 받기는 전부 props 로 받는다.
 * 옛 빌드(걸음 기능 없음)는 `stepsAvailable={false}` 로 두면 화면은 읽기만 되고, 받기 · 단추는
 * 「업데이트하면 걸음 보상을 받을 수 있어요」 안내와 onUpdate() 로 간다(2026-10-20 · 옛 빌드 충돌 방지).
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
import { type StepsStage } from './logic';
export type StepsPageProps = {
    /** 오늘 걸음 수 — 앱이 센다 */
    todaySteps: number;
    /** 단계 목록 — 앱이 1,000걸음 · 5P 같은 값을 정해 준다 */
    stages: readonly StepsStage[];
    /** 오늘 받은 포인트 합 — 「오늘 받은 포인트 {n}P」 */
    earnedToday?: number;
    /** 걸음 기능이 켜져 있나(new 빌드). false 면 읽기만 되고 받기는 onUpdate 로 간다 */
    stepsAvailable: boolean;
    /** 업데이트 창 열기 — 앱이 스토어 · 업데이트 안내를 연다 */
    onUpdate: () => void;
    /** 단계 받기 — 광고 · 서버 지급은 앱이 한다. reject 하면 「다시 시도」 안내 */
    onClaim: (stage: StepsStage) => void | Promise<void>;
    onBack: () => void;
    /** 「1,000걸음마다」 의 걸음 수 — 기본 1000 */
    everySteps?: number;
    /** 안내 줄(목록) — 기본은 carrot 안내 문구 중 기기 중립인 것 */
    guide?: readonly string[];
    title?: string;
    theme?: Partial<MissionPageTheme>;
    /** 광고 자리 — 앱이 네이티브 광고를 넣는다(패키지는 광고를 모른다). 0.4.6 부터 「남은 횟수」 카드 아래 · 「만보기 안내사항」 위 */
    footer?: ReactNode;
};
export declare function StepsPage({ todaySteps, stages, earnedToday, stepsAvailable, onUpdate, onClaim, onBack, everySteps, guide, title, theme: themeIn, footer }: StepsPageProps): React.JSX.Element;
