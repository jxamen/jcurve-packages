import type { CouponInfo, Deals, NoticeSection, ProductPage, ShoppingApi, ShoppingHome, Category, ProofInfo, ProofItem } from './types';

const record = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const nullableString = (value: unknown) => value == null || typeof value === 'string';
const noticeSection = (value: unknown): boolean => record(value) && typeof value.title === 'string' && Array.isArray(value.items) && value.items.every(item =>
  typeof item === 'string' || (record(item) && typeof item.text === 'string' && (item.sub === undefined || (Array.isArray(item.sub) && item.sub.every(x => typeof x === 'string')))));

/** 서버 글은 바꾸지 않고 화면에서 쓸 수 있는 모양의 필드만 통과시킨다. */
export function parseProofInfo(value: unknown): ProofInfo | null {
  if (!record(value) || typeof value.rateText !== 'string') return null;
  return {
    rateText: value.rateText,
    ...Object.fromEntries(['title', 'subtitle', 'payoutText', 'cta'].map(key => [key, nullableString(value[key]) ? value[key] : undefined])),
    guide: Array.isArray(value.guide) && value.guide.every(x => typeof x === 'string') ? value.guide : undefined,
    confirmDays: value.confirmDays === null || typeof value.confirmDays === 'number' ? value.confirmDays : undefined,
    dailyMax: value.dailyMax === null || typeof value.dailyMax === 'number' ? value.dailyMax : undefined,
    steps: Array.isArray(value.steps) && value.steps.every(x => record(x) && typeof x.title === 'string' && nullableString(x.desc)) ? value.steps as ProofInfo['steps'] : undefined,
    faq: Array.isArray(value.faq) && value.faq.every(x => record(x) && typeof x.q === 'string' && typeof x.a === 'string') ? value.faq as ProofInfo['faq'] : undefined,
    notice: Array.isArray(value.notice) && value.notice.every(noticeSection) ? value.notice as ProofInfo['notice'] : undefined,
  };
}

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
    proof: {
      info: async partner => {
        try {
          return parseProofInfo((await request<{ info?: unknown }>(`shopping/proof/info?${q({ partner })}`)).info);
        } catch (e) {
          const error = e as { status?: number; statusCode?: number; code?: string | number };
          if (error?.status === 404 || error?.statusCode === 404 || String(error?.code) === '404') return null;
          throw e;
        }
      },
      list: async () => (await request<{ items?: ProofItem[] }>('shopping/proofs')).items ?? [],
      submit: async input => {
        const body = new FormData();
        body.append('partner', input.partnerId);
        // React Native FormData accepts a local file descriptor, supplied by the host app.
        body.append('image', input.image as unknown as Blob);
        if (input.orderNo != null) body.append('orderNo', input.orderNo);
        if (input.amount != null) body.append('amount', String(input.amount));
        const r = await request<{ item?: ProofItem; error?: string }>('shopping/proofs', { method: 'POST', body });
        if (!r?.item) throw Object.assign(new Error(r?.error || 'no_item'), { code: r?.error || 'no_item' });
        return r.item;
      },
    },
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
