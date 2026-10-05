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
export type Disclosure = {
    id: number;
    /** DART 접수번호(14자리) */
    rceptNo: string;
    corpName: string;
    corpCode: string;
    stockCode: string | null;
    title: string;
    /** 제출인(거래소 공시면 「한국거래소」 등) */
    filer: string | null;
    /** 접수일 YYYY-MM-DD */
    date: string;
    /** DART 비고(유 · 코 · 채 · 넥 · 공 · 연 · 정 · 철) */
    flags: string | null;
    /** 거래소가 공개한 시각(알 때만) · 플랫폼이 처음 받은 시각 — KST ISO */
    disclosedAt: string | null;
    firstSeenAt: string | null;
    /** DART 원문 */
    url: string;
};
export type Article = {
    id: number;
    title: string;
    url: string;
    publisher: string | null;
    /** news(언론) · release(기관 보도자료) */
    kind: 'news' | 'release' | string;
    publishedAt: string | null;
    firstSeenAt: string | null;
    /** 붙은 종목 코드 */
    codes: string[];
};
export type Issue = {
    id: number;
    /** 대표 기사(가장 먼저 나온 기사) 제목 */
    headline: string | null;
    articleCount: number;
    publisherCount: number;
    sourceCount: number;
    firstAt: string | null;
    latestAt: string | null;
    /** 이어진 이전 묶음(타임라인) */
    prevId: number | null;
    codes: string[];
};
export type Company = {
    code: string;
    name: string;
    corpCode: string | null;
    market: string | null;
};
export type Page<T> = {
    items: T[];
    next?: string;
};
export type MarketFeedOptions = {
    /** 앱 API 주소 그대로(슬러그 포함) — 예: `https://api.j-curve.co.kr/v1/moneysign` */
    base: string;
    /** 앱 공개 키(X-App-Token) */
    token: string;
    timeoutMs?: number;
    /** 시험 · 다른 통로용(기본 전역 fetch) */
    fetch?: typeof fetch;
};
/** 서버가 꺼 둔 앱(marketfeed.on 아님)이면 이 오류 — 화면은 「준비 중」으로 */
export declare class MarketFeedError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare function createMarketFeed(opts: MarketFeedOptions): {
    /** 공시 — code 종목코드 · corp DART 고유번호 · q 제목 글자 · before 다음 쪽 · limit(≤100) */
    disclosures: (q?: {
        code?: string;
        corp?: string;
        q?: string;
        before?: string;
        limit?: number;
    }) => Promise<Page<Disclosure>>;
    /** 기사 · 기관 보도자료 */
    news: (q?: {
        code?: string;
        kind?: "news" | "release";
        before?: string;
        limit?: number;
    }) => Promise<Page<Article>>;
    /** 기사 묶음(여러 매체가 같이 다룬 이야기) */
    issues: (q?: {
        code?: string;
        before?: string;
        limit?: number;
    }) => Promise<Page<Issue>>;
    /** 묶음 하나와 그 기사들 */
    issue: (id: number) => Promise<{
        issue: Issue;
        articles: Article[];
    }>;
    /** 회사 이름 사전(이름 · 코드 일부) — 20개까지 */
    companies: (q: string) => Promise<Company[]>;
};
export type MarketFeed = ReturnType<typeof createMarketFeed>;
