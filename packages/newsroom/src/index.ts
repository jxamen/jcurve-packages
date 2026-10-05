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

export type ArticleCard = {
  id: number;
  title: string;
  subtitle: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  caseId: number | null;
  xfileId: number | null;
  episodeNo: number | null;
  codes: string[];
};

export type Source = { kind: 'disclosure' | 'news' | 'url'; url: string; title?: string | null; ref?: string | null };

export type Article = ArticleCard & { body: string; sources: Source[]; author: string | null; updatedAt: string | null };

export type Ending = 'confirmed' | 'withdrawn' | 'corrected';

export type CaseCard = {
  id: number;
  title: string;
  summary: string | null;
  corpName: string | null;
  stockCode: string | null;
  state: 'open' | 'ended';
  ending: Ending | null;
  /** 확정 · 철회 · 정정 */
  endingLabel: string | null;
  endedAt: string | null;
  /** 재공시 기한 YYYY-MM-DD */
  deadline: string | null;
  latestAt: string | null;
};

export type CaseEvent = {
  id: number;
  /** inquiry(조회공시 요구) · answer(답변) · reanswer(재공시) · note(운영 메모) · ending(결말) */
  kind: 'inquiry' | 'answer' | 'reanswer' | 'disclosure' | 'note' | 'ending' | string;
  text: string;
  url: string | null;
  at: string | null;
};

export type XFile = { id: number; title: string; intro: string | null; coverUrl: string | null; state: 'published' | 'ended' | string; episodeCount: number };

export type Page<T> = { items: T[]; next?: string };

export type Home = { articles: ArticleCard[]; cases: CaseCard[]; endings: CaseCard[]; xfiles: XFile[] };

export type NewsroomOptions = {
  /** 앱 API 주소 그대로(슬러그 포함) */
  base: string;
  /** 앱 공개 키(X-App-Token) */
  token: string;
  /** 로그인 토큰(추적 · 내 추적 목록에만) — 없으면 그 경로는 401 */
  session?: () => string | null | undefined | Promise<string | null | undefined>;
  timeoutMs?: number;
  fetch?: typeof fetch;
};

export class NewsroomError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'NewsroomError';
    this.status = status;
  }
}

type Query = Record<string, string | number | undefined | null>;

export function createNewsroom(opts: NewsroomOptions) {
  const base = opts.base.replace(/\/+$/, '');
  const f = opts.fetch ?? fetch;

  async function call<T>(method: string, path: string, q: Query = {}, auth = false): Promise<T> {
    const qs = Object.entries(q)
      .filter(([, v]) => v !== undefined && v !== null && v !== '')
      .map(([k, v]) => encodeURIComponent(k) + '=' + encodeURIComponent(String(v)))
      .join('&');
    const headers: Record<string, string> = { Accept: 'application/json', 'X-App-Token': opts.token };
    if (auth) {
      const s = opts.session ? await opts.session() : null;
      if (s) headers.Authorization = 'Bearer ' + s;
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
    try {
      const res = await f(base + '/' + path + (qs ? '?' + qs : ''), { method, headers, signal: ctrl.signal });
      if (!res.ok) throw new NewsroomError(res.status, res.status === 404 ? 'newsroom_off_or_not_found' : 'newsroom_' + res.status);

      return (await res.json()) as T;
    } finally {
      clearTimeout(t);
    }
  }

  const page = async <T>(path: string, q: Query): Promise<Page<T>> => {
    const j = await call<{ items?: T[]; next?: string }>('GET', path, q);

    return { items: Array.isArray(j.items) ? j.items : [], ...(j.next ? { next: j.next } : {}) };
  };

  return {
    /** 홈 묶음 — 최근 기사 · 열린 사건 · 최근 결말 · X파일 */
    home: async (): Promise<Home> => {
      const j = await call<Partial<Home>>('GET', 'newsroom/home');

      return { articles: j.articles ?? [], cases: j.cases ?? [], endings: j.endings ?? [], xfiles: j.xfiles ?? [] };
    },
    articles: (q: { case?: number; xfile?: number; code?: string; before?: string; limit?: number } = {}) => page<ArticleCard>('newsroom/articles', q),
    article: async (id: number): Promise<Article> => (await call<{ article: Article }>('GET', 'newsroom/articles/' + id)).article,
    cases: (q: { state?: 'open' | 'ended'; before?: string; limit?: number } = {}) => page<CaseCard>('newsroom/cases', q),
    /** 사건 하나 — 기록(오래된 → 새) · 관련 기사 */
    caseDetail: async (id: number): Promise<{ case: CaseCard; events: CaseEvent[]; articles: ArticleCard[] }> => {
      const j = await call<{ case: CaseCard; events?: CaseEvent[]; articles?: ArticleCard[] }>('GET', 'newsroom/cases/' + id);

      return { case: j.case, events: j.events ?? [], articles: j.articles ?? [] };
    },
    xfiles: async (): Promise<XFile[]> => (await page<XFile>('newsroom/xfiles', {})).items,
    xfile: async (id: number): Promise<{ xfile: XFile; episodes: ArticleCard[] }> => {
      const j = await call<{ xfile: XFile; episodes?: ArticleCard[] }>('GET', 'newsroom/xfiles/' + id);

      return { xfile: j.xfile, episodes: j.episodes ?? [] };
    },
    /** 추적 켜기 · 끄기(로그인) — 결말 · 다음 편 알림 */
    follow: async (kind: 'case' | 'xfile', id: number): Promise<boolean> => (await call<{ following: boolean }>('PUT', 'newsroom/follows/' + kind + '/' + id, {}, true)).following,
    unfollow: async (kind: 'case' | 'xfile', id: number): Promise<boolean> => (await call<{ following: boolean }>('DELETE', 'newsroom/follows/' + kind + '/' + id, {}, true)).following,
    /** 내가 추적하는 사건 · X파일(로그인) */
    following: async (): Promise<{ cases: CaseCard[]; xfiles: XFile[] }> => {
      const j = await call<{ cases?: CaseCard[]; xfiles?: XFile[] }>('GET', 'me/newsroom-follows', {}, true);

      return { cases: j.cases ?? [], xfiles: j.xfiles ?? [] };
    },
  };
}

export type Newsroom = ReturnType<typeof createNewsroom>;
