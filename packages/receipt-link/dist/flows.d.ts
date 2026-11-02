import type { FlowEvent, FlowOut } from './naverReceipt';
import type { OutcomeEvent } from './runOutcome';
export type FlowSite = 'naver' | 'coupang' | 'kurly' | 'musinsa';
export type ReceiptFlow = {
    next(ev: FlowEvent): FlowOut;
    progress(): {
        phase: string;
        done: number;
        total: number;
        orders: number;
    };
    takeOutcomes?(): OutcomeEvent[];
};
export type FlowFactoryOptions = {
    maxOrders?: number;
    now?: () => number;
    maxSteps?: number;
    budgetMs?: number;
    allowNoSeconds?: boolean;
    /** 대표님 계정(probe 모드)의 호스트가 true 로 넘긴다 — 사이트 흐름이 구조 기록용 걸음을 앞에 넣을 수 있다(네이버 요청 흐름은 쓰지 않는다). 일반 회원에게는 늘 없음 */
    probe?: boolean;
    /** 네이버: 이 줄들(runOutcome.outcomeKey)만 영수증을 가져온다 — 줄별 「가져오기」 */
    onlyKeys?: string[];
    /** 네이버: 「영수증 내용 채우기」 — 세부가 빈 카드 줄(뒤 4자리|날짜)의 주문만 다시 받는다(ordersModel.refillTails) */
    refill?: string[];
    /** 새 네이버페이 수집 길(서버 LinkState.npv2 — 목록 회원만) */
    npv2?: boolean;
    /** 읽을 기간(일) — 서버 LinkState.readDays[사이트]. 없으면 365 */
    windowDays?: number;
};
export declare const FLOW_FACTORIES: Record<FlowSite, (opts?: FlowFactoryOptions) => ReceiptFlow>;
/** 흐름이 웹뷰로 열어도 되는 도메인(하위 포함) — 이 밖의 주소는 호스트가 열지 않는다 */
export declare const FLOW_HOSTS: Record<FlowSite, readonly string[]>;
/**
 * 네이버 요청 흐름(naverApiFlow)에서 이동(goto)은 실행당 두 번(주문 목록 출처 · 결제 출처)뿐이라 주문 사이에는 이동이 없다 — 이 값은 그 두 이동 사이의 최소 쉬는 시간(밀리초)이다.
 * 호스트(OrderImportView)가 구동기의 minGotoDelayMs 로 넘기고, 구동기는 첫 이동은 쉬지 않는다.
 */
export declare const NAVER_ISSUE_GOTO_DELAY_MS = 1000;
/**
 * 네이버 요청 흐름의 사이트 최대 읽기 시간(밀리초). 1년치(수백 건)를 8건씩 묶어 요청해도 느린 회선 · 막힘 뒤 느린 길에서는 기본 4분(SITE_CAP_MS)을 넘을 수 있어 넉넉히 잡는다.
 * 읽은 만큼은 바로 서버에 올라가고 「가져오기」는 이미 가져온 주문을 건너뛰므로 잘려도 이어서 가져온다. 사용자는 「중단」으로 언제든 멈출 수 있다.
 */
export declare const NAVER_ISSUE_SITE_CAP_MS = 1500000;
