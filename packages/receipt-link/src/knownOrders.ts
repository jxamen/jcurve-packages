/**
 * 서버에 이미 있는 주문 — 다시 열기 · 다시 시도에서 흐름이 영수증을 또 열지 않게 start 이벤트의 known 으로 넘긴다.
 * react-native 를 import 하지 않는다(노드에서 시험한다). 서버 목록(ordersClient.listOrders)과 같은 소스를 쓴다.
 *  - 영수증으로 보강된 행(kind 가 list 가 아닌 행 — 적립 완료 · 이미 올린 영수증 포함)만 넣는다. 보강 전 list 행은 흐름이 다시 보강해야 하니 넣지 않는다.
 *  - orderNo 는 16자리 숫자 그대로일 때만 넣는다(서버는 뒤 4자리만 보이게 가려 주므로 보통 listKey 만 간다).
 *  - listKey 는 「YYYY-MM-DD HH:mm|금액」 — 서버 행의 주문 일시 앞 16자와 금액으로 만든다.
 *  - tails 는 「주문번호 뒤4자리|날짜」 — 가려진 주문번호(뒤 4자리만 보임)와 서버 행의 날짜로 만든다.
 */
import type { LinkPlatform } from './model';
import type { LinkOrder } from './ordersModel';

export type KnownOrders = { orderNos: string[]; listKeys: string[]; /** 「주문번호 뒤4자리|주문 날짜」 — 서버가 가린 주문번호만 있어도 이미 가져온 주문을 가린다(영수증의 결제 시각 · 금액이 목록과 달라도 맞는다) */ tails: string[] };

/** 목록을 기다리는 시간 — 넘으면 known 없이 시작한다(전체 처리) */
export const KNOWN_FETCH_TIMEOUT_MS = 6_000;

const ORDER_NO = /^\d{16}$/;
const STAMP16 = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/;

export function knownFromOrders(orders: readonly LinkOrder[], platform: LinkPlatform): KnownOrders | undefined {
  const orderNos = new Set<string>();
  const listKeys = new Set<string>();
  const tails = new Set<string>();
  for (const o of orders) {
    if (o.platform !== platform || o.kind === 'list') continue;
    if (ORDER_NO.test(o.orderNo)) orderNos.add(o.orderNo);
    const at = STAMP16.exec(o.orderedAt)?.[0];
    if (at && o.amount > 0) listKeys.add(`${at}|${o.amount}`);
    if (at && o.amount > 0 && /\d{4}$/.test(o.orderNo)) tails.add(`${o.orderNo.slice(-4)}|${at.slice(0, 10)}`);
  }
  if (orderNos.size === 0 && listKeys.size === 0 && tails.size === 0) return undefined;
  return { orderNos: [...orderNos], listKeys: [...listKeys], tails: [...tails] };
}

/** 서버 목록을 한 번 받아 known 으로. 못 받거나(오류 · 시간 초과) 비었으면 undefined — 그대로 전체 처리 */
export async function fetchKnown(
  list: () => Promise<{ orders: readonly LinkOrder[] }>,
  platform: LinkPlatform,
  timeoutMs: number = KNOWN_FETCH_TIMEOUT_MS,
): Promise<KnownOrders | undefined> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const slow = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error('timeout')), timeoutMs); });
    const r = await Promise.race([list(), slow]);
    return knownFromOrders(r.orders, platform);
  } catch {
    return undefined;
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
