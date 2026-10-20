import React from 'react';
import { type AttPrimerTexts, type AttSheetTexts, type AttStorage } from './attSheet';
/**
 * ATT 안내 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet appName="…" />`). **붙이는 것만으로는 아무것도 뜨지 않는다.**
 * `ads.requestTracking()` · `ensureTrackingBeforeOfferwall()` 이 부를 때만 두 가지 중 하나가 열린다(1.9.11).
 *
 * ① 중립 안내(`primer`) — 시스템 ATT 창 바로 앞. 상태가 미정일 때만, 한 번, 버튼 「계속」 하나. 누르면 곧바로 시스템 창.
 *    닫기 · 건너뛰기가 없다(건너뛰고 다시 묻지 않는다). 시스템 창을 흉내 내지 않는다.
 * ② 거부 · 제한 단계 시트(`sheet`) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만.
 *    「설정에서 허용하기」 → 설정 앱, 돌아와 허용됐으면 닫는다. 닫아도 오퍼월 진입은 막지 않는다.
 * 앱을 켤 때 · 홈에서 스스로 열리는 일은 없다. iOS 가 아니면 아무것도 그리지 않는다. 안 뜨는 경우에도 던지지 않는다.
 */
export type AttSheetTheme = {
    background?: string;
    text?: string;
    subText?: string;
    /** 번호 동그라미 · 주 버튼(「계속」 · 「설정에서 허용하기」) */
    primary?: string;
    primaryText?: string;
    overlay?: string;
};
export type AttDeniedSheetProps = {
    /** 설정 앱 목록에 보이는 앱 이름 — 단계 시트의 셋째 줄에 들어간다 */
    appName: string;
    theme?: AttSheetTheme;
    /** 1.9.11 부터 쓰이지 않는다(옛 호출 코드가 그대로 컴파일되도록 남김) */
    storage?: AttStorage;
    /** 거부 · 제한 단계 시트 문구 덮어쓰기(선택) — 빠진 항목은 기본 문구 */
    texts?: Partial<AttSheetTexts>;
    /** 시스템 창 앞 중립 안내 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_PRIMER_TEXTS` */
    primerTexts?: Partial<AttPrimerTexts>;
};
/** 안내가 사라지는 동안(페이드 · 슬라이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
export declare const DISMISS_MS = 400;
export declare function AttDeniedSheet({ appName, theme, texts, primerTexts }: AttDeniedSheetProps): React.FunctionComponentElement<React.FragmentProps> | null;
