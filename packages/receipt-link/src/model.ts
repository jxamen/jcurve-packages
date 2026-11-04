/**
 * 네이버 · 쿠팡 주문내역 연동 — 서버 계약과 읽어 온 주문을 서버로 보내기 전에 거르는 순수 함수(기획서 docs/order-link §9).
 * 쿠키 · 아이디 · 비밀번호 · 수취인 · 주소 · 전화는 이 파일 어디에도 타입이 없다 — 읽는 쪽이 그런 값을 건네도 cleanOrder 가 버린다.
 */
export type LinkPlatform = 'naver' | 'coupang' | 'musinsa' | 'kurly';
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
export const LINK_PLATFORMS: LinkPlatform[] = ['naver', 'coupang'];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 「전자 영수증」 칸 앞 연동 칩의 순서(대표님 10-28 17:56) · 구조 기록 */
export const TEST_LINK_PLATFORMS: LinkPlatform[] = ['naver', 'coupang', 'kurly', 'musinsa'];
/** 서버가 줄 수 있는 모든 곳 */
export const ALL_LINK_PLATFORMS: LinkPlatform[] = ['naver', 'coupang', 'musinsa', 'kurly'];
export const LINK_LABEL: Record<LinkPlatform, string> = { naver: '네이버', coupang: '쿠팡', musinsa: '무신사', kurly: '마켓컬리' };
/** 서버가 한 번에 받는 주문 수 */
export const ORDERS_PER_REQUEST = 50;

export type LinkLine = { linkedAt: string | null; revokedAt: string | null; lastImportAt: string | null; importedTotal: number };
/** probe: 구조 기록 단추를 보일 회원(대표님 계정) · hide_legacy: 「전자 영수증」 카드에서 N+스토어 · 네이버페이 · 쿠팡을 숨긴다 */
export type LinkState = { windowDays: number; consentVersion: string; links: Partial<Record<LinkPlatform, LinkLine>>; probe: boolean; hide_legacy: boolean;
  /** 쿠팡 읽기 스위치(대표님 「켜기」 뒤 true). 서버 필드가 없으면 false 로 본다 */
  coupangRead?: boolean;
  /** 새 네이버페이 수집 길(rl15) — 서버 목록 회원만. 켜진 회원은 홈에서 자동 점검도 돈다 */
  npv2?: boolean;
  /** 플랫폼별 읽기 기간(일) — 서버 앱설정이 정한 값. 없으면 흐름 기본(365) */
  readDays?: Partial<Record<LinkPlatform, number>>;
};
/**
 * 서버로 보내는 주문 — 이 열두 칸이 전부다. 뒤의 여섯 칸(사업자번호 · 승인번호 · 카드사 · 종류 · 목록 키)은 영수증을 건건이 읽었을 때만 있다.
 * orderedAt 은 'YYYY-MM-DD HH:mm:ss'(초 포함)가 정상이고, 'YYYY-MM-DD HH:mm' 도 받는다.
 * kind 'list' 는 영수증을 읽기 전의 목록 행이다 — orderNo 가 없을 수 있고(그러면 listKey 로 가린다), 서버가 완성본으로 바꿔 넣는다(결과 updated).
 * kind 'none' 은 영수증이 없는 결제로 끝난 목록 주문 — list 와 같은 칸(상세 없음), 서버가 list 행을 none 으로 바꾼다(적립 불가).
 */
export type OrderKind = 'card' | 'purchase' | 'list' | 'none';
/** 상세(영수증) 없이 가는 종류 — 주문번호 대신 listKey 만 있어도 된다 */
export const isPendingKind = (k: unknown): k is 'list' | 'none' => k === 'list' || k === 'none';
export type OrderInput = {
  orderNo?: string; orderedAt: string; amount: number; seller?: string; title?: string; payment?: string;
  businessNumber?: string; approval?: string; cardIssuer?: string; kind?: OrderKind; listKey?: string;
  detail?: ReceiptDetail;
};

