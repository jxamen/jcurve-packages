/**
 * 영수증 읽기 흐름 구동기 — 사이트별 흐름(flows.ts)이 내는 동작(FlowOut)을 웹뷰 위에서 실행하고, 웹뷰가 돌려준 메시지를 흐름 이벤트(FlowEvent)로 바꿔 먹인다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). 웹뷰 · 시계는 host 로 받는다.
 * 지키는 것: 글자 · 주문 내용은 로그나 서버로 보내지 않는다(probe 는 구조 요약 PageShape 만). 쿠키 · 저장소는 읽지 않는다. 영수증 주소(토큰)는 이동에만 쓰고 서버로 보내지 않는다.
 *
 * 구동 규칙
 *  - 흐름이 동작을 내면 그 동작에 맞는 답 하나만 받는다(awaiting). 같은 읽기 답이 두 번 와도 한 번만 먹인다.
 *  - 페이지가 열리면(onPageChanged) 잠깐(READ_SETTLE_MS) 기다렸다가 읽기를 넣는다 — load 끝 · SPA 이동이 겹쳐 와도 한 번으로 합친다.
 *  - 동작을 낸 뒤 20초 동안 답이 없으면 {type:'timeout'} 을 먹인다. 연속 6번이면 사용자 확인(attention)을 한 번 부탁하고, 그 뒤에도 6번 더 연속이면 구조를 보내고 끝낸다.
 *    한 사이트 전체 4분이 상한이다.
 *  - 로그인(흐름이 login 을 낸 동안) · 사용자 확인 구간의 시간은 흐름의 시계 · 4분 상한에서 뺀다(그 구간 상한은 따로 10분). 이 구간에는 호스트가 웹뷰를 보여 준다.
 *  - goto 는 https 이고 FLOW_HOSTS[site] 안의 호스트일 때만 연다. 아니면 열지 않고 구조를 보내고 끝낸다.
 *  - 흐름에 take() 가 있으면 한 단계마다 불러 새 주문을 onOrders 로 바로 넘긴다. 없으면 done 의 주문을 한 번에 넘긴다. 같은 주문은 한 번만 넘긴다.
 */
import { type FlowFactoryOptions, type FlowSite, type ReceiptFlow } from './flows';
import { type FlowStats, type PageShape, type ReceiptOrder } from './naverReceipt';
import type { OutcomeEvent } from './runOutcome';
export declare const WATCHDOG_MS = 20000;
export declare const MAX_TIMEOUTS = 6;
/** 네이버페이 내역 줄을 한 번에 받아들이는 안전 상한 — 60쪽(MAX_SCAN_PAGES) × 쪽당 수십 줄보다 크게 */
export declare const MAX_PAY_ROWS = 5000;
export declare const SITE_CAP_MS = 240000;
export declare const LOGIN_CAP_MS = 600000;
export declare const READ_SETTLE_MS = 600;
export declare const BACK_READ_MS = 2500;
export declare const LOGIN_POLL_MS = 10000;
export declare const CLOSING_WAIT_MS = 15000;
/** goto 앞에서 기다릴 수 있는 시간의 상한 — 흐름이 더 크게 실어도 이만큼만 기다린다 */
export declare const MAX_GOTO_DELAY_MS = 5000;
export type FlowHost = {
    goto(url: string): void;
    back(): void;
    inject(script: string): void;
    /** 구조 요약(PageShape)을 보낸다. where 는 흐름이 붙인 짧은 이름(영문 · 숫자 · - _). 보내는 곳이 없으면 아무것도 안 해도 된다 */
    probe(shape: PageShape, where: string): void;
    /** 응답 JSON 의 키 구조 줄(structureLines)을 구조 기록으로 보낸다. 보내는 곳이 없으면 안 해도 된다 */
    structure?(where: string, host: string, path: string, lines: string[]): void;
    now(): number;
};
/**
 * login: 로그인 화면을 사용자에게 보여 줄 때 · attention: 캡차 · 본인확인처럼 사용자가 화면에서 직접 끝내야 할 때(둘 다 호스트가 웹뷰를 보여 준다)
 * closing: 주문이 없어 마지막 페이지 구조를 읽어 보내는 중
 */
