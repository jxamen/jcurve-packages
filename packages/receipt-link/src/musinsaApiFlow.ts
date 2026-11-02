/**
 * 무신사 영수증 흐름(8차) — **요청만** 쓴다. 영수증 화면을 열거나 단추를 누르거나 막히면 화면 방식으로 되돌아가는 길이 없다(대표님 10-29 09:03).
 * 예외(대표님 10-29 17:05 「크롤링 안되면 브라우저 눌러서라도 수집해」 · 11-02 「어떤 방식이든 해결」): 매출전표 호스트(pay.musinsapayments.com)가
 * 교차 출처 요청을 받지 않아(모든 요청이 net) 두 묶음 연속 한 건도 못 읽으면, 숨은 웹뷰가 매출전표 주소를 **직접 열어**(goto) 화면 글자를 읽는다.
 * 화면을 여는 것은 이 대체 길뿐이고, 단추를 누르거나 사용자 로그인 정보를 앱이 넣는 일은 없다.
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고, 구동기가 숨은 웹뷰 안에서 범용 요청 동작(fetch, siteFetch.ts)을 실행한다.
 *
 *  1) https://www.musinsa.com/order/order-list 를 한 번 열어 둔다(같은 출처에서 요청을 부르려고 — 실행당 한 번)
 *  2) 주문 목록: GET https://api.musinsa.com/api2/claim/store/mypage/integration/order?size=15&searchText=&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 *     (대표님 10-28 23:51 요청의 쿼리 키 네 개 그대로). 최근 1년을 91일 구간으로 나눠 최신 구간부터 받고, 한 구간이 size(15)건으로 가득 차면
 *     그 구간을 반으로 나눠 다시 받는다 — 쪽 번호 같은 모르는 파라미터를 만들지 않으려고 날짜 구간만으로 모두 받는다(하루 구간이 가득 차면 거기까지).
 *  3) 매출전표: GET https://pay.musinsapayments.com/mps/receipt/{주문번호}?paymentKey=…&merchantCode=…&tid=… (23:52 요청 그대로)
 *     최신 주문부터 FETCH_BATCH 건씩 몇 건씩 병렬로 부른다.
 *  4) 주문마다 결과(가져옴 · 영수증 없음 · 못 가져옴+까닭)를 takeOutcomes 로 알리고, 가져온 영수증은 take 로 낸다.
 * 이미 서버에 있는 주문(start.known)은 건너뛰고(영수증 보강된 줄만 — 목록 행은 다시 가져온다), onlyKeys 가 있으면 그 줄들만 가져온다.
 * 막히면(403 · 429) 한 번에 2건 · 하나씩 · 요청 사이를 늘려 이어 가고, 연달아 세 번 막히면 끝낸다. 로그인이 풀리면 로그인 화면을 보이고 풀린 뒤 같은 곳부터 이어 간다.
 *
 * ── 응답 모양은 원문에 없다 → 이름으로 찾아 바로 쓰고, 동시에 키 구조(값 없음)를 {type:'structure'} 로 남긴다(맞는지 · 틀린지 다음 확인용). 찾는 규칙(추정):
 *  · 주문 배열: 응답 JSON 안에서 「원소에 주문번호(숫자 12~24자리)가 든 객체」의 배열 중 가장 얕은(깊이) 것, 같은 깊이면 가장 긴 것
 *  · 원소의 칸은 이름으로(너비 우선, 깊이 5까지): 주문번호 orderNo · ordNo · orderNumber · ord_no ⋯ / 주문 일시 orderDate · orderDt ⋯ → paymentDate · regDate ⋯ /
 *    금액 finalPaymentAmount · paymentAmount ⋯ → totalAmount · orderAmount ⋯ / 상품명 goodsName · productName ⋯ / 영수증 값 paymentKey · tid · merchantCode
 *  · merchantCode 가 없으면 대표님 원문(5글자)과 옛 확인(STORE)에 맞춰 STORE 를 쓴다
 *  · 영수증이 없는 결제: 목록 원소의 취소 · 반품 · 환불 상태, 또는 결제수단 이름이 포인트 · 계좌 · 무통장 · 가상계좌 · 머니(카드 아님)이면 요청 없이 「영수증 없음」,
 *    paymentKey · tid 가 없고 결제수단도 모르면 「영수증 주소를 못 찾았어요」, 매출전표 요청이 404 · 410 이면 「영수증 없음」
 *  · 매출전표 응답은 JSON 이면 이름으로(approvalNo · businessNo · approvalDateTime · approvalAmount ⋯), HTML 이면 태그를 걷은 글자에서 extractSlip 으로 읽는다
 * 끝난 까닭 코드: all-rows · login · blocked · list-failed · list-shape(목록은 왔는데 주문으로 읽은 게 없음) · cross-origin(매출전표 호스트로 가는 요청이 모두 실패) ·
 *  timeout · timeouts · max-steps · budget · shop-lost · unexpected-event
 */
import {
  extractSlip, listOrder, normalizeKst, pageShape, toImportOrder,
  type FlowEvent, type FlowOut, type FlowStats, type NaverFlow, type ReceiptOrder, type Slip,
} from './naverReceipt';
import { latestKnownDay, tailOf, type ApiFlowOptions } from './naverApiFlow';
import { FETCH_BATCH, FETCH_CONC, FETCH_DEADLINE_MS, FETCH_SLOW, FETCH_STAGGER_MS, FETCH_TIMEOUT_MS, type FetchReq, type FetchResult } from './siteFetch';
import { outcomeKey, type FailCode, type Outcome, type OutcomeEvent } from './runOutcome';
import { structureLines } from './shapeLines';
import type { ReceiptDetail } from './model';

export const MUSINSA_ORDER_LIST_URL = 'https://www.musinsa.com/order/order-list';
export const MUSINSA_LIST_API = 'https://api.musinsa.com/api2/claim/store/mypage/integration/order';
export const MUSINSA_RECEIPT_BASE = 'https://pay.musinsapayments.com/mps/receipt/';
export const MUSINSA_RECEIPT_ORIGIN = 'https://pay.musinsapayments.com/';
export const musinsaDetailUrl = (orderNo: string): string => `https://www.musinsa.com/order-service/my/order/get_order_view/${orderNo}`;
const LIST_HOST = 'api.musinsa.com';
const LIST_PATH = '/api2/claim/store/mypage/integration/order';
const RECEIPT_HOST = 'pay.musinsapayments.com';
const RECEIPT_PATH = '/mps/receipt/#';

