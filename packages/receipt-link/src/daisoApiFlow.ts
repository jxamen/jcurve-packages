/**
 * 다이소 영수증 흐름 — 다이소몰 온라인 주문 + 매장 전자영수증. **요청만** 쓴다(클릭 · 로그인 정보 입력 없음).
 * 서버 크롬 실측(tools/crawl-test presets.json `_version` 21 · src/flow.cjs, 2026-11-05 대표님 15:45 「다이소 · 올리브영도 수집」) 순서 그대로:
 *  1) https://www.daisomall.co.kr/ 를 한 번 연다(요청 출처 페이지 — 실행당 한 번). 로그인 화면(/mb/mbb/SCR_MBB_0097A)이면 로그인
 *  2) 온라인 목록  POST https://fapi.daisomall.co.kr/or/orb/selOr   {strtDt 오늘-1년 · endDt 오늘 · currentPage p · pageSize 15} — 빈 data[] 또는 받은 수 ≥ 첫 줄 totalCnt 까지
 *     취소(orCnclDtm 있음 · orStsCdNm 에 취소 · orderProd 전부 cnclSeCd)는 뺀다(대표님 「취소는 빼기」)
 *  3) 온라인 상세  POST https://fapi.daisomall.co.kr/or/orb/orDts/selOrDtl   {orNo} — data.orPyAm.totPyAm(결제 금액) · data.orPymt(pymtCdNm · credCoCdNm · pyApvDtm)
 *     카드 결제면 카드영수증(card, 카드사 · 승인 시각), 아니면 구매영수증(purchase). 카드 영수증 화면(pyRctwUrl, 결제사 도메인)은 내용이 미확인이라 열지 않는다
 *  4) 매장 목록    POST https://fapi.daisomall.co.kr/or/orb/orOff/selOfflineOrList   {strtDt 1일 · endDt 말일 · pageIndex 0..} 한 달씩 12개월, hasNext 동안 — salDiv "92"(취소)는 뺀다
 *  5) 매장 영수증  POST https://fapi.daisomall.co.kr/or/orb/orOff/getOfflineOrReceipt   {ssNum} — data.orMOfflineorVO(saleDtm · saleAmt · addTax · cardAmt · cashAmt · strNm · bzmnNo) · orOfflineorApprVOList[](apprNo · cardNm · apprYmd · apprTm)
 *     결제 금액 = saleAmt + addTax(매장 saleAmt 는 부가세 뺀 값 — 실측 909 + 91 = 1,000원)
 * 같은 FlowEvent/FlowOut 규약(naverReceipt.ts)을 따르고 구동기가 숨은 웹뷰에서 범용 요청(fetch 동작, siteFetch.ts)을 실행한다.
 * 쿠키 · 토큰 · 이름 · 주소 · 전화 · 카드번호는 이 파일 어디에도 없다 — 요청 모양과 응답 키 이름만 쓴다. 로그에는 건수만.
 * 목록 줄은 먼저 목록 행(list)으로 서버에 올리고, 영수증 · 상세를 읽은 주문은 완성본으로 바꿔 올린다(컬리 흐름과 같다).
 */
import { noneOrder, normalizeKst, pageShape, toImportOrder, type FlowEvent, type FlowOut, type FlowStats, type NaverFlow, type ReceiptOrder } from './naverReceipt';
import { tailOf, type ApiFlowOptions } from './naverApiFlow';
import { FETCH_BATCH, FETCH_CONC, FETCH_DEADLINE_MS, FETCH_SLOW, FETCH_STAGGER_MS, FETCH_TIMEOUT_MS, type FetchReq, type FetchResult } from './siteFetch';
import { outcomeKey, type FailCode, type Outcome, type OutcomeEvent } from './runOutcome';
import { structureLines } from './shapeLines';
import type { ReceiptDetail } from './model';

export const DAISO_HOME_URL = 'https://www.daisomall.co.kr/';
export const DAISO_LOGIN_PATH = '/mb/mbb/SCR_MBB_0097A';
export const DAISO_LIST_URL = 'https://fapi.daisomall.co.kr/or/orb/selOr';
export const DAISO_DETAIL_URL = 'https://fapi.daisomall.co.kr/or/orb/orDts/selOrDtl';
export const DAISO_STORE_LIST_URL = 'https://fapi.daisomall.co.kr/or/orb/orOff/selOfflineOrList';
export const DAISO_STORE_RECEIPT_URL = 'https://fapi.daisomall.co.kr/or/orb/orOff/getOfflineOrReceipt';
const SELLER = '다이소몰';
const STORE_SELLER = '다이소';
const PAGE_SIZE = 15;
const MAX_LIST_PAGES = 60;
const STORE_MONTHS = 12;
const MAX_STORE_PAGES = 50;
const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;
const MAX_LIST_TRIES = 3;
const MAX_JOB_TRIES = 2;
const MAX_BLOCKED_RUN = 3;
const MAX_TIMEOUT_RUN = 3;

