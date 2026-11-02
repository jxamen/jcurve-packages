/**
 * 주문 불러오기 화면의 진행 줄 글자 — react-native 를 import 하지 않는 순수 함수(노드에서 시험한다). 주문 내용은 글자에 넣지 않고 개수만 쓴다. 머리 숫자는 하나의 기준 — 「영수증 가져온 건/목록 전체 건」(영수증 단계 대상 수는 쓰지 않는다).
 */
import type { RunView } from './ordersModel';
import type { Outcome } from './runOutcome';
export type ImportMode = 
/** 흐름이 읽는 중(웹뷰는 뒤에서 돈다) */
'reading'
/** 끝낸 뒤 남은 주문을 서버에 올리는 중 */
 | 'sending'
/** 끝남 — 한 건 이상 불러왔다 */
 | 'ended'
/** 끝남 — 한 건도 못 읽었다(다시 시도 · 사진/종이로 올리기를 낸다) */
 | 'stalled'
/** 사용자가 읽기를 멈췄다 */
 | 'stopped'
/** 올리지 못한 주문이 남았다 */
 | 'sendFailed';
export type LineInput = {
    label: string;
    mode: ImportMode;
    state: 'idle' | 'running' | 'login' | 'attention' | 'closing' | 'done';
    /** 흐름의 영수증 단계 대상 수 — 글자에는 쓰지 않고, 0 이면 아직 목록을 읽는 단계 · 0 보다 크면 영수증 단계라는 구분에만 쓴다 */
    total: number;
    timeouts: number;
    pending: number;
    failed: boolean;
    /** 끝났지만 일부는 못 읽고 끝났다(시간 초과 등) */
    partial: boolean;
    /** 서버 목록의 줄 수 — 머리 숫자의 분모는 항상 이 수다. 목록을 아직 못 받았으면 null */
    listTotal: number | null;
    /** 서버 목록에서 영수증을 가져온 줄 수 */
    fetched: number;
    /** 적립 가능(광고 보고 적립 버튼이 있는) 줄 수 */
    claimable: number;
    /** 못 가져온 줄 수(영수증 없는 결제 · 중단해서 남은 줄은 넣지 않는다) */
    missed: number;
    /** 영수증이 없는 결제(포인트 · 계좌이체 등) 줄 수 — 실패가 아니라 따로 센다. 없으면 0 */
    none?: number;
    /** 이번 실행에서 새로 받은 영수증 수(흐름 progress.orders) — 「새 영수증 받는 중 n」과 「이미 받은 n」을 가르는 데 쓴다. 없으면 가르지 않는다 */
    newFetched?: number;
};
/** 끝난 모드인데 서버 목록이 아직 끝난 뒤 것으로 새로 오지 않았으면 「보내는 중」으로 둔다 — 낡은 목록으로 「다 가져왔어요」 · 「못 가져옴」을 먼저 보이지 않게 */
export declare function settledMode(mode: ImportMode, listFresh: boolean): ImportMode;
/** 줄 상태 판단에 넘기는 읽기 진행 — 영수증 단계(total > 0) · 끝남(끝난 모드, 까닭은 reason) · 그 전은 목록 읽는 단계. outcomes 는 흐름이 알린 줄 결과(없으면 안 싣는다) */
export declare function runView(mode: ImportMode, total: number, reason: string, outcomes?: Record<string, Outcome>, single?: {
    only: string[];
    base: string;
} | null): RunView;
export declare function statusLine(a: LineInput): string;
