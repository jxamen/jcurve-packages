/**
 * 상태 화면(오류 · 점검 · 마감 등) 문구 — react-native 없이 읽히게 화면 파일에서 뗐다(시험이 문구만 본다, 0.2.1).
 */
import { type Lang } from './i18n';
export type StateKind = 'error' | 'maintenance' | 'maintenanceDaily' | 'session' | 'soldOut' | 'off' | 'notReady';
/** (0.2.1) 상태 화면 문구 — lang 이 없거나 'ko' 면 원문(피그마 문구) 그대로 */
export declare function stateCopy(kind: StateKind, lang?: Lang): {
    title: string;
    body: string;
    button?: string;
    windowLabel?: string;
};
