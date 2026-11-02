"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ESCAPE_SCRIPT = exports.NAV_API_INTERCEPT_SCRIPT = exports.PAY_BLOCK_SELECTOR = exports.SHOP_BLOCK_SELECTOR = exports.API_ROUTES = exports.NAV_HELPERS_SCRIPT = exports.NAV_INTERCEPT_SCRIPT = exports.COUPANG_TOKEN_PATTERNS = exports.NAVER_TOKEN_PATTERNS = exports.payHistoryUrl = exports.SHOP_ORDER_URL = exports.MAX_PAY_PAGES = exports.LOOKBACK_DAYS = exports.FORBIDDEN_LABEL_WORDS = void 0;
exports.countLabel = countLabel;
exports.runPatterns = runPatterns;
exports.parseTokens = parseTokens;
exports.pairTokens = pairTokens;
exports.extractPaymentTokens = extractPaymentTokens;
exports.previewUrl = previewUrl;
exports.dateOfPaymentId = dateOfPaymentId;
exports.tidStamp = tidStamp;
exports.extractSlip = extractSlip;
exports.extractReceiptRows = extractReceiptRows;
exports.parseKoreanMD = parseKoreanMD;
exports.countOrderCards = countOrderCards;
exports.extractHistoryRows = extractHistoryRows;
exports.extractDetailStamp = extractDetailStamp;
exports.resolveSlipSeconds = resolveSlipSeconds;
exports.isLoginPage = isLoginPage;
exports.toImportOrder = toImportOrder;
exports.interceptScript = interceptScript;
exports.normalizeKst = normalizeKst;
exports.listOrder = listOrder;
exports.shopItemToOrder = shopItemToOrder;
exports.shopItemCancelled = shopItemCancelled;
exports.payItemToOrder = payItemToOrder;
exports.parseOrderHistories = parseOrderHistories;
exports.parseNvMids = parseNvMids;
exports.pickIssueTitle = pickIssueTitle;
exports.parseShopCard = parseShopCard;
exports.parsePayCard = parsePayCard;
exports.extractShopBlocks = extractShopBlocks;
exports.extractPayBlocks = extractPayBlocks;
exports.blockTextsScript = blockTextsScript;
exports.navScript = navScript;
exports.readTokensScript = readTokensScript;
exports.pageShape = pageShape;
const navCommon_1 = require("./navCommon");
const naverReceiptsScript_1 = require("./naverReceiptsScript");
const siteFetch_1 = require("./siteFetch");
const siteFetchScript_1 = require("./siteFetchScript");
/** 이 글자가 든 요소는 눌러도 되는 요소가 아니다(삭제 · 해지 · 탈퇴 · 취소) */
exports.FORBIDDEN_LABEL_WORDS = ['삭제', '해지', '탈퇴', '취소'];
const HANGUL_OR_ALNUM = /[0-9A-Za-z가-힣]/;
const PID_RE = /^\d{8}NP\d{6,14}$/;
const TID_RE = /^\d{18,22}$/;
const DAY_MS = 86400000;
exports.LOOKBACK_DAYS = 365;
exports.MAX_PAY_PAGES = 40;
exports.SHOP_ORDER_URL = 'https://shopping.naver.com/my/order';
const payHistoryUrl = (page) => `https://pay.naver.com/history?page=${page}`;
exports.payHistoryUrl = payHistoryUrl;
const norm = (s) => s.replace(/ /g, ' ').replace(/\r/g, '');
const pad = (n) => String(n).padStart(2, '0');
/** 날짜 · 시각 조각을 'YYYY-MM-DD HH:mm[:ss]' 로. 실제로 없는 날짜면 null */
function toStamp(y, mo, d, h, mi, s) {
    const year = y.length === 2 ? 2000 + Number(y) : Number(y);
    const M = Number(mo), D = Number(d), H = Number(h), I = Number(mi), S = s === undefined ? 0 : Number(s);
    if (M < 1 || M > 12 || D < 1 || D > 31 || H > 23 || I > 59 || S > 59)
        return null;
    const dt = new Date(Date.UTC(year, M - 1, D));
    if (dt.getUTCMonth() !== M - 1 || dt.getUTCDate() !== D)
        return null;
    const base = `${year}-${pad(M)}-${pad(D)} ${pad(H)}:${pad(I)}`;
    return s === undefined ? base : `${base}:${pad(S)}`;
}
const STAMP_RE = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
function pick(text, re) {
    const m = re.exec(text);
    return m ? m[1] : undefined;
}
function parseAmount(s) {
    if (!s)
        return undefined;
    const n = Number(s.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : undefined;
}
/** 라벨이 붙은 글자를 센다. 앞뒤가 한글·영숫자이면 다른 단어의 일부이므로 세지 않는다(예: 구매영수증 안의 영수증) */
function countLabel(text, label) {
    let n = 0;
    let i = text.indexOf(label);
    while (i >= 0) {
        const before = i > 0 ? text.charAt(i - 1) : '';
        const after = text.charAt(i + label.length);
        if (!HANGUL_OR_ALNUM.test(before) && !HANGUL_OR_ALNUM.test(after))
            n++;
        i = text.indexOf(label, i + label.length);
    }
    return n;
}
function countRe(text, re) {
    const m = text.match(re);
    return m ? m.length : 0;
}
/* ---------------- 토큰 (번호만) ---------------- */
exports.NAVER_TOKEN_PATTERNS = [
    { name: 'pid', source: String.raw `\b\d{8}NP\d{6,14}\b`, group: 0 },
    { name: 'tid', source: String.raw `\b(20\d{12}\d{4,8})\b`, group: 1 },
    { name: 'pair', source: String.raw `paymentId=([0-9A-Za-z]{8,40})&tid=(\d{18,22})`, group: 1, group2: 2 },
    { name: 'pair', source: String.raw `"paymentId"\s*:\s*"([0-9A-Za-z]{8,40})"\s*,\s*"tid"\s*:\s*"?(\d{18,22})`, group: 1, group2: 2 },
    { name: 'nord', source: String.raw `"orderNo"\s*:\s*"(\d{12,20})"`, group: 1 },
    { name: 'npo', source: String.raw `"productOrderNo"\s*:\s*"(\d{12,20})"`, group: 1 },
    { name: 'npid', source: String.raw `"paymentId"\s*:\s*"([0-9]{8}NP[0-9]+)"`, group: 1 },
];
/** 쿠팡 가정 규칙: 주문번호는 orderId 근처 숫자, 판매자 번호는 vendorId(s) 근처 영문1+숫자7~10 */
exports.COUPANG_TOKEN_PATTERNS = [
    { name: 'oid', source: String.raw `orderId["'=:\s]{1,6}"?(\d{10,16})`, group: 1 },
    { name: 'vid', source: String.raw `vendorIds?["'=:\s\[]{1,6}"?([A-Z]\d{7,10}(?:,[A-Z]\d{7,10})*)`, group: 1 },
];
function tokenValue(m, p) {
    if (p.group2 !== undefined)
        return `${m[p.group] ?? ''}|${m[p.group2] ?? ''}`;
    return m[p.group] || m[0];
}
/** 글자에서 규칙에 맞는 토큰만 「이름:값」 으로 뽑는다. 본문은 남기지 않는다 */
function runPatterns(text, patterns) {
    const out = [];
    for (const p of patterns) {
        const re = new RegExp(p.source, 'g');
        let m;
        let n = 0;
        while ((m = re.exec(text)) !== null && n < 2000) {
            n++;
            out.push(`${p.name}:${tokenValue(m, p)}`);
        }
    }
    return out;
}
/** 「이름:값」 토큰을 모양 검사 후 종류별로 나눈다. 모양이 틀린 토큰은 버린다 */
function parseTokens(tokens) {
    const set = { paymentIds: [], tids: [], pairs: [], orderIds: [], vendorIds: [], orderNos: [], productOrderNos: [] };
    const add = (list, v) => { if (!list.includes(v))
        list.push(v); };
    for (const t of tokens) {
        const i = t.indexOf(':');
        if (i < 0)
            continue;
        const name = t.slice(0, i);
        const val = t.slice(i + 1);
        if (name === 'pid' && PID_RE.test(val))
            add(set.paymentIds, val);
        else if (name === 'tid' && TID_RE.test(val))
            add(set.tids, val);
        else if (name === 'pair') {
            const [p, d] = val.split('|');
            if (PID_RE.test(p ?? '') && TID_RE.test(d ?? '')) {
                if (!set.pairs.some((x) => x.paymentId === p))
                    set.pairs.push({ paymentId: p, tid: d });
                add(set.paymentIds, p);
                add(set.tids, d);
            }
        }
        else if (name === 'oid' && /^\d{10,16}$/.test(val))
            add(set.orderIds, val);
        else if (name === 'nord' && /^\d{12,20}$/.test(val))
            add(set.orderNos, val);
        else if (name === 'npo' && /^\d{12,20}$/.test(val))
            add(set.productOrderNos, val);
        else if (name === 'npid' && PID_RE.test(val))
            add(set.paymentIds, val);
        else if (name === 'vid')
            for (const v of val.split(','))
                if (/^[A-Z]\d{7,10}$/.test(v))
                    add(set.vendorIds, v);
    }
    return set;
}
/** 짝이 명시된 것은 그대로, 없으면 같은 날짜(앞 8자리)의 안 쓴 tid 를 붙인다. 최신 날짜부터 */
function pairTokens(set) {
    const used = new Set();
    const explicit = new Map();
    for (const p of set.pairs) {
        explicit.set(p.paymentId, p.tid);
        used.add(p.tid);
    }
    const ids = [...new Set([...set.paymentIds, ...set.pairs.map((p) => p.paymentId)])];
    const out = ids.map((id) => {
        let tid = explicit.get(id);
        if (!tid) {
            const d = id.slice(0, 8);
            tid = set.tids.find((t) => !used.has(t) && t.slice(0, 8) === d);
            if (tid)
                used.add(tid);
        }
        return { paymentId: id, tid };
    });
    return out.sort((a, b) => b.paymentId.slice(0, 8).localeCompare(a.paymentId.slice(0, 8)));
}
/** 글자 한 덩이에서 네이버 결제 번호 · tid · 짝을 뽑는다(글자는 저장하지 않는다) */
function extractPaymentTokens(text) {
    const set = parseTokens(runPatterns(norm(text), exports.NAVER_TOKEN_PATTERNS));
    return { paymentIds: set.paymentIds, tids: set.tids, pairs: set.pairs };
}
/** 영수증 미리보기 주소. 형식은 대표님 확인값 */
const PO_RE = /^PD\d{12,20}$/;
/** 카드 영수증 주소(새 형식). 세 값(tid · productOrderNo · payId)이 모두 맞을 때만 만든다. 옛 형식은 만들지 않는다 */
function previewUrl(tid, productOrderNo, payId) {
    if (!TID_RE.test(tid) || !PO_RE.test(productOrderNo) || !TID_RE.test(payId))
        return null;
    return `https://pay.naver.com/receipts/preview/card?tid=${tid}&productOrderNo=${productOrderNo}&exitType=back&payId=${payId}`;
}
/** 결제번호 앞 8자리 → 'YYYY-MM-DD' */
function dateOfPaymentId(paymentId) {
    if (!PID_RE.test(paymentId))
        return null;
    return `${paymentId.slice(0, 4)}-${paymentId.slice(4, 6)}-${paymentId.slice(6, 8)}`;
}
/** tid 앞 14자리(YYYYMMDDHHMMSS) → 'YYYY-MM-DD HH:mm:ss' */
function tidStamp(tid) {
    if (!TID_RE.test(tid))
        return null;
    const m = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/.exec(tid);
    return m ? toStamp(m[1], m[2], m[3], m[4], m[5], m[6]) : null;
}
/* ---------------- 매출전표 · 목록 추출 ---------------- */
const CARD_ISSUERS = ['KB국민', '국민', 'KB', '신한', '삼성', '현대', '롯데', '하나', '우리', '비씨', 'BC', 'NH농협', '농협', 'NH', '씨티', '카카오뱅크', '카카오', '토스뱅크', '케이뱅크', 'IBK기업', 'IBK', '수협', '광주', '전북', '제주', 'DGB', 'SC제일'];
const ISSUER_RE = new RegExp(`(${CARD_ISSUERS.join('|')})\\s*카드`);
const AMOUNT_RES = [/승인\s*금액\s*[:：]?\s*([\d,]+)/, /결제\s*금액\s*[:：]?\s*([\d,]+)/, /합\s*계\s*[:：]?\s*([\d,]+)/, /금\s*액\s*[:：]?\s*([\d,]+)/];
const PAID_RE = /(?:결제|거래|승인)\s*(?:일시|일자)\s*[:：]?\s*(\d{2,4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/;
function pickBusinessNumber(text) {
    // 판매자 정보 구획의 사업자등록번호만 쓴다. 가맹점 정보(네이버파이낸셜)의 번호는 모든 결제에 같으므로 버린다
    const seller = text.indexOf('판매자 정보');
    if (seller >= 0) {
        const endSeller = text.indexOf('가맹점 정보', seller);
        const sec = text.slice(seller, endSeller > seller ? endSeller : undefined);
        const sm = /(\d{3})-(\d{2})-(\d{5})/.exec(sec);
        return sm ? sm[0] : undefined;
    }
    if (text.indexOf('가맹점 정보') >= 0)
        return undefined;
    // 「상점 정보」 구역의 번호를 먼저 쓴다(「결제서비스 업체정보」 뒤의 번호는 결제대행사 것이라 무시)
    const shop = text.indexOf('상점 정보');
    if (shop >= 0) {
        const endIdx = text.indexOf('결제서비스', shop);
        const section = text.slice(shop, endIdx > shop ? endIdx : undefined);
        const sm = /(\d{3})-(\d{2})-(\d{5})/.exec(section);
        if (sm)
            return sm[0];
    }
    const re = /(\d{3})-(\d{2})-(\d{5})/g;
    let first;
    let near;
    let m;
    while ((m = re.exec(text)) !== null) {
        if (first === undefined)
            first = m[0];
        const before = text.slice(Math.max(0, m.index - 30), m.index);
        if (near === undefined && /사업자|가맹점/.test(before))
            near = m[0];
    }
    return near ?? first;
}
function pickPaidAt(text) {
    const m = PAID_RE.exec(text);
    if (!m)
        return undefined;
    const at = toStamp(m[1], m[2], m[3], m[4], m[5], m[6]);
    if (!at)
        return undefined;
    return { at, noSeconds: m[6] === undefined };
}
function pickAmount(text) {
    for (const re of AMOUNT_RES) {
        const n = parseAmount(pick(text, re));
        if (n !== undefined)
            return n;
    }
    return undefined;
}
/** 매출전표(카드 · 구매영수증) 글자 → 필드. 금액 · 결제일시 · 승인번호 · 사업자번호 중 3개 이상 있어야 한다 */
function extractSlip(raw) {
    const text = norm(raw);
    const businessNumber = pickBusinessNumber(text);
    // 「카드사/승인번호」 값은 「롯데 / 12345678」 모양: 승인번호는 / 뒤 숫자
    const approval = pick(text, /카드사\s*\/\s*승인\s*번호[^\n\/]*\/\s*(\d{5,16})/) ?? pick(text, /승인\s*번호\s*[:：]?\s*(\d{5,16})/);
    const paid = pickPaidAt(text);
    const amount = pickAmount(text);
    const found = [amount, paid, approval, businessNumber].filter((v) => v !== undefined).length;
    if (found < 3)
        return null;
    const merchantRaw = pick(text, /(?:판매자상호|상호|판매처)\s*[:：]?\s*([^\n]{1,60})/);
    const issuer = pick(text, ISSUER_RE) ?? pick(text, /카드사\s*[:：]?\s*([가-힣A-Za-z]{2,10})/);
    return {
        businessNumber,
        approval,
        paidAt: paid?.at,
        paidAtNoSeconds: paid ? paid.noSeconds : undefined,
        amount,
        cardIssuer: issuer,
        merchant: merchantRaw?.trim() || undefined,
        orderNo: pick(text, /(?:^|\D)(\d{16})(?!\d)/),
    };
}
/** 16자리 주문번호마다 블록을 나눈다. 같은 번호는 처음 것만 */
function findOrderNos(text) {
    const re = /(^|\D)(\d{16})(?!\d)/g;
    const out = [];
    const seen = new Set();
    let m;
    while ((m = re.exec(text)) !== null) {
        if (seen.has(m[2]))
            continue;
        seen.add(m[2]);
        out.push({ no: m[2], at: m.index + m[1].length });
    }
    return out;
}
/** 「영수증 발급 내역」 글자 → 줄(주문) 목록. 카드영수증 · 구매영수증 버튼이 몇 번째인지도 센다(눌러서 고를 때 쓴다) */
function extractReceiptRows(raw) {
    const text = norm(raw);
    const hits = findOrderNos(text);
    return hits.map((h, i) => {
        const end = i + 1 < hits.length ? hits[i + 1].at : text.length;
        const block = text.slice(h.at, end);
        const prefix = text.slice(0, h.at);
        return {
            orderNo: h.no,
            seller: pick(block, /판매처\s*[:：]?\s*([^\n]{1,80})/)?.trim() || undefined,
            amount: parseAmount(pick(block, /금액\s*[:：]?\s*([\d,]+)\s*원/) ?? pick(block, /([\d,]+)\s*원/)),
            hasCard: countLabel(block, '카드영수증') > 0,
            hasPurchase: countLabel(block, '구매영수증') > 0,
            cardIndex: countLabel(prefix, '카드영수증'),
            purchaseIndex: countLabel(prefix, '구매영수증'),
        };
    });
}
/**
 * 연도 없는 「9.11. 11:50 주문」 · 「10. 20. 10:04 결제」 를 'YYYY-MM-DD HH:mm' 으로(연도는 주어진 해, 기본은 현재 해).
 * 초는 없으므로 이 값은 목록용 힌트일 뿐 서버에 주문일시로 넣지 않는다.
 */
function parseKoreanMD(raw, year = new Date().getFullYear()) {
    const re = /(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}):(\d{2})\s*(주문|결제)/g;
    const out = [];
    let m;
    const text = norm(raw);
    while ((m = re.exec(text)) !== null) {
        const at = toStamp(String(year), m[1], m[2], m[3], m[4]);
        if (at)
            out.push({ at, kind: m[5] === '주문' ? 'order' : 'pay' });
    }
    return out;
}
/** 주문 목록의 「9.11. 11:50 주문」 개수 */
function countOrderCards(raw) {
    return countRe(norm(raw), /\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2}\s*주문/g);
}
const dayOf = (year, mo, d) => {
    const at = toStamp(String(year), String(mo), String(d), '00', '00');
    return at ? at.slice(0, 10) : null;
};
/**
 * 결제내역(pay.naver.com/history) 글자 → 결제 블록 목록.
 * 날짜는 「2026.10.20」 또는 「5,000원 | 10. 20. 10:04 결제」(연도 없음) 둘 다 본다.
 * 연도 없는 날짜: 최신순 목록에서 12월 → 1월로 넘어가면 해를 낮추고, 오늘(KST)보다 뒤면 해를 낮춘다.
 * 블록은 날짜가 있는 줄의 맨 앞에서 시작한다(금액이 같은 줄에 있다). menuIndex 는 그 결제의 「⋮」 이 페이지에서 몇 번째인지(없으면 undefined).
 */
function extractHistoryRows(raw, nowMs = Date.now()) {
    const text = norm(raw);
    const re = /(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})|(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{1,2}):(\d{2})\s*(?:결제|주문)/g;
    const found = [];
    let m;
    while ((m = re.exec(text)) !== null) {
        if (m[1] !== undefined)
            found.push({ idx: m.index, y: Number(m[1]), mo: Number(m[2]), d: Number(m[3]) });
        else
            found.push({ idx: m.index, mo: Number(m[4]), d: Number(m[5]) });
    }
    const nowDate = new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
    let year = Number(nowDate.slice(0, 4));
    let prevMo = null;
    const starts = [];
    for (const f of found) {
        if (f.y !== undefined)
            year = f.y;
        else if (prevMo !== null && f.mo > prevMo + 6)
            year -= 1;
        let date = dayOf(year, f.mo, f.d);
        if (f.y === undefined && date !== null && date > nowDate) {
            year -= 1;
            date = dayOf(year, f.mo, f.d);
        }
        prevMo = f.mo;
        if (date === null)
            continue;
        const lineStart = text.lastIndexOf('\n', f.idx - 1) + 1;
        if (starts.length > 0 && starts[starts.length - 1].at === lineStart)
            continue;
        starts.push({ at: lineStart, date });
    }
    return starts.map((s, i) => {
        const end = i + 1 < starts.length ? starts[i + 1].at : text.length;
        const block = text.slice(s.at, end);
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const merchant = lines.slice(1).find((l) => /[가-힣A-Za-z]/.test(l) && l.length <= 60 && !/원$/.test(l));
        return {
            date: s.date,
            orderNo: pick(block, /(?:^|\D)(\d{16})(?!\d)/),
            merchant,
            amount: parseAmount(pick(block, /금액\s*[:：]?\s*([\d,]+)\s*원/) ?? pick(block, /([\d,]+)\s*원/)),
            hasReceipt: countLabel(block, '영수증') > 0,
            receiptIndex: countLabel(text.slice(0, s.at), '영수증'),
            menuIndex: block.includes('⋮') ? text.slice(0, s.at).split('⋮').length - 1 : undefined,
        };
    });
}
/** 결제상세의 「2026.10.20. 10:04:43」 → 'YYYY-MM-DD HH:mm:ss'. 초가 없으면 undefined(초 없는 값은 쓰지 않는다) */
function extractDetailStamp(raw) {
    const re = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2}):(\d{2})/g;
    const text = norm(raw);
    let m;
    while ((m = re.exec(text)) !== null) {
        const at = toStamp(m[1], m[2], m[3], m[4], m[5], m[6]);
        if (at)
            return at;
    }
    return undefined;
}
/**
 * 매출전표에 초가 없으면 초를 채운다. 우선순위: 매출전표 승인일시(초 있음) > 결제상세 일시 > tid 앞 14자리.
 * 후보는 전표와 같은 분(HH:mm)일 때만 쓴다. 맞는 후보가 없으면 전표를 그대로 둔다(초 없음 → toImportOrder 가 버린다).
 */
