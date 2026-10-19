import type { CouponInfo, Deals, NoticeSection, ProductPage, ShoppingApi, ShoppingHome, Category } from './types';

/**
 * 서버(jcurve-api) 경로로 ShoppingApi 를 만든다 — 경로 · 응답 모양은 패키지api 설계를 따라 바뀔 수 있다(아직 서버 없음, 10-19).
 * `request(path, init)` 는 앱 자기 요청 함수(앱 토큰 · 로그인 · 재시도)를 넘긴다 — 패키지는 키를 모른다.
 * 실패는 서버 error 코드를 `code` 에 담은 Error 로 던져 주면 화면이 onLinkError 로 넘긴다(계약: 패키지api docs/shopping-package-design §13).
 *
 *   GET  shopping/home                       → { home }
 *   GET  shopping/categories?partner=        → { items }
 *   GET  shopping/products?partner=&category=&cursor=  → { items, next }
 *   GET  shopping/deals?partner=             → { deals | null }
 *   GET  shopping/coupon-info?partner=       → { info | null }
 *   GET  shopping/notice?partner=            → { sections }
 *   POST shopping/link {partner, product}    → { url }   (적립 추적 링크 — 누른 기록도 서버가 남긴다)
 */
export function createHttpShoppingApi(request: <T>(path: string, init?: { method?: 'GET' | 'POST'; body?: unknown }) => Promise<T>): ShoppingApi {
  const q = (o: Record<string, string | null | undefined>) =>
    Object.entries(o).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
  return {
    home: async () => (await request<{ home: ShoppingHome }>('shopping/home')).home,
    categories: async partner => (await request<{ items: Category[] }>(`shopping/categories?${q({ partner })}`)).items ?? [],
    products: async p => request<ProductPage>(`shopping/products?${q({ partner: p.partnerId, category: p.categoryId, cursor: p.cursor })}`),
    deals: async partner => (await request<{ deals: Deals | null }>(`shopping/deals?${q({ partner })}`)).deals ?? null,
    couponInfo: async partner => (await request<{ info: CouponInfo | null }>(`shopping/coupon-info?${q({ partner })}`)).info ?? null,
    notice: async partner => (await request<{ sections: NoticeSection[] }>(`shopping/notice?${q({ partner })}`)).sections ?? [],
    link: async t => {
      const r = await request<{ url?: string; ok?: boolean; error?: string }>('shopping/link', { method: 'POST', body: { partner: t.partnerId, product: t.productId ?? null } });
      if (!r?.url) throw Object.assign(new Error(r?.error || 'no_url'), { code: r?.error || 'no_url' });
      return { url: r.url };
    },
  };
}
