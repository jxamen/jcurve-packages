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
    /** (0.1.3) 이 단계 당첨표의 단위 — 'points' 면 「최대 1,000P」로 P 만 보여 준다(원은 서버가 계산만 한 값이라 안 보인다). 서버가 안 주면 'won'(옛 응답 그대로) */
    unit: 'won' | 'points';
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
    unit: 'won' | 'points';
    maxPoints?: number;
};
export type LotteryWinner = {
    nick: string;
    tierMax: number;
    won: number; /** (0.1.3) 포인트 표 단계의 당첨 */
    unit: 'won' | 'points';
    points?: number;
    tierMaxPoints?: number;
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
/** (0.1.3) 단계의 「최대 ○」 — 포인트 표(unit:'points')면 `1,000P`, 원 표면 `100원`. 원 표시는 포인트 표에서 쓰지 않는다 */
export declare const lotteryTierAmount: (t: Pick<LotteryTier, "maxWon" | "maxPoints"> & {
    unit?: "won" | "points";
}) => string;
export declare const lotteryTierTitle: (t: Pick<LotteryTier, "maxWon" | "maxPoints"> & {
    unit?: "won" | "points";
}) => string;
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
/** (0.1.3) 당첨 전체 화면의 큰 제목 — 「5P 당첨!」 */
export declare const lotteryResultHeadline: (points: number) => string;
/** 결과 창에서 남은 복권이 없을 때 잇는 버튼 — 「미션 하고 복권 더 받기」(다음 단계까지 남은 미션 수) */
export declare function lotteryMoreMissionLabel(s: LotteryState): string | null;
/** (0.1.3) 당첨 띠 문구를 세 조각으로 — 가운데(금액)만 강조색으로 그린다. 포인트 표 단계는 「○님이 1,000P 당첨됐어요!」, 원 표는 예전 문구 그대로 */
export declare function lotteryWinnerParts(w: LotteryWinner): {
    pre: string;
    amount: string;
    post: string;
};
export declare const lotteryWinnerLine: (w: LotteryWinner) => string;
/**
 * (0.1.6, 대표님 10-20 16:37 「1,000원 복권에 당첨됐어요」 → P) 당첨 띠에 쓸 당첨 목록 — 원 당첨도 P 로 보여 준다(포인트 표로 가는 중이라 P 로 통일).
 * 서버 winners 가 아직 원 단위(unit 'won')면 **실제 당첨액**(won)에 100원당 P(`state.wonToPoint`, 160 = 1원 1.6P)를 곱해 바꾼다 — 예: 1,000원 → 1,600P.
 * 티켓 단계의 최대액(tierMax)이 아니라 실제 당첨액이다(최대액을 당첨처럼 보이면 사실과 다르다). 서버가 이미 P(unit 'points')로 주면 그대로 통과한다.
 * 환산값을 모르거나(0) 당첨 P 가 0 이하인 줄은 띠에서 뺀다. `LotterySheet` 가 자동으로 쓴다.
 */
export declare function lotteryWinnersInPoints(winners: LotteryWinner[], wonToPoint: number): LotteryWinner[];
/**
 * (0.1.3) 시트 줄 — 미션 복권 줄(단계마다)과 황금 복권 줄(하루 기본 복권이 있을 때 하나)을 따로 보여 준다. 미션 줄은 미션 복권만의 상태(missionState)로 정한다.
 * 「열기」는 미션 복권이 열린 줄, 「받기」는 아직 못 받은(미션으로 가기), 「받기 완료」는 다 연 줄, 「내일 받아요」는 하루 한도에 막힌 줄
 */
export declare function lotteryMissionButton(t: Pick<LotteryTier, 'missionState'>): {
    label: string;
    kind: 'open' | 'earn' | 'done' | 'wait';
};
/**
 * (0.1.5, 대표님 17:06:56 「미션 말고 쇼핑 · 플레이스 퀴즈로」) 미션 줄 설명의 이름 — 기본 「쇼핑 · 플레이스 퀴즈」. 앱마다 이름이 다르면 `quiz` 로 바꾼다(예: 「미션」).
 */
export declare const DEFAULT_QUIZ = "\uC1FC\uD551 \u00B7 \uD50C\uB808\uC774\uC2A4 \uD034\uC988";
/**
 * 미션 줄 설명 — 늘 **받는 방법**으로 말한다(0.1.4, 대표님 16:37 「미션한개 다섯 개를 해서 내가 복권을 받았다는 건가?」: 「미션 1개로 받았어요」는 이미 받은 이유로 읽혔다).
 * 1 · 5 · 10 · 20 · 30 줄이 같은 꼴 — 「쇼핑 · 플레이스 퀴즈 N개 하면 받아요」(받았든 안 받았든 열 수 있든). 일부 했으면 「쇼핑 · 플레이스 퀴즈 M개 더 하면 받아요」.
 * 하루 한도에 막힌 줄은 버튼 「내일 받아요」와 같은 말 — 「내일 다시 받을 수 있어요」. 한 줄에 들어오게 짧다(대표님 16:47). `quiz` 로 이름을 바꿀 수 있다(0.1.5)
 */
export declare function lotteryMissionHint(t: Pick<LotteryTier, 'missions' | 'missionsLeft' | 'missionState'>, quiz?: string): string;
/** (0.1.5) 목록 한 줄 — 줄의 대표 단계(가장 낮은 문턱)와 묶인 단계들, 설명, 버튼, 「열기」를 눌렀을 때 열 단계(없으면 null) */
export type LotteryRow = {
    rep: LotteryTier;
    tiers: LotteryTier[];
    hint: string;
    button: {
        label: string;
        kind: 'open' | 'earn' | 'done' | 'wait';
    };
    openTier: number | null;
    /** 「받기」를 눌렀을 때 갈 단계(아직 못 받은 첫 단계) — 없으면 대표 단계 */
    earnTier: number;
};
/**
 * (0.1.5, 대표님 17:06 「20개 · 30개짜리는 없애고 열 개짜리를 10개마다 받을 수 있다」) 서버는 1 · 5 · 10 · 20 · 30 문턱을 그대로 준다(20 · 30 은 10 과 같은 표).
 * **같은 표(maxWon · maxPoints · unit) + 문턱이 10 의 배수(≥10)** 인 이어진 단계들을 한 묶음으로 — 나머지(1 · 5 · 표가 다른 단계 · 20 · 30 이 없는 3단계)는 한 단계씩.
 */
export declare function lotteryGroupTiers(tiers: LotteryTier[]): LotteryTier[][];
/**
 * (0.1.5) 묶음 → 한 줄. 한 단계면 예전 그대로(버튼 · 설명), 묶였으면 설명 「쇼핑 · 플레이스 퀴즈 10개마다 받아요」 + 버튼 「열기」 / 열 수 있는 장이 둘 이상이면 「열기 N」
 * (단계마다 미션 복권은 하루 한 장 — 열 수 있는 장 수 = missionState 가 ready 인 단계 수), 누르면 안 연 첫 단계. 못 받은 단계가 남았으면 「받기」, 한도에 막혔으면 「내일 받아요」, 다 열었으면 「받기 완료」
 */
export declare function lotteryTierRow(group: LotteryTier[], quiz?: string): LotteryRow;
/** (0.1.4) 황금 복권 줄 설명 — 한 줄: 광고가 열리면 「하루 1번 광고 보고 받아요」, 광고 없이 열리면(`basicAd` false) 「하루 1번 받아요」 */
export declare const lotteryGoldHint: (basicAd: boolean) => string;
/** 황금 복권 줄 — 기본 복권이 있는 단계(없으면 null). `unopened` 가 0 이면 이미 연 것 */
export declare function goldenRow(s: LotteryState | null): {
    tier: LotteryTier;
    unopened: number;
    total: number;
} | null;
/** 안 연 복권이 있을 때만 칩을 그린다 — 다 열면 사라진다 */
export declare const lotteryChipCount: (s: LotteryState | null) => number;
/** 황금(기본) 복권 팝업 대상 — 안 연 기본 복권이 있는 단계(없으면 null) */
export declare function goldenTier(s: LotteryState | null): LotteryTier | null;
/**
 * (0.1.2) 이 단계의 **다음 복권을 열 때 광고가 바로 열리나** — 미션 복권(광고 없이 열림)이 아니라 매일 기본(황금) 복권만 남았을 때.
 * 서버는 미션 복권을 먼저 연다. `basicAd` 는 서버 설정 daily_basic.ad(기본 true = 광고 필요) — 광고 없이 여는 설정이면 false 를 넘긴다.
 * 버튼에 「광고」 칩을 넣을지 이것으로 정한다(광고 없이 열리는 버튼에는 넣지 않는다)
 */
export declare function opensWithAd(t: Pick<LotteryTier, 'unopened' | 'missionState' | 'basicUnopened'> | null | undefined, basicAd?: boolean): boolean;
/** (0.1.2) 결과 창의 「다음 복권 열기」가 광고를 여는가 — 다음에 열 단계(안 연 첫 단계)가 황금 복권뿐일 때 */
export declare function nextOpensWithAd(s: LotteryState | null, basicAd?: boolean): boolean;
/** 황금 복권 시트의 쉬운 말 설명 — 줄마다 한 가지, 값(최대 금액 · 포인트)은 서버 state 에서 온 것을 넘긴다. 광고 없이 열리는 설정이면 두 번째 줄이 바뀐다 */
export declare function goldenLines(o: {
    maxWon: number;
    maxPoints?: number | null;
    ad?: boolean;
    unit?: 'won' | 'points';
}): {
    lines: string[];
    note: string;
};
/** 열 수 있는 단계 — 이 단계의 복권이 하나라도 안 열렸다 */
export declare function readyTiers(s: LotteryState | null): LotteryTier[];
