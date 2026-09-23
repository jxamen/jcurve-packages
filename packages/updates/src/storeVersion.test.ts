import { afterEach, describe, expect, it, vi } from 'vitest';
import { __resetStoreVersion, checkStoreVersion, decideStoreUpdate, storeLinks, type StoreVersionEnv } from './storeVersion';

describe('막을까 · 권할까', () => {
  it('최소보다 낮으면 강제', () => {
    expect(decideStoreUpdate('1.0.1', { min: '1.0.2', recommend: '1.0.4' })).toEqual({ kind: 'force', installed: '1.0.1', target: '1.0.2' });
  });
  it('최소는 넘고 권장보다 낮으면 권유', () => {
    expect(decideStoreUpdate('1.0.2', { min: '1.0.2', recommend: '1.0.4' })).toEqual({ kind: 'recommend', installed: '1.0.2', target: '1.0.4' });
  });
  it('iOS 스토어 공개 버전이 어드민 권장보다 높으면 그쪽을 권한다', () => {
    expect(decideStoreUpdate('1.0.4', { recommend: '1.0.4' }, '1.0.5')?.target).toBe('1.0.5');
  });
  it('스토어 새 버전으로는 막지 않는다 — 강제는 어드민 최소만', () => {
    expect(decideStoreUpdate('1.0.4', { min: '', recommend: '' }, '2.0.0')?.kind).toBe('recommend');
  });
  it('최소가 비고 권장도 비면 아무것도 안 한다', () => {
    expect(decideStoreUpdate('1.0.0', { min: null, recommend: null })).toBeNull();
  });
  it('설치 버전을 모르면(개발 실행) 아무것도 안 한다', () => {
    expect(decideStoreUpdate(null, { min: '9.0.0' })).toBeNull();
  });
  it('자릿수가 달라도 비교한다 — 1.0 == 1.0.0, 1.0.10 > 1.0.9', () => {
    expect(decideStoreUpdate('1.0', { min: '1.0.0' })).toBeNull();
    expect(decideStoreUpdate('1.0.9', { min: '1.0.10' })?.kind).toBe('force');
  });
  it('버전 모양이 아닌 값은 없는 것으로 본다', () => {
    expect(decideStoreUpdate('1.0.0', { min: '1.0.4 beta', recommend: 'latest' })).toBeNull();
  });
});

describe('스토어 주소', () => {
  it('App Store 는 앱 번호, Play 는 패키지명으로 만든다', () => {
    expect(storeLinks('ios', { appStoreId: '6804574363' })).toEqual({ app: 'itms-apps://apps.apple.com/app/id6804574363', web: 'https://apps.apple.com/kr/app/id6804574363' });
    expect(storeLinks('android', { package: 'kr.co.jcurve.eggfarm' })).toEqual({ app: 'market://details?id=kr.co.jcurve.eggfarm', web: 'https://play.google.com/store/apps/details?id=kr.co.jcurve.eggfarm' });
  });
  it('번호를 모르면 null', () => {
    expect(storeLinks('ios', { appStoreId: null })).toBeNull();
    expect(storeLinks('android', {})).toBeNull();
  });
});

/** 가짜 기기 — 창과 스토어 열기를 기록한다 */
function device(over: Partial<StoreVersionEnv> = {}) {
  const alerts: { title: string; body: string; buttons: { text: string; onPress?: () => void }[] }[] = [];
  const opened: string[] = [];
  const store: Record<string, string> = {};
  let active: () => void = () => {};
  let clock = Date.UTC(2026, 8, 23, 3);
  const env: Partial<StoreVersionEnv> = {
    os: () => 'android', dev: () => false, installed: () => '1.0.1',
    alert: (title, body, buttons) => { alerts.push({ title, body, buttons }); },
    openURL: async (u) => { opened.push(u); },
    onActive: (fn) => { active = fn; return () => {}; },
    lookup: async () => null,
    getItem: async (k) => store[k] ?? null, setItem: async (k, v) => { store[k] = v; },
    now: () => clock,
    ...over,
  };
  __resetStoreVersion(env);
  return { alerts, opened, back: () => active(), tick: (ms: number) => { clock += ms; } };
}
const flush = () => new Promise((r) => setTimeout(r, 0));
const server = (android: object, ios: object = {}) => vi.fn(async () => ({ ok: true, android, ios }));

afterEach(() => __resetStoreVersion());

