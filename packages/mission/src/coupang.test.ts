import { describe, it, expect, vi } from 'vitest';
import { CoupangVisit, coupangVisible, isCoupangUrl, parseCoupangStatus } from './coupang';

function fixture({ enabled = true, done = false, gained = 1 } = {}) {
  let claimed = done;
  const request = vi.fn(async (path: string) => {
    if (path === 'coupang/config') return { enabled, test_only: true, visited_today: claimed, visit_point: 1 };
    if (path.endsWith('/start')) return { ok: true, visit_id: 'visit-1', deep_link: 'https://www.coupang.com/' };
    if (path.endsWith('/complete')) { claimed = gained > 0; return { ok: true, gained }; }
  });
  const open = vi.fn(async () => {}), change = vi.fn(), toast = vi.fn();
  return { request, open, change, toast, visit: new CoupangVisit(request, open, change, toast) };
}
describe('Coupang visit contract', () => {
  it('fails closed before config and for disabled or denied test-only users', async () => {
    expect(coupangVisible(parseCoupangStatus(null))).toBe(false);
    const f = fixture({ enabled: false });
    await f.visit.refresh(); await f.visit.start();
    expect(f.open).not.toHaveBeenCalled();
    expect(coupangVisible(f.visit.status)).toBe(false);
    f.request.mockRejectedValueOnce({ status: 404 });
    await f.visit.refresh();
    expect(coupangVisible(f.visit.status)).toBe(false);
  });
  it('allows a server-authorized test-only user and completes once after leaving and returning', async () => {
    const f = fixture(); await f.visit.refresh();
    expect(coupangVisible(f.visit.status)).toBe(true);
    await Promise.all([f.visit.start(), f.visit.start()]);
    expect(f.open).toHaveBeenCalledOnce();
    await f.visit.appState('active');
    expect(f.request.mock.calls.filter(([p]) => p.endsWith('/complete'))).toHaveLength(0);
    await f.visit.appState('background');
    await Promise.all([f.visit.appState('active'), f.visit.appState('active'), f.visit.appState('active')]);
    expect(f.request.mock.calls.filter(([p]) => p.endsWith('/complete'))).toHaveLength(1);
    expect(f.request).toHaveBeenCalledWith('coupang/visit/complete', { method: 'POST', body: { visit_id: 'visit-1' } });
    expect(f.toast).toHaveBeenCalledExactlyOnceWith('1P 받았어요');
    expect(f.visit.status.today_done).toBe(true);
    await f.visit.start(); expect(f.open).toHaveBeenCalledOnce();
  });
  it('does not announce a replay as a new payment', async () => {
    const f = fixture({ gained: 0 }); await f.visit.refresh(); await f.visit.start();
    await f.visit.appState('inactive'); await f.visit.appState('active');
    expect(f.toast).not.toHaveBeenCalled();
  });
  it('never completes when link opening failed or the controller was disposed', async () => {
    const f = fixture(); await f.visit.refresh();
    f.open.mockRejectedValueOnce(new Error('open failed'));
    await f.visit.start(); await f.visit.appState('background'); await f.visit.appState('active');
    expect(f.request.mock.calls.some(([p]) => p.endsWith('/complete'))).toBe(false);
    await f.visit.start(); f.visit.dispose(); await f.visit.appState('background'); await f.visit.appState('active');
    expect(f.request.mock.calls.some(([p]) => p.endsWith('/complete'))).toBe(false);
  });
  it('does not retry complete on repeated active events after a network failure', async () => {
    const f = fixture(); await f.visit.refresh(); await f.visit.start(); await f.visit.appState('background');
    f.request.mockRejectedValueOnce(new Error('offline'));
    await f.visit.appState('active'); await f.visit.appState('active');
    expect(f.request.mock.calls.filter(([p]) => p.endsWith('/complete'))).toHaveLength(1);
    expect(f.toast).not.toHaveBeenCalledWith('1P 받았어요');
  });
  it('accepts only Coupang deep links', () => {
    expect(isCoupangUrl('https://link.coupang.com/a/test')).toBe(true);
    for (const url of ['javascript:alert(1)', 'https://coupang.com.evil.com/', 'https://evil.com@coupang.com/']) expect(isCoupangUrl(url)).toBe(false);
  });
});