/** 목록 한 번에 받는 건수(대표님 요청의 size) · 처음 나누는 구간(일) */
const LIST_SIZE = 15;
const WINDOW_DAYS = 91;
const LOOKBACK_DAYS = 365;
const DAY_MS = 86_400_000;
const MAX_TRIES = 2;
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;
const MAX_ALL_NET_BATCHES = 2;
const LIST_ACCEPT = 'application/json, text/plain, */*';
const RECEIPT_ACCEPT = 'text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8';

const ymd = (ms: number): string => new Date(ms).toISOString().slice(0, 10);
const dayMs = (d: string): number => Date.parse(`${d}T00:00:00Z`);
const addDays = (d: string, n: number): string => ymd(dayMs(d) + n * DAY_MS);
const spanDays = (a: string, b: string): number => Math.round((dayMs(b) - dayMs(a)) / DAY_MS);
const hostOf = (url: string): string => url.split('/')[0].toLowerCase();

/* ---------------- 응답에서 이름으로 찾기 ---------------- */

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => v !== null && typeof v === 'object' && !Array.isArray(v);

/** root 아래(너비 우선, maxDepth 까지)에서 이름이 patterns[i] 에 맞고 값이 ok 인 첫 것. patterns 앞쪽이 우선이다 */
export function findKey(root: unknown, patterns: readonly RegExp[], ok: (v: unknown) => boolean, maxDepth = 5): unknown {
  for (const re of patterns) {
    let level: unknown[] = [root];
    for (let d = 0; d <= maxDepth && level.length > 0; d++) {
      const next: unknown[] = [];
      for (const node of level) {
        if (Array.isArray(node)) { for (const x of node.slice(0, 40)) if (x !== null && typeof x === 'object') next.push(x); continue; }
        if (!isObj(node)) continue;
        for (const k of Object.keys(node)) {
          if (re.test(k) && ok(node[k])) return node[k];
        }
        for (const k of Object.keys(node)) { const c = node[k]; if (c !== null && typeof c === 'object') next.push(c); }
      }
      level = next;
    }
  }
  return undefined;
}

const asStr = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
const isDigits = (lo: number, hi: number) => (v: unknown): boolean => { const s = asStr(v); return /^\d+$/.test(s) && s.length >= lo && s.length <= hi; };
const isMoney = (v: unknown): boolean => {
  if (typeof v === 'number') return Number.isFinite(v) && Number.isInteger(v) && v >= 1 && v <= 1_000_000_000;
  if (typeof v === 'string') { const s = v.replace(/[,\s원]/g, ''); return /^\d{1,10}$/.test(s) && Number(s) >= 1; }
  return false;
};
const toMoney = (v: unknown): number | undefined => (isMoney(v) ? (typeof v === 'number' ? v : Number((v as string).replace(/[,\s원]/g, ''))) : undefined);
const isStamp = (v: unknown): boolean => {
  if (typeof v === 'number') return v >= 1e9 && v < 1e14 && normalizeKst(v) !== null;
  return typeof v === 'string' && v.trim().length >= 8 && /\d/.test(v) && normalizeKst(v) !== null;
};
const isText = (v: unknown): boolean => typeof v === 'string' && v.trim().length > 0;
const clip = (v: unknown, max: number): string | undefined => { const s = asStr(v).replace(/\s+/g, ' '); return s ? s.slice(0, max) : undefined; };

const ORDER_NO_RES = [/^(orderNo|ordNo|orderNumber|order_no|ord_no)$/i, /^order(Id|Key|Seq)$/i, /^ord.*(no|num)$/i, /^order.*(no|num|number)$/i];
const ORDERED_AT_RES = [/^(orderDate|orderDt|ordDate|ord_dt|ord_date|orderDateTime|orderedAt|orderTime|orderYmdt)$/i, /^(paymentDate|payDate|paidAt|paymentDt|regDate|regDt|reg_dt|createdAt|createDate|insDate)$/i, /(date|dt|time|at|ymdt)$/i];
// receiveAmount = 통합 주문 목록의 상품 줄 결제 금액(11-02 실측: 영수증 합계와 같음)
const AMOUNT_RES = [/^(receiveAmount|finalPaymentAmount|finalPayAmount|totalPaymentAmount|paymentAmount|payAmount|paidAmount|totalPayAmt|payAmt|settleAmount)$/i, /^(totalAmount|orderAmount|orderPrice|totalPrice|amount|price|totalGoodsPrice)$/i, /(pay|paid|total|final|order).*(amount|amt|price)/i];
const TITLE_RES = [/^(goodsName|goodsNm|productName|itemName|goods_nm|title|name)$/i, /(goods|product|item).*(name|nm)/i];
const SELLER_RES = [/^(brandName|brandNm|storeName|shopName|sellerName|mallName|companyName)$/i, /(brand|store|shop|seller).*(name|nm)/i];
const PAYMENT_KEY_RES = [/^paymentKey$/i];
const TID_RES = [/^(tid|tId|pgTid|transactionId)$/i];
const MERCHANT_CODE_RES = [/^merchantCode$/i];
const PAY_METHOD_RES = [/^(payMethod|paymentMethod|payType|paymentType|payWay|payMeans|paymentMeans)$/i, /(pay|payment).*(method|type|way|means)(Name|Nm|Text)?$/i];
const STATUS_RES = [/^(orderStatus|status|state|claimStatus|statusName|statusNm|orderStateName)$/i, /(status|state)(Name|Nm|Text|Desc)?$/i];
const CANCELLED = /취소|반품|환불|교환|CANCEL|RETURN|REFUND|EXCHANGE/i;   // 대표님 11-03 「주문 상태(취소·반품·교환·환불)」
const NON_CARD = /포인트|적립금|무통장|계좌|가상계좌|머니|POINT|VBANK|BANK|ACCOUNT|MONEY/i;

