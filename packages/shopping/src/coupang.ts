export const COUPANG_DISCLOSURE = '이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
export type CoupangProduct = { product_id: string; name: string; price?: number; image_url?: string; deep_link: string };
export type CoupangCategory = { id: string; name: string };
/** Partners bestcategories IDs; the server can replace this catalog via config.categories. */
export const COUPANG_CATEGORIES: CoupangCategory[] = [
  { id: '1001', name: '여성패션' }, { id: '1002', name: '남성패션' }, { id: '1012', name: '식품' },
];
export type CoupangConfig = { enabled: boolean; test_only: boolean; categories?: CoupangCategory[] };
export type CoupangProducts = { products: CoupangProduct[]; status?: string; message?: string };
export type CoupangApi = {
  config(): Promise<CoupangConfig>;
  products(query: { keyword?: string; category?: string }): Promise<CoupangProducts>;
  click(productId: string): Promise<unknown>;
};
export function isCoupangUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:' && !u.username && !u.password && !u.port &&
      (u.hostname === 'coupang.com' || u.hostname.endsWith('.coupang.com'));
  } catch { return false; }
}
export function parseCoupangProducts(value: unknown): CoupangProducts {
  const r = value as Partial<CoupangProducts> | null;
  const products = Array.isArray(r?.products) ? r.products.filter(p => p &&
    (typeof p.product_id === 'string' || typeof p.product_id === 'number') && typeof p.name === 'string' && isCoupangUrl(p.deep_link))
    .map(p => ({ ...p, product_id: String(p.product_id) })) : [];
  return { products, status: typeof r?.status === 'string' ? r.status : undefined, message: typeof r?.message === 'string' ? r.message : undefined };
}
export function createCoupangApi(request: <T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<T>): CoupangApi {
  return {
    config: async () => {
      const r = await request<CoupangConfig & { ok?: boolean }>('coupang/config');
      // The authenticated endpoint itself filters test-only membership (404 otherwise).
      return { enabled: r?.enabled === true && r?.ok !== false, test_only: r?.test_only !== false,
        categories: Array.isArray(r?.categories) ? r.categories.filter(c => typeof c.id === 'string' && typeof c.name === 'string') : COUPANG_CATEGORIES };
    },
    products: async ({ keyword = '', category = '' }) => parseCoupangProducts(await request(`coupang/products?keyword=${encodeURIComponent(keyword)}&category=${encodeURIComponent(category)}`)),
    click: product_id => request('coupang/products/click', { method: 'POST', body: { product_id } }),
  };
}
