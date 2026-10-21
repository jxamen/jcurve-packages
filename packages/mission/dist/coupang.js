"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CoupangVisit = exports.coupangVisible = exports.COUPANG_DISCLOSURE = void 0;
exports.parseCoupangStatus = parseCoupangStatus;
exports.isCoupangUrl = isCoupangUrl;
exports.COUPANG_DISCLOSURE = '이 게시물은 쿠팡 파트너스 활동의 일환으로, 이에 따른 일정액의 수수료를 제공받습니다.';
const OFF = { enabled: false, test_only: true, eligible: false, today_done: false, visit_point: 1, min_stay_seconds: null };
function parseCoupangStatus(value) {
    // config is authenticated and server-filtered: test users receive 200, everyone else 404.
    const r = value;
    return { enabled: r?.enabled === true && r?.ok !== false, test_only: r?.test_only !== false,
        eligible: r?.enabled === true && r?.ok !== false, today_done: r?.visited_today === true,
        min_stay_seconds: typeof r?.min_stay_seconds === 'number' && r.min_stay_seconds > 0 ? r.min_stay_seconds : null,
        visit_point: typeof r?.visit_point === 'number' && r.visit_point > 0 ? r.visit_point : 1 };
}
const coupangVisible = (s) => s.enabled && (!s.test_only || s.eligible);
exports.coupangVisible = coupangVisible;
function isCoupangUrl(value) {
    if (typeof value !== 'string')
        return false;
    try {
        const u = new URL(value);
        return !u.username && !u.password && !u.port &&
            ((u.protocol === 'https:' && (u.hostname === 'coupang.com' || u.hostname.endsWith('.coupang.com'))) || u.protocol === 'coupang:');
    }
    catch {
        return false;
    }
}
/** One controller per mounted list/account. Consume a visit before awaiting complete. */
class CoupangVisit {
    constructor(request, open, changed, notice, tooShort) {
        this.request = request;
        this.open = open;
        this.changed = changed;
        this.notice = notice;
        this.tooShort = tooShort;
        this.status = { ...OFF };
        this.pending = null;
        this.away = false;
        this.starting = false;
        this.completing = false;
        this.alive = true;
        this.revision = 0;
    }
    dispose() { this.alive = false; this.pending = null; ++this.revision; }
    activate() { this.alive = true; }
    async refresh() {
        const revision = ++this.revision;
        let next = { ...OFF };
        try {
            next = parseCoupangStatus(await this.request('coupang/config'));
        }
        catch { /* fail closed */ }
        if (!this.alive || revision !== this.revision)
            return;
        this.status = next;
        if (!(0, exports.coupangVisible)(next))
            this.pending = null;
        this.changed(next);
    }
    async start() {
        if (!this.alive || this.starting || this.completing || this.pending || !(0, exports.coupangVisible)(this.status) || this.status.today_done)
            return;
        this.starting = true;
        try {
            const r = await this.request('coupang/visit/start', { method: 'POST', body: {} });
            if (!this.alive || !(0, exports.coupangVisible)(this.status))
                return;
            if (r.ok === false || !r.visit_id || !isCoupangUrl(r.deep_link))
                throw new Error('invalid_start');
            if (typeof r.min_stay_seconds === 'number' && r.min_stay_seconds > 0)
                this.status = { ...this.status, min_stay_seconds: r.min_stay_seconds };
            this.pending = r.visit_id;
            this.away = false;
            await this.open(r.deep_link);
        }
        catch {
            this.pending = null;
            if (this.alive)
                this.notice('쿠팡을 열지 못했어요. 다시 시도해 주세요.');
            if (this.alive)
                await this.refresh();
        }
        finally {
            this.starting = false;
        }
    }
    async appState(state) {
        if (!this.alive)
            return;
        if (state === 'background' || state === 'inactive') {
            if (this.pending)
                this.away = true;
            return;
        }
        if (state !== 'active')
            return;
        if (!this.pending || !this.away) {
            if (!this.starting && !this.completing)
                await this.refresh();
            return;
        }
        const visit_id = this.pending;
        this.pending = null;
        this.away = false;
        this.completing = true;
        ++this.revision;
        try {
            const r = await this.request('coupang/visit/complete', { method: 'POST', body: { visit_id } });
            if (!this.alive)
                return;
            if (r.ok === false)
                throw r;
            if (typeof r.gained === 'number' && r.gained > 0) {
                this.status = { ...this.status, today_done: true };
                this.changed(this.status);
                this.notice(`${r.gained}P 받았어요`);
            }
        }
        catch (error) {
            const e = error;
            const code = e?.error ?? e?.data?.error ?? e?.code;
            const seconds = e?.min_stay_seconds ?? e?.data?.min_stay_seconds ?? this.status.min_stay_seconds;
            if (this.alive && code === 'visit_too_short' && typeof seconds === 'number' && seconds > 0 && this.tooShort)
                this.tooShort(seconds, this.status.visit_point);
            else if (this.alive && code !== 'already_claimed')
                this.notice('지급 결과를 확인하지 못했어요. 잠시 후 다시 확인해 주세요.');
        }
        finally {
            if (this.alive)
                await this.refresh();
            this.completing = false;
        }
    }
}
exports.CoupangVisit = CoupangVisit;
