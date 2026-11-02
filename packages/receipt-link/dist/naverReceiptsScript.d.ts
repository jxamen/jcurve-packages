/** 주문 한 건의 요청 — key 는 runOutcome.outcomeKey. payId · tid · paymentId 는 목록 항목에서 이미 얻은 값(없으면 영수증 응답에서 얻는다) */
export type ReceiptJob = {
    key: string;
    orderNo: string;
    productOrderNo?: string;
    payId?: string;
    tid?: string;
    paymentId?: string;
    /** 간편결제(SIMPLE_PAYMENT) · 외부몰 네이버페이 — orders.pay.naver.com 출처에서 GET orderApi/payment/detail/info 로 tid 를 얻는 작업(11-02 대표님 확인 길, 전부 HTTP) */
    pinfo?: boolean;
    /** 카드영수증이 없는 결제(네이버페이 머니 · 포인트 · 계좌) — orders.pay.naver.com 출처에서 GET orderApi/orderSheet/detail/?orderNo= (7071 웹 「상세 — 주문서」 요청 그대로)로
        주문상세를 영수증으로 읽는다(11-02 22:40 대표님 「네이버페이 영수증은 별도로 없고 주문상세에 있고」) */
    osheet?: boolean;
};
/** 네이버페이 내역(pay.naver.com/history __NEXT_DATA__) 한 줄 — pageProps.dehydratedState.queries[].state.data.pages[].items[] 의 이름 그대로(10-29 15:36 실기록 키 트리) */
export type PayRow = {
    orderNo?: string;
    payId?: string;
    productOrderNo?: string;
    at?: number;
    amount?: number;
    /** 주문번호가 없는 결제 — 그 줄 buttons[] 의 영수증 주소(/receipts/preview/card?) 쿼리 이름 그대로(B형 payId · tid · productOrderNo / A형 paymentId · tid) */
    tid?: string;
    paymentId?: string;
    /** 간편결제 줄(serviceType SIMPLE_PAYMENT) — orderDetailUrl 의 경로 · 쿼리 그대로(/instantPay/detail/<결제번호>?…, 10-29 16:36 실기록) */
    instant?: string;
    /** 내역 줄 status 가 취소 · 반품(name CANCEL/RETURN 또는 글자 취소/반품) */
    cancelled?: boolean;
};
/** card-single 응답에서 뽑는 영수증 칸(허용 필드만). 시각은 사이트가 준 그대로(문자열 · 숫자) — 해석은 흐름이 한다 */
export type ReceiptSlip = {
    approvalNo?: string;
    cardCompany?: string;
    approvalAt?: string | number;
    cancelAt?: string | number;
    productName?: string;
    sellerName?: string;
    businessNo?: string;
    amount?: number;
    cancelAmount?: number;
    /** 대표님 10-29 14:15 원문 칸(card-single 응답) — 세부 화면에 모두 보인다(14:26 「빈게 너무 많아」). 카드번호는 사이트가 가린 값 그대로 */
    cardNo?: string;
    tradeType?: string;
    ownerType?: string;
    installmentType?: string;
    productOrderNo?: string;
    sellerRepresentative?: string;
    sellerTel?: string;
    sellerAddress?: string;
    merchantName?: string;
    merchantBusinessNo?: string;
    supplyAmount?: number;
    taxAmount?: number;
    totalAmount?: number;
    /** 대표님 폰 실기록(10-29 14:31 rcpt-cardok) 응답에만 있던 칸 — 원문 칸 전부라 같이 */
    expiredYear?: string;
    expiredMonth?: string;
    merchantRepresentative?: string;
    merchantNo?: string;
    merchantAddress?: string;
    serviceCharge?: number;
    disposableCupAmount?: number;
    /** 주문상세(orderSheet · payment/detail/info)에서 읽은 비카드 결제 — 흐름이 구매영수증(kind purchase)으로 올린다. tradeType 에 결제수단 글자 */
    orderSheet?: boolean;
};
/**
 * st: ok 영수증을 읽음(slip) · none 카드 영수증이 없는 결제 · login 로그인이 풀림 · blocked 사이트가 막음(403 · 429) ·
 *     net 요청 실패 · 시간 초과 · nopair 부를 주소의 값을 못 찾음 · shape 응답 모양이 달라 읽지 못함
 */
