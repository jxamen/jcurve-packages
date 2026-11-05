"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DUPLICATE_MESSAGE = exports.ORDER_URL = exports.LOGIN_URL = void 0;
exports.linkStatus = linkStatus;
exports.consentLines = consentLines;
exports.endOfNothingRead = endOfNothingRead;
exports.endNoteLine = endNoteLine;
exports.createReceiptLinkApi = createReceiptLinkApi;
exports.receiptErrorMessage = receiptErrorMessage;
exports.claimErrorMessage = claimErrorMessage;
exports.claimErrorCode = claimErrorCode;
exports.linkSourceLabel = linkSourceLabel;
exports.linkRecordEntries = linkRecordEntries;
/**
 * 앱이 그대로 부르는 부분 — 사이트 주소 · 연결 상태 글자 · 동의 문구 · 「새 주문 0건」 까닭 · 서버 호출 · 오류 문구.
 * 영테크 앱 src/receiptLink/{card,client,ordersClient,importEnd}.ts 에 있던 것을 옮겼다(대표님 11-03 「앱은 부르기만」).
 * react-native 를 import 하지 않는다. 서버 호출은 앱의 http(get · post · slow)를 받아 쓴다. 주문 내용은 글자에 넣지 않는다.
 */
const model_1 = require("./model");
const version_1 = require("./version");
const ordersModel_1 = require("./ordersModel");
/** 사이트의 공식 로그인 페이지 — 회원이 여기서 직접 로그인한다 */
exports.LOGIN_URL = {
    naver: 'https://nid.naver.com/nidlogin.login',
    coupang: 'https://login.coupang.com/login/login.pang',
    musinsa: 'https://www.musinsa.com/auth/login',
    kurly: 'https://www.kurly.com/member/login',
};
/** 로그인 창을 여는 곳 — 주문내역 페이지. 로그인이 안 돼 있으면 사이트가 로그인 뒤 여기로 돌려보낸다 */
exports.ORDER_URL = {
    naver: 'https://pay.naver.com/pc/history',
    coupang: 'https://mc.coupang.com/ssr/mobile/order/list',
    musinsa: 'https://www.musinsa.com/order/order-list',
    kurly: 'https://www.kurly.com/mypage/order',
};
/** 한 줄 상태 — 「연결 안 됨」 또는 「연결됨 · 동의한 날」 */
function linkStatus(s, p) {
    if (!(0, model_1.isConnected)(s, p))
        return '연결 안 됨';
    return '연결됨 · ' + (s.links[p]?.linkedAt ?? '').slice(0, 10).replace(/-/g, '.');
}
/** 동의 화면 문구 — appName 은 앱 이름(예: 영테크 · 사임캐시). 가져오는 칸 · 로그인 정보 · 철회를 그대로 적는다 */
function consentLines(p, appName) {
    const name = model_1.LINK_LABEL[p];
    return [
        `${appName}가 회원님의 ${name} 주문내역(주문번호 · 주문일시 · 판매처 · 상품명 · 결제금액 · 결제수단)을 읽어 영수증 보상으로 드리려면 동의가 필요해요.`,
        `로그인은 ${name} 로그인 화면에서 직접 해요. ${appName}는 아이디와 비밀번호를 보지도, 저장하지도 않아요.`,
        `로그인 정보는 회원님 휴대폰 안에만 있고, ${appName} 서버로 보내지 않아요.`,
        '서버에는 주문내역과 「연결한 시각」만 저장해요. 수취인 · 주소 · 전화번호 · 카드번호는 읽지 않아요.',
        '언제든 「연결 끊기」로 그만둘 수 있어요.',
        `${name} 이용약관에 따라 자동으로 정보를 읽는 것은 제한될 수 있어요. 계정 이용에 불이익이 생길 수 있어요. 동의는 선택이에요.`,
    ];
}
const NO_NEWS = ['all-rows', 'max-orders', 'first-page-only'];
const SLOW = ['timeout', 'timeouts', 'site-cap', 'budget', 'max-steps', 'too-many-steps'];
const BLOCKED = ['blocked', 'cross-origin'];
/** 한 건도 새로 못 읽고 끝났다 — 화면 상태(ended 정상 · stalled 못 읽음)와 까닭. 정상 종료여도 failed 줄이 있으면 「가져올 게 없다」가 아니다 */
function endOfNothingRead(reason, outcomes = []) {
    const failed = outcomes.filter((o) => o.state === 'failed');
    if (/^login/.test(reason) || failed.some((o) => o.code === 'login'))
        return { mode: 'stalled', note: 'login' };
    if (reason === 'attention-timeout')
        return { mode: 'stalled', note: 'attention' };
    if (failed.length > 0)
        return { mode: 'stalled', note: failed.some((o) => o.code === 'blocked') ? 'blocked' : 'unreadable' };
    if (NO_NEWS.includes(reason))
        return { mode: 'ended', note: 'none-new' };
    if (SLOW.includes(reason))
        return { mode: 'stalled', note: 'slow' };
    if (BLOCKED.includes(reason))
        return { mode: 'stalled', note: 'blocked' };
    return { mode: 'stalled', note: 'unreadable' };
}
/** 이 상태의 진행 줄 글자. 서버 목록 숫자(counts)는 아직 못 받았으면 null */
function endNoteLine(note, label, counts) {
    switch (note) {
        case 'none-new':
            if (counts && counts.total > 0)
                return `새로 가져올 영수증이 없어요 · 이미 받은 영수증은 그대로예요\n적립 가능 ${Math.max(0, Math.floor(counts.claimable))}건`;
            return `${label}에서 불러올 주문을 찾지 못했어요\n읽는 기간 안에 주문이 없으면 정상이에요 · 주문이 있는데 이렇게 뜨면 ${label} 로그인을 확인해 주세요`;
        case 'login':
            return `${label} 로그인이 풀렸어요\n「다시 시도」를 누르면 로그인 화면이 열려요`;
        case 'attention':
            return `${label} 확인 화면을 끝내지 못했어요\n「다시 시도」를 눌러 확인을 마쳐 주세요`;
        case 'slow':
            return `${label} 응답이 늦어 끝까지 읽지 못했어요\n잠시 뒤 다시 시도해 주세요`;
        case 'blocked':
            return `${label}에서 잠시 접속을 막았어요\n잠시 뒤 다시 시도하거나 종이·사진으로 올려 주세요`;
        case 'unreadable':
        default:
            return `${label} 주문 화면을 읽지 못했어요 (화면이 바뀌었을 수 있어요)\n다시 시도하거나 종이·사진으로 올려 주세요`;
    }
}
const httpErr = (e) => e !== null && typeof e === 'object' && typeof e.status === 'number' ? e : null;
/** 서버 끝점 묶음 — receipt-link(상태 · 동의 · probe · 철회) · receipt-orders(보내기 · 목록 · 영수증 · 적립) */
function createReceiptLinkApi(http) {
    const slow = (path, body) => (http.slow ? http.slow(path, body) : http.post(path, body));
    const enc = (id) => encodeURIComponent(String(id));
    return {
        /** 서버 스위치가 꺼져 있으면 404 → null(앱은 연동 영역을 그리지 않는다) */
        async fetchLinkState() {
            try {
                return (0, model_1.parseLinkState)(await http.get('receipt-link'));
            }
            catch (e) {
                if (httpErr(e)?.status === 404)
                    return null;
                throw e;
            }
        },
        async consentLink(platform) {
            return (0, model_1.parseLinkState)(await http.post('receipt-link', { platform, consent: true }));
        },
        /** 구조 기록 — 모양만 담은 본문. 거절이면 false */
        async postProbe(body) {
            try {
                await http.post('receipt-link/probe', body);
                return true;
            }
            catch {
                return false;
            }
        },
        async revokeLink(platform) {
            return (0, model_1.parseLinkState)(await http.post('receipt-link/revoke', { platform }));
        },
        /** 읽은 주문 등록 — cleanOrder 를 통과한 것만 50건씩. 주머니가 차면(pouch_full) 남은 묶음은 보내지 않고 같은 사유로 센다 */
        async sendOrders(platform, raw) {
            const orders = raw.map(model_1.cleanOrder);
            const clean = orders.filter((o) => o !== null);
            let tally = (0, model_1.emptyTally)();
            const batches = (0, model_1.chunkOrders)(clean);
            for (let i = 0; i < batches.length; i++) {
                const res = await slow('receipt-orders', { platform, orders: batches[i] });
                tally = (0, model_1.addTally)(tally, res.results);
                if (tally.pouch_full > 0) {
                    tally.pouch_full += batches.slice(i + 1).reduce((n, b) => n + b.length, 0);
                    break;
                }
            }
            return { tally, unreadable: orders.length - clean.length };
        },
        /** 불러온 주문 목록 — 최신순 */
        async listOrders() {
            return (0, ordersModel_1.parseOrderList)(await http.get('receipt-orders'));
        },
        /** 영수증 한 건 — 모양이 틀리면 Error('bad_receipt') */
        async getOrderReceipt(id) {
            const r = (0, ordersModel_1.parseOrderReceipt)(await http.get('receipt-orders/' + enc(id)));
            if (!r)
                throw new Error('bad_receipt');
            return r;
        },
        /** 광고를 본 뒤 한 건 적립. 광고 확인 전이면 402 ad_required */
        async claimOrder(id) {
            return (0, ordersModel_1.parseClaimResult)(await http.post('receipt-orders/' + enc(id) + '/claim', {}));
        },
        /** 카드 · 화면이 쓰는 상태 — 서버 스위치가 꺼졌거나(404) 못 받으면 null(연동 영역을 그리지 않는다) */
        async loadLinkState() {
            try {
                return await this.fetchLinkState();
            }
            catch {
                return null;
            }
        },
        /** 불러오기 한 번의 끝 — 까닭별 개수만(모든 회원, 주문 값 없음) + 패키지 판(pkg, 11-05 옛 판 표시용). 서버 receipt-link/run-end(11-03). 기록이라 실패해도 막지 않는다 */
        async postRunEnd(body) {
            try {
                await http.post('receipt-link/run-end', { ...body, pkg: version_1.PKG_VERSION });
            }
            catch { /* 기록 */ }
        },
        /** 영수증을 못 받은 주문마다 진단 한 줄(failLog.failItems) — 100줄씩, 서버 receipt-link/fails(11-04). 실패해도 막지 않는다 */
        async postFails(platform, items) {
            for (let i = 0; i < items.length; i += 100) {
                try {
                    await http.post('receipt-link/fails', { platform, items: items.slice(i, i + 100), pkg: version_1.PKG_VERSION });
                }
                catch { /* 기록 */ }
            }
        },
    };
}
/** 영수증 보기를 못 열었을 때 — 없는 주문(404)과 그 밖 */
function receiptErrorMessage(e) {
    if (httpErr(e)?.status === 404)
        return '영수증을 찾지 못했어요. 목록을 다시 불러와 주세요';
    return '영수증을 불러오지 못했어요. 잠시 뒤 다시 눌러 주세요';
}
const DAILY_CODES = ['receipt_daily_max', 'daily_max', 'daily_limit'];
/** 같은 영수증이 이미 있어 적립할 수 없다(목록 duplicate 줄 · 적립 409 duplicate_receipt 가 같은 말) */
exports.DUPLICATE_MESSAGE = '이미 올린 영수증이에요';
/** 적립 실패를 사용자 말로 — 서버 코드(없으면 HTTP 상태)로 가른다 */
function claimErrorMessage(e) {
    const he = httpErr(e);
    const codes = he ? [he.code ?? '', he.serverMessage ?? ''] : [];
    const status = he ? he.status : 0;
    const has = (c) => codes.includes(c);
    if (has('ad_required'))
        return '광고가 아직 확인되지 않았어요. 잠시 뒤 다시 눌러 주세요';
    if (has('pouch_full'))
        return '바구니가 가득 찼어요. 먼저 포인트를 꺼내 주세요';
    if (has('already_claimed'))
        return '이미 적립한 주문이에요';
    if (has('duplicate_receipt'))
        return exports.DUPLICATE_MESSAGE;
    if (has('receipt_pending'))
        return '영수증을 아직 가져오는 중이에요. 잠시 뒤 다시 눌러 주세요';
    if (codes.some((c) => DAILY_CODES.includes(c)) || status === 429)
        return '오늘 영수증 등록 한도를 모두 사용했어요';
    if (status === 404)
        return '주문을 찾지 못했어요. 목록을 다시 불러와 주세요';
    if (has('timeout'))
        return '응답이 너무 늦어요. 잠시 뒤 다시 눌러 주세요';
    if (has('network'))
        return '연결이 끊겼어요. 잠시 뒤 다시 눌러 주세요';
    return '적립하지 못했어요. 잠시 뒤 다시 눌러 주세요';
}
/** 적립 실패 코드 — 추적용(주문 내용 없음) */
function claimErrorCode(e) {
    const he = httpErr(e);
    if (!he)
        return 'unknown';
    return he.code || 'http_' + he.status;
}
/** 전자 영수증 출처 글자 — 「네이버 · 카드영수증」 「마켓컬리 · 구매영수증」 */
function linkSourceLabel(o) {
    const site = model_1.LINK_LABEL[o.platform] ?? o.platform;
    return `${site} · ${o.kind === 'purchase' ? '구매영수증' : '카드영수증'}`;
}
function linkRecordEntries(orders, month) {
    return orders
        .filter((o) => (o.kind === 'card' || o.kind === 'purchase') && o.orderedAt.startsWith(month + '-'))
        .map((o) => {
        const m = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}:\d{2}))?/.exec(o.orderedAt);
        return m ? { id: 'link-' + o.id, orderId: o.id, date: m[1], time: m[2] ?? null, store: o.seller || o.title || model_1.LINK_LABEL[o.platform] || o.platform, total: o.amount, source: linkSourceLabel(o), claimed: o.claimed } : null;
    })
        .filter((e) => e !== null)
        .sort((a, b) => (b.date + (b.time ?? '')).localeCompare(a.date + (a.time ?? '')));
}
