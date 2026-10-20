import type { LotteryWinner, Requester } from './lottery';
/**
 * 시험 모드용 가짜 서버 — **서버가 꺼져 있어도 칩 · 시트 · 결과 · 황금 팝업을 시뮬에서 볼 수 있게** 한다(앱관리 · 앱총괄 요청, 감자밭 시뮬 확인).
 * `useLottery(mock.fetchJson)` 처럼 요청 함수 자리에 꽂는다 — 패키지는 아무것도 가로채지 않는다(앱이 시험 모드에서만 꽂는다. 운영 빌드에는 꽂지 않는다).
 * 서버(jcurve-api lottery/*)와 같은 응답 모양 · 오류 이름이고, 규칙도 같다: 단계별 기준 미션 수, 하루에 단계마다 한 장, 황금(기본) 복권은 광고 확인(grantAd)이 있어야 열림,
 * 같은 멱등 키는 저장된 결과를 다시 줌(다른 단계 · src 면 key_conflict). 금액 · 확률은 시험용 값이다 — 실제 값은 서버(어드민 설정)가 정한다.
 */
export type MockLotteryOptions = {
    /** 오늘 참여한 쇼핑 · 플레이스 미션 수(기본 0) */
    participated?: number;
    /** 매일 기본(황금) 복권을 줄지(기본 true) — 마지막 단계 금액의 복권 1장, 광고 확인이 있어야 열린다 */
    golden?: boolean;
    /** 황금 복권을 광고 확인 없이 열지(기본 false = 광고가 필요, grantAd 로 한 건씩 준다) */
    adFree?: boolean;
    /** 100원당 P(기본 160) */
    wonToPoint?: number;
    /** 단계 — 기본 미션 1 · 5 · 10개 → 최대 100 · 500 · 1000원 */
    tiers?: {
        missions: number;
        max: number;
        prizes?: {
            won: number;
            weight: number;
        }[];
    }[];
    winners?: LotteryWinner[];
    /** 추첨을 같게 하려는 시험용 씨앗(없으면 Math.random) */
    seed?: number;
    /** 응답을 이만큼 늦춘다(ms, 기본 0) — 로딩 모양 확인용 */
    latencyMs?: number;
    /** true 면 서버가 꺼진 것처럼 404 off */
    off?: boolean;
};
export type MockLotteryApi = {
    fetchJson: Requester;
    /** 오늘 참여한 미션 수를 바꾼다(기준을 채우면 다음 state 읽기 때 복권이 생긴다) */
    setParticipated: (n: number) => void;
    /** 광고 시청 확인 한 건을 준다(황금 복권을 열 때 소비된다) */
    grantAd: () => void;
    /** 처음 상태로 */
    reset: () => void;
    /** 받은 요청 기록(경로 · 본문) — 시험에서 무엇을 불렀나 확인 */
    calls: {
        path: string;
        body?: unknown;
    }[];
};
export declare function createMockLotteryApi(opts?: MockLotteryOptions): MockLotteryApi;
