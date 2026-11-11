/**
 * 오늘의 미션 — 여러 미션에 참여하면 보너스 (0.4.0, carrot TodayMissionScreen 그대로).
 * 완료 표시는 앱이 아는 값(done)으로 정한다. 줄 어디를 눌러도 onGo 로 간다.
 * 전부 끝나면 「모두 완료하고 {bonus}P 받기」 — onClaim 이 보너스를 주고, 실패하면 다시 누르라고 적는다.
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
import { type MissionDone } from './logic';
/** 오늘 미션 한 줄 — done: true 완료 · false 아직 · null 앱이 모름(완료로 세지 않는다) */
export type TodayMissionRow = MissionDone & {
    key: string;
    title: string;
    sub: string;
    /** 줄 그림 — 기본 ⭐ */
    icon?: ReactNode;
    hidden?: boolean;
    /** 「하러 가기」 — 줄 어디를 눌러도 같다 */
    onGo: () => void;
};
export type TodayMissionPageProps = {
    rows: readonly TodayMissionRow[];
    /** 전부 완료 보너스 P — 0 이면 보너스 단추를 그리지 않는다 */
    bonus: number;
    /** 이미 받았는지(서버 값) — 받았으면 「보너스를 받았어요」 */
    claimed?: boolean;
    /** 보너스 받기 — 실패하면 reject 하거나 false 를 준다(「보너스를 받지 못했어요」) */
    onClaim: () => Promise<void | boolean> | void | boolean;
    onBack: () => void;
    title?: string;
    theme?: Partial<MissionPageTheme>;
    footer?: ReactNode;
    buttonWidth?: number;
    buttonHeight?: number;
};
export declare function TodayMissionPage({ rows, bonus, claimed, onClaim, onBack, title, theme: themeIn, footer, buttonWidth, buttonHeight }: TodayMissionPageProps): React.JSX.Element;