describe('앱을 켤 때', () => {
  it('최소 미만이면 버튼이 「업데이트」 하나뿐인 창 → Play 로 보낸다', async () => {
    const d = device();
    checkStoreVersion({ fetch: server({ min: '1.0.2', package: 'kr.co.jcurve.eggfarm' }) });
    await flush(); await flush();
    expect(d.alerts).toHaveLength(1);
    expect(d.alerts[0].buttons.map((b) => b.text)).toEqual(['업데이트']);
    d.alerts[0].buttons[0].onPress!();
    await flush();
    expect(d.opened).toEqual(['market://details?id=kr.co.jcurve.eggfarm']);
  });

  it('강제는 스토어에 다녀오면 10분을 기다리지 않고 다시 뜬다', async () => {
    const d = device();
    checkStoreVersion({ fetch: server({ min: '1.0.2', package: 'p.k' }) });
    await flush(); await flush();
    d.alerts[0].buttons[0].onPress!();
    d.back(); await flush(); await flush();
    expect(d.alerts).toHaveLength(2);
  });

  it('스토어 앱이 안 열리면 웹 주소, 그것도 안 되면 강제 창을 다시 띄운다', async () => {
    const tried: string[] = [];
    const d = device({ openURL: async (u) => { tried.push(u); throw new Error('no'); } });
    checkStoreVersion({ fetch: server({ min: '1.0.2', package: 'p.k' }) });
    await flush(); await flush();
    d.alerts[0].buttons[0].onPress!();
    for (let i = 0; i < 6; i++) await flush();
    expect(tried).toEqual(['market://details?id=p.k', 'https://play.google.com/store/apps/details?id=p.k']);
    expect(d.alerts.length).toBeGreaterThanOrEqual(2);
  });

  it('권유는 「나중에」가 있고, 같은 권장 버전은 하루 한 번', async () => {
    const d = device({ installed: () => '1.0.2' });
    const fetch = server({ min: '1.0.2', recommend: '1.0.4', package: 'p.k' });
    checkStoreVersion({ fetch });
    await flush(); await flush(); await flush();
    expect(d.alerts[0].buttons.map((b) => b.text)).toEqual(['나중에', '업데이트']);
    d.alerts[0].buttons[0].onPress!();
    d.tick(11 * 60_000); d.back(); await flush(); await flush(); await flush();
    expect(d.alerts).toHaveLength(1);        // 같은 날 두 번째 — 안 뜬다
    d.tick(24 * 3600_000); d.back(); await flush(); await flush(); await flush();
    expect(d.alerts).toHaveLength(2);        // 다음 날 — 다시 뜬다
  });

  it('권유는 canRecommend 가 거짓이면(로그인 전·가입 중) 띄우지 않는다 — 강제는 띄운다', async () => {
    const d = device({ installed: () => '1.0.2' });
    checkStoreVersion({ fetch: server({ recommend: '1.0.4', package: 'p.k' }), canRecommend: () => false });
    await flush(); await flush(); await flush();
    expect(d.alerts).toHaveLength(0);
  });

  it('iOS 는 App Store 공개 버전을 읽어 권한다', async () => {
    const lookup = vi.fn(async () => '1.0.5');
    const d = device({ os: () => 'ios', installed: () => '1.0.4', lookup });
    checkStoreVersion({ fetch: server({}, { recommend: '1.0.4', appStoreId: '6804574363', bundleId: 'kr.co.jcurve.eggfarm' }) });
    for (let i = 0; i < 4; i++) await flush();
    expect(lookup).toHaveBeenCalledWith('kr.co.jcurve.eggfarm');
    expect(d.alerts[0].body).toContain('1.0.4 → 1.0.5');
  });

  it('최소가 비어 있으면 아무것도 하지 않는다', async () => {
    const d = device();
    checkStoreVersion({ fetch: server({ min: null, recommend: null, package: 'p.k' }) });
    await flush(); await flush();
    expect(d.alerts).toHaveLength(0);
  });

  it('스토어 주소를 모르면 막지 않는다 — 막고 못 보내면 사람이 갇힌다', async () => {
    const d = device();
    checkStoreVersion({ fetch: server({ min: '9.0.0' }) });
    await flush(); await flush();
    expect(d.alerts).toHaveLength(0);
  });

  it('서버를 못 읽으면 조용히 넘어간다', async () => {
    const d = device();
    checkStoreVersion({ fetch: async () => { throw new Error('offline'); } });
    await flush();
    expect(d.alerts).toHaveLength(0);
  });

  it('웹 · 개발 실행에서는 서버도 부르지 않는다', async () => {
    const fetch = server({ min: '9.0.0', package: 'p.k' });
    device({ os: () => 'web' }); checkStoreVersion({ fetch });
    device({ dev: () => true }); checkStoreVersion({ fetch });
    await flush();
    expect(fetch).not.toHaveBeenCalled();
  });
});
