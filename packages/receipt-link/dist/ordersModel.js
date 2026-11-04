"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGIN_TEXT = exports.UNKNOWN_END_TEXT = void 0;
exports.parseOrderList = parseOrderList;
exports.parseClaimResult = parseClaimResult;
exports.formatWon = formatWon;
exports.formatDate = formatDate;
exports.cleanTitle = cleanTitle;
exports.displayName = displayName;
exports.displayLine = displayLine;
exports.sortOrders = sortOrders;
exports.summaryLine = summaryLine;
exports.rowState = rowState;
exports.endReasonText = endReasonText;
exports.rowViews = rowViews;
exports.tallyPending = tallyPending;
exports.listCounts = listCounts;
exports.rowLabel = rowLabel;
exports.amountLine = amountLine;
exports.kindLabel = kindLabel;
exports.parseOrderReceipt = parseOrderReceipt;
exports.formatDateTime = formatDateTime;
exports.receiptRows = receiptRows;
exports.refillTails = refillTails;
/**
 * 불러온 주문 목록(영수증 적립) — 서버 응답을 화면 모양으로 고치는 순수 함수.
 * 주문번호는 서버가 가린 값만 받는다. 판매처 · 상품명 · 금액 · 날짜 말고는 화면에 올리지 않는다.
 */
const model_1 = require("./model");
const runOutcome_1 = require("./runOutcome");
const kindShown = (k) => (k === 'card' || k === 'purchase' || k === 'list' || k === 'none' ? k : null);
const object = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const count = (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0;
const text = (v) => typeof v === 'string' ? v.trim() : '';
/** 모양이 틀린 주문 한 건은 버린다(id · 날짜 · 금액이 없으면 화면에 올릴 수 없다) */
function parseOrder(v) {
    const r = object(v);
    const id = typeof r.id === 'number' && Number.isInteger(r.id) && r.id > 0 ? r.id : null;
    const orderedAt = text(r.orderedAt);
    if (id === null || !orderedAt || typeof r.amount !== 'number' || !Number.isFinite(r.amount))
        return null;
    return {
        id,
        platform: text(r.platform),
        orderNo: text(r.orderNo),
        seller: text(r.seller),
        title: text(r.title),
        amount: Math.max(0, Math.floor(r.amount)),
        orderedAt,
        claimed: r.claimed === true,
        claimedAt: text(r.claimedAt) || null,
        kind: kindShown(r.kind),
        duplicate: r.duplicate === true,
        ...(r.hasDetail === true ? { hasDetail: true } : {}),
    };
}
function parseOrderList(v) {
    const r = object(v);
    const orders = Array.isArray(r.orders) ? r.orders.map(parseOrder).filter((o) => o !== null) : [];
    return { orders, point: count(r.point), claimable: count(r.claimable) };
}
function parseClaimResult(v) {
    const r = object(v);
    return { given: count(r.given), pouchRoom: count(r.pouchRoom) };
}
/** 「12,300원」 — 천 단위 쉼표 */
function formatWon(n) {
    return String(Math.max(0, Math.floor(n))).replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '원';
}
/** 「2026.10.20」 — 날짜는 'YYYY-MM-DD HH:mm' 에서 연 · 월 · 일까지. 모양이 틀리면 빈 글자 */
function formatDate(orderedAt) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(orderedAt);
    const two = (v) => ('0' + Number(v)).slice(-2);
    return m ? `${m[1]}.${two(m[2])}.${two(m[3])}` : '';
}
/** 제목 칸에 섞여 들어오는 화면 글자(버튼 · 안내). 긴 것이 먼저 — 「영수증 조회」를 「영수증」보다 먼저 지운다 */
const UI_WORDS = ['영수증 조회', '영수증조회', '자세히 보기', '자세히보기', '상세 보기', '상세보기', '주문 상세', '주문상세', '결제 상세', '결제상세', '더보기', '영수증'];
const WORD_EDGE = '[\\s·|/,>]';
/** 제목에서 화면 글자(자세히 보기 · 더보기 · 영수증 · 결제상세 …)를 지운다. 낱말 단위로만 지워서 「영수증용지」 같은 상품 이름은 그대로 둔다. 남는 것이 없으면 빈 글자 */
function cleanTitle(title) {
    let t = title;
    for (const w of UI_WORDS)
        t = t.replace(new RegExp(`(^|${WORD_EDGE})${w}(?=$|${WORD_EDGE})`, 'g'), '$1');
    return t.replace(/\s+/g, ' ').replace(/^[\s·|/,>:-]+|[\s·|/,>:-]+$/g, '').trim();
}
/** 비교용 글자 — 띄어쓰기 · 가운뎃점 · 구분 기호를 뺀다 */
const squash = (v) => v.replace(/[\s·|/,>]+/g, '');
/** 상품명에 붙어 오는 배송비 부가 줄(「배송비 무료」 · 「배송비 3,000원」 · 「무료배송」) — 판매처 이름과 달라 보여도 이름이 아니다 */
const SHIPPING_PART = /^(배송비\s*(무료|별도|[\d,]+\s*원?)|무료\s*배송)$/;
/**
 * 줄에 보일 이름 — 판매처와 상품명. 상품명이 판매처와 같거나 판매처로 시작하면 한 번만 보인다(상품명이 더 길면 상품명 한 줄, 같으면 판매처 한 줄).
 * 상품명 안의 배송비 부가 줄과 이어서 되풀이되는 이름(「웰스 · 웰스」)은 뺀다. 판매처가 상품명으로 시작해도(상품명이 더 짧다) 판매처만 보인다.
 */
