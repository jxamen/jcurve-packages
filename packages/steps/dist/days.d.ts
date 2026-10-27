/**
 * 걸음 수 — 날짜 나누기 · 보낼 목록 · 서버 응답 읽기. **순수 함수만**(RN 을 부르지 않는다 — 노드 시험이 돈다).
 *
 * 날짜는 **한국시간(KST, UTC+9) 자정** 기준이다. 기기 시간대가 달라도 서버와 같은 날짜로 센다.
 * 한국은 서머타임이 없어 하루는 늘 24시간이다.
 *
 * ## 손실이 없게(대표님 2026-09-24 「걸음 수 날라가서 유저가 못받는 일이 생기면 안됨」)
 *  - 읽은 값은 날짜별 **최댓값만** 남긴다 — 소스가 잠깐 작은 값을 줘도(재부팅 · 권한 끊김) 줄지 않는다.
 *  - 서버가 받았다고 답한 값(`acked`)보다 큰 날짜만 다시 보낸다. 실패하면 그대로 남아 다음에 또 보낸다.
 *  - 서버도 날짜별 최댓값만 반영하므로 같은 값을 여러 번 보내도 중복이 없다.
 */
export type StepSource = 'healthkit' | 'coremotion' | 'healthconnect' | 'sensor' | 'web';
export type DaySteps = {
    date: string;
    steps: number;
    source: StepSource;
};
/** 기기에 남기는 걸음 장부 — `days` 는 읽은 최댓값, `acked` 는 서버가 받은 값 */
export type StepsBook = {
    days: Record<string, DaySteps>;
    acked: Record<string, number>;
};
export declare const emptyBook: () => StepsBook;
/** 이 순간의 한국 날짜 'YYYY-MM-DD' */
export declare function kstDay(ms: number): string;
/** 어제의 한국 날짜 — 한국은 서머타임이 없어 하루는 늘 24시간이다 */
export declare function yesterdayKst(now?: number): string;
/** 그 한국 날짜의 자정(UTC 밀리초) */
export declare function kstStart(date: string): number;
/** 오늘을 포함한 최근 n일 — 오래된 날부터. 오늘 칸의 끝은 지금(미래를 묻지 않는다) */
export declare function recentDays(now: number, n: number): Array<{
    date: string;
    start: number;
    end: number;
}>;
/** 오늘과 어제만 남긴다 — 단계 상태(`steps/stages?day=`)와 청구는 이 둘뿐이다. `steps/sync` 는 지난 날도 받는다(앱보조5, 하루 상한만 적용)지만, 이 패키지의 동기화는 예전처럼 최근 날만 올린다. 먼 날까지 올려 온 앱(에그머니 `toSend`)은 그 동작을 바꾸지 말 것. */
export declare function keepRecent(days: DaySteps[], now: number): DaySteps[];
/** 그 날짜 걸음 수 — 기록이 여러 개면 가장 큰 값, 그 날 기록이 없으면 null */
export declare function stepsOn(days: DaySteps[], date: string): number | null;
/** 새로 읽은 값을 장부에 합친다 — 날짜별 최댓값만. **줄어든 값은 무시**한다 */
export declare function mergeDays(book: StepsBook, fresh: DaySteps[]): StepsBook;
/** 오래된 날짜를 지운다(기본 35일 — 헬스 커넥트 30일보다 조금 길게) */
export declare function pruneBook(book: StepsBook, now: number, keepDays?: number): StepsBook;
/**
 * 서버에 보낼 날짜 — 서버가 받은 값보다 큰 날짜 전부 + **오늘은 늘**(오늘 걸음 · 쌓인 먹이를 새로 받으려고).
 * 날짜 순서로 준다.
 */
export declare function toSend(book: StepsBook, now: number): DaySteps[];
/**
 * 서버에 보내는 소스 이름 — 서버는 `healthkit · cmpedometer · healthconnect · sensor` 만 받는다(다른 이름은 그 줄을 skipped).
 * 기기 장부의 `coremotion`(iOS CMPedometer)은 `cmpedometer` 로 바꿔 보낸다.
 */
export declare function toServerDays(days: DaySteps[]): Array<{
    date: string;
    steps: number;
    source: string;
}>;
/** 서버가 받았다 — 보낸 값을 받은 값으로 적는다(더 큰 값만) */
export declare function ackSent(book: StepsBook, sent: DaySteps[]): StepsBook;
/** 아직 서버가 받지 않은 날짜 수(오늘 제외) — 화면 · 기록용 */
export declare function unsentCount(book: StepsBook, now: number): number;
/** 장부의 오늘 걸음 */
export declare const todayOf: (book: StepsBook, now: number) => number;
/** 서버 응답 — 계약이 확정 전이라 모르는 모양은 무시한다(`today_steps` · `pending_feed`) */
export type SyncReply = {
    todaySteps: number | null;
    pendingFeed: number | null;
};
export declare function parseReply(json: unknown): SyncReply;
/** 안드로이드 걸음 센서(대체) — 켜 둔 동안 늘어난 만큼 그날에 더한다. 음수 · 이상값은 버린다 */
export declare function addSensorSteps(counts: Record<string, number>, date: string, delta: number): Record<string, number>;
/** 웹 전용 가짜 걸음 — 한국시간 자정부터 분당 7보(하루 약 1만 보) */
export declare function fakeSteps(now: number, date: string): number;
