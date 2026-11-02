/**
 * 쿠팡 영수증 흐름(8차) — **요청만** 쓴다. 단추 누르기 · 영수증 화면 열기 · 못 찾으면 화면 방식으로 되돌아가기가 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 영수증 호스트(payment.coupang.com)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 영수증 주소를 **직접 열어**(goto) 화면 글자를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)과 naverApiFlow 의 틀을 따른다. 호스트는 숨은 웹뷰에서 동작을 실행한다.
 *
 *  1) https://mc.coupang.com/ssr/mobile/order/search-by-month 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번, 대표님 23:44:29 주소)
 *  2) find-over API를 size=10 · pageIndex=0부터 호출하고 hasNext · nextPageIndex 로 넘긴다. orderList 는 이름으로 읽는다(findCoupangOrders)
 *  3) 최신 주문부터 FETCH_BATCH 건씩 GET https://payment.coupang.com/v2/card-receipt/view?orderId=…&vendorIds=…&cancel=false (대표님 23:45:08) 를 몇 건씩 병렬로 부른다
 *  4) 영수증 응답은 JSON 이면 이름으로, 글자(HTML)면 naverReceipt.extractSlip 으로 읽는다. 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알린다
 *  5) 응답의 키 구조(값 없음)를 structure 로 남긴다 — 이름으로 찾은 칸이 틀렸을 때 다음에 고칠 수 있게(같은 모양은 한 번만)
 * 이미 서버에 있는 주문(start.known)은 건너뛰고, onlyKeys 가 있으면 그 줄들만 가져온다. 막히면(403 · 429) 한 번에 2건 · 하나씩으로 늦추고 연달아 세 번 막히면 끝낸다.
 * 영수증 요청이 모두 net 으로만 돌아오면(교차 출처 거절 의심) 끝난 까닭 「cross-origin」으로 끝낸다 — 줄에 「인터넷이 불안정해요」를 붙이지 않는다.
 *
 * 이름으로 찾는 규칙(응답 모양을 모르니 가정이다 — 코드 위치 findCoupangOrders · readReceiptJson):
 *  - 주문: 키 이름이 orderId · orderNo · orderNumber · orderSeq 같고 값이 10~16자리 숫자인 객체(바깥쪽 것 하나). 날짜 머리글 객체(date · orderDate 같은 키)는 아래 주문이 이어받는다
 *  - 주문 일시: order*At · order*Date · date · createdAt 같은 키(에포크 · ISO · 「2026.10.06」). 날짜만 있으면 00:00:00 을 자리표시로 쓴다
 *  - 금액: totalPayAmount · payAmount · paymentAmount · orderAmount · totalPrice · amount · price 순(숫자 · 「12,300원」)
 *  - 판매자번호(vendorIds): vendor 가 든 키 아래의 「A + 7~10자리 숫자」 값(대표님 23:45:08 의 vendorIds 모양)
 *  - 취소: cancel 이 든 키가 true · 상태 글자에 「취소」
 */
import {
  extractSlip, isLoginPage, listOrder, LOOKBACK_DAYS, normalizeKst, pageShape, toImportOrder,
  type FlowEvent, type FlowOut, type FlowStats, type NaverFlow, type ReceiptOrder, type Slip,
} from './naverReceipt';
import { latestKnownDay, tailOf, type ApiFlowOptions } from './naverApiFlow';
import { pathsMatching, structureLines } from './shapeLines';
import { outcomeKey, type FailCode, type Outcome, type OutcomeEvent } from './runOutcome';
import { FETCH_BATCH, FETCH_CONC, FETCH_DEADLINE_MS, FETCH_SLOW, FETCH_STAGGER_MS, FETCH_TIMEOUT_MS, type FetchReq, type FetchResult } from './siteFetch';
import type { ReceiptDetail } from './model';

export const COUPANG_LIST_URL = 'https://mc.coupang.com/ssr/mobile/order/search-by-month';
export const COUPANG_LIST_API = 'https://mc.coupang.com/ssr/api/myorders/model/find-over';
export const COUPANG_RECEIPT_URL = 'https://payment.coupang.com/v2/card-receipt/view';
export const coupangListUrl = (startDate: string, endDate: string, year: string): string => `${COUPANG_LIST_URL}?keyword=&year=${year}&month=0&periodType=directInput&startDate=${startDate}&endDate=${endDate}&sourceType=MyCoupang_my_orders_list&filtered=true`;
export const coupangFindOverUrl = (startDate: string, endDate: string, pageIndex: number): string => `${COUPANG_LIST_API}?keyword=&startDate=${startDate}&endDate=${endDate}&size=10&pageIndex=${pageIndex}`;
/** 주문 목록을 이어 받는 최대 쪽 수 */
export const COUPANG_MAX_PAGES = 40;

const DAY_MS = 86_400_000;
const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const hostOf = (url: string): string => url.split('/')[0].toLowerCase();
const pad = (n: number): string => String(n).padStart(2, '0');

/** 목록 · 첫 화면 읽기를 다시 해 보는 횟수 · 한 주문에 막힘 · 요청 실패를 다시 해 보는 횟수(처음 포함) · 연달아 막힘 · 시간 초과 한도 */
const MAX_LIST_TRIES = 3;
const MAX_JOB_TRIES = 2;
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;
/** 성공이 하나도 없는 채로 영수증 묶음이 연달아 이만큼 net 으로만 오면 교차 출처 거절로 본다 */
const MAX_ALL_NET_RUN = 2;

