/** JS-only, best-effort funnel. No SDK keys, user IDs or callback payloads leave this module. */
export type OfferwallFunnelEvent = 'chance_tab_open' | 'offerwall_open' | 'offerwall_close';
export type OfferwallFunnelSend = (event: OfferwallFunnelEvent, prop: string) => unknown;
type Context = { tester: 'test' | 'user' | 'unknown'; visibility: 'all' | 'android' | 'ios' | 'both' | 'list' | 'off' | 'unknown' };
let send: OfferwallFunnelSend | undefined;
let context: Context = { tester: 'unknown', visibility: 'unknown' };
export function configureOfferwallFunnel(sender: OfferwallFunnelSend): void { send = sender; }
export function resetOfferwallFunnelContext(): void { context = { tester: 'unknown', visibility: 'unknown' }; }
/** Compare locally, retain only a boolean category and public tokens, never the list or member ID. */
export function setOfferwallFunnelContext(value: unknown, memberId: unknown): void {
  if (typeof value !== 'string' && typeof value !== 'number') { resetOfferwallFunnelContext(); return; }
  const tokens = String(value).split(/[\s,;]+/).filter(Boolean);
  const id = memberId == null ? '' : String(memberId);
  context = {
    tester: id && /^\d+$/.test(id) ? (tokens.includes(id) ? 'test' : 'user') : 'unknown',
    visibility: tokens.includes('*') ? 'all' : tokens.includes('*android') && tokens.includes('*ios') ? 'both'
      : tokens.includes('*android') ? 'android' : tokens.includes('*ios') ? 'ios'
      : tokens.some(t => /^\d+$/.test(t)) ? 'list' : 'off',
  };
}
export type OfferwallAttempt = { loaded(): void; fail(reason: 'not_ready' | 'invalid_usn' | 'sdk_error' | 'timeout' | 'cancelled'): void };
export type ChanceFunnel = { enter(): void; begin(platform: string): OfferwallAttempt; close(reason?: 'screen_exit' | 'sdk_close'): void };
/** One terminal open result per SDK invocation; duplicate native callbacks are ignored. */
export function createChanceFunnel(sender: OfferwallFunnelSend | undefined = send): ChanceFunnel {
  let entered = false, closed = false;
  const pending = new Set<OfferwallAttempt>();
  const emit = (name: OfferwallFunnelEvent, status: string) => {
    try { Promise.resolve(sender?.(name, `${status}:${context.tester}:${context.visibility}`)).catch(() => {}); } catch { /* UI must continue */ }
  };
  return {
    enter() { if (!entered && !closed) { entered = true; emit('chance_tab_open', 'shown'); } },
    begin(platform) {
      let done = closed;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (status: string) => {
        if (done) return;
        done = true; clearTimeout(timer); pending.delete(attempt); emit('offerwall_open', status);
      };
      const attempt: OfferwallAttempt = {
        // iOS bridge fires on attachment, not proof of campaign load. Android uses OnLoadedOfferwall.
        loaded: () => finish(platform === 'ios' ? 'attached' : 'loaded'),
        fail: reason => finish(reason),
      };
      if (!done) { pending.add(attempt); timer = setTimeout(() => finish('timeout'), 20000); }
      return attempt;
    },
    close(reason = 'screen_exit') {
      if (closed) return;
      closed = true;
      for (const attempt of pending) attempt.fail('cancelled');
      if (entered) emit('offerwall_close', reason);
    },
  };
}
/** Screen visibility, not button presses. Deferred cleanup ignores React StrictMode's effect replay. */
export function useChanceFunnel(): ChanceFunnel {
  const React = require('react') as typeof import('react');
  const visit = React.useRef<ChanceFunnel | null>(null);
  const live = React.useRef(false);
  if (!visit.current) visit.current = createChanceFunnel();
  React.useEffect(() => {
    live.current = true; visit.current!.enter();
    return () => { live.current = false; Promise.resolve().then(() => { if (!live.current) visit.current!.close(); }); };
  }, []);
  return visit.current;
}