function resolveSlipSeconds(slip, detailAt, tid) {
    if (!slip.paidAt || !slip.paidAtNoSeconds)
        return slip;
    const minute = slip.paidAt.slice(0, 16);
    const tidAt = tid ? tidStamp(tid) : null;
    for (const cand of [detailAt, tidAt]) {
        if (cand && STAMP_RE.test(cand) && cand.slice(0, 16) === minute)
            return { ...slip, paidAt: cand, paidAtNoSeconds: false };
    }
    return slip;
}
/** 로그인 화면인지. 네이버 로그인 주소이거나, 주문 흔적 없이 로그인 글자만 있으면 로그인 화면이다 */
function isLoginPage(url, text) {
    if (/nid\.naver\.com/i.test(url))
        return true;
    if (/\d{16}|\d[\d,]*원|주문/.test(text))
        return false;
    return /로그인|아이디|비밀번호/.test(text);
}
/**
 * 매출전표 → 서버가 받는 주문 한 건. 주문번호 · 결제일시(초까지) · 금액이 없으면 null.
 * 초가 없는 결제일시는 allowNoSeconds 를 켰을 때만 ':00' 을 붙인다(기본은 null — 가짜 초를 서버에 넣지 않는다).
 */
function toImportOrder(slip, row, opts = {}) {
    const orderNo = (row?.orderNo || slip.orderNo || '').trim();
    const amount = slip.amount ?? row?.amount;
    if (!orderNo || amount === undefined || !slip.paidAt)
        return null;
    let orderedAt = slip.paidAt;
    if (slip.paidAtNoSeconds) {
        if (!opts.allowNoSeconds)
            return null;
        orderedAt = `${orderedAt}:00`;
    }
    if (!STAMP_RE.test(orderedAt))
        return null;
    const kind = opts.kind ?? (slip.approval || slip.businessNumber ? 'card' : 'purchase');
    const out = {
        orderNo,
        orderedAt,
        amount,
        payment: kind === 'card' ? '카드' : '포인트·기타',
        kind,
    };
    const seller = row?.seller ?? slip.merchant;
    if (seller)
        out.seller = seller;
    if (row?.title)
        out.title = row.title;
    if (slip.businessNumber)
        out.businessNumber = slip.businessNumber;
    if (slip.approval)
        out.approval = slip.approval;
    if (slip.cardIssuer)
        out.cardIssuer = slip.cardIssuer;
    return out;
}
/* ---------------- 웹뷰에 넣는 스크립트 ---------------- */
const HELPERS_JS = String.raw `(function () {
  var MORE = ['…', '⋯', '더보기'];
  var FORBIDDEN = ['삭제', '해지', '탈퇴', '취소'];
  function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }
  function text() {
    var b = document.body;
    var t = b ? String(b.innerText || '') : '';
    return t.length > 200000 ? t.slice(0, 200000) : t;
  }
  function forbidden(s) {
    for (var i = 0; i < FORBIDDEN.length; i++) { if (String(s).indexOf(FORBIDDEN[i]) >= 0) return true; }
    return false;
  }
  function visible(el) {
    if (!el || typeof el.getBoundingClientRect !== 'function') return false;
    var r = el.getBoundingClientRect();
    if (!r || r.width <= 0 || r.height <= 0) return false;
    if (el.hidden || (el.getAttribute && el.getAttribute('aria-hidden') === 'true')) return false;
    var cs = window.getComputedStyle ? window.getComputedStyle(el) : null;
    if (cs && (cs.display === 'none' || cs.visibility === 'hidden')) return false;
    return true;
  }
  function hitLabel(el, labels, exact) {
    var t = norm(el.textContent);
    var aria = norm(el.getAttribute ? el.getAttribute('aria-label') : '');
    for (var i = 0; i < labels.length; i++) {
      var L = labels[i];
      if (t.length <= 300) {
        if (t === L) return L;
        if (!exact && t.indexOf(L) === 0 && !/[0-9A-Za-z가-힣]/.test(t.charAt(L.length))) return L;
      }
      if (!exact && L.length >= 2 && aria.indexOf(L) >= 0) return L;
    }
    return null;
  }
  function interactive(el) {
    var tag = String(el.tagName || '').toUpperCase();
    var role = el.getAttribute ? String(el.getAttribute('role') || '') : '';
    return tag === 'BUTTON' || tag === 'A' || /^(button|link|menuitem|option)$/.test(role);
  }
  function nearInteractive(el) {
    var p = el;
    for (var i = 0; i < 4 && p; i++) { if (interactive(p)) return true; p = p.parentElement; }
    return false;
  }
  function matchAll(labels, exact) {
    var root = document.body;
    if (!root) return [];
    var nodes = root.querySelectorAll('*');
    var hits = [];
    for (var i = 0; i < nodes.length; i++) {
      var el = nodes[i];
      if (visible(el) && hitLabel(el, labels, exact)) hits.push(el);
    }
    var out = [];
    for (var j = 0; j < hits.length; j++) {
      var nested = false;
      for (var k = 0; k < hits.length; k++) { if (k !== j && hits[j].contains(hits[k])) { nested = true; break; } }
      if (!nested) out.push(hits[j]);
    }
    return out;
  }
  function findByText(labels, exact) {
    var list = matchAll(labels, exact);
    var best = null, bestI = 1, bestLen = 0;
    for (var i = 0; i < list.length; i++) {
      var pri = nearInteractive(list[i]) ? 0 : 1;
      var len = norm(list[i].textContent).length;
      if (best === null || pri < bestI || (pri === bestI && len < bestLen)) { best = list[i]; bestI = pri; bestLen = len; }
    }
    return best;
  }
  function fire(el) {
    var r = el.getBoundingClientRect ? el.getBoundingClientRect() : { left: 0, top: 0, width: 0, height: 0 };
    var o = { bubbles: true, cancelable: true, view: window, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, button: 0 };
    if (window.PointerEvent) el.dispatchEvent(new PointerEvent('pointerdown', o));
    el.dispatchEvent(new MouseEvent('mousedown', o));
    if (window.PointerEvent) el.dispatchEvent(new PointerEvent('pointerup', o));
    el.dispatchEvent(new MouseEvent('mouseup', o));
    el.dispatchEvent(new MouseEvent('click', o));
  }
  function clickEl(el) {
    if (!el) return false;
    if (forbidden(norm(el.textContent))) return false;
    try { if (el.scrollIntoView) el.scrollIntoView({ block: 'center' }); } catch (e) {}
    try { fire(el); } catch (e) {
      try { el.click(); } catch (e2) { return false; }
    }
    return true;
  }
  function clickByText(labels) {
    for (var i = 0; i < labels.length; i++) { if (forbidden(labels[i])) return false; }
    return clickEl(findByText(labels, true));
  }
  function clickNth(labels, index) {
    for (var i = 0; i < labels.length; i++) { if (forbidden(labels[i])) return false; }
    return clickEl(matchAll(labels, false)[index] || null);
  }
  function waitStable(ms, max) {
    ms = ms || 800; max = max || 8000;
    return new Promise(function (resolve) {
      var start = Date.now(), last = text().length, lastAt = start;
      (function poll() {
        var now = Date.now(), len = text().length;
        if (len !== last) { last = len; lastAt = now; }
        // 글자가 하나도 없는 채로 멈춘 것은 안정이 아니다 — 늦게 그려지는 화면(컬리 · 무신사)은 max 까지 기다린다(10-28 22:09 구조 기록: 첫 읽기가 빈 화면)
        if ((now - lastAt >= ms && len > 0) || now - start >= max) { resolve(true); return; }
        setTimeout(poll, 200);
      })();
    });
  }
  function tokenValue(m, p) {
    if (p.group2 !== undefined) return String(m[p.group] || '') + '|' + String(m[p.group2] || '');
    return m[p.group] || m[0];
  }
  function collectTokens(patterns) {
    var parts = [];
    var as = document.querySelectorAll('a[href]');
    for (var i = 0; i < as.length && i < 5000; i++) parts.push(String(as[i].href || as[i].getAttribute('href') || ''));
    var ss = document.querySelectorAll('script');
    for (var j = 0; j < ss.length; j++) {
      var tx = String(ss[j].textContent || '');
      if (tx.length > 3000000) continue;
      if (ss[j].type === 'application/json' || /__NEXT_DATA__|__APOLLO_STATE__|__PRELOADED_STATE__/.test(tx)) parts.push(tx);
    }
    var joined = parts.join('\n');
    var out = [], seen = {};
    function add(t) { if (!seen[t] && out.length < 2000) { seen[t] = true; out.push(t); } }
    (window.__ytTokens || []).forEach(add);
    for (var k = 0; k < patterns.length; k++) {
      var p = patterns[k];
      var re = new RegExp(p.source, 'g');
      var m, n = 0;
      while ((m = re.exec(joined)) !== null && n < 2000) { n++; add(p.name + ':' + tokenValue(m, p)); }
    }
    return out;
  }
  function hasMore() { return matchAll(['더보기'], false).length > 0 || matchAll(['다음'], true).length > 0; }
  function signals() {
    var t = text();
    function n(re) { var m = t.match(re); return m ? m.length : 0; }
    return {
      host: location.host,
      path: location.pathname.replace(/\d{6,}/g, '#'),
      textLen: t.length,
      orderNos: n(/(?:^|\D)\d{16}(?!\d)/g),
      orderCards: n(/\d{1,2}\.\s*\d{1,2}\.\s*\d{1,2}:\d{2}\s*주문/g),
      amounts: n(/\d[\d,]*원/g),
      login: /로그인|아이디|비밀번호/.test(t),
      cardBtns: matchAll(['카드영수증'], false).length,
      purchaseBtns: matchAll(['구매영수증'], false).length,
      receiptMenu: matchAll(['영수증조회'], false).length,
      moreBtns: matchAll(MORE, false).length,
      keywords: {
        사업자: /사업자/.test(t),
        승인번호: /승인\s*번호/.test(t),
        일시: /(결제|거래|승인)\s*일시/.test(t),
        금액: /합\s*계|금\s*액/.test(t),
        카드사: /카드사/.test(t)
      }
    };
  }
  /* 컬리 매출전표처럼 화면 글자가 아니라 스크립트 var data = [...] 에 데이터가 있는 페이지 — 그 스크립트만 덧붙인다(없으면 빈 글자) */
  function dataScript() {
    var ss = document.scripts || [];
    for (var i = 0; i < ss.length; i++) {
      var c = String(ss[i].text || '');
      if (/\bvar\s+data\s*=\s*\[/.test(c)) return '\n' + (c.length > 100000 ? c.slice(0, 100000) : c);
    }
    return '';
  }
  window.__yt = {
    text: text, dataScript: dataScript, waitStable: waitStable, findByText: findByText, clickByText: clickByText,
    clickNth: clickNth, signals: signals, collectTokens: collectTokens, hasMore: hasMore
  };
})()`;
const RUNNER_JS = String.raw `(function (a) {
  var Y = window.__yt;
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  Y.waitStable(800, 8000).then(function () {
    if (a.kind === 'read') {
      post({ type: 'nav', step: 'read', url: (location.host + location.pathname).replace(/\d{6,}/g, '#'), text: Y.text() + Y.dataScript(), signals: Y.signals() });
      return;
    }
    if (a.kind === 'tokens') {
      post({ type: 'nav', step: 'tokens', tokens: Y.collectTokens(a.patterns), hasMore: Y.hasMore() });
      return;
    }
    var ok = a.kind === 'clickNth' ? Y.clickNth(a.labels, a.index) : Y.clickByText(a.labels);
    post({ type: 'nav', step: 'clicked', ok: !!ok, label: a.labels[0], index: a.index });
  }).catch(function (e) { post({ type: 'nav', step: 'error', message: String(e && e.name || 'Error').slice(0, 40) }); });
})`;
const INTERCEPT_JS = String.raw `(function (pats) {
  var store = window.__ytTokens = window.__ytTokens || [];
  var seen = {};
  function tokenValue(m, p) {
    if (p.group2 !== undefined) return String(m[p.group] || '') + '|' + String(m[p.group2] || '');
    return m[p.group] || m[0];
  }
  function scan(text) {
    if (typeof text !== 'string' || !text) return;
    for (var i = 0; i < pats.length; i++) {
      var p = pats[i];
      var re = new RegExp(p.source, 'g');
      var m, n = 0;
      while ((m = re.exec(text)) !== null && n < 200) {
        n++;
        var tok = p.name + ':' + tokenValue(m, p);
        if (!seen[tok] && store.length < 500) { seen[tok] = true; store.push(tok); }
      }
    }
  }
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function () {
      var p = origFetch.apply(this, arguments);
      p.then(function (res) {
        try { res.clone().text().then(scan, function () {}); } catch (e) {}
      }, function () {});
      return p;
    };
  }
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var send = XHR.prototype.send;
    XHR.prototype.send = function () {
      var self = this;
      this.addEventListener('load', function () {
        try { if (typeof self.responseText === 'string') scan(self.responseText); } catch (e) {}
      });
      return send.apply(this, arguments);
    };
  }
})`;
/** 가로채기 스크립트(injectedJavaScriptBeforeContentLoaded). 응답은 그대로 통과시키고 토큰만 window.__ytTokens 에 쌓는다 */
function interceptScript(patterns) {
    return `${INTERCEPT_JS}(${JSON.stringify(patterns)});true;`;
}
exports.NAV_INTERCEPT_SCRIPT = interceptScript(exports.NAVER_TOKEN_PATTERNS);
/** 웹뷰 안 글자 찾기 · 누르기 · 본문 읽기 도구. 이 자체는 아무것도 보내지 않는다 */
exports.NAV_HELPERS_SCRIPT = `${HELPERS_JS};true;`;
/** 페이지가 스스로 부르는 목록 주소의 경로. 가로채기 스크립트가 이 경로에 맞는 주소를 window.__ytApi[name] 에 둔다(페이지 메모리 안) */
exports.API_ROUTES = {
    shop: String.raw `\/my\/order\/api\/npay\/order-histories`,
    pay: String.raw `\/web-api\/timeline\/v1\/payments\/nvMids`,
};
exports.SHOP_BLOCK_SELECTOR = 'div[class*="OrderPro"]';
exports.PAY_BLOCK_SELECTOR = 'ul > li[class*="PaymentI"]';
const BLOCK_CHARS = 600;
const asObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) ? v : {};
const prim = (v) => (typeof v === 'string' || typeof v === 'number' ? v : undefined);
const clip = (v, max) => {
    if (typeof v !== 'string')
        return undefined;
    const t = v.replace(/\s+/g, ' ').trim();
    return t ? t.slice(0, max) : undefined;
};
const digitsOf = (v, min, max) => {
    const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
    return new RegExp('^\\d{' + min + ',' + max + '}$').test(s) ? s : undefined;
};
/** 주문 시각 → 'YYYY-MM-DD HH:mm:ss'(KST). 숫자(초·밀리초), 「2026.10.20. 10:04:43」, 「2026-10-20 10:04:43」, 존 있는 ISO 를 받는다. 못 읽으면 null */
function normalizeKst(v) {
    let ms;
    if (typeof v === 'number' && Number.isFinite(v)) {
        ms = v > 1e11 ? v : v * 1000;
    }
    else if (typeof v === 'string') {
        const s = v.trim();
        const m = /^(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
        if (m)
            return toStamp(m[1], m[2], m[3], m[4], m[5], m[6] ?? '00');
        const compact = /^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})$/.exec(s); // 「20261020100443」
        if (compact)
            return toStamp(compact[1], compact[2], compact[3], compact[4], compact[5], compact[6]);
        if (/^\d{10,13}$/.test(s)) {
            const n = Number(s);
            ms = n > 1e11 ? n : n * 1000;
        }
        else {
            const noZone = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/.test(s);
            ms = Date.parse(noZone ? `${s.replace(' ', 'T').replace(/\.\d+$/, '')}+09:00` : s);
        }
    }
    else {
        return null;
    }
    if (!Number.isFinite(ms))
        return null;
    return new Date(ms + 9 * 3600000).toISOString().slice(0, 19).replace('T', ' ');
}
const listKeyOf = (orderedAt, amount) => `${orderedAt.slice(0, 16)}|${amount}`;
const intAmount = (v) => {
    if (typeof v === 'number')
        return Number.isInteger(v) && v >= 1 && v <= 1e9 ? v : undefined;
    if (typeof v === 'string')
        return parseAmount(v.replace(/원$/, '').trim());
    return undefined;
};
/** 목록에서 본 주문 — 영수증으로 보강 전이라 needsReceipt, orderNo 는 모를 수 있다(빈 문자열) */
function listOrder(f) {
    const out = {
        orderNo: f.orderNo ?? '',
        orderedAt: f.orderedAt,
        amount: f.amount,
        payment: '카드',
        kind: 'list',
        needsReceipt: true,
        listKey: listKeyOf(f.orderedAt, f.amount),
    };
    if (f.title)
        out.title = f.title;
    if (f.seller)
        out.seller = f.seller;
    if (f.productOrderNo)
        out.productOrderNo = f.productOrderNo;
    if (f.pay)
        out.pay = f.pay;
    return out;
}
/** 영수증 요청 주소에 들어가는 주문 상품 번호 — 「PD」로 시작해도 된다(대표님 23:23 B형 요청 형식). 모양이 틀리면 없음 */
const productOrderNoOf = (v) => {
    const s = typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
    return /^(PD)?\d{8,24}$/.test(s) ? s : undefined;
};
/** 목록 스크립트가 항목에서 모은 결제 짝(tid · payId · paymentId). tid 와 payId 또는 paymentId 가 모두 있어야 한다 */
const payOf = (v) => {
    const r = asObj(v);
    const tid = digitsOf(r.tid, 18, 22);
    const payId = digitsOf(r.payId, 18, 22);
    const paymentId = typeof r.paymentId === 'string' && /^\d{8}NP\d{6,14}$/.test(r.paymentId) ? r.paymentId : undefined;
    if (!tid || (!payId && !paymentId))
        return undefined;
    return { tid, ...(payId ? { payId } : {}), ...(paymentId ? { paymentId } : {}) };
};
/** 쇼핑 주문내역 API 의 contents[] 한 칸(허용 필드만 쓴다). 주문번호 · 시각 · 금액이 없으면 null */
function shopItemToOrder(x) {
    const r = asObj(x);
    const orderNo = digitsOf(r.orderNo, 8, 20);
    const orderedAt = normalizeKst(prim(r.orderDateTime));
    const amount = intAmount(r.productAmount);
    if (!orderNo || !orderedAt || amount === undefined)
        return null;
    return listOrder({
        orderNo,
        orderedAt,
        amount,
        title: clip(r.productName, 80),
        seller: clip(r.merchantName, 80),
        productOrderNo: productOrderNoOf(r.productOrderNo),
        pay: payOf(r.pay),
    });
}
/** 쇼핑 주문 목록의 상품 한 칸이 취소 · 반품인가 — 키 이름에 status 가 든 칸의 값(CANCEL · RETURN · 취소 · 반품). 대표님 11-02 「취소 주문 불러오지 않음」 */
function shopItemCancelled(x) {
    const r = asObj(x);
    return Object.keys(r).some((k) => /status/i.test(k) && typeof r[k] === 'string' && /CANCEL|RETURN|REFUND|취소|반품|환불/i.test(r[k]));
}
/** 네이버페이 결제내역 API 의 nvMids[] 한 칸. 주문번호는 없을 수 있다(영수증으로 찾는다) */
function payItemToOrder(x) {
    const r = asObj(x);
    const orderedAt = normalizeKst(prim(r.time));
    const amount = intAmount(r.productAmount);
    if (!orderedAt || amount === undefined)
        return null;
    return listOrder({ orderedAt, amount });
}
/** 쇼핑 API 응답 전체. contents 가 배열이 아니면 null(모르는 모양), 배열이면 읽은 것만 */
function parseOrderHistories(json) {
    const arr = asObj(json).contents;
    if (!Array.isArray(arr))
        return null;
    return arr.map(shopItemToOrder).filter((o) => o !== null);
}
/** 네이버페이 결제내역 API 응답 전체. nvMids 가 배열이 아니면 null */
function parseNvMids(json) {
    const arr = asObj(json).nvMids;
    if (!Array.isArray(arr))
        return null;
    return arr.map(payItemToOrder).filter((o) => o !== null);
}
/* 블록 글자(대체 방식): 카드 하나의 innerText 를 따로 읽는다 */
const SHOP_CARD_RE = /(\d{1,2})\.(\d{1,2})\.\s*(\d{1,2}):(\d{2})\s*주문/;
/** 결제 카드의 날짜: 연도 없는 「10. 20. 10:04」(앞에 숫자·점이 없을 때만) 또는 「2026.10.20 10:04」. 줄바꿈 · 파이프가 끼어도 된다 */
const PAY_DATE_RE = /(?:^|[^\d.])(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/;
const PAY_DATE_YEARED_RE = /(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\s*(\d{1,2}):(\d{2})/;
/** 「882원 적립 완료」 는 결제 금액이 아니다 — 적립 글자 앞의 금액은 쓰지 않는다 */
const AMOUNT_NOT_POINT_RE = /([\d,]+)원(?!\s*적립)/;
const CARD_SKIP_RE = /취소완료|반품완료|환불완료|교환완료/;
const STATUS_ONLY_RE = /^(구매확정완료|결제완료|배송완료|배송중|배송준비중|주문접수|구매확정)$/;
const BUTTON_RE = /^(상세보기|판매자정보|문의|장바구니|리뷰|배송조회|주문상세|영수증조회|바로 구매하기|톡톡하기|1:1문의|N ?pay)/i;
/** 영수증 보기 화면의 가게 · 상품 글자(화면 그대로): 「주문번호」 줄 다음부터 금액 줄 전까지, 버튼 · 안내를 뺀 첫 두 줄 */
function pickIssueTitle(text) {
    const lines = norm(text).split('\n').map((l) => l.replace(/\s+/g, ' ').trim());
    const start = lines.findIndex((l) => l.startsWith('주문번호'));
    if (start < 0)
        return undefined;
    const picked = [];
    for (let i = start + 1; i < lines.length && picked.length < 2; i++) {
        const l = lines[i];
        if (/\d[\d,]*원/.test(l))
            break;
        if (!l || l.length > 60 || !/[가-힣A-Za-z]/.test(l))
            continue;
        if (UI_WORD_RE.test(l) || STATUS_ONLY_RE.test(l) || BUTTON_RE.test(l) || /^\d/.test(l))
            continue;
        picked.push(l);
    }
    return picked.length > 0 ? picked.join(' · ').slice(0, 80) : undefined;
}
/** 카드 안의 화면 글자(버튼 · 상태 · 안내): 제목 후보에서 뺀다 */
const UI_WORD_RE = /자세히|더보기|영수증|적립|상세|리뷰|재구매|장바구니|배송조회|톡톡|문의|결제|주문/;
/** 연도 없는 「M.D. HH:mm」 → 올해(KST). 오늘보다 뒤면 작년 */
function yearlessStamp(mo, d, h, mi, nowMs) {
    const nowDate = new Date(nowMs + 9 * 3600000).toISOString().slice(0, 10);
    const y = Number(nowDate.slice(0, 4));
    let at = toStamp(String(y), mo, d, h, mi);
    if (at && at.slice(0, 10) > nowDate)
        at = toStamp(String(y - 1), mo, d, h, mi);
    return at;
}
/** 카드 글자에서 상품명: 상태 · 날짜 · 금액 · 버튼 글자를 건너뛰고 첫 한글·영문 줄 */
function pickTitle(text) {
    for (const raw of text.split('\n')) {
        const l = raw.replace(/\s+/g, ' ').trim();
        if (!l || l.length > 80 || !/[가-힣A-Za-z]/.test(l))
            continue;
        if (STATUS_ONLY_RE.test(l) || BUTTON_RE.test(l) || UI_WORD_RE.test(l))
            continue;
        if (/\d[\d,]*원/.test(l) || /\d{1,2}\.\s*\d{1,2}\.?\s*\d{1,2}:\d{2}/.test(l))
            continue;
        if (/^\d{1,2}\s*[\/.]\s*\d{1,2}/.test(l))
            continue;
        return l;
    }
    return undefined;
}
/** 쇼핑 주문 카드 한 장 → 목록 주문. 취소 · 반품 · 날짜 · 금액이 없으면 null */
function parseShopCard(raw, nowMs = Date.now()) {
    const text = norm(raw.slice(0, BLOCK_CHARS));
    if (CARD_SKIP_RE.test(text))
        return null;
    const m = SHOP_CARD_RE.exec(text);
    const amount = parseAmount(pick(text, AMOUNT_NOT_POINT_RE));
    if (!m || amount === undefined)
        return null;
    const orderedAt = yearlessStamp(m[1], m[2], m[3], m[4], nowMs);
    if (!orderedAt)
        return null;
    return listOrder({ orderedAt, amount, title: pickTitle(text) });
}
/** 결제 카드 한 장 → 목록 주문. 「5,000원 | 10. 20. 10:04 결제」 의 금액(적립 금액 아님) */
function parsePayCard(raw, nowMs = Date.now()) {
    const lines = norm(raw.slice(0, BLOCK_CHARS));
    const text = lines.replace(/\s+/g, ' ');
    if (CARD_SKIP_RE.test(text))
        return null;
    const amount = parseAmount(pick(text, AMOUNT_NOT_POINT_RE));
    if (amount === undefined)
        return null;
    const y = PAY_DATE_YEARED_RE.exec(text);
    const orderedAt = y
        ? toStamp(y[1], y[2], y[3], y[4], y[5])
        : (() => { const m = PAY_DATE_RE.exec(text); return m ? yearlessStamp(m[1], m[2], m[3], m[4], nowMs) : null; })();
    if (!orderedAt)
        return null;
    return listOrder({ orderedAt, amount, title: pickTitle(lines) });
}
function extractShopBlocks(texts, nowMs = Date.now()) {
    const out = [];
    texts.forEach((t, index) => {
        const order = parseShopCard(String(t), nowMs);
        if (order)
            out.push({ index, order });
    });
    return out;
}
function extractPayBlocks(texts, nowMs = Date.now()) {
    const out = [];
    texts.forEach((t, index) => {
        const order = parsePayCard(String(t), nowMs);
        if (order)
            out.push({ index, order });
    });
    return out;
}
/** 블록 글자 스크립트: 선택자별 카드 innerText 를 600자씩 모아 {step:'blocks'} 로 보낸다. 누르지 않는다 */
function blockTextsScript(selectors, shape = false, hrefs = false) {
    if (selectors.length < 1 || selectors.length > 4)
        throw new Error('bad selectors');
    const safe = selectors.map((s) => {
        if (typeof s !== 'string' || s.length > 80 || !/^[A-Za-z0-9_\-\[\]\*="' >.]+$/.test(s))
            throw new Error('bad selector');
        return s;
    });
    return String.raw `(function (sels, withShape, withHrefs) {
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  /* 구조 요약: 첫 카드 안 요소의 종류 개수만(글자 · 값 · 클래스 이름 없음) */
  function cardSummary(sel) {
    var first = document.querySelector(sel);
    if (!first) return 'cs-none';
    var els = first.querySelectorAll('*');
    var n = Math.min(els.length, 40);
    var c = { btn: 0, a: 0, svg: 0, img: 0, role: 0, alab: 0, click: 0, empty: 0, onc: 0 };
    for (var i = 0; i < n; i++) {
      var e = els[i];
      var tag = String(e.tagName || '').toUpperCase();
      var role = e.getAttribute ? e.getAttribute('role') : null;
      var onc = e.getAttribute ? e.getAttribute('onclick') : null;
      if (tag === 'BUTTON') c.btn++;
      if (tag === 'A') c.a++;
      if (tag === 'SVG') c.svg++;
      if (tag === 'IMG') c.img++;
      if (role) c.role++;
      if (e.getAttribute && e.getAttribute('aria-label')) c.alab++;
      if (onc) c.onc++;
      if (tag === 'BUTTON' || tag === 'A' || role === 'button' || onc) c.click++;
      if (!String(e.textContent || '').trim()) c.empty++;
    }
    return 'cs-n' + n + 'b' + c.btn + 'a' + c.a + 's' + c.svg + 'i' + c.img + 'r' + c.role + 'l' + c.alab + 'k' + c.click + 'e' + c.empty + 'o' + c.onc;
  }
  /* 구조 요약: __NEXT_DATA__ 의 키 이름 개수(깊이 3까지, 최대 60)와 찾는 이름의 있음/없음만 */
  function ndSummary() {
    var el = document.getElementById ? document.getElementById('__NEXT_DATA__') : null;
    if (!el) return 'nd-none';
    var j = null;
    try { j = JSON.parse(String(el.textContent || '')); } catch (e) { return 'nd-bad'; }
    var names = [];
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 3) return;
      Object.keys(o).forEach(function (k) { if (names.length < 60) { names.push(k); walk(o[k], d + 1); } });
    })(j, 1);
    var lower = names.map(function (n) { return n.toLowerCase(); });
    var want = ['paymentid', 'tid', 'orderno', 'productorderno', 'nvmid', 'payment'];
    var flags = want.map(function (k) { return lower.indexOf(k) >= 0 ? '1' : '0'; }).join('');
    return 'nd-k' + names.length + '-' + flags;
  }
  function run() {
    var out = [];
    for (var i = 0; i < sels.length; i++) {
      var nodes = document.querySelectorAll(sels[i]);
      for (var j = 0; j < nodes.length && out.length < 200; j++) {
        var el = nodes[j];
        if (el.querySelector && el.querySelector(sels[i])) continue;
        var t = String(el.innerText || '');
        if (t.trim()) out.push(t.slice(0, 600));
      }
    }
    if (withShape) { out.push('' + cardSummary(sels[0])); out.push('' + ndSummary()); }
    if (withHrefs) {
      var links = document.querySelectorAll('a[href*="order/status/"]');
      for (var k = 0; k < links.length && k < 200; k++) {
        var href = String(links[k].href || links[k].getAttribute('href') || '');
        var hm = /order\/status\/(\d{16})/.exec(href);
        if (hm) out.push('ho-' + hm[1]);
      }
    }
    post({ type: 'nav', step: 'blocks', blocks: out });
  }
  var Y = window.__yt;
  if (Y && Y.waitStable) Y.waitStable(800, 8000).then(run); else run();
})(${JSON.stringify(safe)}, ${shape ? 'true' : 'false'}, ${hrefs ? 'true' : 'false'});true;`;
}
/** 가로채기(API 주소 학습): 페이지가 부르는 목록 주소만 window.__ytApi 에 둔다. 응답 본문은 읽지도 보내지도 않는다 */
exports.NAV_API_INTERCEPT_SCRIPT = String.raw `(function (routes) {
  var store = window.__ytApi = window.__ytApi || {};
  function learn(u) {
    if (typeof u !== 'string' || u.length === 0 || u.length > 2000) return;
    for (var i = 0; i < routes.length; i++) {
      if (new RegExp(routes[i].source).test(u)) store[routes[i].name] = u;
    }
  }
  var origFetch = window.fetch;
  if (typeof origFetch === 'function') {
    window.fetch = function (input) {
      try { learn(typeof input === 'string' ? input : (input && input.url) || ''); } catch (e) {}
      return origFetch.apply(this, arguments);
    };
  }
  var XHR = window.XMLHttpRequest;
  if (XHR && XHR.prototype) {
    var open = XHR.prototype.open;
    XHR.prototype.open = function (method, url) {
      try { learn(String(url || '')); } catch (e) {}
      return open.apply(this, arguments);
    };
  }
})(${JSON.stringify(Object.entries(exports.API_ROUTES).map(([name, source]) => ({ name, source })))});true;`;
/**
 * API 읽기 스크립트: 가로챈 같은 출처 주소로 페이지를 넘기며 호출한다(동일 호스트만, credentials 포함).
 * 페이지 키(page·pageNo·pageNumber, 없으면 offset), 크기 키(size·limit), 기간 키(start|from|begin · end|to)를 다룬다.
 * 기간을 1년으로 바꿔 먼저 시도하고, 오류 · 빈 첫 쪽이면 원래 주소로 되돌려 다시 한다.
 * 끝나면 허용 필드만 모아 {step:'api', name, items, page, done} 한 번 보낸다. 실패는 {failed:true}.
 */
function apiReadScript(a) {
    return String.raw `(function (a) {
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  function fail(note) { post({ type: 'nav', step: 'api', name: a.name, items: [], page: 0, done: true, failed: true, note: note }); }
  var raw = (window.__ytApi || {})[a.name];
  // 쇼핑 주문 목록은 페이지가 먼저 부른 주소를 못 배웠어도 같은 출처의 알려진 주소로 page=1 부터 직접 부른다(대표님 23:12 개발자 도구 확인: GET /my/order/api/npay/order-histories?page=N)
  if (!raw && a.name === 'shop' && location.host === 'shopping.naver.com') raw = 'https://' + location.host + '/my/order/api/npay/order-histories?page=1';
  if (!raw) { fail('no_url'); return; }
  var base;
  try { base = new URL(raw, location.href); } catch (e) { fail('bad_url'); return; }
  if (base.host !== location.host) { fail('other_host'); return; }
  var keys = [];
  base.searchParams.forEach(function (v, k) { keys.push(k); });
  var PAGE_KEYS = ['page', 'pageNo', 'pageNumber'];
  var pageKey = null;
  for (var i = 0; i < PAGE_KEYS.length; i++) { if (keys.indexOf(PAGE_KEYS[i]) >= 0) { pageKey = PAGE_KEYS[i]; break; } }
  var offsetKey = pageKey === null && keys.indexOf('offset') >= 0 ? 'offset' : null;
  var size = parseInt(base.searchParams.get('size') || base.searchParams.get('limit') || '20', 10) || 20;
  var startPage = parseInt(base.searchParams.get(pageKey || 'page') || '1', 10) || 1;
  function isStartKey(k) { return k !== pageKey && /^(start|from|begin)/i.test(k); }
  function isEndKey(k) { return /^(end|to)(date|day|ymd)?$/i.test(k); }
  function fmt(orig, ymd) { return /^\d{8}$/.test(orig || '') ? ymd.replace(/-/g, '') : ymd; }
  function build(p, override) {
    var u = new URL(base.href);
    if (pageKey) u.searchParams.set(pageKey, String(p));
    if (offsetKey) u.searchParams.set(offsetKey, String((p - startPage) * size));
    if (override) keys.forEach(function (k) {
      var orig = base.searchParams.get(k) || '';
      if (isStartKey(k)) u.searchParams.set(k, fmt(orig, a.since));
      else if (isEndKey(k)) u.searchParams.set(k, fmt(orig, a.until));
    });
    return u.href;
  }
  function tm(v) {
    if (typeof v === 'number') return v > 1e11 ? v : v * 1000;
    if (typeof v !== 'string') return NaN;
    var s = v.trim();
    var m = /^(\d{4})[.\-\/]\s*(\d{1,2})[.\-\/]\s*(\d{1,2})\.?\s+(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(s);
    if (m) return Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 9, +m[5], +(m[6] || 0));
    return Date.parse(s);
  }
  function prim(v) { return typeof v === 'string' || typeof v === 'number' ? v : undefined; }
  function str(v, max) { return typeof v === 'string' ? v.slice(0, max) : undefined; }
  function digs(v, lo, hi) {
    var s = typeof v === 'number' ? String(v) : (typeof v === 'string' ? v : '');
    return /^\d+$/.test(s) && s.length >= lo && s.length <= hi ? s : undefined;
  }
  /* 항목 안(깊이 5)에서 결제 짝만 찾는다: 대표님 원문 이름 그대로 tid · payId(22:29) · paymentId(NP, 23:20). 다른 이름은 읽지 않는다 */
  function pairOf(x) {
    var res = {};
    var n = 0;
    (function walk(o, d) {
      if (!o || typeof o !== 'object' || d > 5 || n > 400) return;
      n++;
      if (Array.isArray(o)) { for (var i = 0; i < o.length && i < 20; i++) walk(o[i], d + 1); return; }
      if (!res.tid) { var t = digs(o.tid, 18, 22); if (t) res.tid = t; }
      if (!res.payId) { var p = digs(o.payId, 18, 22); if (p) res.payId = p; }
      if (!res.paymentId && typeof o.paymentId === 'string' && /^\d{8}NP\d{6,14}$/.test(o.paymentId)) res.paymentId = o.paymentId;
      for (var k in o) { if (o[k] && typeof o[k] === 'object') walk(o[k], d + 1); }
    })(x, 0);
    return res.tid && (res.payId || res.paymentId) ? res : undefined;
  }
  function pick(j) {
    var arr = a.name === 'shop' ? (j && j.contents) : (j && j.nvMids);
    if (!Array.isArray(arr)) return null;
    var out = [];
    for (var i = 0; i < arr.length && i < 200; i++) {
      var x = arr[i] || {};
      if (a.name === 'shop') out.push({ orderNo: str(x.orderNo, 40) || prim(x.orderNo), productOrderNo: str(x.productOrderNo, 40) || prim(x.productOrderNo), orderDateTime: prim(x.orderDateTime), productName: str(x.productName, 120), productAmount: prim(x.productAmount), merchantName: str(x.merchantName, 80), pay: pairOf(x) });
      else out.push({ nvMid: str(x.nvMid, 40) || prim(x.nvMid), time: prim(x.time), productOrderStatusCode: str(x.productOrderStatusCode, 40), productAmount: prim(x.productAmount) });
    }
    return out;
  }
  function oldest(items) {
    var min = Infinity;
    items.forEach(function (it) { var t = tm(a.name === 'shop' ? it.orderDateTime : it.time); if (t === t && t < min) min = t; });
    return min;
  }
  var all = [];
  function get(url) {
    return fetch(url, { credentials: 'include', headers: { accept: 'application/json, text/plain, */*' } }).then(function (res) {
      if (!res.ok) throw new Error('http');
      return res.json();
    });
  }
  function run(p, override, retried) {
    return get(build(p, override)).then(function (j) {
      var items = pick(j);
      if (!items) throw new Error('shape');
      if (items.length === 0 && p === startPage) {
        if (override) return run(p, false, true);
        throw new Error('empty');
      }
      all = all.concat(items).slice(0, 600);
      var end = items.length === 0 || j.last === true || j.hasMore === false
        || (typeof j.totalPages === 'number' && p >= j.totalPages)
        || p - startPage + 1 >= a.maxPages || oldest(items) < a.sinceMs;
      if (end) return { page: p };
      return run(p + 1, override, retried);
    }, function (e) {
      if (override && !retried) return run(p, false, true);
      throw e;
    });
  }
  run(startPage, true, false).then(function (r) {
    post({ type: 'nav', step: 'api', name: a.name, items: all, page: r.page, done: true });
  }, function (e) { fail(String(e && e.message || 'error').slice(0, 20)); });
})(${JSON.stringify({ name: a.name, maxPages: a.maxPages, sinceMs: a.sinceMs, since: a.since, until: a.until })});true;`;
}
/** 열린 시트 닫기: Escape 키 이벤트만 보낸다 */
exports.ESCAPE_SCRIPT = String.raw `(function () {
  function post(o) { try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch (e) {} }
  try { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', keyCode: 27, bubbles: true })); } catch (e) {}
  post({ type: 'nav', step: 'clicked', ok: true, label: 'Escape', index: 0 });
})();true;`;
function checkAction(a) {
    if (a.kind === 'read')
        return a;
    if (a.kind === 'tokens') {
        if (!Array.isArray(a.patterns) || a.patterns.length > 20)
            throw new Error('bad tokens action');
        for (const p of a.patterns) {
            if (typeof p.name !== 'string' || typeof p.source !== 'string' || p.source.length > 300 || !Number.isInteger(p.group))
                throw new Error('bad pattern');
        }
        return a;
    }
    if (a.kind === 'blocks') {
        blockTextsScript(a.selectors, a.shape === true, a.hrefs === true);
        return a;
    }
    if (a.kind === 'escape')
        return a;
    if (a.kind === 'receipts') {
        (0, naverReceiptsScript_1.checkReceiptsRun)(a);
        return a;
    }
    if (a.kind === 'fetch') {
        (0, siteFetch_1.checkFetchRun)(a);
        return a;
    }
    if (a.kind === 'api') {
        if (!(a.name in exports.API_ROUTES) || !Number.isInteger(a.maxPages) || a.maxPages < 1 || a.maxPages > 40 || !Number.isFinite(a.sinceMs)
            || !/^\d{4}-\d{2}-\d{2}$/.test(a.since) || !/^\d{4}-\d{2}-\d{2}$/.test(a.until))
            throw new Error('bad api action');
        return a;
    }
    if (!Array.isArray(a.labels) || a.labels.length < 1 || a.labels.length > 5 || a.labels.some((l) => typeof l !== 'string' || l.length < 1 || l.length > 20)) {
        throw new Error('bad labels');
    }
    if (a.kind === 'clickNth' && !(Number.isInteger(a.index) && a.index >= 0 && a.index <= 99))
        throw new Error('bad index');
    if (a.prepare !== undefined && a.prepare !== 'neutralizeNewWindow')
        throw new Error('bad prepare');
    return a;
}
/**
 * 한 단계 실행 스크립트. prepare 가 있으면 새 창 막기 스크립트를 앞에 붙인다.
 * read → {step:'read'}, tokens → {step:'tokens'}, click → {step:'clicked'} 를 보낸다
 */
function navScript(action) {
    const checked = checkAction(action);
    if (checked.kind === 'blocks')
        return blockTextsScript(checked.selectors, checked.shape === true, checked.hrefs === true);
    if (checked.kind === 'api')
        return apiReadScript(checked);
    if (checked.kind === 'escape')
        return exports.ESCAPE_SCRIPT;
    if (checked.kind === 'fetch') {
        const { reqs, conc, staggerMs, gapMs, timeoutMs, deadlineMs } = checked;
        return (0, siteFetchScript_1.fetchScript)({ reqs, conc, staggerMs, gapMs, timeoutMs, deadlineMs });
    }
    // v2(새 네이버페이 수집 길, 서버 npv2)도 옮긴다 — 빠지면 스크립트가 옛 길로 돈다(10-29 16:23 rl15 실기록: page · miss 줄 0)
    if (checked.kind === 'receipts') {
        const { jobs, conc, staggerMs, gapMs, timeoutMs, deadlineMs, scan, skip, v2 } = checked;
        return (0, naverReceiptsScript_1.receiptsScript)({ jobs, conc, staggerMs, gapMs, timeoutMs, deadlineMs, ...(scan ? { scan } : {}), ...(skip ? { skip } : {}), ...(v2 === true ? { v2: true } : {}) });
    }
    const pre = 'prepare' in checked && checked.prepare === 'neutralizeNewWindow' ? `${navCommon_1.NEUTRALIZE_NEW_WINDOW_SCRIPT};` : '';
    return `${pre}${HELPERS_JS};${RUNNER_JS}(${JSON.stringify(checked)});true;`;
}
/** 토큰 모으기 스크립트(a[href] · 초기 상태 JSON · 가로챈 토큰만). 보내는 것은 토큰 목록과 더보기 유무뿐이다 */
function readTokensScript(patterns = exports.NAVER_TOKEN_PATTERNS) {
    return navScript({ kind: 'tokens', patterns: [...patterns] });
}
function pageShape(url, text) {
    return {
        url: url.split('?')[0].replace(/\d{6,}/g, '#').slice(0, 120),
        textLen: text.length,
        orderNos: countRe(text, /(?:^|\D)\d{16}(?!\d)/g),
        amounts: countRe(text, /\d[\d,]*원/g),
        orderCards: countOrderCards(text),
        receiptMenu: countLabel(text, '영수증조회'),
        cardReceiptBtns: countLabel(text, '카드영수증'),
        purchaseReceiptBtns: countLabel(text, '구매영수증'),
        login: /로그인|아이디|비밀번호/.test(text),
    };
}