/* ------------------------------------------------------------------ 목록 읽기(이름으로 찾기) */

export type CoupangListOrder = {
  orderId: string;
  /** 'YYYY-MM-DD HH:mm:ss'(한국 시각). dateOnly 면 시각 00:00:00 은 자리표시다 */
  at: string;
  dateOnly: boolean;
  amount: number;
  seller?: string;
  title?: string;
  vendorIds: string[];
  cancelled: boolean;
};

const ORDER_ID_KEY = /^(order(Id|No|Number|Seq|Sn)?|ordNo|orderid)$/i;
const ORDER_ID_VALUE = /^\d{10,19}$/;   // 쿠팡 orderId 가 17자리 이상이면 /^\d{10,16}$/ 가 걸러내 0건이던 문제(대표님 10-30). parseBig 로 정밀하게 읽은 값을 그대로 받는다
const VENDOR_VALUE = /^[A-Z]\d{7,10}$/;
const DATE_KEYS: RegExp[] = [/^order(ed)?(At|Date|Time|Dt|Dttm)$/i, /^ordDt$/i, /^(created|regist(er|ered)?|reg)(At|Date)$/i, /^(order)?date(Str|Text)?$/i, /^(pay|paid)(At|Date|Time)$/i];
const GROUP_DATE_KEYS = /^(date|orderDate|orderedDate|dateStr|dateText|groupDate|headerDate)$/i;
const AMOUNT_KEYS: RegExp[] = [
  /^totalPayAmount$/i, /^payAmount$/i, /^(total)?paymentAmount$/i, /^(total)?orderAmount$/i, /^finalPrice$/i, /^totalPrice$/i, /^totalAmount$/i, /^amount$/i, /^price$/i,
  /^(pay|payment|total|order|final|charge).*(amount|price)$/i,
];
const SELLER_KEYS = /^(vendor(Item)?Name|sellerName|storeName|shopName|merchantName|brandName)$/i;
const TITLE_KEYS = /^(product(Name|Title)?|item(Name|Title)?|goodsName|vendorItemName|title)$/i;

const isObj = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v);

/** 값 → 한국 날짜. 「2026.10.06」 · 「2026-10-06」 처럼 날짜만 있으면 dateOnly. 에포크 · ISO · 시각 있는 글자는 normalizeKst */
export function parseListDate(v: unknown): { at: string; dateOnly: boolean } | null {
  if (typeof v === 'string') {
    const m = /^\s*(\d{4})[.\-/]\s*(\d{1,2})[.\-/]\s*(\d{1,2})\.?\s*(?:주문)?\s*$/.exec(v);
    if (m) {
      const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
      if (d.getUTCMonth() !== Number(m[2]) - 1 || d.getUTCDate() !== Number(m[3])) return null;
      return { at: `${m[1]}-${pad(Number(m[2]))}-${pad(Number(m[3]))} 00:00:00`, dateOnly: true };
    }
  }
  if (typeof v === 'number' && !(v > 1e9)) return null;   // 에포크가 아닌 작은 숫자는 날짜가 아니다
  const full = normalizeKst(v);
  if (full && full.slice(0, 4) >= '2015' && full.slice(0, 4) <= '2035') return { at: full, dateOnly: false };
  return null;
}

/** 값 → 원 단위 정수(1 ~ 10억). 숫자 · 「12,300원」 */
export function parseAmount(v: unknown): number | undefined {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^[\d,\s]+원?$/.test(v.trim()) && /\d/.test(v) ? Number(v.replace(/[^\d]/g, '')) : NaN;
  return Number.isInteger(n) && n >= 1 && n <= 1e9 ? n : undefined;
}

/** 객체 아래(자기 칸 먼저, 그다음 깊이 4까지 넓게)에서 키 이름이 re 에 맞고 값이 test 를 통과하는 첫 것 */
function scan<T>(root: unknown, keyRe: RegExp, pick: (v: unknown) => T | undefined, maxDepth = 4): T | undefined {
  let level: unknown[] = [root];
  for (let d = 0; d <= maxDepth && level.length > 0; d++) {
    const next: unknown[] = [];
    for (const o of level) {
      if (Array.isArray(o)) { next.push(...o.slice(0, 50)); continue; }
      if (!isObj(o)) continue;
      for (const k of Object.keys(o)) {
        if (keyRe.test(k)) { const got = pick(o[k]); if (got !== undefined) return got; }
      }
      for (const k of Object.keys(o)) { const c = o[k]; if (c !== null && typeof c === 'object') next.push(c); }
    }
    level = next;
  }
  return undefined;
}

const textOf = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() !== '' ? v.replace(/\s+/g, ' ').trim().slice(0, 80) : undefined);

/** 객체 아래에서 판매자번호 값(A + 숫자)을 모두 모은다 — 키 이름에 vendor 가 든 것만 */
function vendorsOf(root: unknown): string[] {
  const out: string[] = [];
  const walk = (o: unknown, depth: number, inVendorKey: boolean): void => {
    if (depth > 6 || out.length >= 20) return;
    if (typeof o === 'string') { if (inVendorKey && VENDOR_VALUE.test(o) && !out.includes(o)) out.push(o); return; }
    if (Array.isArray(o)) { for (const x of o.slice(0, 100)) walk(x, depth + 1, inVendorKey); return; }
    if (!isObj(o)) return;
    for (const k of Object.keys(o)) walk(o[k], depth + 1, inVendorKey || /vendor/i.test(k));
  };
  walk(root, 0, false);
  return out;
}

