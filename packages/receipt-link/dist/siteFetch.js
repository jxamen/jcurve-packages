"use strict";
/**
 * 사이트 요청 동작(fetch) — 쿠팡 · 컬리 · 무신사 요청 흐름이 함께 쓰는 범용 요청 묶음(네이버는 영수증 전용 naverReceiptsScript 를 쓴다).
 * 숨은 웹뷰의 **현재 페이지 안에서** fetch 만 부른다(클릭 · 화면 이동 없음, credentials include). 응답은 앱(JS) 안으로만 돌아온다 — 서버 · 로그로 보내지 않는다.
 * 모양이 다른 응답은 흐름(TypeScript)이 이름으로 찾는다 — 그래서 응답 JSON 을 가볍게 줄여(긴 글자 · 긴 배열 · 깊이 제한) 통째로 돌려준다.
 * react-native 를 import 하지 않는다(노드의 vm 으로 이 스크립트 자체를 시험한다).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkFetchRun = exports.ABORT_FETCH_SCRIPT = exports.FETCH_PRUNE = exports.FETCH_SLOW = exports.FETCH_DEADLINE_MS = exports.FETCH_TIMEOUT_MS = exports.FETCH_STAGGER_MS = exports.FETCH_CONC = exports.FETCH_BATCH = void 0;
/** 한 번에 보내는 최대 요청 수 · 기본 동시 수 · 첫 요청 간격 · 요청 시간 제한 · 전체 마감(구동기 감시 20초보다 짧게). 막혔을 때는 FETCH_SLOW 로 늦춘다 */
exports.FETCH_BATCH = 6;
exports.FETCH_CONC = 3;
exports.FETCH_STAGGER_MS = 200;
exports.FETCH_TIMEOUT_MS = 9000;
exports.FETCH_DEADLINE_MS = 16000;
exports.FETCH_SLOW = { batch: 2, conc: 1, gapMs: 1200 };
/** 응답 줄이기 한도 — 글자 300자 · 배열 400칸 · 깊이 24(Next.js dehydratedState 처럼 깊이 든 주문 안쪽 객체까지) · 결과 하나 300KB(넘으면 배열을 더 줄이고, 그래도 넘으면 shape) */
exports.FETCH_PRUNE = { str: 300, arr: 400, depth: 24, bytes: 300000 };
/** 진행 중인 요청을 모두 끊는다(구동기 stop 이 넣는다) */
exports.ABORT_FETCH_SCRIPT = 'try{window.__ytAbortFetch&&window.__ytAbortFetch();}catch(e){};true;';
const checkFetchRun = (r) => {
    if (!Array.isArray(r.reqs) || r.reqs.length < 1 || r.reqs.length > 12)
        throw new Error('bad reqs');
    for (const q of r.reqs) {
        if (typeof q.key !== 'string' || q.key.length < 1 || q.key.length > 80)
            throw new Error('bad key');
        if (q.method !== 'GET' && q.method !== 'POST')
            throw new Error('bad method');
        if (typeof q.url !== 'string' || q.url.length < 1 || q.url.length > 2000 || !/^(https:\/\/[^\s/?#:@]+(:\d+)?)?\/[^\s]*$|^https:\/\/[^\s/?#:@]+(:\d+)?$/.test(q.url))
            throw new Error('bad url');
        if (q.body !== undefined && (typeof q.body !== 'string' || q.body.length > 8000 || q.method !== 'POST'))
            throw new Error('bad body');
        if (q.as !== 'json' && q.as !== 'nextData' && q.as !== 'text')
            throw new Error('bad as');
    }
    if (![r.conc, r.staggerMs, r.gapMs, r.timeoutMs, r.deadlineMs].every((v) => Number.isInteger(v) && v >= 0 && v <= 60000) || r.conc < 1 || r.conc > 6)
        throw new Error('bad run');
};
exports.checkFetchRun = checkFetchRun;
