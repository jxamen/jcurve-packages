import React from 'react';
import { type StepsStage, type StepsState } from './stages';
/** 색 — 앱의 theme 에서 이 일곱 가지만 넘기면 된다(`StepsScreen` 은 자기 theme 을 그대로 넘긴다). */
export type YesterdayTheme = {
    card: string;
    text: string;
    sub: string;
    primary: string;
    primaryDeep?: string;
    primarySoft: string;
    onPrimary: string;
    radius: number;
};
export type StepsYesterdayCardProps = {
    /** `GET steps/stages?day=어제` 의 응답. 없으면(아직 못 받음 · 실패) 카드가 안 보인다 */
    state: StepsState | null | undefined;
    /** 이 카드의 받기를 눌렀다 — 앱이 어제 날짜(`state.day`)의 광고(`stage.ad_purpose`)를 보여 주고 `claim(stage_id, day=state.day)` 를 부른다 */
    onClaim: (stage: StepsStage) => void;
    /** 다른 청구가 진행 중이거나 광고 확인을 기다리는 중 — 버튼을 잠근다 */
    busy?: boolean;
    theme?: Partial<YesterdayTheme>;
    now?: number;
};
/**
 * 「어제 걸음」 카드 — 오늘 카드 바로 아래에 둔다(대표님 10/28 「어제 걸음도 받게 하기」). 어제 몫이 0 이거나 다 받았으면 아무것도 안 그린다.
 * 어제 걸음은 **오늘 자정(한국 시간)까지만** 받을 수 있다 — 서버가 오늘 · 어제 날짜만 받는다.
 */
export declare function StepsYesterdayCard({ state, onClaim, busy, theme, now }: StepsYesterdayCardProps): React.JSX.Element | null;