/** 영수증 세부 칸 — 대표님 10-29 14:15 card-single 원문 칸(세부 화면에 22:30 캡처 순서로 보인다) */
export const RECEIPT_DETAIL_KEYS = [
  'cardCompany', 'approvalNo', 'cardNo', 'tradeType', 'ownerType', 'installmentType', 'approvalAt', 'cancelAt', 'productName', 'productOrderNo',
  'sellerName', 'sellerRepresentative', 'sellerBusinessNo', 'sellerTel', 'sellerAddress', 'merchantName', 'merchantBusinessNo',
  'approvalAmount', 'cancelAmount', 'supplyAmount', 'taxAmount', 'totalAmount',
  // 대표님 폰 실기록(10-29 14:31 rcpt-cardok) 응답에만 있던 칸
  'cardExpiredYear', 'cardExpiredMonth', 'merchantRepresentative', 'merchantNo', 'merchantAddress', 'serviceCharge', 'disposableCupAmount',
] as const;
export type ReceiptDetailKey = (typeof RECEIPT_DETAIL_KEYS)[number];
export type ReceiptDetail = Partial<Record<ReceiptDetailKey, string | number>>;
const DETAIL_AMOUNTS: ReadonlySet<string> = new Set(['approvalAmount', 'cancelAmount', 'supplyAmount', 'taxAmount', 'totalAmount', 'serviceCharge', 'disposableCupAmount']);

/** 세부 칸만 남긴다 — 금액 칸은 정수, 나머지는 글자(200자까지). 모르는 키 · 다른 모양은 버린다 */
export function readDetail(v: unknown): ReceiptDetail | undefined {
  const r = object(v);
  const out: ReceiptDetail = {};
  for (const k of RECEIPT_DETAIL_KEYS) {
    const x = r[k];
    if (DETAIL_AMOUNTS.has(k)) { if (typeof x === 'number' && Number.isInteger(x) && Math.abs(x) <= 1_000_000_000) out[k] = x; continue; }
    if (typeof x === 'string') { const t = x.replace(/\s+/g, ' ').trim().slice(0, 200); if (t) out[k] = t; }
  }
  return Object.keys(out).length ? out : undefined;
}
export type OrderResult = 'new' | 'duplicate' | 'updated' | 'taken' | 'out_of_range' | 'invalid' | 'amount' | 'pouch_full';
export type ImportTally = Record<OrderResult, number>;

const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const RESULTS: OrderResult[] = ['new', 'duplicate', 'updated', 'taken', 'out_of_range', 'invalid', 'amount', 'pouch_full'];
const strOrNull = (v: unknown): string | null => typeof v === 'string' && v ? v : null;

/**
 * 이 사이트를 읽을 기간(일) — 서버 앱설정 readDays 를 서버가 받아 주는 기간(windowDays)까지만 쓴다.
 * 서버는 windowDays(365)보다 오래된 주문을 out_of_range 로 거절한다 — 컬리를 1095 일로 읽던 11-02 에 읽은 6건이 전부 거절돼 0건이었다.
 * readDays 가 없으면 undefined(흐름 기본값). windowDays 가 30 이하면(서버가 안 보낸 기본값) 자르지 않는다.
 */
export function effectiveReadDays(state: { windowDays: number; readDays?: Partial<Record<LinkPlatform, number>> } | null | undefined, platform: LinkPlatform): number | undefined {
  const days = state?.readDays?.[platform];
  if (!days) return undefined;
  const accepted = state?.windowDays ?? 0;
  return accepted > 30 ? Math.min(days, accepted) : days;
}

export function parseLinkState(v: unknown): LinkState {
  const r = object(v);
  const links: LinkState['links'] = {};
  const raw = object(r.links);
  for (const p of ALL_LINK_PLATFORMS) {
    if (!(p in raw)) continue;
    const l = object(raw[p]);
    links[p] = { linkedAt: strOrNull(l.linkedAt), revokedAt: strOrNull(l.revokedAt), lastImportAt: strOrNull(l.lastImportAt),
      importedTotal: typeof l.importedTotal === 'number' && l.importedTotal >= 0 ? Math.floor(l.importedTotal) : 0 };
  }
  return { windowDays: typeof r.windowDays === 'number' && r.windowDays > 0 ? r.windowDays : 30, consentVersion: typeof r.consentVersion === 'string' ? r.consentVersion : '', links, probe: r.probe === true, hide_legacy: r.hide_legacy === true, coupangRead: r.coupangRead === true, npv2: r.npv2 === true, readDays: parseReadDays(r.readDays) };
}

/** 동의했고 철회하지 않았다 */
/** 서버가 준 플랫폼별 읽기 기간 — 1 이상 숫자만 싣는다 */
function parseReadDays(v: unknown): Partial<Record<LinkPlatform, number>> {
  const raw = object(v);
  const out: Partial<Record<LinkPlatform, number>> = {};
  for (const p of ALL_LINK_PLATFORMS) {
    const d = raw[p];
    if (typeof d === 'number' && d >= 1) out[p] = Math.floor(d);
  }
  return out;
}

