"use strict";
/**
 * `@jcurve/newsroom` — 공용 「뉴스룸」을 앱에서 읽는 통로(2026-10-06, 첫 앱 머니사인).
 *
 * 기사는 운영이 어드민에서 사람이 쓰고 발행한다(AI 글쓰기 없음). 사건은 플랫폼이 이미 모은 거래소 공시(조회공시 요구 · 답변 · 재공시)를
 * 규칙으로 이어 붙이고, 결말(확정 · 철회 · 정정)은 운영이 찍는다. X파일은 연재 묶음. 추적하면 결말 · 다음 편 알림(알림 종류 ending · episode).
 * 서버 경로: `{base}/newsroom/...`(jcurve-api NewsroomController) — 앱 설정 `newsroom.on` 을 켠 앱만(꺼져 있으면 404).
 *
 * ```ts
 * import { createNewsroom } from '@jcurve/newsroom';
 * const nr = createNewsroom({ base: 'https://api.j-curve.co.kr/v1/moneysign', token: APP_PUBLIC_KEY, session: () => auth.token() });
 * const home = await nr.home();
 * await nr.follow('case', home.cases[0].id);   // 로그인 필요
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.NewsroomError = void 0;
exports.createNewsroom = createNewsroom;
class NewsroomError extends Error {
    constructor(status, message) {
        super(message);
        this.name = 'NewsroomError';
        this.status = status;
    }
}
exports.NewsroomError = NewsroomError;
function createNewsroom(opts) {
    const base = opts.base.replace(/\/+$/, '');
    const f = opts.fetch ?? fetch;
    async function call(method, path, q = {}, auth = false) {
        const qs = Object.entries(q)
            .filter(([, v]) => v !== undefined && v !== null && v !== '')
            .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
            .join('&');
        const headers = { Accept: 'application/json', 'X-App-Token': opts.token };
        if (auth) {
            const s = opts.session ? await opts.session() : null;
            if (s)
                headers.Authorization = 'Bearer ' + s;
        }
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
        try {
            const res = await f(base + '/' + path + (qs ? '?' + qs : ''), { method, headers, signal: ctrl.signal });
            if (!res.ok)
                throw new NewsroomError(res.status, res.status === 404 ? 'newsroom_off_or_not_found' : 'newsroom_' + res.status);
            return (await res.json());
        }
        finally {
            clearTimeout(t);
        }
    }
    const page = async (path, q) => {
        const j = await call('GET', path, q);
        return { items: Array.isArray(j.items) ? j.items : [], ...(j.next ? { next: j.next } : {}) };
    };
    return {
        /** 홈 묶음 — 최근 기사 · 열린 사건 · 최근 결말 · X파일 */
        home: async () => {
            const j = await call('GET', 'newsroom/home');
            return { articles: j.articles ?? [], cases: j.cases ?? [], endings: j.endings ?? [], xfiles: j.xfiles ?? [] };
        },
        articles: (q = {}) => page('newsroom/articles', q),
        article: async (id) => (await call('GET', 'newsroom/articles/' + id)).article,
        cases: (q = {}) => page('newsroom/cases', q),
        /** 사건 하나 — 기록(오래된 → 새) · 관련 기사 */
        caseDetail: async (id) => {
            const j = await call('GET', 'newsroom/cases/' + id);
            return { case: j.case, events: j.events ?? [], articles: j.articles ?? [] };
        },
        xfiles: async () => (await page('newsroom/xfiles', {})).items,
        xfile: async (id) => {
            const j = await call('GET', 'newsroom/xfiles/' + id);
            return { xfile: j.xfile, episodes: j.episodes ?? [] };
        },
        /** 추적 켜기 · 끄기(로그인) — 결말 · 다음 편 알림 */
        follow: async (kind, id) => (await call('PUT', 'newsroom/follows/' + kind + '/' + id, {}, true)).following,
        unfollow: async (kind, id) => (await call('DELETE', 'newsroom/follows/' + kind + '/' + id, {}, true)).following,
        /** 내가 추적하는 사건 · X파일(로그인) */
        following: async () => {
            const j = await call('GET', 'me/newsroom-follows', {}, true);
            return { cases: j.cases ?? [], xfiles: j.xfiles ?? [] };
        },
    };
}
