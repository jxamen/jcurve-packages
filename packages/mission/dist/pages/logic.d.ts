/**
 * 페이지 계산 — 화면 없이 시험하는 순수 함수(react-native 를 가져오지 않는다, 0.4.0).
 * 앱이 이미 가진 값(완료 · 놓침 · 걸음 수 · 남은 시간)을 넘기면 글자 · 칸 · 상태만 정한다.
 */
/** 「하루 3번 들르기」 한 칸 — 앱이 done · missed · claimable 을 정해 넘긴다(carrot visitView 와 같은 뜻) */
export type FreeItemSlot = {
    id: string;
    /** 칸 이름 — 아침 · 점심 · 저녁 */
    name: string;
    /** 열리는 시각 · 닫히는 시각(시 단위, 예 9 · 11) */
    fromHour: number;
    toHour: number;
    /** 회차(1 · 2 · 3) */
    step: number;
    /** 이 회차에 받는 양 */
    reward: number;
    done: boolean;
    missed: boolean;
    claimable: boolean;
};
/** 칸 버튼 글자 — 받았으면 「받았어요」, 지났으면 「놓쳤어요」, 받을 수 있으면 「받기」, 그 밖은 「아직」 */
export declare function slotButtonLabel(slot: Pick<FreeItemSlot, 'done' | 'missed' | 'claimable'>): string;
/** 칸 아래 한 줄 — 「아침 9시~11시」 옆 글(받았어요 · 시간이 지났어요 · 회차 · 양) */
export declare function slotStatusLine(slot: FreeItemSlot, itemName: string): string;
/** 「아침 9시~11시」 */
export declare function slotWindowLabel(slot: Pick<FreeItemSlot, 'name' | 'fromHour' | 'toHour'>): string;
/** 「3칸 중 몇 칸」 — 받은 칸 수와 전체 칸 수 */
export declare function slotCount(slots: readonly Pick<FreeItemSlot, 'done'>[]): {
    done: number;
    total: number;
};
/** 오늘 미션 한 줄 — done 은 앱이 아는 값(true 완료 · false 아직 · null 모름, 모름은 완료로 세지 않는다) */
export type MissionDone = {
    done: boolean | null;
};
/** 진행 수 · 퍼센트 · 전부 끝났는지 — 보이는 줄만 넘긴다(앱이 hidden 을 거른다) */
export declare function missionProgress(rows: readonly MissionDone[]): {
    done: number;
    total: number;
    allDone: boolean;
    percent: number;
};
/** 오늘 미션 보너스 큰 단추 글 — 보너스가 0 이면 단추를 그리지 않는다(호출하지 않는다) */
export declare function bonusButtonLabel(bonus: number): string;
/** 만보기 단계 한 칸 — 앱이 넘긴다(threshold = 이 걸음에 이르면 받을 수 있음) */
export type StepsStage = {
    id: string;
    threshold: number;
    points: number;
    claimed: boolean;
};
/** 오늘 걸음 수 기준으로 받을 수 있는 단계 · 다음 단계 · 남은 걸음 */
export declare function stepsSummary(todaySteps: number, stages: readonly StepsStage[]): {
    claimable: StepsStage[];
    next?: StepsStage;
    remaining: number;
    allClaimed: boolean;
};
/** 말풍선 글 — 업데이트 전이면 「업데이트하면…」, 아니면 받을 수 있는 횟수 · 다음 단계 · 다 받음 순 */
export declare function stepsBubble(args: {
    available: boolean;
    todaySteps: number;
    stages: readonly StepsStage[];
}): string;
/** 「업데이트하면 걸음 보상을 받을 수 있어요」 — 걸음 기능이 없는 옛 빌드에서 쓰는 안내(대표님 10-19 22:30 · 패키지 0.4.0) */
export declare const UPDATE_NOTICE = "\uC5C5\uB370\uC774\uD2B8\uD558\uBA74 \uAC78\uC74C \uBCF4\uC0C1\uC744 \uBC1B\uC744 \uC218 \uC788\uC5B4\uC694";
/** 행운 찬스 · 무료 뽑기 — 대기 남은 시간(ms). 서버 기준 시각 `until` 과 지금 `now` 로 정한다 */
export declare function waitLeftMs(until: number | undefined, now: number): number;
/** 「1:05」 — 남은 시간 글 */
export declare function clockText(ms: number): string;
/** 뽑기 단추 글 — 대기 중이면 남은 시간, 무료 한 번이면 「무료로 뽑기」, 광고를 봐야 하면 「광고 보고 한 번 더」 */
export declare function drawLabel(args: {
    free: boolean;
    waitMs: number;
}): string;
/** 뽑기 카드 한 줄 — 대기 · 무료 남음 · 광고로 한 번 더 · 오늘 끝 */
export declare function drawSubLine(args: {
    free: number;
    ad: number;
    waitMs: number;
}): string;
/** 「꽝 없이 A / B」 — 뽑으면 받는 것 목록 */
export declare function prizeLine(prizes: readonly string[]): string | null;
/** 초대 코드 입력 정리 — 영문 대문자 · 숫자만, 14자 이내(carrot InviteCard 와 같은 규칙) */
export declare function normalizeInviteCode(raw: string): string;
/** 초대 카드 제목 줄 — 「{n}P 받으세요」 */
export declare function inviteHeadline(inviterPoint: number): string;
/** 확률권 줄 — 「확률권 N장」, 앱 설명이 있으면 「 — 설명」을 붙인다(앱 이름이 박히지 않게, 0.4.1) */
export declare function boostLine(boost: number, text?: string): string;
/** 페이지 단추 잠금(「확인 중…」)의 최대 길이(0.4.3) — 앱이 준 약속(광고 · 받기)이 끝나지 않아도 이 시간 뒤엔 반드시 풀린다 */
export declare const BUSY_LIMIT_MS = 75000;
/** 약속이 끝나거나 ms 가 지나면 끝난다(시간이 지나면 undefined). 실패는 그대로 던진다 — 잠금은 부르는 쪽 finally 에서 푼다 */
export declare function settleWithin<T>(p: Promise<T>, ms?: number): Promise<T | undefined>;