const isCancelledObj = (o: unknown): boolean => {
  let hit = false;
  const walk = (v: unknown, depth: number): void => {
    if (hit || depth > 4) return;
    if (Array.isArray(v)) { for (const x of v.slice(0, 50)) walk(x, depth + 1); return; }
    if (!isObj(v)) return;
    for (const k of Object.keys(v)) {
      const c = v[k];
      if (/cancel/i.test(k) && c === true) hit = true;
      else if (/status|state/i.test(k) && typeof c === 'string' && /취소/.test(c)) hit = true;
      else if (c !== null && typeof c === 'object') walk(c, depth + 1);
    }
  };
  walk(o, 0);
  return hit;
};

/**
 * __NEXT_DATA__ 등 JSON 안에서 주문을 찾는다(위 「이름으로 찾는 규칙」). 주문번호가 같은 것은 바깥쪽 하나만.
 * 일시 · 금액을 못 찾은 객체는 주문이 아니다(목록 행을 만들 수 없다).
 */
export function findCoupangOrders(root: unknown): CoupangListOrder[] {
  const out: CoupangListOrder[] = [];
  const seen = new Set<string>();
  const walk = (o: unknown, depth: number, groupDate: { at: string; dateOnly: boolean } | null): void => {
    if (depth > 18 || out.length >= 800) return;
    if (Array.isArray(o)) { for (const x of o.slice(0, 500)) walk(x, depth + 1, groupDate); return; }
    if (!isObj(o)) return;
    let orderId: string | undefined;
    for (const k of Object.keys(o)) {
      if (!ORDER_ID_KEY.test(k)) continue;
      const v = o[k];
      const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v : '';
      if (ORDER_ID_VALUE.test(s)) { orderId = s; break; }
    }
    if (orderId !== undefined) {
      if (!seen.has(orderId)) {
        seen.add(orderId);
        let when: { at: string; dateOnly: boolean } | null = null;
        for (const re of DATE_KEYS) { when = scan(o, re, (v) => parseListDate(v) ?? undefined) ?? null; if (when) break; }
        when = when ?? groupDate;
        let amount: number | undefined;
        for (const re of AMOUNT_KEYS) { amount = scan(o, re, parseAmount); if (amount !== undefined) break; }
        if (when && amount !== undefined) {
          out.push({
            orderId, at: when.at, dateOnly: when.dateOnly, amount,
            seller: scan(o, SELLER_KEYS, textOf), title: scan(o, TITLE_KEYS, textOf),
            vendorIds: vendorsOf(o), cancelled: isCancelledObj(o),
          });
        }
      }
      return;   // 주문 안쪽은 더 내려가지 않는다(상품 줄이 같은 주문번호를 또 들고 있어도 한 번)
    }
    let g = groupDate;
    for (const k of Object.keys(o)) { if (GROUP_DATE_KEYS.test(k)) { const d = parseListDate(o[k]); if (d) { g = d; break; } } }
    for (const k of Object.keys(o)) { const c = o[k]; if (c !== null && typeof c === 'object') walk(c, depth + 1, g); }
  };
  walk(root, 0, null);
  return out;
}

/**
 * 다음 쪽 주소 — nextUrl · nextPageUrl · nextLink 처럼 이름이 다음 쪽 주소인 칸의 값(https 쿠팡 주소 또는 /ssr/ 경로)만 쓴다. 주소를 지어내지 않는다.
 * more: 다음 쪽이 있다는 표시(hasNext · hasMore · isLast=false 등)는 있는데 주소를 못 찾았다.
 */
export function nextListPage(root: unknown): { url: string | null; more: boolean } {
  let url: string | null = null;
  let more = false;
  const walk = (o: unknown, depth: number): void => {
    if (depth > 12 || url) return;
    if (Array.isArray(o)) { for (const x of o.slice(0, 20)) walk(x, depth + 1); return; }
    if (!isObj(o)) return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (/^(next(Page)?(Url|Uri|Link|Href|Path)|moreUrl)$/i.test(k) && typeof v === 'string') {
        if (/^https:\/\/([a-z0-9-]+\.)*coupang\.com\/\S*$/.test(v)) { url = v; return; }
        if (/^\/ssr\/\S*$/.test(v)) { url = `https://mc.coupang.com${v}`; return; }
      }
      if (/^(hasNext|hasMore|more)$/i.test(k) && v === true) more = true;
      if (/^(isLast|last)$/i.test(k) && v === false) more = true;
    }
    for (const k of Object.keys(o)) { const c = o[k]; if (c !== null && typeof c === 'object') walk(c, depth + 1); }
  };
  walk(root, 0);
  return { url, more };
}

/* ------------------------------------------------------------------ 영수증 읽기 */

/** 쿠팡 카드영수증 주소 — 대표님 23:45:08 형식(orderId · vendorIds · cancel=false). 값 모양이 틀리면 null */
export function receiptUrl(orderId: string, vendorIds: readonly string[]): string | null {
  if (!ORDER_ID_VALUE.test(orderId) || vendorIds.length === 0 || !vendorIds.every((v) => VENDOR_VALUE.test(v))) return null;
  return `${COUPANG_RECEIPT_URL}?orderId=${orderId}&vendorIds=${vendorIds.join(',')}&cancel=false`;
}

export type ReceiptRead = { kind: 'slip'; slip: Slip; seller?: string; detail?: ReceiptDetail } | { kind: 'none' } | { kind: 'bad' };

