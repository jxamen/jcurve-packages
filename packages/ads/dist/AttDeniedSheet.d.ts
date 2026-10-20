import React from 'react';
import { type AttSheetTexts, type AttStorage } from './attSheet';
/**
 * ATT 거부 안내 시트 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet appName="…" />`).
 *
 * - 켤 때: 거부·제한이고 오늘 아직 안 보였으면 띄운다. 미정이면 시스템 창(시트 아님).
 * - 오퍼월 전: `ensureTrackingBeforeOfferwall()` 이 이 시트를 연다(매번).
 * - 「설정에서 허용하기」 → 설정 앱. 앱으로 돌아와 허용됐으면 시트를 닫는다.
 * iOS 가 아니면 아무것도 그리지 않는다. 시트가 안 뜨는 경우에도 던지지 않는다.
 */
export type AttSheetTheme = {
    background?: string;
    text?: string;
    subText?: string;
    /** 번호 동그라미 · 「설정에서 허용하기」 버튼 */
    primary?: string;
    primaryText?: string;
    overlay?: string;
};
export type AttDeniedSheetProps = {
    /** 설정 앱 목록에 보이는 앱 이름 — 셋째 줄에 들어간다 */
    appName: string;
    theme?: AttSheetTheme;
    /** 마지막으로 띄운 날을 적어 둘 곳(선택) — 없으면 메모리(앱을 끄면 잊는다) */
    storage?: AttStorage;
    /** 문구 덮어쓰기(선택) — 빠진 항목은 기본 문구 */
    texts?: Partial<AttSheetTexts>;
};
export declare function AttDeniedSheet({ appName, theme, storage, texts }: AttDeniedSheetProps): React.FunctionComponentElement<{
    visible: boolean;
    transparent: boolean;
    animationType: string;
    onRequestClose: () => void;
}> | null;
