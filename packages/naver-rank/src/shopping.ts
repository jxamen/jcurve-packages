import { collectWeb,CollectorError } from './webQueue';
import { targetUrlId } from './naverUrl';
import {nextData,record} from './naver';

export interface ShoppingItem {
  rank: number;
  title: string;
  mallName: string;
  productId: string;
  link: string;
}
export type ShoppingTarget = { productId: string; mallName?: never; titleIncludes?: never }
  | { mallName: string; productId?: never; titleIncludes?: never }
  | { titleIncludes: string; productId?: never; mallName?: never };

/** 추정한 견본 스키마다. 실제 응답 확인 후 이 필드 매핑을 교체한다. */
export const SHOPPING_FIELDS = {
  root: 'shoppingResult', items: 'products', title: 'productTitle',
  mall: 'mallName', id: 'productId', link: 'productUrl',
} as const;
const object = (value: unknown): Record<string, unknown> =>
  value !== null && typeof value === 'object' ? value as Record<string, unknown> : {};

export function parseShoppingSlots(json: unknown): ShoppingItem[] {
  const rows = object(object(json)[SHOPPING_FIELDS.root])[SHOPPING_FIELDS.items];
  if (!Array.isArray(rows)) throw new Error('쇼핑 응답 형식을 확인해 주세요');
  return rows.slice(0, 20).map((row, index) => {
    const item = object(row);
    const id = item[SHOPPING_FIELDS.id];
    const title = item[SHOPPING_FIELDS.title];
    if ((typeof id !== 'string' && typeof id !== 'number') || !String(id).trim()
      || typeof title !== 'string' || !title.trim()) throw new Error('쇼핑 상품 형식을 확인해 주세요');
    return {
      rank: index + 1, productId: String(id), title: title.replace(/<[^>]*>/g, ''),
      mallName: typeof item[SHOPPING_FIELDS.mall] === 'string' ? item[SHOPPING_FIELDS.mall] as string : '',
      link: typeof item[SHOPPING_FIELDS.link] === 'string' ? item[SHOPPING_FIELDS.link] as string : '',
    };
  });
}

export function findMyRank(items: ShoppingItem[], target: ShoppingTarget): number | undefined {
  const value = (target.productId ?? target.mallName ?? target.titleIncludes ?? '').trim();
  if (!value) return undefined;
  const id = targetUrlId(value, 'shop') ?? value;
  return items.find(item => target.productId !== undefined ? (targetUrlId(item.productId, 'shop') ?? item.productId) === id || targetUrlId(item.link, 'shop') === id
    : target.mallName !== undefined ? item.mallName === value : item.title.includes(value))?.rank;
}

export function parseShoppingPage(html:string,page:number):ShoppingItem[]{
 const props=record(record(nextData(html)).props);const pageProps=record(props.pageProps);
 const result=record(pageProps.shoppingResult);
 const rows=result.products;
 if(!Array.isArray(rows))throw Error('네이버 쇼핑 검색 응답 형식을 확인할 수 없어요');
 return rows.map((row,index)=>{
  const item=record(record(row).item??row);
  const parsed=parseShoppingSlots({shoppingResult:{products:[item]}})[0];
  return {...parsed,rank:(page-1)*40+index+1};
 });
}