export type ParsedOrder = {
  orderNo: string; orderedAt: string; amount: number; title?: string; seller?: string;
  pay?: { paymentKey: string; tid: string; merchantCode: string }; method?: string; cancelled: boolean;
  /** 옵션 일부만 반품 · 취소(나머지는 구매 확정) */
  mixed?: boolean;
};

export function readMusinsaDetail(json: unknown): NonNullable<ParsedOrder['pay']> | null {
  const info = isObj(json) && isObj(json.orderInfo) ? json.orderInfo : null;
  if (!info) return null;
  const paymentKey = asStr(info.payment_key);
  const tid = asStr(info.tno);
  if (!/^[A-Za-z0-9_-]{10,64}$/.test(paymentKey) || !/^[A-Za-z0-9_-]{16,160}$/.test(tid)) return null;
  return { paymentKey, tid, merchantCode: 'STORE' };
}

export function musinsaNextOffsets(json: unknown): { onlineOffset?: string; offlineOffset?: string } | null {
  const meta = isObj(json) && isObj(json.meta) ? json.meta : null;
  if (!meta) return null;
  const onlineOffset = asStr(meta.onlineOffset);
  const offlineOffset = asStr(meta.offlineOffset);
  return { ...(onlineOffset ? { onlineOffset } : {}), ...(offlineOffset ? { offlineOffset } : {}) };
}

/** 응답 JSON 안의 주문 배열을 찾는다 — 규칙은 파일 머리말 */
export function findOrderRows(json: unknown): Raw[] {
  let best: { depth: number; rows: Raw[] } | null = null;
  const hasOrderNo = (e: unknown): boolean => isObj(e) && findKey(e, ORDER_NO_RES, isDigits(12, 24), 2) !== undefined;
  let level: unknown[] = [json];
  for (let depth = 0; depth <= 6 && level.length > 0; depth++) {
    const next: unknown[] = [];
    for (const node of level) {
      if (Array.isArray(node)) {
        const objs = node.filter(isObj);
        if (objs.length > 0 && objs.slice(0, 3).some(hasOrderNo)) {
          if (best === null || depth < best.depth || (depth === best.depth && objs.length > best.rows.length)) best = { depth, rows: objs };
        }
        for (const x of node.slice(0, 40)) if (x !== null && typeof x === 'object') next.push(x);
      } else if (isObj(node)) {
        for (const k of Object.keys(node)) { const c = node[k]; if (c !== null && typeof c === 'object') next.push(c); }
      }
    }
    if (best !== null) break;   // 가장 얕은 깊이에서 찾았으면 더 내려가지 않는다
    level = next;
  }
  return best ? best.rows : [];
}

/** 객체 안에 객체 배열이 있는데 주문번호를 못 찾았는가(= 주문 목록일 수 있으나 이름을 못 맞춤) */
const hasObjectArray = (json: unknown, depth = 0): boolean => {
  if (depth > 6) return false;
  if (Array.isArray(json)) return json.length > 0 && json.some((x) => isObj(x));
  if (!isObj(json)) return false;
  return Object.keys(json).some((k) => hasObjectArray(json[k], depth + 1));
};

/** 상태 기록 한 줄(날짜 · 금액 같은 값 없이): 결제 키 있음/없음 · 옵션별 orderState/claimState/childOrderState/상태 글자 · 판정 */
export function musinsaStatusLine(e: Raw, p: ParsedOrder): string {
  const opts = Array.isArray(e.orderOptionList) ? (e.orderOptionList as unknown[]).filter(isObj) as Raw[] : [];
  const num = (v: unknown): string => (typeof v === 'number' ? String(v) : '-');
  const o = opts.slice(0, 6).map((x) => `${num(x.orderState)}/${num(x.claimState)}/${num(x.childOrderState)}/${asStr(x.orderStateText).replace(/[^가-힣A-Za-z ]/g, '').slice(0, 12) || '-'}`).join(',');
  const top = asStr(findKey(e, STATUS_RES, isText, 3)).replace(/[^가-힣A-Za-z_ ]/g, '').slice(0, 16);
  return `pay=${p.pay ? 'y' : 'n'} top=${top || '-'} opt=${o || '-'} off=${p.cancelled ? 'y' : p.mixed ? 'part' : 'n'}`.slice(0, 200);
}

export function parseOrderRow(e: Raw): ParsedOrder | null {
  const orderNo = asStr(findKey(e, ORDER_NO_RES, isDigits(12, 24), 3));
  const orderedAtRaw = findKey(e, ORDERED_AT_RES, isStamp, 4);
  const orderedAt = orderedAtRaw === undefined ? null : normalizeKst(orderedAtRaw);
  const amount = toMoney(findKey(e, AMOUNT_RES, isMoney, 4));
  if (!orderNo || !orderedAt || amount === undefined) return null;
  const paymentKey = asStr(findKey(e, PAYMENT_KEY_RES, (v) => /^[A-Za-z0-9_-]{10,64}$/.test(asStr(v)), 6));
  const tid = asStr(findKey(e, TID_RES, (v) => /^[A-Za-z0-9_-]{16,160}$/.test(asStr(v)), 6));
  const merchantCode = asStr(findKey(e, MERCHANT_CODE_RES, (v) => /^[A-Za-z0-9_]{2,20}$/.test(asStr(v)), 6)) || 'STORE';
  const status = asStr(findKey(e, STATUS_RES, isText, 3));
  const method = asStr(findKey(e, PAY_METHOD_RES, isText, 4));
  // 대표님 11-02 무신사 JSON: 상태는 orderOptionList(옵션별) — 구매 확정 claimState 0 · orderState 50, 반품 완료 claimState 61 · orderState 40 · orderStateText 「반품 완료」
  const opts = Array.isArray(e.orderOptionList) ? (e.orderOptionList as unknown[]).filter(isObj) as Raw[] : [];
  const optOff: Raw[] = opts.filter((o) => CANCELLED.test(asStr(o.orderStateText)) || (typeof o.claimState === 'number' && o.claimState === 61));
  const optAmts = opts.length > 1 ? opts.filter((o) => !optOff.includes(o)).map((o) => toMoney(findKey(o, AMOUNT_RES, isMoney, 2))) : [];
  const keptAmount = optAmts.length > 0 && optAmts.every((v) => v !== undefined) ? optAmts.reduce((a: number, v) => a + (v as number), 0) : amount;
  return {
    orderNo, orderedAt, amount: keptAmount,
    title: clip(findKey(e, TITLE_RES, isText, 4), 80),
    seller: clip(findKey(e, SELLER_RES, isText, 4), 80),
    ...(paymentKey && tid ? { pay: { paymentKey, tid, merchantCode } } : {}),
    ...(method ? { method } : {}),
    cancelled: opts.length > 0 ? optOff.length === opts.length : CANCELLED.test(status),
    ...(optOff.length > 0 && optOff.length < opts.length ? { mixed: true } : {}),
  };
}

