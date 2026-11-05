import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

// RN 컴포넌트라 노드에서 그리지 않는다 — 실기기 전에 고정할 것(WebView 옵션 · 숨김 배치 · 구동기 배선 · 쿠팡 스위치 · 안내 글)만 원문으로 확인한다.
// 규칙 자체(구동기 · 올리기 · 숨김 배치 · 진행 줄)는 ../*.test.ts 에서 실제로 돌려 본다. 영테크 앱 OrderImportView.test.ts · autoProbe.test.ts 의 화면 검사를 옮겼다(1.1.0) — 목록 시트 자체 검사는 앱에 남는다.
const src = readFileSync(join(__dirname, 'ReceiptImportScreen.tsx'), 'utf8');

describe('ReceiptImportScreen source', () => {
  it('앱마다 다른 것은 전부 config 로 받는다 — 서버 호출 · 웹뷰 · 단추 · 색 · 앱 판 · 보상 글 · 목록. react-native 밖의 앱 모듈은 import 하지 않는다', () => {
    expect(src).toContain('export function ReceiptImportScreen({ config, platform, onClose, coupangRead = false, selftest = false, insets = ZERO_INSETS }: ReceiptImportProps)');
    expect(src).toContain('const { api, Button } = config;');
    expect(src).toContain('const s = useMemo(() => makeStyles(config.theme), [config.theme]);');
    expect(src).toContain('const WebView = config.WebView;');
    expect(src).toContain("update_id: config.updateId ?? ''");
    expect(src).toContain('const claimText = counts && config.claimLine ? config.claimLine(counts.claimable) : null;');
    expect(src).not.toMatch(/from '\.\.\/\.\.\/|from '\.\.\/ui|react-native-safe-area-context|react-native-webview|expo-updates|require\(/);
    expect(src).not.toMatch(/건당 5P|영테크/);
  });

  it('목록을 그리지 않는 앱(renderOrders 없음)도 서버 목록 수는 받아 진행 줄 · 끝 상태에 쓴다', () => {
    expect(src).toContain('if (config.renderOrders) return undefined;');
    expect(src).toContain('const mine = r.orders.filter((o) => o.platform === platform); onLoaded(key, listCounts(mine), mine);');
    expect(src).toContain('}, [ordersKey]);');
  });

  it('keeps the WebView options the login window uses (shared cookies, no incognito)', () => {
    for (const part of ['incognito={false}', 'sharedCookiesEnabled', 'thirdPartyCookiesEnabled', 'javaScriptEnabled', 'domStorageEnabled']) {
      expect(src).toContain(part);
    }
  });

  it('reads every site per receipt through the flow driver — never through the old list scripts', () => {
    expect(src).toContain('createFlowDriver({');
    expect(src).toContain('factory: FLOW_FACTORIES[platform],');
    expect(src).toContain('site: platform,');
    expect(src).not.toMatch(/ORDER_PAGES|parseReaderMessage|createCollector|receiptLink\/readers/);
  });

  it('uploads as it reads: driver onOrders feeds the uploader, which posts through config.api.sendOrders', () => {
    expect(src).toContain('onOrders: (list) => { rememberOrders(list); uploader.current!.add(list); },');
    expect(src).toContain('send: (orders) => api.sendOrders(platform, orders),');
    expect(src).toContain('const sum = await uploader.current!.finish();');
    expect(src).not.toMatch(/noSeconds/);
  });

  it('injects the new-window guard, the nav helpers and the token interceptor before the page loads (every site, coupang included)', () => {
    expect(src).toContain('injectedJavaScriptBeforeContentLoaded={beforeContentLoaded(platform, probe ? [probeObserveScript(), SHAPE_TAP_SCRIPT] : [])}');
    expect(src).toContain('setSupportMultipleWindows={false}');
  });

  it('swallows the hidden page alerts: quiet while hidden, passes them through while the WebView is shown, and counts dialog messages instead of passing them to the flow', () => {
    expect(src).toContain('webRef.current?.injectJavaScript(setQuietScript(!showWeb));');
    expect(src).toContain('webRef.current?.injectJavaScript(setQuietScript(!showRef.current));');
    expect(src).toContain('[showWeb]');
    expect(src).toContain("if (msg.type === 'dialog') {");
    const dialogAt = src.indexOf("msg.type === 'dialog'");
    const navAt = src.indexOf("msg.type === 'nav'");
    expect(dialogAt).toBeGreaterThan(navAt);
    expect(src.slice(dialogAt, dialogAt + 220)).toContain('return;');
    expect(src.slice(dialogAt, dialogAt + 220)).not.toContain('driver.current');
  });

  it('fetches the server list once per run and hands the already-completed rows to the flow as known; naver pauses between pages through one constant', () => {
    expect(src).toContain('const known = await fetchKnown(api.listOrders, platform);');
    expect(src).toContain('if (runId.current !== id || !alive.current) return;');
    expect(src.match(/fetchKnown\(/g)).toHaveLength(1);
    expect(src).toContain('      known,\n');
    expect(src).toContain("minGotoDelayMs: platform === 'naver' ? NAVER_ISSUE_GOTO_DELAY_MS : 0,");
    expect(src).toContain('void startRun();');
  });

  it('opens new windows in the same WebView, only https pages inside the site domains', () => {
    expect(src).toContain('onOpenWindow={onOpenWindow}');
    expect(src).toContain('isFlowUrl(t, FLOW_HOSTS[platform])');
    expect(src).toContain('loadUrl(t)');
  });

  it('runs the reader behind the screen: hidden layout keeps the WebView alive and injectJavaScript keeps working', () => {
    expect(src).toContain("webHostLayout(showWeb ? 'shown' : 'hidden', Platform.OS, win)");
    expect(src).toContain('<View style={layout.style} pointerEvents={layout.pointerEvents}>');
    expect(src).toContain('inject: (script) => { webRef.current?.injectJavaScript(script); },');
    expect(src).not.toMatch(/display:\s*'none'|opacity:\s*0[,\s}]|width:\s*0[,\s}]|height:\s*0[,\s}]|visible=\{false\}|removeClippedSubviews/);
    expect(src).toContain('{webOn && source ? (');
    expect(src).toMatch(/const settle = async \(id: number\) => \{\s*setWebOn\(false\);/);
  });

  it('shows the WebView only for login or a needed check, and hides it again when reading resumes', () => {
    expect(src).toContain("const showWeb = reading && webOn && (drv.state === 'login' || drv.state === 'attention' || onLogin);");
    expect(src).toContain('setOnLogin(isLoginUrl(u));');
    expect(src).toContain('driver.current?.onPageChanged(u);');
    expect(src).toContain('<Button label="확인 끝났어요"');
    expect(src).toContain('driver.current?.resume()');
  });

  it('puts the order list (config.renderOrders) on the screen while reading, refreshed whenever a batch reaches the server', () => {
    expect(src).toContain("config.renderOrders({ platform, reading, onClose: close, reloadKey: ordersKey, run, onFetchOne: fetchOne, onRefill: platform === 'naver' ? refillDetails : undefined, fetchBusy: mode === 'sending' || (reading && !single), onLoaded })");
    expect(src).toContain('if (p.sent !== lastSent.current) { lastSent.current = p.sent; setOrdersKey((k) => k + 1); }');
    expect(src).toContain('const t = setInterval(() => driver.current?.tick(), TICK_MS);');
  });

  it('shows the server rows first: the list mounts together with the reader; a retry fetches the list again before reading starts', () => {
    expect(src).toMatch(/\{config\.renderOrders && \(!stalled \|\| \(counts && counts\.total > 0\)\) \? config\.renderOrders\(/);
    const retry = src.slice(src.indexOf('const retry = () => {'), src.indexOf('const resendOrders'));
    expect(retry.indexOf('setOrdersKey((k) => k + 1);')).toBeGreaterThan(-1);
    expect(retry.indexOf('setOrdersKey((k) => k + 1);')).toBeLessThan(retry.indexOf('startRun();'));
  });

  it('keeps an already imported list on screen even when this run read nothing', () => {
    expect(src).toContain('(counts && counts.total > 0)');
  });

  it('header numbers come from the same server list as the rows (one basis: fetched / list total), and the receipt-stage target count is only used to tell the stage', () => {
    expect(src).toContain('listTotal: counts ? counts.total : null, fetched: counts ? counts.fetched : 0, claimable: counts ? counts.claimable : 0,');
    expect(src).toContain('const tally = tallyPending(listInfo.orders, run);');
    expect(src).toContain('missed: tally.failed, none: tally.none,');
    expect(src).toContain('total: drv.total,');
    expect(src).not.toMatch(/done: drv\.done|read: prog\.read|sent: prog\.sent/);
    expect(src).toContain('const shown = settledMode(mode, listInfo.key >= ordersKey);');
    expect(src).toContain('const run = runView(shown, drv.total, endReason, REPORTS_OUTCOMES.includes(platform) ? outcomes : undefined, single);');
  });

  it('remembers why the run ended (flow reason, or stopped by the user) for the 못 가져옴 reason text', () => {
    expect(src).toContain('reasonRef.current = r.reason;');
    expect(src).toContain("setEndReason(endKind.current === 'stopped' ? 'stopped' : reasonRef.current);");
  });

  it('never reads cookies or page text itself', () => {
    expect(src).not.toMatch(/document\.cookie|CookieManager|getCookies|innerText|textContent/);
  });

  it('has the stop / close / retry / skip controls — and no 구조 기록 button for anyone (the flow records structure quietly)', () => {
    expect(src).toContain('<Button label="중단" onPress={stopReading} />');
    expect(src).toContain('accessibilityLabel="닫기"');
    expect(src).toContain('<Button label="다시 시도"');
    expect(src).toContain('<Button label="건너뛰기"');
    expect(src).toContain('<Button label="사진/종이로 올리기"');
    expect(src).toContain('<Button label="다시 보내기"');
    expect(src).not.toContain('읽기 멈추기');
    expect(src).not.toContain('label="구조 기록"');
    expect(src).not.toContain('recordShape');
    expect(src).not.toContain('지금까지 읽은 것 보기');
    expect(src).toContain('const MAX_TRIES = 3;');
  });

  it('sends a structure report only for probe members (the server rejects everyone else), and only the page shape', () => {
    expect(src).toContain('probe: (shape, where) => {\n      if (!probeOn.current) return;');
    expect(src).toContain('void api.postProbe(buildPayload(shapeProbeRaw(shape, where), platform))');
  });

  it('coupang reads only when the server switch is on; otherwise it reads nothing and shows the not-ready notice', () => {
    expect(src).toContain("const offByServer = platform === 'coupang' && !coupangRead;");
    expect(src).toContain('if (probe !== null && !offByServer) void startRun();');
    // 한 번 누르면 끝까지(대표님 11-05 16:57): 시간 · 재시도 상한으로 끊긴 전체 실행은 새 줄을 읽었으면 스스로 이어 간다(최대 3번) — 한 줄 · 채우기 실행은 아니다
    expect(src).toContain("const CONTINUE_REASONS = ['timeout', 'timeouts', 'site-cap', 'budget', 'max-steps'];");
    expect(src).toContain('const MAX_AUTO_RUNS = 3;');
    expect(src).toContain('if (!scopedRun.current && CONTINUE_REASONS.includes(reasonRef.current) && uploader.current!.progress().read > 0 && autoRuns.current < MAX_AUTO_RUNS) {');
    expect(src).toMatch(/autoRuns\.current \+= 1;\s*setOrdersKey\(\(k\) => k \+ 1\);\s*void startRun\(\);\s*return;/);
    expect(src).toContain("if (offByServer || readOff) return paperExit(`쿠팡은 준비 중이에요 · 종이 영수증이나 사진으로 올려 주세요`);");
    expect(src).toContain('if (p.readOff) {');
  });

  it('dead-end messages always name the next step (다시 시도 · 사진/종이로 올리기)', () => {
    expect(src).not.toContain('이 곳의 주문은 읽지 않아요');
    expect(src).toContain('사진으로 올리기');
  });

  it('중단 단추는 가져오는 동안 진행 줄 옆에 눈에 띄게(ghost 아님) 있고, 누르면 목록 읽기와 영수증 가져오기를 모두 바로 멈춘다', () => {
    const i = src.indexOf('<View style={s.popCard}>');
    const pop = src.slice(i, src.indexOf('<View style={s.bar}>', i));
    expect(pop).toContain('<View style={s.popBtn}><Button label="중단" onPress={stopReading} /></View>');
    expect(pop).not.toContain('tone="ghost"');
    expect(src).toContain("popBtn: { alignSelf: 'stretch' }");
    expect(src).toContain('const busyNow = (mode === ');
    expect(src).toContain("&& !showWeb;");
    const stop = src.slice(src.indexOf('const stopReading = () => {'), src.indexOf('const close = () => {'));
    expect(stop).toContain('const id = ++runId.current;');
    expect(stop).toContain('driver.current?.stop();');
    expect(stop).toContain("endKind.current = 'stopped';");
    expect(stop).toContain('void settle(id);');
    expect(src).toMatch(/const settle = async \(id: number\) => \{\s*setWebOn\(false\);/);
    expect(src).toContain("setEndReason(endKind.current === 'stopped' ? 'stopped' : reasonRef.current);");
  });

  it('줄마다 가져오기 결과는 흐름이 알린 것(onOutcome)을 결과를 알리는 사이트에서만 쓰고, 전체 실행은 비우고 한 줄 실행은 그 줄만 지운다', () => {
    expect(src).toContain("const REPORTS_OUTCOMES: readonly LinkPlatform[] = ['naver', 'coupang', 'kurly', 'musinsa', 'daiso', 'oliveyoung'];");
    expect(src).toContain('onOutcome: (e) => { if (runId.current === id && alive.current) { outcomeRef.current = { ...outcomeRef.current, [e.key]: e.outcome }; setOutcomes((p) => ({ ...p, [e.key]: e.outcome })); } },');
    expect(src).toContain('if (!onlyKeys) { setOutcomes({}); outcomeRef.current = {}; queueRef.current = []; }');
    expect(src).toContain('setOutcomes((p) => { const next = { ...p }; delete next[key]; return next; });');
  });

  it('「가져오기」는 이미 가져온 줄을 건너뛴다 — 전체는 known 으로, 한 줄은 onlyKeys(그 줄의 key)로 시작한다', () => {
    expect(src).toContain('const startRun = async (onlyKeys?: string[], refill?: string[]) => {');
    expect(src).toContain('options: { ...(onlyKeys ? { probe: probeOn.current, onlyKeys } : refill ? { probe: probeOn.current, refill } : { probe: probeOn.current }), ...(npv2On.current ? { npv2: true } : {}), ...(windowDays ? { windowDays } : {}) },');
    expect(src).toContain('uploader.current!.setWindowDays(windowDays);');
    expect(src.match(/fetchKnown\(/g)).toHaveLength(1);
    const fetchOne = src.slice(src.indexOf('const fetchOne = '), src.indexOf('const resendOrders'));
    expect(fetchOne).toContain("if (mode === 'sending') return;");
    expect(fetchOne).toContain('queueRef.current.push(key);');
    expect(fetchOne).toContain('if (!single || queueRef.current.includes(key) || single.only.includes(key)) return;');
    expect(fetchOne).toContain('void startRun([key]);');
    expect(src).toContain("onFetchOne: fetchOne, onRefill: platform === 'naver' ? refillDetails : undefined, fetchBusy: mode === 'sending' || (reading && !single)");
  });

  it('하단 「못 가져온 것만 다시 가져오기」 단추는 뺐다(대표님 10-30) — 다시 「주문 불러오기」로 이어서 가져온다', () => {
    expect(src).not.toContain('showFetchMissing');
    expect(src).not.toContain('못 가져온 것만 다시 가져오기');
    expect(src).not.toContain('const fetchMissing');
    expect(src).toContain("{stalled && (tries < MAX_TRIES || endNote === 'login') ? <Button label=\"다시 시도\"");
  });

  it('새 주문을 한 건도 못 읽고 끝나도 전부 「못 읽었어요」가 아니다 — 끝난 까닭(새 영수증 없음 · 로그인 풀림 · 시간 초과 …)을 가른다(대표님 11-02 20:36)', () => {
    const settle = src.slice(src.indexOf('const settle = async'), src.indexOf('/** onlyKeys 가 있으면'));
    expect(settle).toContain("if (endKind.current === 'stopped') { setMode('stopped'); return; }");
    expect(settle).toContain('if (uploader.current!.progress().read === 0) {');
    expect(settle).toContain("if (scopedRun.current) { setMode('stalled'); return; }");
    expect(settle).toContain('endOfNothingRead(reasonRef.current, Object.values(outcomeRef.current))');
    expect(settle).toContain('setEndNote(end.note);');
    expect(settle).toContain('setMode(end.mode);');
    expect(src).toContain('scopedRun.current = !!onlyKeys || !!refill;');
    expect(src).toContain('outcomeRef.current = { ...outcomeRef.current, [e.key]: e.outcome };');
    expect(src).toContain('setEndNote(null);');
    expect(src).toContain("const noteLine = endNote && (mode === 'stalled' || (mode === 'ended' && shown === 'ended')) ? endNoteLine(endNote, label, counts ? { total: counts.total, claimable: counts.claimable } : null) : null;");
    expect(src).toContain('const line = noteLine ?? statusLine({');
    expect(src).toContain("if (tries >= MAX_TRIES && endNote !== 'login') return;");
  });

  it('자동 구조 기록(흐름 · 구조 기록기)은 조용히 그대로 — 구조 기록 답을 화면 글자 없이 올린다', () => {
    expect(src).toContain("if (msg.type === 'probe' && probeOn.current) void api.postProbe(buildPayload(msg.raw, platform));");
    expect(src).not.toMatch(/구조를 기록|구조 기록을 보내지/);
    expect(src).toContain('probeCollectScript(true)');
  });

  it('요청 흐름의 응답 키 구조(structure)도 대표님 계정에서만, 실행당 상한 안에서 조용히 올린다', () => {
    const host = src.slice(src.indexOf('structure: (where, h, path, lines) => {'), src.indexOf('now: () => Date.now(),'));
    expect(host).toContain('if (!probeOn.current || !probeGate.current.allowFlowRecord()) return;');
    expect(host).toContain("outline: ['flow-structure', `where=${where}`, ...lines]");
    expect(host).toContain('void api.postProbe(buildPayload(');
  });

  // 영테크 autoProbe.test.ts 의 화면 배선 검사(옮김)
  it('자동 구조 수집: 대표님 계정(probeOn)이 아니면 아무것도 하지 않고, 문이 허용한 화면에서만 수집 스크립트를 넣는다 · 문은 한 번 만들어 실행 내내 쓴다', () => {
    const at = src.indexOf('probe: (shape, where) => {');
    const block = src.slice(at, src.indexOf('now: () => Date.now()', at));
    expect(at).toBeGreaterThan(0);
    expect(block.indexOf('if (!probeOn.current) return;')).toBeGreaterThan(-1);
    expect(block.indexOf('if (!probeOn.current) return;')).toBeLessThan(block.indexOf('postProbe('));
    expect(block.indexOf('if (!probeOn.current) return;')).toBeLessThan(block.indexOf('injectJavaScript('));
    expect(block).toContain('if (webRef.current && gate.allowCollect(shape.url)) webRef.current.injectJavaScript(probeCollectScript(true));');
    expect(src).toContain('const probeGate = useRef(createProbeGate());');
    expect(src).not.toContain('setNote');
  });

  it('실패 기록 · 실행 끝은 config.api 로 보낸다(묶음 나누기 · 오류 삼키기는 appKit 에)', () => {
    expect(src).toContain('void api.postFails(platform, items);');
    expect(src.match(/api\.postRunEnd\(\{ platform, total: outs\.length/g)).toHaveLength(2);
    expect(src).toContain('effectiveReadDays(await api.loadLinkState(), platform)');
  });
});