const NONE_TEXT_RE = /영수증[^\n]{0,14}(없|조회할 수 없|존재하지)|매출전표[^\n]{0,14}(없|조회할 수 없)/;
const cardWord = (s: string | undefined): string | undefined => (s && s.length <= 20 ? s : undefined);

/** 영수증 JSON 에서 이름으로 칸을 찾는다. 사업자번호 · 승인번호 · 결제 일시 · 금액 중 셋이 안 되면 null (extractSlip 과 같은 기준) */
export function readReceiptJson(data: unknown): ReceiptRead {
  if (isCancelledObj(data)) return { kind: 'none' };
  const digits = (v: unknown): string | undefined => { const s = typeof v === 'number' ? String(v) : typeof v === 'string' ? v.trim() : ''; return /^\d{5,16}$/.test(s) ? s : undefined; };
  const biz = scan(data, /(biz|business|saupja|registration|corpReg)/i, (v) => { const s = typeof v === 'string' ? v.trim() : ''; return /^\d{3}-?\d{2}-?\d{5}$/.test(s) ? `${s.replace(/-/g, '').slice(0, 3)}-${s.replace(/-/g, '').slice(3, 5)}-${s.replace(/-/g, '').slice(5)}` : undefined; });
  const approval = scan(data, /^(card)?(approval|approve|auth)(No|Num|Number)$/i, digits);
  let paid: { at: string; dateOnly: boolean } | undefined;
  for (const re of [/^(approval|approve|pay|paid|trade|transaction)(At|Date|Time|Dt|Dttm|DateTime)$/i, /(approv|trade|transaction).*(At|Date|Time|Dt)$/i]) {
    paid = scan(data, re, (v) => parseListDate(v) ?? undefined);
    if (paid) break;
  }
  let amount: number | undefined;
  for (const re of [/^(approval|approve)Amount$/i, /^totalAmount$/i, /^(pay|payment)Amount$/i, /^amount$/i, /^price$/i]) { amount = scan(data, re, parseAmount); if (amount !== undefined) break; }
  const found = [biz, approval, paid, amount].filter((x) => x !== undefined).length;
  if (found < 3) return { kind: 'bad' };
  const cardIssuer = cardWord(scan(data, /^(card(Company|Co|Name|Issuer|Kind)(Name)?|issuer(Name)?)$/i, textOf));
  const seller = scan(data, /^(vendorName|sellerName|merchantName|storeName|shopName|companyName)$/i, textOf);
  const productName = scan(data, /^(productName|goodsName|itemName|vendorItemName|orderName|title)$/i, textOf);
  const slip: Slip = {
    businessNumber: biz, approval, amount,
    paidAt: paid && !paid.dateOnly ? paid.at : paid ? `${paid.at.slice(0, 10)} 00:00` : undefined,
    paidAtNoSeconds: paid?.dateOnly ? true : undefined,
    cardIssuer,
  };
  // 세부 칸(서버 receipt_link_orders.detail) — 이름으로 찾은 값을 서버 허용 칸(model.ts RECEIPT_DETAIL_KEYS) 이름으로 옮긴다
  const detail: ReceiptDetail = {};
  if (cardIssuer) detail.cardCompany = cardIssuer;
  if (approval) detail.approvalNo = approval;
  if (paid) detail.approvalAt = paid.at;
  if (amount !== undefined) detail.approvalAmount = amount;
  if (biz) detail.sellerBusinessNo = biz;
  if (seller) detail.sellerName = seller;
  if (productName) detail.productName = productName;
  return { kind: 'slip', slip, seller, ...(Object.keys(detail).length > 0 ? { detail } : {}) };
}

/**
 * 글자 영수증의 상호 — 웹뷰 스크립트가 HTML 의 태그를 걷으며 줄바꿈을 공백 하나로 합치므로 extractSlip 의 「상호 …」 읽기가 뒤 라벨(사업자등록번호 · 카드사 · 승인일시 …)까지 삼킨다.
 * 첫 라벨 앞에서 자르고, 남는 게 없으면 undefined(그러면 목록의 판매자를 쓴다).
 */
export function cleanMerchant(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  const cut = raw.split(/(?:^|\s+)(?:사업자|카드사|승인|결제|대표|주소|전화|연락처|거래|할부|가맹점|매출전표|판매자|상호)/)[0].trim();
  return cut === '' ? undefined : cut.slice(0, 40);
}

