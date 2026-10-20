/**
 * @jcurve/lottery — 공용 복권(mission 0.6.0 에서 옮겨 왔다) — 대표님 2026-10-20 14:08 「미션 하나 참여하면 최대 100원 · 다섯 개 500원 · 열 개 1000원」 + 14:15 「황금 복권이 기본으로」.
 * 서버(jcurve-api feat/lottery-server)가 장부 · 지급 · 추첨을 모두 하고, 이 파일은 응답을 읽고 문구를 만들고 열기 요청을 보낸다.
 * react-native 를 가져오지 않는다(시험이 바로 돈다). 규칙 · 금액 · 확률은 서버(어드민 설정)가 정한다 — 여기에는 없다.
 */
/** 앱의 서버 요청 함수 — 앱이 가진 것(ApiError 를 던지는 api.get/post 계열)을 그대로 넘긴다. 경로는 `{app}/` 뒤부터(예: 'lottery/state') */
export type Requester = (path: string, options?: {
    method?: string;
    body?: unknown;
}) => Promise<unknown>;
export type LotteryTierState = 'locked' | 'ready' | 'opened' | 'capped';
export type LotteryTier = {
    /** 단계 번호(1부터, 서버 설정 순서) — open 에 그대로 넘긴다 */
    tier: number;
    /** 이 단계를 받는 서로 다른 쇼핑 · 플레이스 미션 수 */
    missions: number;
    maxWon: number;
    maxPoints: number;
    /** 이 단계의 복권 상태(미션 · 매일 기본 복권 합쳐서): ready = 열 수 있는 게 있음 · opened = 다 엶 · capped = 기준은 채웠지만 하루 한도로 못 받음 · locked = 아직 */
    state: LotteryTierState;
    /** 미션으로 받는 복권만의 상태 — 황금(기본) 복권이 같은 단계에 있어도 「미션 N개 더」를 따로 보여 준다 */
    missionState: LotteryTierState;
    missionsLeft: number;
    tickets: number;
    unopened: number;
    /** 이 단계의 매일 기본(황금) 복권 수 · 안 연 수 */
    basic: number;
    basicUnopened: number;
    prize: {
        won: number;
        points: number;
    } | null;
};
export type LotteryState = {
    day: string;
    /** 100원당 P(160 = 1원 1.6P) */
    wonToPoint: number;
    participated: number;
    tiers: LotteryTier[];
    unopened: number;
};
export type LotteryOpenResult = {
    tier: number;
    maxWon: number;
    won: number;
    points: number;
    balance: number;
    replayed: boolean;
    unopened: number;
};
export type LotteryWinner = {
    nick: string;
    tierMax: number;
    won: number;
};
export type LotteryError = 'off' | 'not_ready' | 'not_reached' | 'already_opened' | 'key_conflict' | 'ad_required' | 'key_required' | 'bad_key' | 'bad_tier' | 'bad_src' | 'network' | 'busy' | 'invalid';
/** 서버 응답을 믿지 않고 다시 읽는다 — 꺼진 앱(ok 아님) · 깨진 응답은 null(칩이 안 보인다) */
export declare function parseLotteryState(response: unknown): LotteryState | null;
export declare function parseWinners(response: unknown): LotteryWinner[];
/**
 * 던져진 오류 · 응답 본문에서 서버 오류 이름을 읽는다 — 앱마다 요청 함수가 던지는 꼴이 달라서(ApiError.code · status, {error}, {data:{error}}, {body:{error}}) 모두 읽는다.
 * 앱이 {error, status} 로 바꿔 던질 필요 없이 `openLottery` 가 이것을 쓴다. 서버가 답한 이름이 아니면 404 → off · 503 → not_ready, 그 밖(끊김 · 시간초과 · 모름)은 network
 */
export declare function toLotteryError(e: unknown): LotteryError;
/** GET lottery/state — 꺼졌거나 실패하면 null(복권 칩을 그리지 않는다). 읽는 순간 서버가 오늘 줄 복권을 만든다 */
export declare function fetchLotteryState(fetchJson: Requester): Promise<LotteryState | null>;
export declare function fetchLotteryWinners(fetchJson: Requester): Promise<LotteryWinner[]>;
/** 열기 요청마다 새 멱등 키 — 같은 시도를 다시 보낼 때만 같은 키를 쓴다(createLotteryOpener) */
export declare function newLotteryKey(): string;
export type OpenOutcome = {
    ok: true;
    result: LotteryOpenResult;
} | {
    ok: false;
    error: LotteryError;
};
/** POST lottery/open — `src: 'basic'` 는 황금(기본) 복권(서버가 광고 시청 확인을 소비한다), 안 주면 미션 복권을 먼저 연다 */
export declare function openLottery(fetchJson: Requester, args: {
    tier: number;
    key: string;
    src?: 'basic' | 'mission';
}): Promise<OpenOutcome>;
/**
 * 열기 함수 — **한 번에 하나만**, 네트워크가 끊겨 다시 보낼 때는 같은 키(서버가 저장된 결과를 다시 준다), 서버가 답을 준 뒤에는 키를 버린다.
 * 잠금(busy)은 끝나면 반드시 풀린다(finally) — 이동 · 실패 · 취소를 기다리지 않는다(0.4.3 와 같은 규칙).
 */
export declare function createLotteryOpener(fetchJson: Requester): (tier: number, src?: 'basic' | 'mission') => Promise<OpenOutcome>;
export declare const lotteryTierTitle: (t: Pick<LotteryTier, "maxWon">) => string;
/** 단계 줄 설명 — 황금(기본) 복권이 있는 단계는 그 안내, 아니면 미션 기준 */
export declare function lotteryTierHint(t: LotteryTier): string;
/** 단계 줄 버튼 — ready 면 「열기」, 다 열었으면 「획득 완료」, 못 받은 단계는 「받기」(미션으로 가기), 하루 한도에 막힌 단계는 「내일 받아요」 */
export declare function lotteryTierButton(t: Pick<LotteryTier, 'state'>): {
    label: string;
    kind: 'open' | 'earn' | 'done' | 'wait';
};
/** 아직 못 받은 가장 가까운 단계 — 「한 번 더! ○원 복권 받기」 · 「미션 N개 더 하면」 */
export declare function nextTierToEarn(s: LotteryState): LotteryTier | null;
export declare function lotteryMoreLabel(s: LotteryState): string | null;
/** 결과 창 제목 — 「축하해요 보상 ○P 당첨!」 */
export declare const lotteryResultTitle: (points: number) => string;
/** 결과 창에서 남은 복권이 없을 때 잇는 버튼 — 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수) */
export declare function lotteryMoreMissionLabel(s: LotteryState): string | null;
export declare const lotteryWinnerLine: (w: LotteryWinner) => string;
/** 안 연 복권이 있을 때만 칩을 그린다 — 다 열면 사라진다 */
export declare const lotteryChipCount: (s: LotteryState | null) => number;
/** 황금(기본) 복권 팝업 대상 — 안 연 기본 복권이 있는 단계(없으면 null) */
export declare function goldenTier(s: LotteryState | null): LotteryTier | null;
/** 열 수 있는 단계 — 이 단계의 복권이 하나라도 안 열렸다 */
export declare function readyTiers(s: LotteryState | null): LotteryTier[];