/** 매출전표 JSON → Slip(이름으로 찾기, 네 칸 중 셋 이상이면 영수증) */
export function slipFromJson(json: unknown): Slip | null {
  const approval = asStr(findKey(json, [/^(approvalNo|approveNo|approvalNumber|apprNo|authNo|cardApprovalNo|approval_no|appr_no|cardAppNo|cardApprNo)$/i, /(approv|appr|auth).*(no|num)/i], isDigits(5, 16), 6)) || undefined;
  const bizRaw = asStr(findKey(json, [/^(businessNo|bizNo|businessNumber|bsnNo|corpNo|bizRegNo|merchantBizNo|sellerBizNo|coNo)$/i, /(biz|business|bsn).*(no|num)/i], (v) => /^\d{3}-?\d{2}-?\d{5}$/.test(asStr(v)), 6));
  const businessNumber = bizRaw ? bizRaw.replace(/^(\d{3})-?(\d{2})-?(\d{5})$/, '$1-$2-$3') : undefined;
  const paidRaw = findKey(json, [/^(approvalDateTime|approvalDate|approvedAt|approveDt|paidAt|paymentDateTime|paymentDate|payDate|transDate|tradeDate)$/i, /(approv|appr|paid|trade|trans).*(date|dt|time|at)/i], isStamp, 6);
  const paidAt = paidRaw === undefined ? undefined : (normalizeKst(paidRaw) ?? undefined);
  const amount = toMoney(findKey(json, [/^(approvalAmount|approveAmount|paymentAmount|payAmount|totalAmount|amount|apprAmt)$/i, /(approv|appr|payment).*(amount|amt)/i], isMoney, 6));
  const cardIssuer = clip(findKey(json, [/^(cardName|cardCompany|cardCompanyName|issuerName|cardNm|issuer)$/i], (v) => isText(v) && asStr(v).length <= 20, 6), 30);
  const merchant = clip(findKey(json, [/^(merchantName|storeName|sellerName|shopName|companyName)$/i], isText, 6), 60);
  const found = [amount, paidAt, approval, businessNumber].filter((v) => v !== undefined).length;
  if (found < 3) return null;
  return { businessNumber, approval, paidAt, paidAtNoSeconds: false, amount, cardIssuer, merchant };
}

/** 매출전표 응답(JSON 이면 이름으로, 아니면 글자에서 extractSlip) → Slip */
/**
 * 무신사페이 매출전표 HTML(대표님 11-02 원문) — receipt-detail__definition / description 짝. 태그 · 주석을 걷어 낸 글자에서 이름으로 읽는다
 * (요청으로 받은 HTML 이든 웹뷰가 연 화면 글자든 같은 글자가 남는다). 결제일시 줄은 주석이라 「승인 YYYY-MM-DD HH:mm:ss」 를 쓴다
 */
export function slipFromMusinsaText(raw: string): Slip | null {
  const t = raw.replace(/<!--[\s\S]*?-->/g, ' ').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ');
  const approval = /승인\s*번호\s*(\d{6,12})/.exec(t)?.[1];
  const paid = /승인\s*(\d{4}-\d{2}-\d{2})\s+(\d{2}:\d{2}:\d{2})/.exec(t);
  const total = /합\s*계\s*([\d,]+)\s*원/.exec(t)?.[1];
  if (!approval || !paid || !total) return null;
  const cardIssuer = /카드\s*종류\s*([^\s]{1,20})/.exec(t)?.[1];
  return { approval, paidAt: `${paid[1]} ${paid[2]}`, amount: Number(total.replace(/,/g, '')), ...(cardIssuer ? { cardIssuer } : {}) };
}