export const isConnected = (s: LinkState, p: LinkPlatform): boolean => !!s.links[p]?.linkedAt && !s.links[p]?.revokedAt;

/**
 * 목록 키 「YYYY-MM-DD HH:mm|금액」 — 영수증을 읽기 전 목록 행과 읽은 뒤 완성본을 잇는다(서버가 같은 키의 list 행을 완성본으로 바꾼다).
 * 날짜만 아는 「YYYY-MM-DD|금액」(쿠팡)은 서버 모양에 맞게 「YYYY-MM-DD 00:00|금액」 으로 맞춘다. 모양이 틀리면 undefined.
 */
export function normalizeListKey(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  const dateOnly = /^(\d{4}-\d{2}-\d{2})\|(\d{1,12})$/.exec(t);
  const k = dateOnly ? `${dateOnly[1]} 00:00|${dateOnly[2]}` : t;
  return /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}\|\d{1,12}$/.test(k) ? k : undefined;
}

const clip = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

/**
 * 읽어 온 주문 한 건에서 서버에 보낼 열 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
export function cleanOrder(raw: unknown): OrderInput | null {
  const r = object(raw);
  const isList = isPendingKind(r.kind);
  const orderNo = clip(r.orderNo, 60);
  const listKey = normalizeListKey(r.listKey);
  const orderedAt = clip(r.orderedAt, 40);
  const n = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' && /\d/.test(r.amount) ? Number(r.amount.replace(/[^\d]/g, '')) : NaN;
  if ((!orderNo && !(isList && listKey)) || !orderedAt || !Number.isFinite(n) || n < 0 || n > 1_000_000_000 || !Number.isFinite(Date.parse(orderedAt.replace(' ', 'T')))) return null;
  const out: OrderInput = { orderedAt, amount: Math.floor(n) };
  if (orderNo) out.orderNo = orderNo;
  const seller = clip(r.seller, 80); if (seller) out.seller = seller;
  const title = clip(r.title, 200); if (title) out.title = title;
  const payment = clip(r.payment, 30); if (payment) out.payment = payment;
  const biz = typeof r.businessNumber === 'string' ? r.businessNumber.trim() : ''; if (/^[0-9-]{1,20}$/.test(biz)) out.businessNumber = biz;
  const approval = clip(r.approval, 40); if (approval) out.approval = approval;
  const cardIssuer = clip(r.cardIssuer, 30); if (cardIssuer) out.cardIssuer = cardIssuer;
  if (r.kind === 'card' || r.kind === 'purchase' || isList) out.kind = r.kind as OrderKind;
  if (listKey) out.listKey = listKey;
  const detail = readDetail(r.detail); if (detail) out.detail = detail;
  return out;
}

export function chunkOrders<T>(items: T[], size = ORDERS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const emptyTally = (): ImportTally => ({ new: 0, duplicate: 0, updated: 0, taken: 0, out_of_range: 0, invalid: 0, amount: 0, pouch_full: 0 });

/** 서버 응답 results[].result 를 합친다 — 모르는 값은 invalid 로 센다 */
export function addTally(t: ImportTally, results: unknown): ImportTally {
  const out = { ...t };
  if (!Array.isArray(results)) return out;
  for (const item of results) {
    const res = object(item).result;
    out[(RESULTS as unknown[]).includes(res) ? res as OrderResult : 'invalid']++;
  }
  return out;
}

/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
export function importMessage(t: ImportTally, skippedUnreadable = 0): string {
  const lines: string[] = [];
  lines.push(t.new > 0 ? `새 주문 ${t.new}건을 영수증 보상으로 담았어요.` : '새로 담을 주문이 없어요.');
  if (t.pouch_full > 0) lines.push(`용돈 주머니가 가득 차서 ${t.pouch_full}건은 담지 못했어요. 주머니를 꺼낸 뒤 다시 가져와 주세요.`);
  if (t.duplicate > 0) lines.push(`이미 가져온 ${t.duplicate}건은 건너뛰었어요.`);
  if (t.taken > 0) lines.push(`다른 계정에서 이미 받은 ${t.taken}건은 받을 수 없어요.`);
  const other = t.out_of_range + t.invalid + t.amount + skippedUnreadable;
  if (other > 0) lines.push(`기간이 지났거나 읽을 수 없는 ${other}건은 건너뛰었어요.`);
  return lines.join('\n');
}