function displayName(seller, title) {
    const parts = [];
    for (const piece of cleanTitle(title).split(/\s*[·|]\s*/)) {
        const t = piece.trim();
        if (!t || SHIPPING_PART.test(t))
            continue;
        if (parts.length > 0 && squash(parts[parts.length - 1]) === squash(t))
            continue;
        parts.push(t);
    }
    const name = parts.join(' · ');
    const store = seller.trim();
    if (!store)
        return name;
    if (!name)
        return store;
    const a = squash(store);
    const b = squash(name);
    if (b === a || a.startsWith(b))
        return store;
    if (b.startsWith(a))
        return name;
    return `${store} · ${name}`;
}
/** 「2026.10.20 판매처 · 상품명」 — 상품명이 비었거나 화면 글자뿐이면 날짜(와 판매처)만, 판매처와 겹치는 상품명은 한 번만 */
function displayLine(o) {
    return [formatDate(o.orderedAt), displayName(o.seller, o.title)].filter(Boolean).join(' ');
}
/** 적립한 줄인가 — claimed 이거나 적립 시각(claimedAt)이 있다 */
const isClaimed = (o) => o.claimed || !!o.claimedAt;
/** 적립 안 한 것이 먼저, 그 안에서는 최근 주문이 먼저. 원래 배열은 바꾸지 않는다 */
function sortOrders(list) {
    return [...list].sort((a, b) => {
        if (isClaimed(a) !== isClaimed(b))
            return isClaimed(a) ? 1 : -1;
        if (a.orderedAt === b.orderedAt)
            return b.id - a.id;
        return a.orderedAt < b.orderedAt ? 1 : -1;
    });
}
/** 「적립 가능 3건 · 건당 300P」 */
function summaryLine(claimable, perOrder) {
    return `적립 가능 ${count(claimable)}건 · 건당 ${count(perOrder)}P`;
}
function rowState(o) {
    if (isClaimed(o))
        return 'claimed';
    if (o.duplicate)
        return 'duplicate';
    if (o.kind === 'list')
        return 'pending';
    if (o.kind === 'none')
        return 'none';
    return 'ready';
}
const REASON_TEXT = {
    'no-row-menu': '영수증 메뉴를 못 찾았어요',
    'no-receipt-menu': '영수증 메뉴를 못 찾았어요',
    'receipt-bounced': '영수증 화면을 못 열었어요',
    'issue-failed': '연달아 가져오지 못해 멈췄어요',
    timeouts: '사이트 응답이 늦어 멈췄어요',
    timeout: '사이트 응답이 늦어 멈췄어요',
    'site-cap': '시간이 다 돼 멈췄어요',
    budget: '시간이 다 돼 멈췄어요',
    'max-steps': '시간이 다 돼 멈췄어요',
    blocked: '사이트가 잠시 막았어요',
    'list-failed': '주문 목록을 받지 못했어요',
    'shop-lost': '사이트 화면이 달라 멈췄어요',
    'pay-lost': '사이트 화면이 달라 멈췄어요',
    'cross-origin': '사이트가 영수증 요청을 받아 주지 않았어요',
    'first-page-only': '주문 목록 첫 쪽까지만 가져왔어요',
    'list-shape': '주문 목록 모양이 달라 읽지 못했어요',
    'fetch-refused': '허용되지 않은 주소라 멈췄어요',
    'unexpected-page': '사이트 화면이 달라 멈췄어요',
    stopped: '중단했어요',
};
/** 끝난 까닭을 모를 때의 글자 — 「읽지 못했어요」처럼 두루뭉술하게 말하지 않고 다음 할 일을 말한다 */
exports.UNKNOWN_END_TEXT = '가져오지 못했어요 · 가져오기를 눌러 다시 시도해 주세요';
/** 로그인이 풀린 줄 — 다시 가져와도 같다(먼저 로그인) */
exports.LOGIN_TEXT = '로그인이 풀렸어요';
/** 끝난 까닭 코드를 쉬운 말로(영문 코드 · 번호는 글자에 넣지 않는다) */
function endReasonText(reason) {
    if (/^login/.test(reason))
        return exports.LOGIN_TEXT;
    return REASON_TEXT[reason] ?? exports.UNKNOWN_END_TEXT;
}
/** 못 가져온 줄 — 끝난 까닭 글자. 로그인이 풀린 줄만 다시 가져오기를 막는다 */
const failedView = (reason) => {
    const text = endReasonText(reason);
    return { state: 'failed', reason: text, retry: text !== exports.LOGIN_TEXT };
};
/**
 * 줄마다 상태. 읽는 중에는 흐름이 알린 줄 결과(outcomes)를 그대로 보이고, 아직 결과가 없는 줄은 「대기」다(결과를 알리지 않는 사이트는 영수증 단계에서
 * 가장 위(최신) 대기 줄 하나만 「가져오는 중」 — 흐름이 최신부터 처리한다).
 * 끝났거나 읽기 정보가 없으면(run 없음) 결과가 없는 줄은 끝난 까닭으로 「못 가져옴」 — 사용자가 중단했으면(reason stopped) 실패가 아니라 「대기」로 남긴다.
 */