export function slipOf(r: FetchResult): Slip | null {
  let json: unknown = r.data;
  if (json === undefined && typeof r.text === 'string' && /^\s*[{[]/.test(r.text)) { try { json = JSON.parse(r.text); } catch { json = undefined; } }
  if (json !== undefined) { const s = slipFromJson(json); if (s) return s; }
  if (typeof r.text !== 'string') return null;
  return slipFromMusinsaText(r.text) ?? extractSlip(r.text);
}

/**
 * extractSlip 의 상호(판매자상호 · 상호 · 판매처)는 한 줄 안의 글자를 읽는데, 웹뷰 스크립트(siteFetchScript)가 HTML 의 줄바꿈을 공백으로 접어 한 줄이 되므로
 * 뒤 칸 글자(사업자등록번호 · 카드사 · 승인번호 …)까지 끌려온다(통합 시험에서 확인) — 다음 칸 이름 앞에서 자른다. 남는 글자가 없으면 없음
 */
export const cleanMerchant = (m: string | undefined): string | undefined => {
  if (!m) return undefined;
  const head = m.split(/\s(?:사업자|대표|카드사|카드\s*번호|승인|거래|결제|합\s*계|금액|전화|주소|사업장)/)[0] ?? '';
  const t = head.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, 60) : undefined;
};

/** 매출전표 글자에서 카드 영수증이 아닌 결제(현금영수증 · 무통장 · 포인트)를 가리킨다 — 카드 승인 글자가 없을 때만 */
const NO_CARD_TEXT = /현금영수증|무통장|계좌이체|가상계좌|포인트|적립금|머니/;

/** 값 없는 글자 모양 줄 — HTML 매출전표는 키 구조가 없어 읽은 칸의 있음 · 없음만 남긴다 */
const textShapeLines = (text: string): string[] => [
  `text.length : number`,
  `has.approvalWord : ${/승인\s*번호/.test(text) ? 'boolean' : 'missing'}`,
  `has.businessWord : ${/사업자/.test(text) ? 'boolean' : 'missing'}`,
  `has.paidWord : ${/(결제|거래|승인)\s*(일시|일자)/.test(text) ? 'boolean' : 'missing'}`,
  `has.amountWord : ${/(승인|결제)\s*금액|합\s*계/.test(text) ? 'boolean' : 'missing'}`,
  `has.cardWord : ${/카드/.test(text) ? 'boolean' : 'missing'}`,
  `has.noCardWord : ${NO_CARD_TEXT.test(text) ? 'boolean' : 'missing'}`,
];

/* ---------------- 흐름 ---------------- */

type Phase = 'idle' | 'shop' | 'list' | 'detail' | 'receiptorigin' | 'receipts' | 'receiptnav' | 'finished';
type Cursor = { onlineOffset?: string; offlineOffset?: string; tries: number };
type Job = { order: ReceiptOrder; parsed: ParsedOrder; key: string; tries: number };
type Struct = { where: string; host: string; path: string; lines: string[] };
const isMusinsaHost = (host: string): boolean => host === 'musinsa.com' || host.endsWith('.musinsa.com');
const LOGIN_WORDS = /로그인|아이디|비밀번호|회원가입|비회원/;
const isMusinsaLogin = (url: string, text: string): boolean => {
  if (/\/(auth|login)/i.test(url)) return true;
  if (/\d[\d,]*원|주문/.test(text)) return false;
  return LOGIN_WORDS.test(text);
};

export function createMusinsaApiFlow(opts: ApiFlowOptions = {}): NaverFlow {
  const now = opts.now ?? (() => Date.now());
  const maxSteps = opts.maxSteps ?? 4000;
  const budgetMs = opts.budgetMs ?? 1_500_000;
  const maxOrders = opts.maxOrders ?? 600;
  const allowNoSeconds = opts.allowNoSeconds ?? false;
  const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
  const startedAt = now();
  let cutoff = ymd(startedAt - (opts.windowDays ?? LOOKBACK_DAYS) * DAY_MS);
  const untilDate = ymd(startedAt + 9 * 3600000);

  let phase: Phase = 'idle';
  let resumeTo: 'list' | 'detail' | 'receipts' = 'list';
  let steps = 0;
  let tries = 0;
  let lastUrl = '';
  let lastText = '';
  let final: FlowOut | null = null;
  const knownNos = new Set<string>();
  const knownKeys = new Set<string>();
  const knownTails = new Set<string>();
  /* 목록 단계 */
  let cursor: Cursor = { tries: 0 };
  let listPages = 0;
  const found = new Map<string, ParsedOrder>();
  let listOk = 0;
  let listFailed = 0;
  let listNet = 0;
  let shapeMiss = 0;
  /** 같은 주문번호로 합친 상품 줄 수(묶음 주문) */
  let bundled = 0;
  /* 상세 · 매출전표 단계 */
  let queue: Job[] = [];
  let batch: Job[] = [];
  const readyJobs: Job[] = [];
  let receiptOriginReady = false;
  const orders: ReceiptOrder[] = [];
  const pending: ReceiptOrder[] = [];
  const outcomes: OutcomeEvent[] = [];
  const stats: FlowStats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [] };
  let total = 0;
  let okN = 0;
  let noneN = 0;
  let failN = 0;
  let blockedRun = 0;
  let timeoutRun = 0;
  let allNetBatches = 0;
  let slow = false;
  /* 매출전표 웹뷰 직접 열기(교차 출처 대체 길) — navMode 가 켜지면 매출전표 단계는 요청 대신 goto 로 한 장씩 읽는다 */
  let navMode = false;
  let navJobs: Job[] = [];
  let navJob: Job | null = null;
  let navFailRun = 0;
  const MAX_NAV_FAIL_RUN = 3;
  /* 키 구조 기록 — 같은 모양은 한 번만 */
  const structSeen = new Set<string>();
  const structQ: Struct[] = [];
  let pendingGo: (() => FlowOut) | null = null;
  let ending: { reason: string; orders: ReceiptOrder[]; stats: FlowStats } | null = null;
  let endQueue: string[] = [];

  const READ: FlowOut = { kind: 'read' };

  /** 주문 줄마다 상태 칸(코드 · 상태 글자)만 — 상품명 · 결제 값은 남기지 않는다(대표님 11-03 07:40 반품 · 취소 주문이 목록에 남음) */
  let statLog: string[] = [];
  const queueStructure = (where: string, host: string, path: string, lines: string[]): void => {
    if (structSeen.has(where) || lines.length === 0) return;
    structSeen.add(where);
    structQ.push({ where, host, path, lines });
  };
  /** 쌓인 구조 기록을 먼저 내보내고, 다 내보낸 뒤 go() 의 동작으로 이어 간다(구동기가 structure 마다 resume 을 먹인다) */
  const withStructure = (go: () => FlowOut): FlowOut => {
    const s = structQ.shift();
    if (!s) return go();
    pendingGo = go;
    return { type: 'structure', ...s };
  };

  const drainEnd = (): FlowOut => {
    const s = structQ.shift();
    if (s) return { type: 'structure', ...s };
    const w = endQueue.shift();
    if (w !== undefined) return { type: 'probe', where: w, shape: pageShape(lastUrl, lastText) };
    const e = ending;
    if (!final && e) final = { type: 'done', reason: e.reason, orders: e.orders, stats: e.stats };
    return final ?? { type: 'done', reason: 'unknown', orders: [], stats: { ...stats } };
  };
  /** 끝: 구조 기록 → 개수 기록(값 없음) → 끝난 까닭 기록 → done */
  const finish = (reason: string): FlowOut => {
    if (final) return final;
    if (!ending) {
      const at = phase;
      phase = 'finished';
      pendingGo = null;
      ending = { reason, orders: pending.splice(0), stats: { ...stats } };
      endQueue = [`flowc-t${total}-k${okN}-x${noneN}-f${failN}-q${queue.length}`, `flowb-merged${bundled}-mixed${[...found.values()].filter((p) => p.mixed).length}-cancel${[...found.values()].filter((p) => p.cancelled).length}`, `flowe-${reason}-${at}`];
    }
    return drainEnd();
  };
  const retryOr = (reason: string): FlowOut => {
    if (tries < 2) { tries++; return READ; }
    return finish(reason);
  };

  const setOutcome = (key: string, outcome: Outcome): void => { outcomes.push({ key, outcome }); };
  const fail = (j: Job, code: FailCode): void => {
    failN++;
    setOutcome(j.key, { state: 'failed', code });
    stats.unfetched = [...(stats.unfetched ?? []), j.order.orderNo];
  };
  const none = (j: Job): void => { noneN++; setOutcome(j.key, { state: 'none' }); };

  /* ----- 목록: meta offset ----- */
  const fetchAction = (reqs: FetchReq[], slowRun: boolean): FlowOut => ({
    kind: 'fetch', reqs,
    conc: slowRun ? FETCH_SLOW.conc : FETCH_CONC,
    staggerMs: slowRun ? 0 : FETCH_STAGGER_MS,
    gapMs: slowRun ? FETCH_SLOW.gapMs : 0,
    timeoutMs: FETCH_TIMEOUT_MS, deadlineMs: FETCH_DEADLINE_MS,
  });
  const listAction = (): FlowOut => {
    phase = 'list';
    const offsets = `${cursor.onlineOffset ? `&onlineOffset=${encodeURIComponent(cursor.onlineOffset)}` : ''}${cursor.offlineOffset ? `&offlineOffset=${encodeURIComponent(cursor.offlineOffset)}` : ''}`;
    return fetchAction([{
      key: 'list', method: 'GET', as: 'json', accept: LIST_ACCEPT,
      url: `${MUSINSA_LIST_API}?size=${LIST_SIZE}&searchText=&startDate=${cutoff}&endDate=${untilDate}${offsets}`,
    }], slow);
  };

  const onListFetched = (results: FetchResult[]): FlowOut => {
    if (phase !== 'list') return finish('unexpected-event');
    timeoutRun = 0;
    const r = results[0] ?? { key: 'list', st: 'net' as const };
    if (r.st === 'login') { phase = 'shop'; resumeTo = 'list'; tries = 0; return { type: 'login' }; }
    if (r.st !== 'ok') {
      if (r.st === 'blocked') { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); }
      if (cursor.tries + 1 < MAX_TRIES) { cursor.tries++; return listAction(); }
      listFailed++; if (r.st === 'net') listNet++;
      return finish('list-failed');
    }
    blockedRun = 0;
    listOk++;
    listPages++;
    queueStructure('mus-list', LIST_HOST, LIST_PATH, structureLines(r.data));
    const rows = findOrderRows(r.data);
    if (rows.length === 0 && hasObjectArray(r.data)) shapeMiss++;
    for (const e of rows) {
      const p = parseOrderRow(e);
      if (!p) { stats.rejected++; continue; }
      if (statLog.length < 280) statLog.push(`o${statLog.length + 1} ${musinsaStatusLine(e, p)}`);
      // 묶음 주문 — 같은 주문번호의 상품 줄을 모두 합친다(대표님 11-02: 6/21 묶음 주문에서 반품된 1개만 읽었다). 반품 · 취소 상품은 금액에서 빼고, 전부 반품 · 취소일 때만 취소 주문
      const prev = found.get(p.orderNo);
      if (!prev) { found.set(p.orderNo, p); continue; }
      bundled++;
      const both = prev.cancelled && p.cancelled;
      const amount = both ? prev.amount : (prev.cancelled ? 0 : prev.amount) + (p.cancelled ? 0 : p.amount);
      found.set(p.orderNo, { ...prev, ...(prev.pay ? {} : p.pay ? { pay: p.pay } : {}), ...(prev.method ? {} : p.method ? { method: p.method } : {}), amount, cancelled: both, ...(!both && (prev.cancelled || p.cancelled || prev.mixed || p.mixed) ? { mixed: true } : {}) });
    }
    const next = musinsaNextOffsets(r.data);
    if (!next?.onlineOffset || next.onlineOffset === '999999999999999999' || listPages >= 100) return withStructure(listDone);
    cursor = { ...next, tries: 0 };
    return withStructure(listAction);
  };

  /** 목록 끝 → 가져올 주문(최신 먼저, 이미 가져온 것 제외). 새 목록 행은 서버에 올린다 */
  const listDone = (): FlowOut => {
    if (listOk === 0) return finish('list-failed');
    if (statLog.length > 0) { queueStructure('mus-status', LIST_HOST, LIST_PATH, statLog); statLog = []; return withStructure(listDone); }
    const all = [...found.values()]
      .filter((p) => p.orderedAt.slice(0, 10) >= cutoff)
      .sort((a, b) => (a.orderedAt < b.orderedAt ? 1 : a.orderedAt > b.orderedAt ? -1 : 0));
    if (all.length === 0) return finish(shapeMiss > 0 || (listFailed === 0 && stats.rejected > 0) ? 'list-shape' : 'all-rows');
    const matched = new Set<string>();
    const jobs: Job[] = [];
    for (const p of all) {
      const key = outcomeKey(p.orderNo, p.orderedAt, p.amount);
      const lo = listOrder({ orderNo: p.orderNo, orderedAt: p.orderedAt, amount: p.amount, title: p.title, seller: p.seller });
      if (only) { if (!only.has(key)) continue; matched.add(key); }
      else if (knownNos.has(p.orderNo) || knownTails.has(tailOf(p.orderNo, p.orderedAt)) || (lo.listKey !== undefined && knownKeys.has(lo.listKey))) continue;
      jobs.push({ order: lo, parsed: p, key, tries: 0 });
      if (jobs.length >= maxOrders) break;
    }
    if (only) {
      // 목록에서 이 줄을 못 찾았다(주문이 사라졌거나 시각이 바뀜) — 조용히 끝내지 않고 그 줄에 까닭을 남긴다
      for (const k of only) if (!matched.has(k)) { failN++; setOutcome(k, { state: 'failed', code: 'no-pair' }); }
    } else pending.push(...jobs.filter((j) => !j.parsed.cancelled).map((j) => j.order));   // 취소 · 반품 · 환불 주문은 서버에 올리지 않는다(대표님 11-02)
    total = jobs.length;
    queue = [];
    for (const j of jobs) {
      const p = j.parsed;
      if (p.cancelled) { noneN++; setOutcome(j.key, { state: 'none', why: 'cancelled' }); }
      else if (p.method && NON_CARD.test(p.method)) none(j);
      else queue.push(j);
    }
    if (queue.length === 0) return withStructure(() => finish('all-rows'));
    return withStructure(detailBatch);
  };

  const detailBatch = (): FlowOut => {
    if (queue.length === 0) return withStructure(sendBatch);
    batch = queue.splice(0, slow ? FETCH_SLOW.batch : FETCH_BATCH);
    phase = 'detail';
    return fetchAction(batch.map((j): FetchReq => ({ key: j.key, method: 'GET', url: musinsaDetailUrl(j.parsed.orderNo), as: 'json', accept: LIST_ACCEPT })), slow);
  };

  const onDetail = (results: FetchResult[]): FlowOut => {
    if (phase !== 'detail') return finish('unexpected-event');
    const byKey = new Map(results.map((r) => [r.key, r]));
    const again: Job[] = [];
    const ready: Job[] = [];
    let sawLogin = false;
    let blocked = 0;
    for (const j of batch) {
      const r = byKey.get(j.key) ?? { key: j.key, st: 'net' as const };
      if (r.st === 'login') { sawLogin = true; again.push(j); continue; }
      if (r.st !== 'ok') {
        if (r.st === 'blocked') blocked++;
        if (j.tries + 1 < MAX_TRIES) { j.tries++; again.push(j); } else fail(j, 'network');
        continue;
      }
      const pay = readMusinsaDetail(r.data);
      if (!pay) { fail(j, 'no-pair'); continue; }
      j.parsed.pay = pay;
      ready.push(j);
    }
    batch = [];
    readyJobs.push(...ready);
    queue = [...again, ...queue];
    if (sawLogin) { phase = 'shop'; resumeTo = 'detail'; tries = 0; return { type: 'login' }; }
    if (blocked > 0) { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); } else blockedRun = 0;
    if (queue.length > 0) return withStructure(detailBatch);
    queue.push(...readyJobs.splice(0));
    return withStructure(sendBatch);
  };

  /* ----- 매출전표 ----- */
  const receiptReq = (j: Job): FetchReq => {
    const p = j.parsed.pay as NonNullable<ParsedOrder['pay']>;
    return {
      key: j.key, method: 'GET', as: 'text', accept: RECEIPT_ACCEPT,
      url: `${MUSINSA_RECEIPT_BASE}${j.parsed.orderNo}?paymentKey=${encodeURIComponent(p.paymentKey)}&merchantCode=${encodeURIComponent(p.merchantCode)}&tid=${encodeURIComponent(p.tid)}`,
    };
  };
  const sendBatch = (): FlowOut => {
    if (queue.length === 0) return finish('all-rows');
    batch = queue.splice(0, slow ? FETCH_SLOW.batch : FETCH_BATCH);
    for (const j of batch) setOutcome(j.key, { state: 'fetching' });
    if (navMode) { navJobs = [...batch, ...navJobs]; batch = []; return navNext(); }
    // 영수증 도메인 첫 화면(pay.musinsapayments.com/)은 다른 곳으로 넘어가 shop-lost 가 된다(11-02 실측) — 첫 영수증 주소로 들어간다
    if (!receiptOriginReady) { phase = 'receiptorigin'; return { type: 'goto', url: batch[0] ? receiptReq(batch[0]).url : MUSINSA_RECEIPT_ORIGIN }; }
    phase = 'receipts';
    return fetchAction(batch.map(receiptReq), slow);
  };

  /** 웹뷰 직접 열기(교차 출처 대체 길): 다음 매출전표 주소로 이동한다. 다 읽으면 끝낸다 */
  const navNext = (): FlowOut => {
    const j = navJobs.shift();
    navJob = j ?? null;
    if (!j) return finish('all-rows');
    phase = 'receiptnav';
    return { type: 'goto', url: receiptReq(j).url };
  };
  /** 웹뷰 직접 열기를 그만둘 때 — 아직 읽지 못한 줄(읽는 중 · 대기)에 모두 까닭을 남긴다 */
  const failNavRest = (): void => {
    if (navJob) { fail(navJob, 'network'); navJob = null; }
    for (const j of navJobs) fail(j, 'network');
    navJobs = [];
    for (const j of queue) fail(j, 'network');
    queue = [];
  };

  /** 매출전표 하나 → 완성 주문 · 영수증 없음 · 읽지 못함 */
  const settleOk = (j: Job, r: FetchResult): void => {
    const slip = slipOf(r);
    const lines = r.data !== undefined ? structureLines(r.data) : (typeof r.text === 'string' ? textShapeLines(r.text) : []);
    queueStructure('mus-rcpt', RECEIPT_HOST, RECEIPT_PATH, lines);
    if (!slip) {
      if (typeof r.text === 'string' && NO_CARD_TEXT.test(r.text) && !/승인\s*번호/.test(r.text)) none(j); else fail(j, 'unreadable');
      return;
    }
    const amount = slip.amount ?? j.parsed.amount;
    const merchantName = cleanMerchant(slip.merchant);
    const done = toImportOrder({ ...slip, merchant: merchantName }, { orderNo: j.parsed.orderNo, seller: j.parsed.seller, title: j.parsed.title, amount }, { kind: 'card', allowNoSeconds });
    if (!done) { fail(j, 'unreadable'); return; }
    // 세부 칸(서버 receipt_link_orders.detail) — 매출전표 응답 칸 이름은 원문에 없어 이름으로 찾은 값이다(추정)
    const detail: ReceiptDetail = {};
    if (slip.approval) detail.approvalNo = slip.approval;
    if (slip.cardIssuer) detail.cardCompany = slip.cardIssuer;
    if (slip.businessNumber) detail.sellerBusinessNo = slip.businessNumber;
    if (slip.paidAt) detail.approvalAt = slip.paidAt;
    if (slip.amount !== undefined) detail.approvalAmount = slip.amount;
    if (merchantName) detail.merchantName = merchantName;
    if (Object.keys(detail).length > 0) done.detail = detail;
    // 목록 행과 같은 키로 이어 서버가 목록 행을 완성본으로 바꾸게 한다(영수증의 결제 시각이 주문 시각과 달라도)
    if (j.order.listKey) done.listKey = j.order.listKey;
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
    // 매출전표 호스트로 가는 요청이 한 건도 못 읽은 채 연달아 모두 net 이면 교차 출처 거절 — 두 묶음 연속이면 요청을 되풀이하지 않고
    // 숨은 웹뷰가 매출전표 주소를 직접 연다(대표님 11-02 「어떤 방식이든 해결」 · 10-29 17:05 「브라우저 눌러서라도 수집해」)
    if (rs.length >= 2 && okN === 0 && rs.every((x) => x.r.st === 'net')) {
      allNetBatches++;
      batch = [];
      if (allNetBatches >= MAX_ALL_NET_BATCHES) {
        navMode = true;
        navJobs = [...rs.map((x) => x.j), ...queue];
        queue = [];
        return withStructure(navNext);
      }
      const retry: Job[] = [];
      for (const { j } of rs) { if (j.tries + 1 < MAX_TRIES) { j.tries++; retry.push(j); } else fail(j, 'network'); }
      queue = [...retry, ...queue];
      return withStructure(sendBatch);
    }
    allNetBatches = 0;
    const again: Job[] = [];
    let sawLogin = false;
    let blocked = 0;
    for (const { j, r } of rs) {
      if (r.st === 'ok') settleOk(j, r);
      else if (r.st === 'login') { sawLogin = true; again.push(j); }
      else if (r.st === 'blocked' || r.st === 'net' || (r.st === 'http' && (r.status ?? 0) >= 500)) {
        if (r.st === 'blocked') blocked++;
        if (j.tries + 1 < MAX_TRIES) { j.tries++; again.push(j); } else fail(j, r.st === 'blocked' ? 'blocked' : 'network');
      } else if (r.st === 'http') {
        if (r.status === 404 || r.status === 410) none(j); else fail(j, 'no-pair');
      } else fail(j, 'unreadable');
    }
    batch = [];
    queue = [...again, ...queue];
    if (sawLogin) { phase = 'shop'; resumeTo = 'receipts'; tries = 0; return { type: 'login' }; }
    if (blocked > 0) { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); } else blockedRun = 0;
    return withStructure(sendBatch);
  };

  const onTimeout = (): FlowOut => {
    if (phase === 'receiptnav') {
      timeoutRun++;
      const j = navJob;
      navJob = null;
      if (j) { if (j.tries + 1 < MAX_TRIES) { j.tries++; navJobs.unshift(j); } else fail(j, 'network'); }
      navFailRun++;
      if (navFailRun >= MAX_NAV_FAIL_RUN) { failNavRest(); return finish('cross-origin'); }
      return navNext();
    }
    if (phase === 'receipts') {
      timeoutRun++;
      const lost = batch;
      batch = [];
      const again: Job[] = [];
      for (const j of lost) { if (j.tries + 1 < MAX_TRIES) { j.tries++; again.push(j); } else fail(j, 'network'); }
      queue = [...again, ...queue];
      if (timeoutRun >= MAX_TIMEOUT_RUN) return finish('timeouts');
      return sendBatch();
    }
    if (phase === 'detail') {
      timeoutRun++;
      const lost = batch;
      batch = [];
      for (const j of lost) { if (j.tries + 1 < MAX_TRIES) { j.tries++; queue.unshift(j); } else fail(j, 'network'); }
      if (timeoutRun >= MAX_TIMEOUT_RUN) return finish('timeouts');
      return detailBatch();
    }
    if (phase === 'list') {
      timeoutRun++;
      if (cursor.tries + 1 < MAX_TRIES) { cursor.tries++; return listAction(); }
      listFailed++; listNet++;
      if (timeoutRun >= MAX_TIMEOUT_RUN) return finish('timeouts');
      return finish('list-failed');
    }
    return retryOr('timeout');
  };

  const onPage = (url: string, text: string): FlowOut => {
    lastUrl = url;
    lastText = text;
    if (phase === 'receiptnav') {
      // 웹뷰가 직접 연 매출전표 화면 — HTML 이면 글자에서, JSON 본문이면 그대로 읽는다
      const j = navJob;
      navJob = null;
      if (!j) return withStructure(navNext);
      if (isMusinsaLogin(url, text)) { navJobs.unshift(j); phase = 'shop'; resumeTo = 'receipts'; tries = 0; return { type: 'login' }; }
      const t = text.trim();
      if (t === '') {
        // 빈 화면 · 오류 화면 — 연달아 세 번이면 매출전표 호스트가 막은 것으로 보고 끝낸다
        navFailRun++;
        fail(j, 'network');
        if (navFailRun >= MAX_NAV_FAIL_RUN) { failNavRest(); return finish('cross-origin'); }
        return navNext();
      }
      navFailRun = 0;
      settleOk(j, { key: j.key, st: 'ok', text: t });
      return withStructure(navNext);
    }
    if (phase === 'receiptorigin') {
      if (hostOf(url) !== RECEIPT_HOST) return retryOr('shop-lost');
      receiptOriginReady = true;
      phase = 'receipts';
      return fetchAction(batch.map(receiptReq), slow);
    }
    if (phase !== 'shop') return finish('unexpected-page');
    if (isMusinsaLogin(url, text)) return { type: 'login' };
    if (!isMusinsaHost(hostOf(url))) return retryOr('shop-lost');
    tries = 0;
    if (resumeTo === 'receipts') return navMode ? navNext() : sendBatch();
    if (resumeTo === 'detail') return detailBatch();
    return listAction();
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
        phase = 'shop';
        resumeTo = 'list';
        tries = 0;
        return { type: 'goto', url: MUSINSA_ORDER_LIST_URL };
      case 'page':
        return onPage(ev.url, ev.text);
      case 'fetched':
        if (phase === 'list') return onListFetched(ev.results);
        if (phase === 'detail') return onDetail(ev.results);
        return onReceiptsFetched(ev.results);
      case 'timeout':
        return onTimeout();
      case 'resume': {
        // 구조 기록(structure)을 내보낸 뒤의 이어 가기 — 남은 구조 기록이 있으면 그것부터, 없으면 멈춰 둔 동작
        const s = structQ.shift();
        if (s) return { type: 'structure', ...s };
        const go = pendingGo;
        pendingGo = null;
        return go ? go() : finish('unexpected-event');
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
