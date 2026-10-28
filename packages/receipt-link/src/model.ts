/**
 * 네이버 · 쿠팡 주문내역 연동 — 서버 계약과 읽어 온 주문을 서버로 보내기 전에 거르는 순수 함수(기획서 docs/order-link §9).
 * 쿠키 · 아이디 · 비밀번호 · 수취인 · 주소 · 전화는 이 파일 어디에도 타입이 없다 — 읽는 쪽이 그런 값을 건네도 cleanOrder 가 버린다.
 */
export type LinkPlatform = 'naver' | 'coupang' | 'musinsa' | 'kurly';
/** 캡슐함 카드에 보이는 두 곳(모든 스위치 켜진 회원) */
export const LINK_PLATFORMS: LinkPlatform[] = ['naver', 'coupang'];
/** 대표님 계정(probe)에게만 보이는 시험 곳 — 영수증 올리기 연동 줄 · 구조 기록 */
export const TEST_LINK_PLATFORMS: LinkPlatform[] = ['naver', 'musinsa', 'kurly'];
/** 서버가 줄 수 있는 모든 곳 */
export const ALL_LINK_PLATFORMS: LinkPlatform[] = ['naver', 'coupang', 'musinsa', 'kurly'];
export const LINK_LABEL: Record<LinkPlatform, string> = { naver: '네이버', coupang: '쿠팡', musinsa: '무신사', kurly: '마이컬리' };
/** 서버가 한 번에 받는 주문 수 */
export const ORDERS_PER_REQUEST = 50;

export type LinkLine = { linkedAt: string | null; revokedAt: string | null; lastImportAt: string | null; importedTotal: number };
/** probe: 구조 기록 단추를 보일 회원(대표님 계정) · hide_legacy: 「전자 영수증」 카드에서 N+스토어 · 네이버페이 · 쿠팡을 숨긴다 */
export type LinkState = {
  windowDays: number; consentVersion: string; links: Partial<Record<LinkPlatform, LinkLine>>; probe: boolean; hide_legacy: boolean;
  /** (0.1.0) 서버가 알려 주면 그 값, 옛 서버면 50 · 없음 — 상한 검사는 서버가 하고 앱은 미리 거르는 데만 쓴다 */
  ordersPerRequest: number; amountMax: number | null;
};
/** 서버로 보내는 주문 — 이 여섯 칸이 전부다 */
export type OrderInput = { orderNo: string; orderedAt: string; amount: number; seller?: string; title?: string; payment?: string };
export type OrderResult = 'new' | 'duplicate' | 'taken' | 'out_of_range' | 'invalid' | 'amount' | 'pouch_full';
export type ImportTally = Record<OrderResult, number>;

const object = (v: unknown): Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v) ? v as Record<string, unknown> : {};
const RESULTS: OrderResult[] = ['new', 'duplicate', 'taken', 'out_of_range', 'invalid', 'amount', 'pouch_full'];
const strOrNull = (v: unknown): string | null => typeof v === 'string' && v ? v : null;

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
  return {
    windowDays: typeof r.windowDays === 'number' && r.windowDays > 0 ? r.windowDays : 30, consentVersion: typeof r.consentVersion === 'string' ? r.consentVersion : '', links,
    probe: r.probe === true, hide_legacy: r.hide_legacy === true,
    ordersPerRequest: typeof r.ordersPerRequest === 'number' && r.ordersPerRequest >= 1 && r.ordersPerRequest <= ORDERS_PER_REQUEST ? Math.floor(r.ordersPerRequest) : ORDERS_PER_REQUEST,
    amountMax: typeof r.amountMax === 'number' && r.amountMax > 0 ? Math.floor(r.amountMax) : null,
  };
}

/** 동의했고 철회하지 않았다 */
export const isConnected = (s: LinkState, p: LinkPlatform): boolean => !!s.links[p]?.linkedAt && !s.links[p]?.revokedAt;

const clip = (v: unknown, max: number): string | undefined => {
  if (typeof v !== 'string') return undefined;
  const t = v.replace(/\s+/g, ' ').trim();
  return t ? t.slice(0, max) : undefined;
};

/**
 * 읽어 온 주문 한 건에서 서버에 보낼 여섯 칸만 남긴다. 주문번호 · 일시 · 금액이 없거나 모양이 틀리면 null(그 주문은 보내지 않는다).
 * 금액은 쉼표 · 「원」 이 붙은 글자도 받는다(화면 읽기). 다른 키는 전부 버린다.
 */
export function cleanOrder(raw: unknown): OrderInput | null {
  const r = object(raw);
  const orderNo = clip(r.orderNo, 60);
  const orderedAt = clip(r.orderedAt, 40);
  const n = typeof r.amount === 'number' ? r.amount : typeof r.amount === 'string' && /\d/.test(r.amount) ? Number(r.amount.replace(/[^\d]/g, '')) : NaN;
  if (!orderNo || !orderedAt || !Number.isFinite(n) || n < 0 || n > 1_000_000_000 || !Number.isFinite(Date.parse(orderedAt.replace(' ', 'T')))) return null;
  const out: OrderInput = { orderNo, orderedAt, amount: Math.floor(n) };
  const seller = clip(r.seller, 80); if (seller) out.seller = seller;
  const title = clip(r.title, 200); if (title) out.title = title;
  const payment = clip(r.payment, 30); if (payment) out.payment = payment;
  return out;
}

export function chunkOrders<T>(items: T[], size = ORDERS_PER_REQUEST): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

export const emptyTally = (): ImportTally => ({ new: 0, duplicate: 0, taken: 0, out_of_range: 0, invalid: 0, amount: 0, pouch_full: 0 });

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

/** 가져오기 결과 문구 중 앱마다 다른 것 — 보상이 들어가는 곳(영테크: 용돈 주머니 · 사임캐시: 바로 적립)이 다르다 */
export type ImportTexts = { added: (n: number) => string; capacityFull: (n: number) => string };
export const DEFAULT_IMPORT_TEXTS: ImportTexts = {
  added: (n) => `새 주문 ${n}건을 영수증 보상으로 담았어요.`,
  capacityFull: (n) => `용돈 주머니가 가득 차서 ${n}건은 담지 못했어요. 주머니를 꺼낸 뒤 다시 가져와 주세요.`,
};

/** 가져오기가 끝난 뒤 사용자에게 보이는 한두 줄 */
export function importMessage(t: ImportTally, skippedUnreadable = 0, texts: Partial<ImportTexts> = {}): string {
  const say = { ...DEFAULT_IMPORT_TEXTS, ...texts };
  const lines: string[] = [];
  lines.push(t.new > 0 ? say.added(t.new) : '새로 담을 주문이 없어요.');
  if (t.pouch_full > 0) lines.push(say.capacityFull(t.pouch_full));
  if (t.duplicate > 0) lines.push(`이미 가져온 ${t.duplicate}건은 건너뛰었어요.`);
  if (t.taken > 0) lines.push(`다른 계정에서 이미 받은 ${t.taken}건은 받을 수 없어요.`);
  const other = t.out_of_range + t.invalid + t.amount + skippedUnreadable;
  if (other > 0) lines.push(`최근 30일이 아니거나 읽을 수 없는 ${other}건은 건너뛰었어요.`);
  return lines.join('\n');
}
