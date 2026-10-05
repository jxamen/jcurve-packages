"use strict";
/**
 * `@jcurve/marketfeed` — 공용 「시장 소식」을 앱에서 읽는 통로(2026-10-06, 첫 앱 머니사인).
 *
 * 플랫폼이 **이미 모으는** 공시(DART · 거래소) · 기사 · 기관 보도자료 · 같은 일을 다룬 기사 묶음을 읽기만 한다.
 * 앱이 따로 수집하지 않는다. DART · 네이버 등 회사 키는 서버에만 있고, 앱은 앱 공개 키(`X-App-Token`)로 읽는다.
 * 서버 경로: `{base}/marketfeed/...`(jcurve-api MarketFeedController) — 앱 설정 `marketfeed.on` 을 켠 앱만 열린다(꺼져 있으면 404).
 *
 * ```ts
 * import { createMarketFeed } from '@jcurve/marketfeed';
 * const feed = createMarketFeed({ base: 'https://api.j-curve.co.kr/v1/moneysign', token: APP_PUBLIC_KEY });
 * const { items, next } = await feed.disclosures({ code: '005930' });
 * const more = next ? await feed.disclosures({ code: '005930', before: next }) : null;
 * ```
 *
 * 내보내지 않는 것(서버가 안 줌): 기사 본문 · 발췌(저작권), 팩트투자 분석(AI 이슈 글 · 급등 사유 · 추천 · 테마).
 * 기사 묶음 제목(`headline`)은 그 묶음에서 가장 먼저 나온 기사 제목이다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.MarketFeedError = void 0;
exports.createMarketFeed = createMarketFeed;
/** 서버가 꺼 둔 앱(marketfeed.on 아님)이면 이 오류 — 화면은 「준비 중」으로 */
class MarketFeedError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'MarketFeedError';
        this.status = status;
    }
}
exports.MarketFeedError = MarketFeedError;
function createMarketFeed(opts) {
    const base = opts.base.replace(/\/+$/, '');
    const f = opts.fetch ?? fetch;
    async function get(path, q = {}) {
        const qs = Object.entries(q)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&');
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
        try {
            const res = await f(base + '/marketfeed/' + path + (qs ? '?' + qs : ''), {
                method: 'GET',
                headers: { Accept: 'application/json', 'X-App-Token': opts.token },
                signal: ctrl.signal,
            });
            if (!res.ok)
                throw new MarketFeedError(res.status, res.status === 404 ? 'marketfeed_off_or_not_found' : 'marketfeed_' + res.status);
            return (await res.json());
        }
        finally {
            clearTimeout(t);
        }
    }
    const page = async (path, q) => {
        const j = await get(path, q);
        return { items: Array.isArray(j.items) ? j.items : [], ...(j.next ? { next: j.next } : {}) };
    };
    return {
        /** 공시 — code 종목코드 · corp DART 고유번호 · q 제목 글자 · before 다음 쪽 · limit(≤100) */
        disclosures: (q = {}) => page('disclosures', q),
        /** 기사 · 기관 보도자료 */
        news: (q = {}) => page('news', q),
        /** 기사 묶음(여러 매체가 같이 다룬 이야기) */
        issues: (q = {}) => page('issues', q),
        /** 묶음 하나와 그 기사들 */
        issue: async (id) => {
            const j = await get('issues/' + id);
            return { issue: j.issue, articles: Array.isArray(j.articles) ? j.articles : [] };
        },
        /** 회사 이름 사전(이름 · 코드 일부) — 20개까지 */
        companies: async (q) => (q.trim() === '' ? [] : (await page('companies', { q: q.trim() })).items),
    };
}