/** 영수증 응답 → 읽은 것. data 가 있으면 JSON 으로, 아니면 text 가 JSON 모양이면 파싱, 아니면 글자에서(extractSlip). 취소 · 영수증 없음 글자는 none */
export function readReceipt(r: FetchResult): ReceiptRead {
  let data = r.data;
  const text = r.text ?? '';
  if (data === undefined && /^\s*[{[]/.test(text)) { try { data = JSON.parse(text); } catch { data = undefined; } }
  if (data !== undefined && data !== null && typeof data === 'object') {
    const j = readReceiptJson(data);
    if (j.kind !== 'bad' || text === '') return j;
  }
  if (text === '') return { kind: 'bad' };
  if (/취소\s*완료/.test(text)) return { kind: 'none' };
  const slip = extractSlip(text);
  if (slip) {
    // 글자 영수증도 세부 칸을 채운다(JSON 경로와 같은 이름) — 11-02 실측: 쿠팡 영수증은 HTML 이라 세부가 0건이었다
    const seller = cleanMerchant(slip.merchant);
    const detail: ReceiptDetail = {};
    if (slip.cardIssuer) detail.cardCompany = slip.cardIssuer;
    if (slip.approval) detail.approvalNo = slip.approval;
    if (slip.paidAt) detail.approvalAt = slip.paidAt;
    if (slip.amount !== undefined) detail.approvalAmount = slip.amount;
    if (slip.businessNumber) detail.sellerBusinessNo = slip.businessNumber;
    if (seller) detail.sellerName = seller;
    return { kind: 'slip', slip, seller, ...(Object.keys(detail).length > 0 ? { detail } : {}) };
  }
  return NONE_TEXT_RE.test(text) ? { kind: 'none' } : { kind: 'bad' };
}

/** 응답이 글자(HTML)일 때 구조 기록용 요약 줄 — 값 없이 라벨 유무 · 길이 단계만(영문) */
export function textSummaryLines(text: string): string[] {
  const has = (re: RegExp): number => (re.test(text) ? 1 : 0);
  return [
    'kind : text', `lenBucket : ${Math.min(9, Math.floor(text.length / 1000))}`,
    `label.biz : ${has(/사업자/)}`, `label.approval : ${has(/승인\s*번호/)}`, `label.paidat : ${has(/(승인|결제|거래)\s*일시/)}`,
    `label.amount : ${has(/(승인|결제)?\s*금액/)}`, `label.card : ${has(/카드/)}`, `label.cancel : ${has(/취소/)}`, `label.none : ${has(NONE_TEXT_RE)}`,
  ];
}

/* ------------------------------------------------------------------ 상태기계 */

type Phase = 'idle' | 'origin' | 'list' | 'relogin' | 'receipts' | 'receiptnav' | 'finished';
type Job = { row: CoupangListOrder; order: ReceiptOrder; key: string; tries: number };
type StructureItem = { where: string; host: string; path: string; lines: string[] };

const FAIL_OF: Partial<Record<FetchResult['st'], FailCode>> = { blocked: 'blocked', net: 'network', shape: 'unreadable', login: 'login' };

export function createCoupangApiFlow(opts: ApiFlowOptions = {}): NaverFlow {
  const now = opts.now ?? (() => Date.now());
  const maxSteps = opts.maxSteps ?? 4000;
  const budgetMs = opts.budgetMs ?? 1_500_000;
  const maxOrders = opts.maxOrders ?? 800;
  const allowNoSeconds = opts.allowNoSeconds ?? false;
  const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
  const startedAt = now();
  let cutoff = ymd(startedAt - LOOKBACK_DAYS * DAY_MS);
  const untilDate = ymd(startedAt + 9 * 3600000);
  const startUrl = coupangListUrl(cutoff, untilDate, untilDate.slice(0, 4));

  let phase: Phase = 'idle';
  let steps = 0;
  let tries = 0;
  let listTries = 0;
  let listPages = 0;
  let listPageIndex = 0;
  let lastListUrl = coupangFindOverUrl(cutoff, untilDate, 0);
  let lastUrl = '';
  let lastText = '';
  let final: FlowOut | null = null;
  let after: (() => FlowOut) | null = null;
  const knownNos = new Set<string>();
  const knownKeys = new Set<string>();
  const knownTails = new Set<string>();
  const listed = new Map<string, CoupangListOrder>();
  const listUrlsSeen = new Set<string>();
  let nextUrl: string | null = null;
  let moreWithoutUrl = false;
  let queue: Job[] = [];
  let batch: Job[] = [];
  const orders: ReceiptOrder[] = [];
  const pending: ReceiptOrder[] = [];
  const outcomes: OutcomeEvent[] = [];
  const stats: FlowStats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [] };
  const structSeen = new Set<string>();
  let total = 0;
  let okN = 0;
  let noneN = 0;
  let failN = 0;
  let blockedRun = 0;
  let timeoutRun = 0;
  let allNetRun = 0;
  let slow = false;
  /* 영수증 웹뷰 직접 열기(교차 출처 대체 길) — navMode 가 켜지면 영수증 단계는 요청 대신 goto 로 한 장씩 읽는다 */
  let navMode = false;
  let navJobs: Job[] = [];
  let navJob: Job | null = null;
  let navFailRun = 0;
  const MAX_NAV_FAIL_RUN = 3;
  let ending: { reason: string; orders: ReceiptOrder[]; stats: FlowStats } | null = null;
  let endQueue: string[] = [];

  const READ: FlowOut = { kind: 'read' };

  const drainEnd = (): FlowOut => {
    const w = endQueue.shift();
    if (w !== undefined) return { type: 'probe', where: w, shape: pageShape(lastUrl, lastText) };
    const e = ending;
    if (!final && e) final = { type: 'done', reason: e.reason, orders: e.orders, stats: e.stats };
    return final ?? { type: 'done', reason: 'unknown', orders: [], stats: { ...stats } };
  };
  /** 끝: 개수 기록(값 없음) → 끝난 까닭 기록 → done */
  const finish = (reason: string): FlowOut => {
    if (final) return final;
    if (!ending) {
      const at = phase;
      phase = 'finished';
      after = null;
      ending = { reason, orders: pending.splice(0), stats: { ...stats } };
      endQueue = [`flowc-t${total}-k${okN}-x${noneN}-f${failN}-q${queue.length}`, `flowe-${reason}-${at}`];
    }
    return drainEnd();
  };
  const retryOr = (reason: string): FlowOut => {
    if (tries < 2) { tries++; return READ; }
    return finish(reason);
  };
  /** 응답 키 구조 기록을 차례로 내보내고(resume 마다 다음 것) 끝나면 then — 같은 where 는 한 번만 */
  const structureThen = (items: StructureItem[], then: () => FlowOut): FlowOut => {
    const todo = items.filter((i) => i.lines.length > 0 && !structSeen.has(i.where));
    const step = (): FlowOut => {
      const i = todo.shift();
      if (!i) { after = null; return then(); }
      structSeen.add(i.where);
      after = step;
      return { type: 'structure', where: i.where, host: i.host, path: i.path, lines: i.lines };
    };
    return step();
  };

  const setOutcome = (key: string, outcome: Outcome): void => { outcomes.push({ key, outcome }); };
  const fail = (j: Job, code: FailCode): void => {
    failN++;
    setOutcome(j.key, { state: 'failed', code });
    stats.unfetched = [...(stats.unfetched ?? []), j.row.orderId];
  };

  const listReq = (): FlowOut => {
    lastListUrl = coupangFindOverUrl(cutoff, untilDate, listPageIndex);
    const req: FetchReq = { key: 'list', method: 'GET', url: lastListUrl, as: 'json' };
    listUrlsSeen.add(lastListUrl);
    return { kind: 'fetch', reqs: [req], conc: 1, staggerMs: 0, gapMs: 0, timeoutMs: FETCH_TIMEOUT_MS, deadlineMs: FETCH_DEADLINE_MS };
  };

  /** 목록 행 + 영수증 요청에 쓸 값 */
  const jobOf = (row: CoupangListOrder): Job => {
    const order = listOrder({ orderNo: row.orderId, orderedAt: row.at, amount: row.amount, title: row.title, seller: row.seller });
    // 날짜만 아는 행의 목록 키는 서버가 받는 「YYYY-MM-DD 00:00|금액」 모양이다(listOrder 가 시각 00:00 으로 만든다)
    return { row, order, key: outcomeKey(row.orderId, row.at, row.amount), tries: 0 };
  };

  const sendBatch = (): FlowOut => {
    const size = slow ? FETCH_SLOW.batch : FETCH_BATCH;
    const reqs: FetchReq[] = [];
    batch = [];
    while (queue.length > 0 && batch.length < size) {
      const j = queue.shift() as Job;
      const url = receiptUrl(j.row.orderId, j.row.vendorIds);
      if (url === null) { fail(j, 'no-pair'); continue; }   // 판매자번호를 못 찾았다 — 요청 없이 까닭만
      batch.push(j);
      reqs.push({ key: j.key, method: 'GET', url, as: 'text' });
      setOutcome(j.key, { state: 'fetching' });
    }
    if (batch.length === 0) return finish(moreWithoutUrl ? 'first-page-only' : 'all-rows');
    if (navMode) { navJobs = [...batch, ...navJobs]; batch = []; return navNext(); }
    phase = 'receipts';
    return { kind: 'fetch', reqs, conc: slow ? FETCH_SLOW.conc : FETCH_CONC, staggerMs: slow ? 0 : FETCH_STAGGER_MS, gapMs: slow ? FETCH_SLOW.gapMs : 0, timeoutMs: FETCH_TIMEOUT_MS, deadlineMs: FETCH_DEADLINE_MS };
  };

  /** 웹뷰 직접 열기(교차 출처 대체 길): 다음 영수증 주소로 이동한다. 다 읽으면 끝낸다 */
  const navNext = (): FlowOut => {
    const j = navJobs.shift();
    navJob = j ?? null;
    if (!j) return finish(moreWithoutUrl ? 'first-page-only' : 'all-rows');
    phase = 'receiptnav';
    return { type: 'goto', url: receiptUrl(j.row.orderId, j.row.vendorIds) as string };
  };
  /** 웹뷰 직접 열기를 그만둘 때 — 아직 읽지 못한 줄(읽는 중 · 대기)에 모두 까닭을 남긴다 */
  const failNavRest = (): void => {
    if (navJob) { fail(navJob, 'network'); navJob = null; }
    for (const j of navJobs) fail(j, 'network');
    navJobs = [];
    for (const j of queue) fail(j, 'network');
    queue = [];
  };

  /** 목록 전체 → 가져올 주문(최신 먼저, 이미 가져온 것 제외). 새 목록 행은 서버에 올린다 */
  const startReceipts = (): FlowOut => {
    const rows = [...listed.values()].filter((r) => r.at.slice(0, 10) >= cutoff).sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
    const jobs: Job[] = [];
    const matched = new Set<string>();
    for (const r of rows) {
      if (r.cancelled) { stats.rejected++; continue; }
      const j = jobOf(r);
      if (only) { if (!only.has(j.key)) continue; matched.add(j.key); }
      else if (knownNos.has(r.orderId) || knownTails.has(tailOf(r.orderId, r.at)) || (j.order.listKey !== undefined && knownKeys.has(j.order.listKey))) continue;
      jobs.push(j);
      if (jobs.length >= maxOrders) break;
    }
    if (only) {
      for (const k of only) if (!matched.has(k)) { failN++; setOutcome(k, { state: 'failed', code: 'no-pair' }); }
    } else pending.push(...jobs.map((j) => j.order));
    queue = jobs;
    total = jobs.length;
    if (jobs.length === 0) return finish(moreWithoutUrl ? 'first-page-only' : 'all-rows');
    return sendBatch();
  };

  const onListFetched = (res: FetchResult | undefined): FlowOut => {
    const bad = (reason: string): FlowOut => {
      listTries++;
      return listTries < MAX_LIST_TRIES ? listReq() : finish(reason);
    };
    if (!res) return bad('list-failed');
    if (res.st === 'login') { phase = 'origin'; tries = 0; return { type: 'login' }; }
    if (res.st === 'blocked') return finish('blocked');
    if (res.st !== 'ok' || res.data === undefined) return bad('list-failed');
    listPages++;
    const found = findCoupangOrders(res.data);
    const first = listPages === 1;
    const items: StructureItem[] = first ? [
      { where: 'cp-list', host: 'mc.coupang.com', path: '/ssr/api/myorders/model/find-over', lines: structureLines(res.data) },
      { where: 'cp-listpick', host: 'mc.coupang.com', path: '/ssr/api/myorders/model/find-over', lines: pathsMatching(res.data, /order|vendor|amount|price|date|time|cancel|next|page|more|last|status/i, 80).map((p) => `${p} : hit`) },
    ] : [];
    return structureThen(items, () => {
      if (found.length === 0 && first) return finish('list-failed');
      let added = 0;
      for (const o of found) if (!listed.has(o.orderId)) { listed.set(o.orderId, o); added++; }
      const data = isObj(res.data) ? res.data : {};
      const hasNext = data.hasNext === true;
      const rawNext = Number(data.nextPageIndex);
      const nextIndex = Number.isInteger(rawNext) && rawNext > listPageIndex ? rawNext : null;
      moreWithoutUrl = hasNext && nextIndex === null;
      const oldest = found.reduce((m, o) => (o.at < m ? o.at : m), '9999');
      const stop = !hasNext || moreWithoutUrl || added === 0 || listPages >= COUPANG_MAX_PAGES || (found.length > 0 && oldest.slice(0, 10) < cutoff) || listed.size >= maxOrders;
      if (stop) return startReceipts();
      listPageIndex = nextIndex as number;
      return listReq();
    });
  };

  /** 영수증 한 장 → 서버로 보낼 완성 주문 */
  const settleOk = (j: Job, read: ReceiptRead): void => {
    if (read.kind === 'none') { noneN++; setOutcome(j.key, { state: 'none' }); return; }
    if (read.kind === 'bad') { fail(j, 'unreadable'); return; }
    const s: Slip = { ...read.slip };
    if (!s.paidAt) {   // 영수증에 결제 시각이 없으면 목록의 주문 날짜(+시각이 있으면 시각)를 쓴다 — 초가 없으면 allowNoSeconds 가 켜졌을 때만 서버로 간다
      s.paidAt = j.row.dateOnly ? `${j.row.at.slice(0, 10)} 00:00` : j.row.at;
      s.paidAtNoSeconds = j.row.dateOnly || undefined;
    }
    const done = toImportOrder(s, { orderNo: j.row.orderId, seller: read.seller ?? j.row.seller, title: j.row.title, amount: s.amount ?? j.row.amount }, { kind: 'card', allowNoSeconds });
    if (!done) { fail(j, 'unreadable'); return; }
    if (j.order.listKey) done.listKey = j.order.listKey;
    if (read.detail) done.detail = read.detail;
    orders.push(done);
    pending.push(done);
    okN++;
    setOutcome(j.key, { state: 'done' });
  };

  const onReceiptsFetched = (results: FetchResult[]): FlowOut => {
    if (phase !== 'receipts') return finish('unexpected-event');
    timeoutRun = 0;
    const byKey = new Map(results.map((r) => [r.key, r]));
    const rs = batch.map((j) => ({ j, r: byKey.get(j.key) ?? ({ key: j.key, st: 'net' } as FetchResult) }));
    // 성공이 하나도 없는 채로 net 으로만 연달아 오면 교차 출처 거절 — 두 묶음 연속이면 요청을 되풀이하지 않고
    // 숨은 웹뷰가 영수증 주소를 직접 연다(대표님 11-02 「어떤 방식이든 해결」 · 10-29 17:05 「브라우저 눌러서라도 수집해」)
    const allNet = rs.length > 0 && rs.every((x) => x.r.st === 'net');
    if (allNet && okN + noneN === 0) {
      allNetRun++;
      if (allNetRun >= MAX_ALL_NET_RUN) {
        navMode = true;
        batch = [];
        navJobs = [...rs.map((x) => x.j), ...queue];
        queue = [];
        return navNext();
      }
    } else allNetRun = 0;
    const again: Job[] = [];
    let sawLogin = false;
    let blocked = 0;
    const first = rs.find((x) => x.r.st === 'ok');
    for (const { j, r } of rs) {
      if (r.st === 'ok') settleOk(j, readReceipt(r));
      else if (r.st === 'login') { sawLogin = true; again.push(j); }
      else if (r.st === 'blocked' || r.st === 'net' || (r.st === 'http' && (r.status ?? 0) >= 500)) {
        if (r.st === 'blocked') blocked++;
        if (j.tries + 1 < MAX_JOB_TRIES) { j.tries++; again.push(j); } else fail(j, r.st === 'blocked' ? 'blocked' : 'network');
      } else if (r.st === 'http') { noneN++; setOutcome(j.key, { state: 'none' }); }   // 404 같은 응답 — 그 주문에는 카드영수증이 없는 것으로 본다(가정)
      else fail(j, FAIL_OF[r.st] ?? 'unreadable');
    }
    batch = [];
    queue = [...again, ...queue];
    const proceed = (): FlowOut => {
      if (sawLogin) { phase = 'relogin'; tries = 0; return { type: 'login' }; }
      if (blocked > 0) {
        slow = true;
        blockedRun++;
        if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked');
      } else blockedRun = 0;
      return sendBatch();
    };
    if (!first) return proceed();
    const data = first.r.data;
    const lines = data !== undefined && data !== null && typeof data === 'object' ? structureLines(data) : textSummaryLines(first.r.text ?? '');
    return structureThen([{ where: 'cp-receipt', host: 'payment.coupang.com', path: '/v2/card-receipt/view', lines }], proceed);
  };

  const onTimeout = (): FlowOut => {
    if (phase === 'receiptnav') {
      const j = navJob;
      navJob = null;
      if (j) { if (j.tries + 1 < MAX_JOB_TRIES) { j.tries++; navJobs.unshift(j); } else fail(j, 'network'); }
      navFailRun++;
      if (navFailRun >= MAX_NAV_FAIL_RUN) { failNavRest(); return finish('cross-origin'); }
      return navNext();
    }
    if (phase === 'receipts') {
      timeoutRun++;
      const lost = batch;
      batch = [];
      const again: Job[] = [];
      for (const j of lost) { if (j.tries + 1 < MAX_JOB_TRIES) { j.tries++; again.push(j); } else fail(j, 'network'); }
      queue = [...again, ...queue];
      if (timeoutRun >= MAX_TIMEOUT_RUN) return finish('timeouts');
      return sendBatch();
    }
    if (phase === 'list') return tries < 2 ? (tries++, listReq()) : finish('timeout');
    return retryOr('timeout');
  };

  const isLogin = (url: string, text: string): boolean => /^(login|member|id)\.coupang\.com$/.test(hostOf(url)) || /^[^/]*\/(login|member\/login)/.test(url) || isLoginPage(url, text);

  const onPage = (url: string, text: string): FlowOut => {
    lastUrl = url;
    lastText = text;
    if (phase === 'receiptnav') {
      // 웹뷰가 직접 연 영수증 화면 — JSON 본문은 글자 그대로, HTML 이면 걷은 글자로 읽는다
      const j = navJob;
      navJob = null;
      if (!j) return navNext();
      if (isLogin(url, text)) { navJobs.unshift(j); phase = 'relogin'; tries = 0; return { type: 'login' }; }
      const t = text.trim();
      if (t === '') {
        // 빈 화면 · 오류 화면 — 연달아 세 번이면 영수증 호스트가 막은 것으로 보고 끝낸다
        navFailRun++;
        fail(j, 'network');
        if (navFailRun >= MAX_NAV_FAIL_RUN) { failNavRest(); return finish('cross-origin'); }
        return navNext();
      }
      navFailRun = 0;
      settleOk(j, readReceipt({ key: j.key, st: 'ok', text: t }));
      return structureThen([{ where: 'cp-receipt', host: 'payment.coupang.com', path: '/v2/card-receipt/view', lines: textSummaryLines(t) }], navNext);
    }
    if (phase === 'origin' || phase === 'relogin') {
      if (isLogin(url, text)) return { type: 'login' };
      // 영수증 직접 열기 중 로그인이 풀렸으면 로그인 뒤 영수증 주소로 돌아온다 — 목록 출처(mc)가 아니어도 이어 간다
      if (hostOf(url) !== 'mc.coupang.com' && !(navMode && hostOf(url) === 'payment.coupang.com')) return retryOr('origin-lost');
      tries = 0;
      if (phase === 'relogin') return navMode ? navNext() : sendBatch();   // 영수증 단계에서 로그인이 풀렸다 — 목록은 다시 받지 않고 남은 주문부터
      phase = 'list';
      listPageIndex = 0;
      return listReq();
    }
    return finish('unexpected-page');
  };

  const next = (ev: FlowEvent): FlowOut => {
    if (final) return final;
    if (ending) return drainEnd();
    steps++;
    if (ev.type !== 'start') {
      if (steps > maxSteps) return finish('max-steps');
      if (now() - startedAt > budgetMs) return finish('budget');
    }
    switch (ev.type) {
      case 'start':
        for (const n of ev.known?.orderNos ?? []) knownNos.add(n);
        for (const k of ev.known?.listKeys ?? []) knownKeys.add(k);
        for (const t of ev.known?.tails ?? []) knownTails.add(t);
        // 저장된 가장 최근 주문 날짜부터만 읽는다 — 같은 날 주문은 주문번호 · 뒤4자리로 중복만 거른다(대표님 11-02). 처음(저장 없음)은 1년
        { const last = opts.sinceLatest && !only ? latestKnownDay(ev.known) : undefined; if (last && last > cutoff) cutoff = last; }
        phase = 'origin';
        tries = 0;
        return { type: 'goto', url: startUrl };
      case 'page':
        return onPage(ev.url, ev.text);
      case 'fetched':
        if (phase === 'list') {
          const r = ev.results.find((x) => x.key === 'list');
          const out = onListFetched(r);
          if ('kind' in out && out.kind === 'fetch') lastListUrl = out.reqs[0].url;
          return out;
        }
        return onReceiptsFetched(ev.results);
      case 'timeout':
        return onTimeout();
      case 'resume': {
        const f = after;
        after = null;
        return f ? f() : finish('unexpected-event');
      }
      default:
        return finish('unexpected-event');
    }
  };

  return {
    next,
    take: () => pending.splice(0),
    takeOutcomes: () => outcomes.splice(0),
    progress: () => ({ phase, done: okN + noneN + failN, total, orders: orders.length }),
  };
}