function rowViews(list, run) {
    const out = new Map();
    const ended = !run || run.stage === 'ended';
    const stopped = !!run && run.reason === 'stopped';
    let fetching = false;
    for (const o of sortOrders(list)) {
        const st = rowState(o);
        if (st === 'claimed' || st === 'duplicate') {
            out.set(o.id, { state: st, reason: '' });
            continue;
        }
        if (st === 'ready') {
            out.set(o.id, { state: 'fetched', reason: '' });
            continue;
        }
        if (st === 'none') {
            out.set(o.id, { state: 'none', reason: runOutcome_1.NONE_TEXT });
            continue;
        } // 서버에 「영수증 없음」으로 남은 줄 — 다시 가져오지 않는다
        const key = (0, runOutcome_1.outcomeKey)(o.orderNo, o.orderedAt, o.amount);
        const r = run?.outcomes?.[key];
        // 이 줄이 지금 실행에 들어 있나 — 한 줄 실행(only)이면 그 줄만, 아니면 모든 줄
        const inRun = !run?.only || run.only.includes(key);
        const live = !ended && inRun;
        if (r && r.state === 'none' && r.why === 'cancelled')
            out.set(o.id, { state: 'cancelled', reason: runOutcome_1.CANCELLED_TEXT });
        else if (r && r.state === 'none')
            out.set(o.id, { state: 'none', reason: runOutcome_1.NONE_TEXT });
        else if (r && r.state === 'failed' && r.code !== 'stopped')
            out.set(o.id, { state: 'failed', reason: (0, runOutcome_1.failText)(r.code), retry: r.code !== 'login' });
        else if (r && r.state === 'failed')
            out.set(o.id, { state: 'waiting', reason: '', retry: true });
        else if (live && r)
            out.set(o.id, { state: 'fetching', reason: '' }); // 가져오는 중 · 가져왔지만 서버 목록이 아직 따라오는 중
        else if (!inRun && r && r.state === 'fetching')
            out.set(o.id, { state: 'waiting', reason: '' }); // 차례를 기다리는 한 줄 가져오기
        else if (!live) {
            const why = inRun ? (run ? run.reason : '') : (run?.base ?? '');
            out.set(o.id, why === 'stopped' ? { state: 'waiting', reason: '', retry: true } : failedView(why));
        }
        else if (!run.outcomes && run.stage === 'receipt' && !fetching) {
            fetching = true;
            out.set(o.id, { state: 'fetching', reason: '' });
        }
        else
            out.set(o.id, { state: 'waiting', reason: '' });
    }
    return out;
}
function tallyPending(list, run) {
    const t = { waiting: 0, fetching: 0, none: 0, cancelled: 0, failed: 0 };
    const views = rowViews(list, run);
    for (const o of list) {
        if (rowState(o) !== 'pending')
            continue;
        const v = views.get(o.id);
        if (v && (v.state === 'waiting' || v.state === 'fetching' || v.state === 'none' || v.state === 'cancelled' || v.state === 'failed'))
            t[v.state]++;
    }
    return t;
}
function listCounts(list) {
    let fetched = 0;
    let claimable = 0;
    for (const o of list) {
        const st = rowState(o);
        if (st !== 'pending' && st !== 'none')
            fetched++;
        if (st === 'ready')
            claimable++;
    }
    return { total: list.length, fetched, claimable };
}
/** 줄 오른쪽 글자 — 광고 보고 적립 버튼이 있는 줄(fetched)은 버튼이, 이미 올린 영수증(duplicate)은 서버 안내 글이 대신한다 */
function rowLabel(v) {
    switch (v.state) {
        case 'claimed': return '적립 완료';
        case 'waiting': return '대기';
        case 'fetching': return '가져오는 중…';
        case 'none': return '영수증 없음';
        case 'cancelled': return '취소된 주문';
        case 'failed': return '못 가져옴';
        default: return '';
    }
}
/** 「5,000원 · 카드영수증 · 가져옴 ✓」 — 금액과 종류, 가져온 줄이면 가져옴 표시 */
function amountLine(o, v) {
    return [formatWon(o.amount), kindLabel(o), v.state === 'fetched' ? '가져옴 ✓' : ''].filter(Boolean).join(' · ');
}
/** 금액 밑의 작은 종류 글자 — 카드영수증 · 구매영수증(목록 행 · 모르는 종류는 없음) */
function kindLabel(o) {
    return o.kind === 'card' ? '카드영수증' : o.kind === 'purchase' ? '구매영수증' : '';
}
/** 응답 모양이 틀리거나 일시 · 금액이 없으면 null */
function parseOrderReceipt(v) {
    const r = object(object(v).receipt);
    const orderedAt = text(r.orderedAt);
    if (!orderedAt || typeof r.amount !== 'number' || !Number.isFinite(r.amount))
        return null;
    const out = {
        seller: text(r.seller),
        title: text(r.title),
        amount: Math.max(0, Math.floor(r.amount)),
        orderedAt,
        kind: kindShown(r.kind),
        cardIssuer: text(r.cardIssuer),
        approval: text(r.approval),
        businessNumber: text(r.businessNumber),
    };
    const detail = (0, model_1.readDetail)(r.detail);
    if (detail)
        out.detail = detail;
    return out;
}
/** 「2026.10.20 14:03:22」 — 초가 없으면 분까지. 모양이 틀리면 빈 글자 */
function formatDateTime(orderedAt) {
    const m = /^(\d{4})-(\d{1,2})-(\d{1,2})[ T](\d{1,2}):(\d{2})(?::(\d{2}))?/.exec(orderedAt);
    const two = (x) => ('0' + Number(x)).slice(-2);
    if (!m)
        return '';
    return `${m[1]}.${two(m[2])}.${two(m[3])} ${two(m[4])}:${m[5]}${m[6] ? ':' + m[6] : ''}`;
}
/** 영수증 보기의 상품명 — 업체명과 겹치는 상품명(업체명 그대로이거나 업체명으로 시작하는 짧은 이름)은 업체명 칸이 말하니 줄을 만들지 않는다 */
const productName = (r) => {
    const name = displayName('', r.title);
    return name && displayName(r.seller, name) !== r.seller ? name : '';
};
/** 「롯데 / 37649223」 — 대표님 22:30 캡처처럼 두 값을 「/」로 붙인다(한쪽만 있으면 그 값만) */
const pair = (a, b) => [a, b].filter(Boolean).join(' / ');
/**
 * 세부가 있는 영수증 — 대표님 10-29 22:30 「카드 영수증」 캡처(IMG_9704)의 칸 이름 · 순서 그대로.
 * 캡처가 「가맹점 정보 › 대표자명」 아래에서 잘려, 그 뒤 칸(가맹점 사업자등록번호 · 가맹점번호 · 주소 · 금액) 이름은 응답 원문 칸에 맞춘 우리 말이다.
 */
