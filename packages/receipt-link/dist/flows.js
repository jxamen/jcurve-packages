"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NAVER_ISSUE_SITE_CAP_MS = exports.NAVER_ISSUE_GOTO_DELAY_MS = exports.FLOW_HOSTS = exports.FLOW_FACTORIES = void 0;
/**
 * 사이트별 영수증 읽기 흐름 등록표 — 호스트(OrderImportView)가 사이트 키로 흐름을 만들고, 흐름이 열어도 되는 도메인만 정해 둔다.
 * 흐름이 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따른다. 사이트별 에이전트는 자기 파일만 고친다.
 */
const coupangApiFlow_1 = require("./coupangApiFlow");
const kurlyApiFlow_1 = require("./kurlyApiFlow");
const musinsaApiFlow_1 = require("./musinsaApiFlow");
const naverApiFlow_1 = require("./naverApiFlow");
exports.FLOW_FACTORIES = {
    naver: (o) => (0, naverApiFlow_1.createNaverApiFlow)({ ...o }), // 대표님 11-02 23:13 「예전엔 172건」 — 네이버는 최근 저장일 이후만 읽기를 끈다(지운 뒤 옛 주문이 다시 안 들어옴). 중복은 주문번호 · 뒤4자리로 거른다
    coupang: (o) => (0, coupangApiFlow_1.createCoupangApiFlow)({ ...o }), // 대표님 11-02 23:36 「기존에 못 가져온 것도 다 가져오게」 — 최근 저장일 이후만 읽기를 끈다(옛 목록 행이 cut 으로 다시 시도되지 않음). 받은 주문은 known 으로 건너뛴다
    kurly: (o) => (0, kurlyApiFlow_1.createKurlyApiFlow)({ ...o }), // 대표님 11-02 23:36 「컬리 아직도 제대로 못 가져옴」 — 최근 저장일 이후만 읽기를 끈다(옛 못 가져옴 줄을 다시 시도)
    musinsa: (o) => (0, musinsaApiFlow_1.createMusinsaApiFlow)({ sinceLatest: true, ...o }),
};
/** 흐름이 웹뷰로 열어도 되는 도메인(하위 포함) — 이 밖의 주소는 호스트가 열지 않는다 */
exports.FLOW_HOSTS = {
    naver: ['naver.com'],
    coupang: ['coupang.com'],
    kurly: ['kurly.com', 'kurlypay.co.kr'],
    musinsa: ['musinsa.com', 'musinsapayments.com'],
};
/**
 * 네이버 요청 흐름(naverApiFlow)에서 이동(goto)은 실행당 두 번(주문 목록 출처 · 결제 출처)뿐이라 주문 사이에는 이동이 없다 — 이 값은 그 두 이동 사이의 최소 쉬는 시간(밀리초)이다.
 * 호스트(OrderImportView)가 구동기의 minGotoDelayMs 로 넘기고, 구동기는 첫 이동은 쉬지 않는다.
 */
exports.NAVER_ISSUE_GOTO_DELAY_MS = 1000;
/**
 * 네이버 요청 흐름의 사이트 최대 읽기 시간(밀리초). 1년치(수백 건)를 8건씩 묶어 요청해도 느린 회선 · 막힘 뒤 느린 길에서는 기본 4분(SITE_CAP_MS)을 넘을 수 있어 넉넉히 잡는다.
 * 읽은 만큼은 바로 서버에 올라가고 「가져오기」는 이미 가져온 주문을 건너뛰므로 잘려도 이어서 가져온다. 사용자는 「중단」으로 언제든 멈출 수 있다.
 */
exports.NAVER_ISSUE_SITE_CAP_MS = 1500000;
