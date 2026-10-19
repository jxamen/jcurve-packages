import { type DaySteps } from './days';
export type StepsPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';
/** 지금 권한 — 묻지 않고 본다 */
export declare function stepsPermission(): Promise<StepsPermission>;
/** 권한을 묻는다 — 안드로이드는 헬스 커넥트 먼저, 없거나 거부하면 걸음 센서 */
export declare function requestStepsPermission(explain: () => Promise<boolean>): Promise<StepsPermission>;
/** 오늘 KST 걸음 — 권한 없음/읽기 실패는 빈 목록으로, readToday가 상태를 구분한다. */
export declare function readDays(now: number): Promise<DaySteps[]>;
/**
 * 앱이 켜진 동안 걸음이 늘면 알린다 — 화면이 다시 읽는다.
 * 안드로이드 센서 방식이면 **이때 늘어난 만큼 그날에 적는다**(이것이 유일한 기록이다).
 */
export declare function watchSteps(onChange: () => void): () => void;
export type TodayReading = {
    status: StepsPermission | 'ready' | 'error';
    steps: number | null;
    days: DaySteps[];
    sensorOnly: boolean;
};
export declare function readToday(now?: number): Promise<TodayReading>;