function detailRows(r, d) {
    const t = (k) => (typeof d[k] === 'string' ? d[k] : '');
    const won = (k) => (typeof d[k] === 'number' ? formatWon(d[k]) : '');
    const trade = t('tradeType') + (t('ownerType') ? `(${t('ownerType')})` : '');
    // 「4523-****-****-0113(**/**)」 — 캡처 모양. 유효기간은 응답 칸(월 · 연)을 그대로 붙인다
    const expiry = t('cardExpiredMonth') || t('cardExpiredYear') ? `(${t('cardExpiredMonth')}/${t('cardExpiredYear')})` : '';
    const groups = [
        [
            { label: '카드사/승인번호', value: pair(t('cardCompany') || r.cardIssuer, t('approvalNo') || r.approval) },
            { label: '카드번호(유효기간)', value: t('cardNo') ? t('cardNo') + expiry : '' },
            { label: '거래종류/할부', value: pair(trade, t('installmentType')) },
            { label: '결제일자', value: t('approvalAt') || formatDateTime(r.orderedAt) },
            { label: '취소일자', value: t('cancelAt') },
            { label: '상품명', value: t('productName') || r.title },
            { label: '상품 주문번호', value: t('productOrderNo') },
        ],
        [
            { label: '판매자 정보', value: '', head: true },
            { label: '판매자상호', value: t('sellerName') || r.seller },
            { label: '대표자명', value: t('sellerRepresentative') },
            { label: '사업자등록번호', value: t('sellerBusinessNo') || r.businessNumber },
            { label: '전화번호', value: t('sellerTel') },
            { label: '사업장주소', value: t('sellerAddress') },
        ],
        [
            { label: '가맹점 정보', value: '', head: true },
            { label: '가맹점명', value: t('merchantName') },
            { label: '대표자명', value: t('merchantRepresentative') },
            { label: '사업자등록번호', value: t('merchantBusinessNo') },
            { label: '가맹점번호', value: t('merchantNo') },
            { label: '사업장주소', value: t('merchantAddress') },
        ],
        [
            { label: '승인금액', value: won('approvalAmount') || formatWon(r.amount), strong: true },
            { label: '취소금액', value: won('cancelAmount') },
            { label: '공급가액', value: won('supplyAmount') },
            { label: '부가세', value: won('taxAmount') },
            { label: '봉사료', value: won('serviceCharge') },
            { label: '일회용컵 보증금', value: won('disposableCupAmount') },
            { label: '합계', value: won('totalAmount') },
        ],
    ];
    // 값이 없는 칸은 줄을 만들지 않고, 소제목은 그 아래 줄이 하나라도 있을 때만
    return groups.flatMap((g) => {
        const filled = g.filter((x) => !x.head && x.value);
        return filled.length ? g.filter((x) => x.head || x.value) : [];
    });
}
/** 영수증 보기의 표 — 값이 없는 칸은 줄을 만들지 않는다. 세부(detail)가 있으면 대표님 22:30 캡처 순서, 없으면(옛 방식으로 받은 줄) 예전 칸 */
function receiptRows(r) {
    if (r.detail)
        return detailRows(r, r.detail);
    const rows = [
        { label: '업체명', value: r.seller },
        { label: '상품명', value: productName(r) },
        { label: '결제 금액', value: formatWon(r.amount), strong: true },
        { label: '승인 일시', value: formatDateTime(r.orderedAt) },
        { label: '카드사', value: r.cardIssuer },
        { label: '승인번호', value: r.approval },
        { label: '사업자등록번호', value: r.businessNumber },
        { label: '종류', value: r.kind === 'card' ? '카드영수증' : r.kind === 'purchase' ? '구매영수증' : '' },
    ];
    return rows.filter((x) => x.value);
}
/**
 * 「영수증 내용 채우기」로 다시 받을 줄 — 세부가 빈 내 네이버 카드 줄(서버 hasDetail 이 없는 줄).
 * 서버가 주문번호를 가려 주므로 「뒤 4자리|결제 날짜」로 넘긴다(흐름이 목록 주문과 날짜 하루 차이까지 잇는다). 대표님 14:26 「가져온 영수증 정보도 빈게 너무 많아」
 */
function refillTails(orders) {
    const out = new Set();
    for (const o of orders) {
        if (o.platform !== 'naver' || o.kind !== 'card' || o.hasDetail === true)
            continue;
        const tail = o.orderNo.slice(-4);
        if (/^\d{4}$/.test(tail) && /^\d{4}-\d{2}-\d{2}/.test(o.orderedAt))
            out.add(`${tail}|${o.orderedAt.slice(0, 10)}`);
    }
    return [...out];
}