type Raw = Record<string, unknown>;
const isObj = (v: unknown): v is Raw => v !== null && typeof v === 'object' && !Array.isArray(v);
const obj = (v: unknown): Raw => (isObj(v) ? v : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : typeof v === 'number' && Number.isFinite(v) ? String(v) : '');
/** 금액 — 숫자 또는 「1,000」 글자. 0 이상 정수만 */
const num = (v: unknown): number | undefined => {
  if (typeof v === 'number') return Number.isInteger(v) && v >= 0 && v <= 1e9 ? v : undefined;
  if (typeof v === 'string' && /\d/.test(v)) { const n = Number(v.replace(/[^\d.-]/g, '')); return Number.isInteger(n) && n >= 0 && n <= 1e9 ? n : undefined; }
  return undefined;
};
/** 한국 날짜 YYYYMMDD */
const kstYmd = (ms: number): string => new Date(ms + KST_MS).toISOString().slice(0, 10).replace(/-/g, '');
const pathOf = (url: string): string => { const i = url.indexOf('/'); return i < 0 ? '/' : url.slice(i).split(/[?#]/)[0]; };
const hostOf = (url: string): string => url.split('/')[0].toLowerCase();
const splitUrl = (url: string): { host: string; path: string } => { const m = /^https:\/\/([^/?#]+)([^?#]*)/.exec(url); return { host: m ? m[1] : '', path: m ? m[2] : '/' }; };
const CANCEL = /취소|반품|환불/;

/* ---------------- 응답 읽기(순수 함수 — 시험한다) ---------------- */

/** 온라인 목록 응답 → 주문 줄 배열(data[] 가 바로 주문 배열, 11-05 실측) */
export function daisoListRows(json: unknown): Raw[] {
  const d = obj(json).data;
  return arr(Array.isArray(d) ? d : obj(d).list ?? obj(d).data).filter(isObj);
}
/** 첫 줄의 totalCnt — 없으면 null */
export const daisoTotalCount = (rows: Raw[]): number | null => { const n = num(rows[0]?.totalCnt); return n === undefined ? null : n; };

/** 취소된 온라인 주문 — orCnclDtm 있음 · 상태 글자에 취소 · 상품 줄이 모두 취소 구분(cnclSeCd) */
export function daisoCancelled(o: Raw): boolean {
  if (str(o.orCnclDtm)) return true;
  if (CANCEL.test(str(o.orStsCdNm))) return true;
  const prods = arr(o.orderProd).filter(isObj);
  return prods.length > 0 && prods.every((p) => str(p.cnclSeCd) !== '');
}

/** 온라인 목록 줄 → 목록 주문(주문번호 orNo · 결제 완료 시각 pyCmptDtm · 금액 = 상품 줄 orAm 합). 못 읽으면 null */
export function daisoListOrder(o: Raw): ReceiptOrder | null {
  const orderNo = str(o.orNo);
  if (!/^[0-9A-Za-z-]{6,30}$/.test(orderNo)) return null;
  const orderedAt = normalizeKst(str(o.pyCmptDtm) || str(o.orDt) || str(o.orDtm));
  if (!orderedAt) return null;
  const prods = arr(o.orderProd).filter(isObj);
  const amount = prods.reduce((a, p) => a + (num(p.orAm) ?? 0), 0);
  if (amount < 1) return null;
  const names = prods.map((p) => str(p.exhPdNm) || str(p.pdNm)).filter(Boolean);
  const title = names.length > 0 ? `${names[0]}${names.length > 1 ? ` 외 ${names.length - 1}건` : ''}` : undefined;
  const out: ReceiptOrder = { orderNo, orderedAt, amount, seller: str(o.strNm) || SELLER, payment: '카드', kind: 'list', needsReceipt: true, listKey: `${orderedAt.slice(0, 16)}|${amount}` };
  if (title) out.title = title.slice(0, 120);
  return out;
}

export type DaisoDetail = { amount?: number; paidAt?: string; card: boolean; issuer?: string; cancelled: boolean; found: boolean };
/** 온라인 상세 응답 — data.or · data.orPyAm.totPyAm · data.orPymt(pymtCdNm 신용카드 · credCoCdNm · pyApvDtm) */
export function readDaisoDetail(json: unknown): DaisoDetail {
  const d = obj(obj(json).data);
  const or = obj(d.or);
  const pay = obj(d.orPymt);
  const method = str(pay.pymtCdNm) || str(pay.pymtCd);
  const amount = num(obj(d.orPyAm).totPyAm) ?? num(pay.pyAm);
  const out: DaisoDetail = { card: /카드|card/i.test(method), cancelled: str(or.orCnclDtm) !== '' || CANCEL.test(str(or.orStsCdNm)), found: Object.keys(d).length > 0 };
  if (amount !== undefined) out.amount = amount;
  const paidAt = normalizeKst(str(pay.pyApvDtm) || str(or.pyCmptDtm) || str(or.orDt));
  if (paidAt) out.paidAt = paidAt;
  const issuer = str(pay.credCoCdNm);
  if (issuer) out.issuer = issuer.slice(0, 30);
  return out;
}

/** 매장 목록 응답 → 줄 배열 · 다음 쪽 — data.orOffineList(API 철자 그대로) 또는 orOfflineList, data.hasNext · nextPageIndex */
export function daisoStoreRows(json: unknown): { rows: Raw[]; hasNext: boolean; next: number | null } {
  const d = obj(obj(json).data);
  const rows = arr(d.orOffineList ?? d.orOfflineList ?? d.list).filter(isObj);
  const next = num(d.nextPageIndex);
  return { rows, hasNext: d.hasNext === true || d.hasNext === 'true' || d.hasNext === 'Y', next: next === undefined ? null : next };
}
/** 매장 결제 금액 — saleAmt(공급가) + addTax(부가세) */
export const daisoStoreAmount = (o: Raw): number | undefined => { const a = num(o.saleAmt); return a === undefined ? undefined : a + (num(o.addTax) ?? 0); };
/** 매장 목록 줄 → 목록 주문(주문번호 = ssNum · 시각 saleDay+saleTim). salDiv 92 는 취소라 부르는 쪽이 뺀다. 못 읽으면 null */
export function daisoStoreOrder(o: Raw): ReceiptOrder | null {
  const orderNo = str(o.ssNum);
  if (!/^[0-9A-Za-z_-]{4,60}$/.test(orderNo)) return null;
  const day = str(o.saleDay).replace(/\D/g, '');
  const tim = str(o.saleTim).replace(/\D/g, '');
  const orderedAt = normalizeKst(str(o.saleDtm)) ?? (day.length === 8 ? normalizeKst(day + (tim + '000000').slice(0, 6)) : null);
  if (!orderedAt) return null;
  const amount = daisoStoreAmount(o);
  if (amount === undefined || amount < 1) return null;
  const prods = arr(o.orderProd).filter(isObj);
  const names = prods.map((p) => str(p.gdsNam) || str(p.exhPdNm) || str(p.pdNm)).filter(Boolean);
  const out: ReceiptOrder = { orderNo, orderedAt, amount, seller: str(o.strNm) ? `${STORE_SELLER} ${str(o.strNm)}`.slice(0, 60) : STORE_SELLER, payment: '카드', kind: 'list', needsReceipt: true, listKey: `${orderedAt.slice(0, 16)}|${amount}` };
  if (names.length > 0) out.title = `${names[0]}${names.length > 1 ? ` 외 ${names.length - 1}건` : ''}`.slice(0, 120);
  return out;
}

export type DaisoStoreReceipt = { amount?: number; paidAt?: string; card: boolean; issuer?: string; approval?: string; businessNumber?: string; seller?: string; cancelled: boolean; detail: ReceiptDetail };
/** 매장 전자영수증 응답 — data.orMOfflineorVO + orOfflineorApprVOList[0]. 없으면 null */
export function readDaisoStoreReceipt(json: unknown): DaisoStoreReceipt | null {
  const d = obj(obj(json).data);
  const vo = obj(d.orMOfflineorVO);
  if (Object.keys(vo).length === 0) return null;
  const appr = arr(d.orOfflineorApprVOList).filter(isObj).find((a) => str(a.apprNo) !== '') ?? obj(arr(d.orOfflineorApprVOList)[0]);
  const amount = daisoStoreAmount(vo);
  const apprYmd = str(appr.apprYmd).replace(/\D/g, '');
  const apprTm = str(appr.apprTm).replace(/\D/g, '');
  const paidAt = normalizeKst(str(vo.saleDtm)) ?? (apprYmd.length === 8 ? normalizeKst(apprYmd + (apprTm + '000000').slice(0, 6)) : null);
  const cardAmt = num(vo.cardAmt) ?? 0;
  const issuer = str(appr.cardNm);
  const approval = str(appr.apprNo);
  const biz = str(vo.bzmnNo).replace(/[^\d-]/g, '');
  const detail: ReceiptDetail = {};
  if (issuer) detail.cardCompany = issuer;
  if (approval) detail.approvalNo = approval;
  if (paidAt) detail.approvalAt = paidAt;
  if (str(vo.strNm)) detail.merchantName = `${STORE_SELLER} ${str(vo.strNm)}`.slice(0, 60);
  if (biz) detail.merchantBusinessNo = biz;
  if (amount !== undefined) detail.totalAmount = amount;
  if (num(vo.saleAmt) !== undefined) detail.supplyAmount = num(vo.saleAmt) as number;
  if (num(vo.addTax) !== undefined) detail.taxAmount = num(vo.addTax) as number;
  const out: DaisoStoreReceipt = { card: cardAmt > 0 || /카드|card/i.test(str(appr.apprWay) + str(appr.payApprDivName)), cancelled: str(vo.salDiv) === '92' || CANCEL.test(str(vo.salDivNm)), detail };
  if (amount !== undefined) out.amount = amount;
  if (paidAt) out.paidAt = paidAt;
  if (issuer) out.issuer = issuer.slice(0, 30);
  if (approval) out.approval = approval.slice(0, 30);
  if (biz) out.businessNumber = biz.slice(0, 20);
  if (str(vo.strNm)) out.seller = `${STORE_SELLER} ${str(vo.strNm)}`.slice(0, 60);
  return out;
}

/* ---------------- 흐름 ---------------- */

type Phase = 'idle' | 'page' | 'list' | 'detail' | 'storelist' | 'storercpt' | 'relogin' | 'finished';
type Job = { order: ReceiptOrder; key: string; tries: number; store: boolean };
const FAIL_OF: Partial<Record<FetchResult['st'], FailCode>> = { blocked: 'blocked', net: 'network', shape: 'unreadable', http: 'unreadable', login: 'login' };

export function createDaisoApiFlow(opts: ApiFlowOptions = {}): NaverFlow {
  const now = opts.now ?? (() => Date.now());
  const maxSteps = opts.maxSteps ?? 4000;
  const budgetMs = opts.budgetMs ?? 1_500_000;
  const maxOrders = opts.maxOrders ?? 800;
  const allowNoSeconds = opts.allowNoSeconds ?? true;   // 다이소 응답 시각은 분까지만일 수 있다
  const only = opts.onlyKeys ? new Set(opts.onlyKeys) : null;
  const startedAt = now();
  const windowDays = opts.windowDays ?? 365;
  const cutoffYmd = kstYmd(startedAt - windowDays * DAY_MS);
  const todayYmd = kstYmd(startedAt);
  const cutoff = `${cutoffYmd.slice(0, 4)}-${cutoffYmd.slice(4, 6)}-${cutoffYmd.slice(6, 8)}`;

  let phase: Phase = 'idle';
  let steps = 0;
  let tries = 0;
  let listTries = 0;
  let page = 1;
  let total: number | null = null;
  let lastUrl = '';
  let lastText = '';
  let final: FlowOut | null = null;
  let after: (() => FlowOut) | null = null;
  let resumeAt: (() => FlowOut) | null = null;
  const knownNos = new Set<string>();
  const knownKeys = new Set<string>();
  const knownTails = new Set<string>();
  const listRows: Raw[] = [];
  const seenNo = new Set<string>();
  const recorded = new Set<string>();
  let queue: Job[] = [];
  let batch: Job[] = [];
  // 매장: 이번 달부터 거꾸로 k 개월째 · 그 달의 쪽
  let monthIdx = 0;
  let storePage = 0;
  let storeTries = 0;
  let storeAll = 0;
  let storeCancel = 0;
  const storeJobs: Job[] = [];
  const orders: ReceiptOrder[] = [];
  const pending: ReceiptOrder[] = [];
  const outcomes: OutcomeEvent[] = [];
  const stats: FlowStats = { rejected: 0, probes: 0, duplicates: 0, unfetched: [], reasons: {} };
  const note = (k: string, n = 1): void => { const r = (stats.reasons ??= {}); r[k] = (r[k] ?? 0) + n; };
  let totalN = 0;
  let okN = 0;
  let noneN = 0;
  let failN = 0;
  let okTotal = 0;
  let blockedRun = 0;
  let timeoutRun = 0;
  let slow = false;
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
  const finish = (reason: string): FlowOut => {
    if (final) return final;
    if (!ending) {
      const at = phase;
      phase = 'finished';
      after = null;
      ending = { reason, orders: pending.splice(0), stats: { ...stats } };
      endQueue = [`flowc-t${totalN}-k${okN}-x${noneN}-f${failN}-q${queue.length}`, `flowe-${reason}-${at}`];
    }
    return drainEnd();
  };
  const retryOr = (reason: string): FlowOut => { if (tries < 2) { tries++; return READ; } return finish(reason); };
  const setOutcome = (key: string, outcome: Outcome): void => { outcomes.push({ key, outcome }); };
  const fail = (j: Job, code: FailCode): void => { failN++; setOutcome(j.key, { state: 'failed', code }); stats.unfetched = [...(stats.unfetched ?? []), j.order.orderNo]; };
  const none = (j: Job): void => { noneN++; setOutcome(j.key, { state: 'none' }); pending.push(noneOrder(j.order)); };
  const cancelled = (j: Job): void => { noneN++; setOutcome(j.key, { state: 'none', why: 'cancelled' }); };
  /** 응답의 키 구조(값 없음)를 같은 모양마다 한 번만 남긴다 — 대표님 계정 구조 기록 */
  const structThen = (where: string, url: string, data: unknown, used: string[], then: () => FlowOut): FlowOut => {
    if (recorded.has(where) || data === undefined || data === null) return then();
    recorded.add(where);
    const { host, path } = splitUrl(url);
    const lines = [...used.map((u) => `use ${u}`.slice(0, 200)), ...structureLines(data, 280)].slice(0, 300);
    after = then;
    return { type: 'structure', where, host, path, lines };
  };
  const run = (reqs: FetchReq[], conc: number): FlowOut => ({ kind: 'fetch', reqs, conc, staggerMs: slow ? 0 : conc > 1 ? FETCH_STAGGER_MS : 0, gapMs: slow ? FETCH_SLOW.gapMs : 0, timeoutMs: FETCH_TIMEOUT_MS, deadlineMs: FETCH_DEADLINE_MS });
  const post = (key: string, url: string, body: Raw): FetchReq => ({ key, method: 'POST', url, as: 'json', body: JSON.stringify(body) });

  /** 이미 서버에 있는 주문인가 */
  const known = (o: ReceiptOrder): boolean => knownNos.has(o.orderNo) || knownTails.has(tailOf(o.orderNo, o.orderedAt)) || (o.listKey !== undefined && knownKeys.has(o.listKey));
  /** 주문 하나를 일감으로 — onlyKeys 면 그 줄만, 아니면 이미 받은 것은 건너뛰고 목록 행을 서버에 올린다 */
  const enqueue = (o: ReceiptOrder, store: boolean, isCancelled: boolean, into: Job[]): void => {
    if (seenNo.has(o.orderNo)) { stats.duplicates++; note('drop-dup'); return; }
    seenNo.add(o.orderNo);
    if (o.orderedAt.slice(0, 10) < cutoff) { note('drop-old'); return; }
    const key = outcomeKey(o.orderNo, o.orderedAt, o.amount);
    if (only) { if (!only.has(key)) return; }
    else if (known(o)) { note('skip-known'); return; }
    const job: Job = { order: o, key, tries: 0, store };
    totalN++;
    if (isCancelled) { cancelled(job); return; }
    if (!only) pending.push(o);
    into.push(job);
  };

  /* ---- 온라인 목록 ---- */
  const listReq = (): FlowOut => {
    phase = 'list';
    return run([post(`list-${page}`, DAISO_LIST_URL, { orNo: '', orSeq: '', type: '', dlvTy: '', dlvFomCd: '', gfYn: '', status: '', currentPageCnt: page, strtDt: cutoffYmd, endDt: todayYmd, orStsCd: '', rowNumber: '', currentPage: page, pageSize: PAGE_SIZE, orTyCd: '', searchKeyword: '', selectedDate: '12' })], 1);
  };
  const onList = (): FlowOut => {
    note('list-rows', listRows.length);
    note(`list-pages-${page}`);
    const jobs: Job[] = [];
    let cancelN = 0;
    for (const r of listRows) {
      const o = daisoListOrder(r);
      if (!o) { stats.rejected++; note('drop-unreadable'); continue; }
      const c = daisoCancelled(r);
      if (c) cancelN++;
      enqueue(o, false, c, jobs);
      if (jobs.length >= maxOrders) break;
    }
    note('list-cancelled', cancelN);
    jobs.sort((a, b) => (a.order.orderedAt < b.order.orderedAt ? 1 : a.order.orderedAt > b.order.orderedAt ? -1 : 0));
    queue = jobs;
    return nextDetail();
  };
  const onListResult = (r: FetchResult): FlowOut => {
    if (r.st === 'ok') {
      okTotal++;
      timeoutRun = 0;
      listTries = 0;
      const rows = daisoListRows(r.data);
      const go = (): FlowOut => {
        if (rows.length === 0) return onList();
        if (total === null) total = daisoTotalCount(rows);
        const fresh = rows.filter((x) => { const k = str(x.orNo); if (!k || listRows.some((y) => str(y.orNo) === k)) return false; return true; });
        listRows.push(...fresh);
        if (fresh.length === 0 || (total !== null && listRows.length >= total) || page >= MAX_LIST_PAGES) return onList();
        page++;
        return listReq();
      };
      return page === 1 ? structThen('daiso-list', DAISO_LIST_URL, r.data, ['orderNo : orNo', 'date : pyCmptDtm', 'amount : orderProd[].orAm', 'cancel : orCnclDtm orStsCdNm cnclSeCd'], go) : go();
    }
    if (r.st === 'login' || (okTotal === 0 && r.st === 'blocked' && (r.status ?? 0) === 403)) { phase = 'page'; return { type: 'login' }; }
    if (r.st === 'blocked') { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); listTries++; return listTries < MAX_LIST_TRIES ? listReq() : finish('blocked'); }
    note(`list-${r.st}-${r.status ?? 0}`);
    if (r.st === 'http' && (r.status ?? 0) >= 400 && (r.status ?? 0) < 500) return finish('list-failed');
    listTries++;
    if (listTries < MAX_LIST_TRIES) return listReq();
    return r.st === 'net' && okTotal === 0 ? finish('cross-origin') : finish('list-failed');
  };

  /* ---- 온라인 상세 ---- */
  const nextDetail = (): FlowOut => {
    if (queue.length === 0) return storeStart();
    batch = queue.splice(0, slow ? FETCH_SLOW.batch : FETCH_BATCH);
    for (const j of batch) setOutcome(j.key, { state: 'fetching' });
    phase = 'detail';
    return run(batch.map((j) => post(j.key, DAISO_DETAIL_URL, { orNo: j.order.orderNo })), slow ? FETCH_SLOW.conc : FETCH_CONC);
  };
  const settleOnline = (j: Job, d: DaisoDetail): void => {
    if (d.cancelled) { cancelled(j); return; }
    const amount = d.amount ?? j.order.amount;
    if (amount < 1) { none(j); return; }
    const paidAt = d.paidAt ?? j.order.orderedAt;
    const done = toImportOrder({ paidAt, amount, cardIssuer: d.issuer }, { orderNo: j.order.orderNo, seller: j.order.seller ?? SELLER, title: j.order.title, amount }, { kind: d.card ? 'card' : 'purchase', allowNoSeconds });
    if (!done) { fail(j, 'unreadable'); return; }
    if (j.order.listKey) done.listKey = j.order.listKey;
    if (d.card) done.detail = { ...(d.issuer ? { cardCompany: d.issuer } : {}), approvalAt: paidAt, totalAmount: amount, merchantName: SELLER };
    orders.push(done);
    pending.push(done);
    okN++;
    setOutcome(j.key, { state: 'done' });
  };
  const settleCommon = (j: Job, r: FetchResult, again: Job[], flags: { login: boolean; blocked: number }): void => {
    if (r.st === 'login') { flags.login = true; again.push(j); return; }
    if (r.st === 'blocked' || r.st === 'net' || (r.st === 'http' && (r.status ?? 0) >= 500)) {
      if (r.st === 'blocked') flags.blocked++;
      if (j.tries + 1 < MAX_JOB_TRIES) { j.tries++; again.push(j); } else fail(j, r.st === 'blocked' ? 'blocked' : 'network');
      return;
    }
    fail(j, FAIL_OF[r.st] ?? 'unreadable');
  };
  const afterBatch = (again: Job[], flags: { login: boolean; blocked: number }, next: () => FlowOut): FlowOut => {
    if (flags.login) { phase = 'relogin'; tries = 0; resumeAt = next; return { type: 'login' }; }
    if (flags.blocked > 0) { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); } else blockedRun = 0;
    return next();
  };
  const onDetail = (results: FetchResult[]): FlowOut => {
    timeoutRun = 0;
    const byKey = new Map(results.map((r) => [r.key, r]));
    const again: Job[] = [];
    const flags = { login: false, blocked: 0 };
    let firstOk: FetchResult | undefined;
    for (const j of batch) {
      const r = byKey.get(j.key) ?? ({ key: j.key, st: 'net' } as FetchResult);
      if (r.st === 'ok') {
        okTotal++;
        firstOk ??= r;
        const d = readDaisoDetail(r.data);
        if (!d.found) fail(j, 'unreadable'); else settleOnline(j, d);
      } else settleCommon(j, r, again, flags);
    }
    batch = [];
    queue = [...again, ...queue];
    const go = (): FlowOut => afterBatch(again, flags, nextDetail);
    return firstOk ? structThen('daiso-detail', DAISO_DETAIL_URL, firstOk.data, ['amount : orPyAm.totPyAm', 'pay : orPymt.pymtCdNm credCoCdNm pyApvDtm', 'cancel : or.orCnclDtm'], go) : go();
  };

  /* ---- 매장 목록(한 달씩) ---- */
  const monthRange = (k: number): { start: string; end: string } => {
    const t = new Date(startedAt + KST_MS);
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth() - k;
    const first = new Date(Date.UTC(y, m, 1));
    const lastDay = k === 0 ? t.getUTCDate() : new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const ym = first.toISOString().slice(0, 7).replace('-', '');
    return { start: `${ym}01`, end: `${ym}${String(lastDay).padStart(2, '0')}` };
  };
  const storeStart = (): FlowOut => { monthIdx = 0; storePage = 0; storeTries = 0; return storeReq(); };
  const storeReq = (): FlowOut => {
    if (monthIdx >= STORE_MONTHS) return storeDone();
    phase = 'storelist';
    const { start, end } = monthRange(monthIdx);
    return run([post(`store-${monthIdx}-${storePage}`, DAISO_STORE_LIST_URL, { rows: PAGE_SIZE, pageIndex: storePage, mbMngNo: '', strtDt: start, endDt: end, searchKeyword: '', usePaging: true })], 1);
  };
  const storeNextMonth = (): FlowOut => { monthIdx++; storePage = 0; storeTries = 0; return storeReq(); };
  const onStoreList = (r: FetchResult): FlowOut => {
    if (r.st === 'ok') {
      okTotal++;
      timeoutRun = 0;
      storeTries = 0;
      const { rows, hasNext, next } = daisoStoreRows(r.data);
      const go = (): FlowOut => {
        for (const it of rows) {
          storeAll++;
          if (str(it.salDiv) === '92') { storeCancel++; continue; }
          const o = daisoStoreOrder(it);
          if (!o) { stats.rejected++; note('drop-store-unreadable'); continue; }
          enqueue(o, true, false, storeJobs);
          if (storeJobs.length >= maxOrders) break;
        }
        if (!hasNext || rows.length === 0 || storePage >= MAX_STORE_PAGES) return storeNextMonth();
        storePage = next !== null && next > storePage ? next : storePage + 1;
        return storeReq();
      };
      return monthIdx === 0 && storePage === 0 ? structThen('daiso-store-list', DAISO_STORE_LIST_URL, r.data, ['orderNo : ssNum', 'date : saleDay saleTim', 'amount : saleAmt + addTax', 'cancel : salDiv 92', 'page : hasNext nextPageIndex'], go) : go();
    }
    if (r.st === 'login') { phase = 'relogin'; tries = 0; resumeAt = storeReq; return { type: 'login' }; }
    if (r.st === 'blocked') { slow = true; blockedRun++; if (blockedRun >= MAX_BLOCKED_RUN) return finish('blocked'); }
    note(`store-list-${r.st}-${r.status ?? 0}`);
    storeTries++;
    if (storeTries < MAX_LIST_TRIES && r.st !== 'http') return storeReq();
    // 이 달은 포기하고 다음 달로(한 달 실패로 전체를 멈추지 않는다)
    return storeNextMonth();
  };
  const storeDone = (): FlowOut => {
    note('store-rows', storeAll);
    note('store-cancelled', storeCancel);
    queue = storeJobs.splice(0).sort((a, b) => (a.order.orderedAt < b.order.orderedAt ? 1 : a.order.orderedAt > b.order.orderedAt ? -1 : 0));
    return nextStoreReceipt();
  };

  /* ---- 매장 영수증 ---- */
  const nextStoreReceipt = (): FlowOut => {
    if (queue.length === 0) return finish('all-rows');
    batch = queue.splice(0, slow ? FETCH_SLOW.batch : FETCH_BATCH);
    for (const j of batch) setOutcome(j.key, { state: 'fetching' });
    phase = 'storercpt';
    return run(batch.map((j) => post(j.key, DAISO_STORE_RECEIPT_URL, { ssNum: j.order.orderNo })), slow ? FETCH_SLOW.conc : FETCH_CONC);
  };
  const settleStore = (j: Job, rc: DaisoStoreReceipt): void => {
    if (rc.cancelled) { cancelled(j); return; }
    const amount = rc.amount ?? j.order.amount;
    if (amount < 1) { none(j); return; }
    const paidAt = rc.paidAt ?? j.order.orderedAt;
    const done = toImportOrder({ paidAt, amount, cardIssuer: rc.issuer, approval: rc.card ? rc.approval : undefined, businessNumber: rc.businessNumber }, { orderNo: j.order.orderNo, seller: rc.seller ?? j.order.seller ?? STORE_SELLER, title: j.order.title, amount }, { kind: rc.card ? 'card' : 'purchase', allowNoSeconds });
    if (!done) { fail(j, 'unreadable'); return; }
    if (j.order.listKey) done.listKey = j.order.listKey;
    if (!rc.card && rc.approval) done.payment = '현금영수증';
    if (Object.keys(rc.detail).length > 0) done.detail = rc.detail;
    orders.push(done);
    pending.push(done);
    okN++;
    setOutcome(j.key, { state: 'done' });
  };
  const onStoreReceipt = (results: FetchResult[]): FlowOut => {
    timeoutRun = 0;
    const byKey = new Map(results.map((r) => [r.key, r]));
    const again: Job[] = [];
    const flags = { login: false, blocked: 0 };
    let firstOk: FetchResult | undefined;
    for (const j of batch) {
      const r = byKey.get(j.key) ?? ({ key: j.key, st: 'net' } as FetchResult);
      if (r.st === 'ok') {
        okTotal++;
        firstOk ??= r;
        const rc = readDaisoStoreReceipt(r.data);
        if (!rc) fail(j, 'unreadable'); else settleStore(j, rc);
      } else settleCommon(j, r, again, flags);
    }
    batch = [];
    queue = [...again, ...queue];
    const go = (): FlowOut => afterBatch(again, flags, nextStoreReceipt);
    return firstOk ? structThen('daiso-store-receipt', DAISO_STORE_RECEIPT_URL, firstOk.data, ['amount : orMOfflineorVO.saleAmt + addTax', 'pay : cardAmt cashAmt', 'appr : orOfflineorApprVOList[].apprNo cardNm apprYmd apprTm', 'merchant : strNm bzmnNo'], go) : go();
  };

  const onTimeout = (): FlowOut => {
    if (phase === 'detail' || phase === 'storercpt') {
      timeoutRun++;
      const lost = batch;
      batch = [];
      const again: Job[] = [];
      for (const j of lost) { if (j.tries + 1 < MAX_JOB_TRIES) { j.tries++; again.push(j); } else fail(j, 'network'); }
      queue = [...again, ...queue];
      if (timeoutRun >= MAX_TIMEOUT_RUN) return finish('timeouts');
      return phase === 'detail' ? nextDetail() : nextStoreReceipt();
    }
    if (phase === 'list') { listTries++; return listTries < MAX_LIST_TRIES ? listReq() : finish('timeout'); }
    if (phase === 'storelist') { storeTries++; return storeTries < MAX_LIST_TRIES ? storeReq() : storeNextMonth(); }
    return retryOr('timeout');
  };

  const isLogin = (url: string): boolean => pathOf(url).startsWith(DAISO_LOGIN_PATH) || /\/login/i.test(pathOf(url));
  const onPage = (url: string, text: string): FlowOut => {
    lastUrl = url;
    lastText = text;
    if (isLogin(url)) return { type: 'login' };
    if (!/(^|\.)daisomall\.co\.kr$/.test(hostOf(url))) return retryOr('shop-lost');
    tries = 0;
    if (phase === 'page' || phase === 'list') return listReq();
    if (phase === 'relogin') { const f = resumeAt; resumeAt = null; return f ? f() : listReq(); }
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
        phase = 'page';
        tries = 0;
        return { type: 'goto', url: DAISO_HOME_URL };
      case 'page':
        return onPage(ev.url, ev.text);
      case 'resume': { const f = after; after = null; return f ? f() : READ; }
      case 'fetched': {
        if (phase === 'list') return onListResult(ev.results.find((r) => r.key.startsWith('list-')) ?? { key: 'list', st: 'net' });
        if (phase === 'detail') return onDetail(ev.results);
        if (phase === 'storelist') return onStoreList(ev.results.find((r) => r.key.startsWith('store-')) ?? { key: 'store', st: 'net' });
        if (phase === 'storercpt') return onStoreReceipt(ev.results);
        return finish('unexpected-event');
      }
      case 'timeout':
        return onTimeout();
      default:
        return finish('unexpected-event');
    }
  };

  return {
    next,
    take: () => pending.splice(0),
    takeOutcomes: () => outcomes.splice(0),
    progress: () => ({ phase, done: okN + noneN + failN, total: totalN, orders: orders.length }),
  };
}