export type ReceiptStatus = 'ok' | 'none' | 'login' | 'blocked' | 'net' | 'nopair' | 'shape' | 'pair';
/**
 * 실패한 줄의 진단 — 값이 아니라 모양만(대표님 10-29 12:00 「쇼핑 9건 전부 못 가져옴」, 줄별 까닭이 서버에 안 올라와 원인을 못 찍음).
 *  w 단계(order 주문번호로 짝 찾기 · card 카드 영수증 · pair 짝 만들기) · status HTTP 번호(0 은 응답 없음) · lines 구조 줄(경로 : 형태 · fmt 경로 : 자릿수 모양)
 */
export type ReceiptDiag = {
    w: string;
    status: number;
    lines: string[];
};
export type ReceiptResult = {
    key: string;
    st: ReceiptStatus;
    slip?: ReceiptSlip;
    status?: number;
    diag?: ReceiptDiag;
    found?: number;
    /** 「카드영수증」 링크가 없을 때의 payId(작업에 있던 것 또는 issue-history __NEXT_DATA__ 의 이름 payId) — ② 길에서 쓴다 */
    payId?: string;
    /** ② orderSheet/detail 결과(st 'pair') — 간편결제 화면이면 pos 없이 paymentId */
    tid?: string;
    pos?: string[];
    paymentId?: string;
    /** 간편결제에서 tid 를 얻은 길 — read(화면 · 상태 읽기) · tap(영수증 버튼 눌러 주소 받기) */
    via?: 'read' | 'tap';
    /** np:scan — 네이버페이 내역 줄(주문번호 · payId · 상품 주문번호 · 시각 · 금액) */
    rows?: PayRow[];
    /** np:scan(v2) — 이 내역 화면의 pages[].curPage · pages[].totalPage */
    page?: number;
    pages?: number;
    /** np:scan(v2) — 스크립트가 _next/data 로 모든 쪽을 직접 받아 한 번에 끝냈다(흐름이 쪽을 더 넘기지 않게 한다, 무한 재시도 금지) */
    full?: boolean;
};
/**
 * scan 이면 영수증 요청 뒤에 이 페이지(pay.naver.com/history)의 __NEXT_DATA__ 를 읽어 결제 짝(paymentId · tid)을 값의 모양으로 찾아 같은 방식으로 영수증을 받는다(대표님 10-28 23:18 「네이버페이는 이 페이지에서 __NEXT_DATA__ 이 부분 읽어야 함」).
 * 결과 key 는 np:<결제 번호>, 짝 개수와 위치 모양은 key np:scan 의 found · diag 로 알린다. skip 은 이미 가져온 결제 번호(건너뜀).
 */
export type ReceiptsRun = {
    jobs: ReceiptJob[];
    conc: number;
    staggerMs: number;
    gapMs: number;
    timeoutMs: number;
    deadlineMs: number;
    scan?: boolean;
    skip?: string[];
    /** 새 네이버페이 수집 길(서버 npv2 — 목록 회원만): 내역 줄의 주문번호 · 금액 대체 칸 · buttons[] 영수증 주소 · 못 찾은 줄 진단 · 페이지 수 */
    v2?: boolean;
};
/** 한 번에 보내는 최대 작업 수 · 동시에 부르는 수 · 첫 요청 간격 · 요청 시간 제한 · 전체 마감(구동기 감시 20초보다 짧게). 막혔을 때는 RECEIPTS_SLOW 로 늦춘다 */
export declare const RECEIPTS_BATCH = 8;
export declare const RECEIPTS_CONC = 4;
export declare const RECEIPTS_STAGGER_MS = 150;
export declare const RECEIPTS_TIMEOUT_MS = 9000;
export declare const RECEIPTS_DEADLINE_MS = 16000;
/** 사이트가 막았을 때(403 · 429) 늦춘 설정 — 한 번에 2건, 하나씩, 요청 사이 1.2초 */
export declare const RECEIPTS_SLOW: {
    readonly batch: 2;
    readonly conc: 1;
    readonly gapMs: 1200;
};
/** 진행 중인 요청을 모두 끊는다(구동기 stop 이 넣는다) */
export declare const ABORT_RECEIPTS_SCRIPT = "try{window.__ytAbortReceipts&&window.__ytAbortReceipts();}catch(e){};true;";
/** 작업 검사 — 열 개 이하의 모양이 맞는 값만(주소에 들어가는 값이라 숫자 · PD · NP 모양만 받는다) */
export declare function checkReceiptsRun(r: ReceiptsRun): void;
export declare function receiptsScript(r: ReceiptsRun): string;
