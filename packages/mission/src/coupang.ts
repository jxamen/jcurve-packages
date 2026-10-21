import type { Requester } from './entry';

export const COUPANG_DISCLOSURE = '이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
export type CoupangStatus = { enabled: boolean; test_only: boolean; eligible: boolean; today_done: boolean; visit_point: number };
const OFF: CoupangStatus = { enabled: false, test_only: true, eligible: false, today_done: false, visit_point: 1 };
export function parseCoupangStatus(value: unknown): CoupangStatus {
  // config is authenticated and server-filtered: test users receive 200, everyone else 404.
  const r = value as (Partial<CoupangStatus> & { ok?: boolean; visited_today?: boolean }) | null;
  return { enabled: r?.enabled === true && r?.ok !== false, test_only: r?.test_only !== false,
    eligible: r?.enabled === true && r?.ok !== false, today_done: r?.visited_today === true,
    visit_point: typeof r?.visit_point === 'number' && r.visit_point > 0 ? r.visit_point : 1 };
}
export const coupangVisible = (s: CoupangStatus) => s.enabled && (!s.test_only || s.eligible);
export function isCoupangUrl(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const u = new URL(value);
    return !u.username && !u.password && !u.port &&
      ((u.protocol === 'https:' && (u.hostname === 'coupang.com' || u.hostname.endsWith('.coupang.com'))) || u.protocol === 'coupang:');
  } catch { return false; }
}

/** One controller per mounted list/account. Consume a visit before awaiting complete. */
export class CoupangVisit {
  status = { ...OFF };
  private pending: string | null = null;
  private away = false;
  private starting = false;
  private completing = false;
  private alive = true;
  private revision = 0;
  constructor(private request: Requester, private open: (url: string) => Promise<unknown>,
    private changed: (status: CoupangStatus) => void, private notice: (message: string) => void) {}
  dispose() { this.alive = false; this.pending = null; ++this.revision; }
  activate() { this.alive = true; }
  async refresh() {
    const revision = ++this.revision;
    let next = { ...OFF };
    try { next = parseCoupangStatus(await this.request('coupang/config')); } catch { /* fail closed */ }
    if (!this.alive || revision !== this.revision) return;
    this.status = next;
    if (!coupangVisible(next)) this.pending = null;
    this.changed(next);
  }
  async start() {
    if (!this.alive || this.starting || this.completing || this.pending || !coupangVisible(this.status) || this.status.today_done) return;
    this.starting = true;
    try {
      const r = await this.request('coupang/visit/start', { method: 'POST', body: {} }) as { ok?: boolean; visit_id?: string; deep_link?: string };
      if (!this.alive || !coupangVisible(this.status)) return;
      if (r.ok === false || !r.visit_id || !isCoupangUrl(r.deep_link)) throw new Error('invalid_start');
      this.pending = r.visit_id;
      this.away = false;
      await this.open(r.deep_link);
    } catch {
      this.pending = null;
      if (this.alive) this.notice('쿠팡을 열지 못했어요. 다시 시도해 주세요.');
      if (this.alive) await this.refresh();
    } finally { this.starting = false; }
  }
  async appState(state: string) {
    if (!this.alive) return;
    if (state === 'background' || state === 'inactive') { if (this.pending) this.away = true; return; }
    if (state !== 'active') return;
    if (!this.pending || !this.away) { if (!this.starting && !this.completing) await this.refresh(); return; }
    const visit_id = this.pending;
    this.pending = null;
    this.away = false;
    this.completing = true;
    ++this.revision;
    try {
      const r = await this.request('coupang/visit/complete', { method: 'POST', body: { visit_id } }) as { ok?: boolean; gained?: number; error?: string };
      if (!this.alive) return;
      if (r.ok === false) throw r;
      if (typeof r.gained === 'number' && r.gained > 0) {
        this.status = { ...this.status, today_done: true };
        this.changed(this.status);
        this.notice(`${r.gained}P 받았어요`);
      }
    } catch (error) {
      const e = error as { error?: string; code?: string; data?: { error?: string } };
      const code = e?.error ?? e?.data?.error ?? e?.code;
      if (this.alive && code !== 'already_claimed') this.notice(code === 'visit_too_short'
        ? '방문 시간이 짧아 아직 지급되지 않았어요. 다시 방문해 주세요.'
        : '지급 결과를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
    }
    finally { if (this.alive) await this.refresh(); this.completing = false; }
  }
}