export type DriverState = 'idle' | 'running' | 'login' | 'attention' | 'closing' | 'done';
export type DriverStatus = {
    state: DriverState;
    phase: string;
    done: number;
    total: number;
    orders: number;
    timeouts: number;
};
/** orders 는 onOrders 로 넘긴 모든 주문(중복 없이)이다 */
export type DriverResult = {
    orders: ReceiptOrder[];
    reason: string;
    stats: FlowStats;
    probes: number;
    timeouts: number;
};
export type FlowDriverArgs = {
    site: FlowSite;
    factory: (opts?: FlowFactoryOptions) => ReceiptFlow;
    host: FlowHost;
    onDone: (r: DriverResult) => void;
    /** 새 주문이 생길 때마다 — 같은 주문은 한 번만 온다 */
    onOrders?: (orders: ReceiptOrder[]) => void;
    onUpdate?: (s: DriverStatus) => void;
    /** 주문 한 건의 결과(가져오는 중 · 가져옴 · 영수증 없음 · 못 가져옴+까닭)가 날 때마다 — 줄 상태를 그리는 데 쓴다. 결과를 내지 않는 흐름은 부르지 않는다 */
    onOutcome?: (e: OutcomeEvent) => void;
    options?: FlowFactoryOptions;
    /** start 이벤트에 실을 시작 경로 — 안 주면 흐름의 기본 경로(네이버는 issue) */
    route?: 'issue' | 'history' | 'pay' | 'shop';
    /** start 이벤트에 실을 「서버에 이미 있는 주문」 — 흐름이 이 주문은 다시 열지 않고 건너뛴다(없으면 전부 처리) */
    known?: {
        orderNos?: string[];
        listKeys?: string[];
        tails?: string[];
    };
    /** 첫 이동을 뺀 모든 goto 앞에서 최소로 쉬는 시간(밀리초). 흐름이 delayMs 를 실었으면 둘 중 큰 쪽. 기본 0(구동기가 멋대로 쉬지 않는다) */
    minGotoDelayMs?: number;
    /** 사이트 하나를 읽는 최대 시간(밀리초). 없으면 SITE_CAP_MS(4분). 네이버 영수증(issue)은 주문마다 쉬면서 1년치를 읽으므로 호스트가 더 길게 넘긴다 */
    siteCapMs?: number;
};
export type FlowDriver = {
    start(): void;
    /** 웹뷰 load 끝 · 주소 바뀜(SPA 포함) — 전체 주소를 넘긴다 */
    onPageChanged(url: string): void;
    /** 페이지 안 스크립트가 보낸 {type:'nav', step, ...} 메시지(JSON.parse 한 값) */
    onMessage(msg: unknown): void;
    /** 0.5초쯤마다 부른다 — 읽기 예약 · 20초 감시 · 상한을 본다 */
    tick(): void;
    /** 로그인 · 사용자 확인을 사용자가 끝냈다고 알린다(주소가 안 바뀌는 확인 화면용) — 바로 다시 읽는다 */
    resume(): void;
    status(): DriverStatus;
    /** 끝내지 않고 조용히 멈춘다(onDone 을 부르지 않는다) */
    stop(): void;
};
/** 호스트 이름(소문자). https 가 아니거나 모양이 틀리면 빈 문자열 — 사용자 정보(@) 가 든 주소는 거절한다 */
export declare const httpsHostOf: (url: string) => string;
/** 흐름이 열어도 되는 주소 — https, 허용 도메인(하위 포함), 경로에 로그아웃 · 탈퇴 · 삭제 글자가 없음(쿼리는 보지 않는다: 쿠팡은 cancel=false 가 든다) */
export declare function isFlowUrl(url: string, hosts: readonly string[]): boolean;
/** 전체 주소 → 「호스트+경로」(긴 숫자는 #) — 흐름의 page 이벤트 주소와 같은 모양이다. 쿼리 · 해시는 버린다 */
export declare function pageKey(url: string): string;
/** 구조 요약 → 서버 구조 기록(buildPayload)이 받는 raw. 글자 · 번호는 없고 개수 · 있음/없음만 담는다 */
export declare function shapeProbeRaw(shape: PageShape, where: string): {
    host: string;
    path: string;
    queryKeys: string[];
    cookieNames: string[];
    outline: string[];
    repeat: Record<string, number>;
    requests: [];
};
export declare function createFlowDriver(args: FlowDriverArgs): FlowDriver;
