/**
 * 주문 불러오기 화면(패키지 1.1.0 — 첫 앱의 OrderImportView.tsx 를 그대로 옮겼다. 앱마다 다른 것은 config 로 받는다: screen/config.ts).
 * 연동 칩 「주문 불러오기」가 연다. 사이트의 영수증을 주문마다 건건이 읽어(receiptLink/flows.ts 의 사이트별 흐름 + flowDriver.ts) 서버에 올린다.
 * 읽기 웹뷰는 **뒤에서** 돈다(webHostStyle.ts: 보이지 않지만 멈추지 않게 놓는다). 사용자가 보는 것은 이 화면 하나 — 진행 줄과, 읽는 대로 올라가는 주문 목록(ReceiptOrdersSheet).
 * 웹뷰를 보이는 것은 로그인이 필요할 때(흐름이 login 을 내거나 로그인 주소) · 캡차 같은 확인이 필요할 때뿐이다. 끝나면 바로 다시 숨기고 읽기를 이어 간다.
 * 읽은 주문은 importUploader.ts 가 읽는 대로 50건 이하로 올린다(실패는 다음 회차에 다시). 입력란 · 토큰 · 쿠키 · 영수증 주소는 읽지도 올리지도 않는다.
 * 20초 동안 답이 없으면 구동기가 흐름에 시간 초과를 먹이고(다시 확인), 끝내 한 건도 못 읽으면 「못 읽었어요 · 다시 시도 · 사진/종이로 올리기」를 낸다.
 * 쿠팡은 서버 스위치(coupangRead)가 켜져 있을 때만 읽는다 — 꺼져 있거나 서버가 read_disabled 를 주면 읽기를 시작하지 않고 안내만 보인다.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { endNoteLine, endOfNothingRead, type EndNote } from '../appKit';
import { failItems, type FailOrder } from '../failLog';
import { createFlowDriver, isFlowUrl, shapeProbeRaw, type DriverStatus, type FlowDriver, type FlowHost } from '../flowDriver';
import { FLOW_FACTORIES, FLOW_HOSTS, NAVER_ISSUE_GOTO_DELAY_MS, NAVER_ISSUE_SITE_CAP_MS } from '../flows';
import { fetchKnown } from '../knownOrders';
import { runView, settledMode, statusLine, type ImportMode } from '../importLine';
import { setQuietScript } from '../navCommon';
import { isLoginUrl, type ImportResult } from '../importPlan';
import { createUploader, type UploadProgress, type Uploader } from '../importUploader';
import { effectiveReadDays, LINK_LABEL, type LinkPlatform } from '../model';
import { listCounts, tallyPending, type LinkOrder, type ListCounts } from '../ordersModel';
import { buildPayload, createProbeGate, probeCollectScript, probeObserveScript, showProbeButton } from '../probe';
import { outcomeKey, type Outcome } from '../runOutcome';
import { NO_PAIR_SCRIPT, parseTapMessage, SHAPE_TAP_SCRIPT, tapKey, tapRaw } from '../shapeTap';
import { beforeContentLoaded } from '../webScripts';
import { webHostLayout } from '../webHostStyle';
import type { ReceiptLinkScreenConfig, ScreenTheme } from './config';

/** 구동기 시계 — 읽기 예약 · 20초 감시 · 상한을 이 간격으로 본다 */
const TICK_MS = 500;
/** 「다시 시도」는 한 곳에 세 번까지(처음 한 번 포함) */
const MAX_TRIES = 3;
/** 흐름이 첫 동작으로 주소를 열지 않을 때 처음 여는 주문내역 주소 */
const FALLBACK_URL: Record<LinkPlatform, string> = {
  naver: 'https://shopping.naver.com/my/order',
  coupang: 'https://mc.coupang.com/ssr/mobile/order/list',
  kurly: 'https://www.kurly.com/mypage/order',
  musinsa: 'https://www.musinsa.com/order/order-list',
  daiso: 'https://www.daisomall.co.kr/',
  oliveyoung: 'https://www.oliveyoung.co.kr/store/main/main.do',
};
/** 이 사유로 끝났으면 끝까지 다 읽은 것이다(나머지는 일부를 못 읽고 끝난 것) */
const COMPLETE_REASONS = ['all-rows', 'max-orders'];
/** 줄마다 가져오기 결과(onOutcome)를 알리는 사이트의 흐름 — 줄 상태 · 까닭을 이 결과로 보인다. 나머지 사이트는 끝난 뒤 목록 행으로 짐작한다 */
const REPORTS_OUTCOMES: readonly LinkPlatform[] = ['naver', 'coupang', 'kurly', 'musinsa', 'daiso', 'oliveyoung'];

export type ReceiptImportProps = {
  /** 앱이 한 번 만들어 둔 설정(defineReceiptLinkScreen) */
  config: ReceiptLinkScreenConfig;
  platform: LinkPlatform;
  onClose: () => void;
  /** 안전 영역(앱의 useSafeAreaInsets 값) — 없으면 0 */
  insets?: { top: number; bottom: number };
  /** 쿠팡 읽기 스위치(LinkState.coupangRead). 쿠팡인데 이게 true 가 아니면 읽지 않고 준비 중 안내만 낸다 */
  coupangRead?: boolean;
  /** 호환용(OrderLinkFlow 가 넘긴다). 이 화면이 이미 불러온 주문 목록이라 읽기가 끝나도 부르지 않는다 */
  onFinished?: (r: ImportResult) => void;
  /**
   * 자동 점검(npv2 회원, 홈의 OrderLinkSelftest 가 안 보이게 띄운다) — 전체 1번이 끝나면 못 가져온 줄 하나를 개별로 1번 돌리고,
   * 결과(개수 · 까닭만, 값 없음)를 `[receiptLink] selftest …` 줄로 남긴 뒤 닫는다. 로그인이 필요하면 그 사실만 남기고 닫는다(슬랙대표님요청 16:09)
   */
  selftest?: boolean;
};

/** 자동 점검 기록 — syslog(값 없음) + 서버(구조 기록)로. 대표님 폰이 PC 에 없을 때 서버에서 본다(슬랙대표님요청 10-29 18:x) */
const stLog = (text: string): void => { try { console.log(`[receiptLink] selftest ${text}`); } catch { /* 무시 */ } };
const stPost = (api: ReceiptLinkScreenConfig['api'], platform: LinkPlatform, text: string): void => {
  try { void api.postProbe(buildPayload({ host: 'app', path: '/selftest', queryKeys: [], cookieNames: [], outline: ['selftest', ...text.split(' ').slice(0, 40)], repeat: {}, requests: [] }, platform)); } catch { /* 무시 */ }
};
/** 결과 세기 — 상태 · 까닭별 개수 */
const tallyOutcomes = (o: Record<string, Outcome>): string => {
  const n: Record<string, number> = {};
  for (const v of Object.values(o)) { const k = v.state === 'failed' ? `failed:${v.code}` : v.state; n[k] = (n[k] ?? 0) + 1; }
  return JSON.stringify(n);
};

const EMPTY_STATUS: DriverStatus = { state: 'idle', phase: 'idle', done: 0, total: 0, orders: 0, timeouts: 0 };

export function ReceiptImportScreen({ config, platform, onClose, coupangRead = false, selftest = false, insets = ZERO_INSETS }: ReceiptImportProps) {
  const { api, Button } = config;
  const s = useMemo(() => makeStyles(config.theme), [config.theme]);
  const win = useWindowDimensions();
  /** 쿠팡인데 읽기 스위치가 꺼져 있다 — 아무것도 읽지 않는다 */
  const offByServer = platform === 'coupang' && !coupangRead;
  const label = LINK_LABEL[platform];
  const [probe, setProbe] = useState<boolean | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [webOn, setWebOn] = useState(false);
  const [onLogin, setOnLogin] = useState(false);
  const [mode, setMode] = useState<ImportMode>('reading');
  const [partial, setPartial] = useState(false);
  /** 끝난 까닭 코드(흐름이 낸 것 · 사용자가 멈췄으면 'stopped') — 못 가져온 줄의 까닭 글자에 쓴다 */
  const [endReason, setEndReason] = useState('');
  /** 한 줄 다시 가져오기 실행이면 그 줄 · 지난 전체 실행이 끝난 까닭 — 나머지 줄은 그 모습 그대로 둔다 */
  const [single, setSingle] = useState<{ only: string[]; base: string } | null>(null);
  /** 한 줄 가져오기 중에 누른 다른 줄 — 끝나면 차례로 가져온다 */
  const queueRef = useRef<string[]>([]);
  const [readOff, setReadOff] = useState(false);
  const [drv, setDrv] = useState<DriverStatus>(EMPTY_STATUS);
  const drvRef = useRef<DriverStatus>(EMPTY_STATUS);
  const [prog, setProg] = useState<UploadProgress>({ read: 0, sent: 0, pending: 0, failed: false, readOff: false, full: false });
  const [ordersKey, setOrdersKey] = useState(0);
  /** 서버 목록을 마지막으로 받은 결과 — key 는 거기까지 반영된 ordersKey, counts 는 목록 줄 수(머리 숫자의 분모 · 분자) */
  const [listInfo, setListInfo] = useState<{ key: number; counts: ListCounts | null; orders: LinkOrder[] }>({ key: -1, counts: null, orders: [] });
  /** 흐름이 줄마다 알려 준 가져오기 결과(키는 runOutcome.outcomeKey) — 전체 실행은 비우고 시작하고, 한 줄 다시 가져오기는 그 줄 것만 지운다 */
  const [outcomes, setOutcomes] = useState<Record<string, Outcome>>({});
  const [tries, setTries] = useState(1);
  /** 새 주문을 한 건도 못 읽고 끝났을 때의 까닭(importEnd.ts) — 새 영수증 없음 · 로그인 풀림 · 시간 초과 … 를 가른 진행 줄 글자에 쓴다 */
  const [endNote, setEndNote] = useState<EndNote | null>(null);
  const source = useMemo(() => (url ? { uri: url } : undefined), [url]);
  const reading = mode === 'reading';
  // 웹뷰는 로그인 · 사용자 확인이 필요할 때만 보인다 — 로그인이 끝나 주문 페이지로 돌아오면 바로 다시 숨는다
  const showWeb = reading && webOn && (drv.state === 'login' || drv.state === 'attention' || onLogin);
  /** 지금 웹뷰가 사용자에게 보이는가 — 새 문서가 열릴 때마다 알림 통과 여부를 다시 정하는 데 쓴다 */
  const showRef = useRef(false);
  showRef.current = showWeb;
  /** 숨김 웹뷰가 띄우려던 알림 수(글자는 받지 않는다) */
  const dialogs = useRef({ total: 0, fail: 0 });
  const webRef = useRef<any>(null);
  const alive = useRef(true);
  const probeOn = useRef(false);
  /** 줄마다 가져오기 결과의 최신 값 — 끝난 까닭을 가를 때(settle) 쓴다(상태는 그 시점의 값이 낡았다) */
  const outcomeRef = useRef<Record<string, Outcome>>({});
  /** 이번 실행이 한 줄 · 영수증 채우기 실행이다 — 이때는 새 주문 0건을 예전처럼 「못 읽음」으로 둔다 */
  const scopedRun = useRef(false);
  /** 새 네이버페이 수집 길(서버 LinkState.npv2) */
  const npv2On = useRef(false);
  /** 자동 점검 단계 — full 전체 실행 중 · one 개별 실행 중 · done 끝 */
  const stStage = useRef<'full' | 'one' | 'done'>('full');
  const stStart = useRef(Date.now());
  /** 한 번 실행에서 서버로 가는 구조 기록의 문(probe.ts createProbeGate) */
  const probeGate = useRef(createProbeGate());
  /** 구조 기록기가 card-single B 형식 기록을 한 번이라도 받았다 — 이후 새 문서에서는 같은 읽기 전용 호출을 다시 하지 않게 알린다 */
  const pairDone = useRef(false);
  const urlRef = useRef<string | null>(null);
  const runId = useRef(0);
  const driver = useRef<FlowDriver | null>(null);
  const gotoCalled = useRef(false);
  const lastSent = useRef(0);

  const loadUrl = (u: string) => {
    if (urlRef.current === u) { webRef.current?.reload(); return; }
    urlRef.current = u;
    setUrl(u);
  };

  const uploader = useRef<Uploader | null>(null);
  if (!uploader.current) {
    uploader.current = createUploader({
      send: (orders) => api.sendOrders(platform, orders),
      onChange: (p) => {
        if (!alive.current) return;
        setProg(p);
        // 서버에 올라간 주문이 늘었으면 목록을 새로 불러온다 — 읽은 주문이 하나씩 나타난다
        if (p.sent !== lastSent.current) { lastSent.current = p.sent; setOrdersKey((k) => k + 1); }
        // 서버가 이 곳 읽기를 막고 있다(쿠팡 스위치 꺼짐) — 읽기를 멈추고 준비 중 안내
        if (p.readOff) { runId.current += 1; driver.current?.stop(); setWebOn(false); setReadOff(true); }
      },
    });
  }

  /** 흐름(구동기)이 웹뷰에 시키는 일 */
  const host: FlowHost = {
    goto: (u) => { gotoCalled.current = true; loadUrl(u); },
    back: () => { webRef.current?.goBack(); },
    inject: (script) => { webRef.current?.injectJavaScript(script); },
    // 구조 요약(주소 모양 · 개수만)은 대표님 계정(서버 probe 목록)에서만 서버로 보낸다 — 다른 회원은 서버가 받지 않는다
    probe: (shape, where) => {
      if (!probeOn.current) return;
      const gate = probeGate.current;
      if (gate.allowFlowRecord()) void api.postProbe(buildPayload(shapeProbeRaw(shape, where), platform));
      // 같은 화면 모양마다 한 번, 요청 목록(경로 · 쿼리 키 · 응답 키)이 든 구조도 같이 올린다 — 대표님 계정이 사이트가 쓰는 API 지도를 남기게. 사용자 문구는 바꾸지 않는다(auto)
      if (webRef.current && gate.allowCollect(shape.url)) webRef.current.injectJavaScript(probeCollectScript(true));
    },
    // 요청 흐름이 응답에서 이름으로 찾아 쓴 칸의 키 구조(경로 : 종류, 값 없음) — 대표님 계정에서만 조용히 올린다(맞으면 그대로 쓰고, 틀렸을 때 다음에 고칠 근거가 된다)
    structure: (where, h, path, lines) => {
      if (!probeOn.current || !probeGate.current.allowFlowRecord()) return;
      void api.postProbe(buildPayload({ host: h, path, queryKeys: [], cookieNames: [], outline: ['flow-structure', `where=${where}`, ...lines], repeat: {}, requests: [] }, platform));
    },
    now: () => Date.now(),
  };

  /** 끝낸 방식 — ended 읽기가 끝났다 · stopped 사용자가 멈췄다. partial 은 일부를 못 읽고 끝났다 */
  const endKind = useRef<'ended' | 'stopped'>('ended');
  const partialRef = useRef(false);
  const reasonRef = useRef('');
  /** 흐름이 센 까닭별 개수(FlowStats.reasons) — 실행 끝 기록(모든 회원, 개수만) */
  const statsRef = useRef<Record<string, number>>({});
  /** 줄 키 → 목록 주문(실패 기록에 주문번호 · 상품명 · 일시 · 금액을 싣는다) · 이번 실행 시작 시각 */
  const ordersByKey = useRef<Map<string, FailOrder>>(new Map());
  const runStartRef = useRef(0);
  const rememberOrders = (list: readonly FailOrder[]) => { for (const o of list) if (o.orderNo) ordersByKey.current.set(outcomeKey(o.orderNo, o.orderedAt, o.amount), { orderNo: o.orderNo, title: o.title, orderedAt: o.orderedAt, amount: o.amount }); };
  /** 못 받은 줄을 서버 실패 기록으로(대표님 11-04 「다 기록해놔」) — 100줄씩 */
  const sendFails = (endCode: string) => {
    const ctx = { os: Platform.OS, update_id: config.updateId ?? '', login: drvRef.current.state === 'login' ? 'needed' : 'ok', run_ms: runStartRef.current ? Date.now() - runStartRef.current : null, end: endCode };
    const items = failItems(outcomeRef.current, ordersByKey.current, endCode, ctx);
    void api.postFails(platform, items);
  };

  /** 못 올린 주문 중 서버 목록에 정말 없는 수 — 같은 쇼핑몰 · 분 단위 일시 · 금액으로 맞춘다(주문번호는 서버가 가려 보낸다). 목록을 못 받으면 전부 없는 것으로 */
  const countMissing = async (rest: { orderedAt: string; amount: number }[]): Promise<number> => {
    try {
      const have = new Set((await api.listOrders()).orders.filter((o) => o.platform === platform).map((o) => `${o.orderedAt.slice(0, 16)}|${o.amount}`));
      return rest.filter((o) => !have.has(`${o.orderedAt.slice(0, 16)}|${o.amount}`)).length;
    } catch {
      return rest.length;
    }
  };

  /** 읽기가 끝났다(또는 멈췄다) — 남은 주문을 올리고 결과에 맞는 화면으로 */
  const settle = async (id: number) => {
    setWebOn(false);
    setOnLogin(false);
    setMode('sending');
    const sum = await uploader.current!.finish();
    // 실행 끝 까닭별 개수 — 모든 회원(주문 값 · 쿠키 없이 개수만). 회원 폰에서 쿠팡 14자리 영수증 · 보내기 실패 까닭을 서버에서 보려고(11-03)
    {
      const reasons: Record<string, number> = { ...statsRef.current };
      const add = (k: string, n = 1) => { reasons[k] = (reasons[k] ?? 0) + n; };
      const outs = Object.values(outcomeRef.current);
      for (const o of outs) add(`row-${o.state}${o.state === 'failed' ? `-${o.code}` : o.state === 'none' && o.why ? `-${o.why}` : ''}`);
      for (const [k, n] of Object.entries(sum.errors)) add(k, n);
      if (sum.dropped > 0) add('send-dropped', sum.dropped);
      if (sum.pending > 0) add('send-pending', sum.pending);
      sendFails(endKind.current === 'stopped' ? 'stopped' : reasonRef.current || 'ended');
      void api.postRunEnd({ platform, total: outs.length, ok: outs.filter((o) => o.state === 'done').length, reason: (endKind.current === 'stopped' ? 'stopped' : reasonRef.current).toLowerCase().replace(/[^a-z0-9:_-]/g, '').slice(0, 40), reasons });
    }
    // 올리기 결과의 거절 까닭별 개수(대표님 계정만, 값 없음) — 컬리 6건이 전부 거절된 까닭을 서버 기록에 남긴다
    if (probeOn.current) {
      const t = sum.tally;
      for (const w of [`flowu-n${t.new}-d${t.duplicate}-u${t.updated}-t${t.taken}`, `flowu-o${t.out_of_range}-i${t.invalid}-a${t.amount}`, `flowu-p${t.pouch_full}-x${sum.unreadable}`]) {
        void api.postProbe(buildPayload({ host: 'app', path: '/import-result', queryKeys: [], cookieNames: [], outline: ['flow-structure', `where=${w}`], repeat: {}, requests: [] }, platform));
      }
    }
    if (!alive.current || runId.current !== id) return;
    if (sum.readOff) { setReadOff(true); return; }
    setPartial(partialRef.current);
    setEndReason(endKind.current === 'stopped' ? 'stopped' : reasonRef.current);
    if (sum.pending > 0) {
      // 저장은 됐는데 응답만 못 받은 경우가 있다(쿠팡 68건, 11-02) — 서버 목록과 맞춰 정말 없는 것만 「보내지 못함」으로 센다
      const missing = await countMissing(uploader.current!.pendingOrders());
      if (!alive.current || runId.current !== id) return;
      if (missing > 0) { setProg((p) => ({ ...p, pending: missing })); setMode('sendFailed'); return; }
    }
    // 멈춘 것이면 멈췄다고만 말한다
    if (endKind.current === 'stopped') { setMode('stopped'); return; }
    // 새 주문을 한 건도 못 읽었다 — 전체 실행이면 까닭을 가른다: 목록을 끝까지 읽었고 가져올 게 없으면 정상 종료(실패가 아니다),
    // 로그인이 풀렸거나 시간 초과 · 막힘 · 목록 못 읽음이면 「못 읽었어요」+ 그 까닭. 한 줄 · 영수증 채우기 실행은 예전 그대로(대표님 11-02 20:36)
    if (uploader.current!.progress().read === 0) {
      if (scopedRun.current) { setMode('stalled'); return; }
      const end = endOfNothingRead(reasonRef.current, Object.values(outcomeRef.current));
      setEndNote(end.note);
      setMode(end.mode);
      return;
    }
    setMode('ended');
  };

  /** onlyKeys 가 있으면 그 줄들(runOutcome.outcomeKey)만 영수증을 가져온다 — 한 줄 다시 가져오기. 없으면 전체(이미 가져온 줄은 known 으로 건너뛴다) */
  const startRun = async (onlyKeys?: string[], refill?: string[]) => {
    runId.current += 1;
    const id = runId.current;
    driver.current?.stop();
    gotoCalled.current = false;
    setMode('reading');
    setWebOn(true);
    setOnLogin(false);
    setPartial(false);
    setEndReason('');
    setEndNote(null);
    reasonRef.current = '';
    scopedRun.current = !!onlyKeys || !!refill;
    if (!onlyKeys) { setOutcomes({}); outcomeRef.current = {}; queueRef.current = []; }
    runStartRef.current = Date.now();
    // 한 줄 실행이면 지난 전체 실행의 까닭을 이어 둔다(이어서 누른 한 줄 실행도 같은 까닭)
    setSingle(onlyKeys ? (prev) => ({ only: onlyKeys, base: prev ? prev.base : endReason }) : null);
    setDrv(EMPTY_STATUS);
    probeGate.current = createProbeGate();   // 구조 기록 상한은 실행마다 — 한 화면에서 여러 번 누르면 뒤 실행의 끝 기록이 막혔다
    // 서버에 이미 영수증까지 보강된 주문은 다시 열지 않게 한 번만 받아 start 에 넘긴다(못 받으면 known 없이 전체 처리)
    const known = await fetchKnown(api.listOrders, platform);
    if (runId.current !== id || !alive.current) return;
    // 읽을 기간 — 서버 앱설정(플랫폼별 일수). 못 받으면 기본 365(패키지가 정한다)
    // 서버가 받는 기간(windowDays)보다 길게 읽어도 서버가 거절한다 — 그 기간까지만(컬리 1095 일 설정이 6건 전부 거절 → 0건이었다, 11-02)
    const windowDays = effectiveReadDays(await api.loadLinkState(), platform);
    if (runId.current !== id || !alive.current) return;
    uploader.current!.setWindowDays(windowDays);
    const d = createFlowDriver({
      site: platform,
      factory: FLOW_FACTORIES[platform],
      known,
      minGotoDelayMs: platform === 'naver' ? NAVER_ISSUE_GOTO_DELAY_MS : 0,
      siteCapMs: NAVER_ISSUE_SITE_CAP_MS,
      host,
      // 대표님 계정이면 흐름이 구조 기록용 걸음을 앞에 넣을 수 있다(일반 회원은 false)
      options: { ...(onlyKeys ? { probe: probeOn.current, onlyKeys } : refill ? { probe: probeOn.current, refill } : { probe: probeOn.current }), ...(npv2On.current ? { npv2: true } : {}), ...(windowDays ? { windowDays } : {}) },
      onOrders: (list) => { rememberOrders(list); uploader.current!.add(list); },
      onOutcome: (e) => { if (runId.current === id && alive.current) { outcomeRef.current = { ...outcomeRef.current, [e.key]: e.outcome }; setOutcomes((p) => ({ ...p, [e.key]: e.outcome })); } },
      onUpdate: (st) => { if (runId.current === id && alive.current) { drvRef.current = st; setDrv(st); } },
      onDone: (r) => {
        if (runId.current !== id) return;
        endKind.current = 'ended';
        partialRef.current = !COMPLETE_REASONS.includes(r.reason);
        reasonRef.current = r.reason;
        statsRef.current = r.stats.reasons ?? {};
        void settle(id).then(() => {
          // 기다리던 한 줄이 있으면 이어서 그 줄만
          const nextKey = queueRef.current.shift();
          if (nextKey && alive.current && runId.current === id) {
            setOutcomes((p) => { const n = { ...p }; delete n[nextKey]; return n; });
            void startRun([nextKey]);
          }
        });
      },
    });
    driver.current = d;
    d.start();
    if (!gotoCalled.current && !urlRef.current) loadUrl(FALLBACK_URL[platform]);
  };

  /** 중단 — 목록 읽기와 영수증 가져오기를 모두 멈춘다(runId 를 올려 오는 답을 버리고, 구동기를 세우고, 웹뷰를 뗀다). 지금까지 가져온 것은 올리고 남은 줄은 「대기」로 남긴다 */
  const stopReading = () => {
    const id = ++runId.current;
    // 차례를 기다리던 한 줄들은 기다리지 않고 원래 모습(단추 있음)으로
    const waiting = queueRef.current;
    queueRef.current = [];
    if (waiting.length > 0) setOutcomes((p) => { const n = { ...p }; for (const k of waiting) delete n[k]; return n; });
    driver.current?.stop();
    endKind.current = 'stopped';
    void settle(id);
  };

  const close = () => {
    // 영수증을 받는 중에 닫으면 거기서 멈춘다 — 다른 쇼핑몰로 넘어가기 전에 한 번 묻는다(대표님 11-03 네이버 목록 46건 뒤 18초 만에 쿠팡으로 넘어가 영수증이 멈춤)
    if (mode === 'reading' && drv.state !== 'login') {
      Alert.alert('아직 영수증을 받는 중이에요', '지금 닫으면 남은 영수증은 받지 못해요. 끝날 때까지 기다려 주세요.', [
        { text: '계속 받기', style: 'cancel' },
        { text: '닫기', style: 'destructive', onPress: closeNow },
      ]);
      return;
    }
    closeNow();
  };

  const closeNow = () => {
    // 받는 중에 닫으면 서버 기록이 안 남아 멈춘 까닭을 몰랐다 — 남은 줄 수와 「closed」를 남긴다(개수만, 대표님 11-03 「멈춘 경우 남은 건수 · 까닭 기록」)
    if (mode === 'reading') {
      const outs = Object.values(outcomeRef.current);
      const reasons: Record<string, number> = {};
      for (const o of outs) { const k = `row-${o.state}${o.state === 'failed' ? `-${o.code}` : ''}`; reasons[k] = (reasons[k] ?? 0) + 1; }
      reasons['closed-left'] = outs.filter((o) => o.state === 'fetching').length;
      void api.postRunEnd({ platform, total: outs.length, ok: outs.filter((o) => o.state === 'done').length, reason: 'closed', reasons });
      sendFails('closed');
    }
    runId.current += 1;
    driver.current?.stop();
    void uploader.current?.flush();
    onClose();
  };

  const retry = () => {
    // 세 번 제한은 같은 실패를 되풀이하지 않게 하는 것 — 로그인이 풀려서 멈춘 것은 사용자가 로그인하면 풀리니 제한하지 않는다
    if (tries >= MAX_TRIES && endNote !== 'login') return;
    setTries((t) => t + 1);
    // 다시 시도 — 읽기를 시작하기 전에 서버 목록부터 새로 받아 이미 불러온 줄을 바로 보인다
    setOrdersKey((k) => k + 1);
    void startRun();
  };

  /** 한 줄만 다시 가져오기(그 줄의 「가져오기」 단추) — 읽는 중이 아닐 때만. 그 줄의 지난 결과를 지우고 그 줄만 처리하는 새 실행을 만든다 */
  const fetchOne = (key: string) => {
    if (mode === 'sending') return;
    if (mode === 'reading') {
      // 한 줄 가져오기 중이면 이 줄은 차례를 기다린다(누른 줄만 「대기」, 나머지 줄은 그대로). 전체 읽기 중에는 받지 않는다
      if (!single || queueRef.current.includes(key) || single.only.includes(key)) return;
      queueRef.current.push(key);
      setOutcomes((p) => ({ ...p, [key]: { state: 'fetching' } }));
      return;
    }
    setOutcomes((p) => { const next = { ...p }; delete next[key]; return next; });
    void startRun([key]);
  };

  /** 「영수증 내용 채우기」 — 세부가 빈 카드 줄만 새 방식으로 한 번 다시 받는다(서버가 빈 세부만 채운다). 읽는 중 · 보내는 중이면 받지 않는다 */
  const refillDetails = (tails: string[]) => {
    if (mode === 'reading' || mode === 'sending' || tails.length === 0) return;
    void startRun(undefined, tails);
  };

  const resendOrders = () => { void settle(runId.current); };

  /** 주소가 바뀌었다(load 끝 · SPA 이동). 로그인 주소면 웹뷰를 보이고, 구동기에 알려 읽기를 예약한다 */
  const onUrl = (u: string) => {
    if (!u) return;
    if (pairDone.current) webRef.current?.injectJavaScript(NO_PAIR_SCRIPT);
    // 새 문서는 알림 삼키기가 기본(조용히)으로 돌아간다 — 지금 웹뷰를 보여 주는 중이면 다시 통과로 맞춘다
    webRef.current?.injectJavaScript(setQuietScript(!showRef.current));
    setOnLogin(isLoginUrl(u));
    driver.current?.onPageChanged(u);
  };
  const onLoadEnd = (e: { nativeEvent?: { url?: string } }) => onUrl(e?.nativeEvent?.url ?? '');
  const onNavChange = (e: { url?: string }) => onUrl(e?.url ?? '');
  // 간편결제 영수증 주소(receipts/preview/card)는 열지 말고 주소만 instantJob 에 넘긴다(window.__RCPT_CARD__) — 화면을 넘기지 않아 흐름이 보존된다(대표님 17:04~05, rl15j)
  const injectCardUrl = (u: string) => { webRef.current?.injectJavaScript(`try{window.__RCPT_CARD__=${JSON.stringify(u)}}catch(e){};true;`); };
  // 같은 창 이동 요청 — 영수증 주소면 막고(false 반환 → 웹뷰 보존) 주소만 주입, 그 밖은 그대로 진행
  const onShouldStart = (req: { url?: string }): boolean => {
    const u = req?.url ?? '';
    if (u.indexOf('receipts/preview/card') >= 0) { injectCardUrl(u); return false; }
    return true;
  };
  // 새 창(target=_blank · window.open) — 영수증 주소면 주소만 받고(새 창 안 띄움), 그 밖 사이트 도메인 https 는 같은 웹뷰에서 연다
  const onOpenWindow = (e: { nativeEvent?: { targetUrl?: string } }) => {
    const t = e?.nativeEvent?.targetUrl;
    if (typeof t !== 'string') return;
    if (t.indexOf('receipts/preview/card') >= 0) { injectCardUrl(t); return; }
    if (isFlowUrl(t, FLOW_HOSTS[platform])) loadUrl(t);
  };

  const onMessage = (e: { nativeEvent?: { data?: unknown } }) => {
    const data = e?.nativeEvent?.data;
    if (typeof data !== 'string') return;
    let msg: { type?: unknown; raw?: unknown } | null = null;
    try { msg = JSON.parse(data); } catch { return; }
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'nav') { driver.current?.onMessage(msg); return; }
    // 숨김 웹뷰의 alert · confirm · prompt 를 삼켰다는 알림({type:'dialog', kind, len, fail}) — 흐름에 흘리지 않고 개수만 센다
    if (msg.type === 'dialog') {
      dialogs.current.total += 1;
      if ((msg as { fail?: unknown }).fail === true) dialogs.current.fail += 1;
      return;
    }
    // 구조 기록기(shapeTap)가 보낸 사이트 데이터의 키 구조 — 대표님 계정에서만 조용히 올린다(값 없음 · 사용자 문구 없음). 화면 + target 모양마다 한 번, 한 실행 최대 TAP_RECORD_MAX 건
    if (msg.type === 'tap') {
      if (!probeOn.current) return;
      const rec = parseTapMessage(msg);
      if (!rec) return;
      if (rec.target === 'card-single-B') pairDone.current = true;
      if (probeGate.current.allowTap(tapKey(rec))) void api.postProbe(buildPayload(tapRaw(rec), platform));
      return;
    }
    // 구조 기록 답 — 흐름이 자동으로 모은 것은 사용자 화면에 아무 글자 없이 조용히 올린다(손으로 누르는 「구조 기록」 단추는 없다)
    if (msg.type === 'probe' && probeOn.current) void api.postProbe(buildPayload(msg.raw, platform));
  };

  useEffect(() => {
    alive.current = true;
    void api.loadLinkState().then((st) => {
      if (!alive.current) return;
      probeOn.current = showProbeButton(st);
      npv2On.current = st?.npv2 === true;
      setProbe(probeOn.current);
    });
    return () => {
      alive.current = false;
      runId.current += 1;
      driver.current?.stop();
      void uploader.current?.flush();
    };
  }, []);

  // 카드 상태(구조 기록 여부)를 읽은 뒤 읽기를 시작한다. 쿠팡 스위치가 꺼져 있으면 시작하지 않는다
  useEffect(() => {
    if (probe !== null && !offByServer) void startRun();
  }, [probe]);

  // 자동 점검(selftest): 전체가 끝나면 못 가져온 줄 하나를 개별로, 그것도 끝나면 기록을 남기고 닫는다. 로그인이 필요하면 바로 닫는다
  useEffect(() => {
    if (!selftest || stStage.current === 'done') return;
    if (reading && (onLogin || drv.state === 'login')) {
      stStage.current = 'done';
      stLog(`login-needed stage=${single ? 'one' : 'full'}`);
      close();
      return;
    }
    if (reading || mode === 'sending') return;
    if (stStage.current === 'full') {
      { const t = `full sec=${Math.round((Date.now() - stStart.current) / 1000)} mode=${mode} reason=${endReason || '-'} total=${drv.total} done=${drv.done} orders=${drv.orders} outcomes=${tallyOutcomes(outcomes)} list=${listInfo.orders.length}`; stLog(t); stPost(api, platform, t); }
      // 개별: 네이버 목록 줄(영수증 없음) 중 하나 — 주문번호를 모르는(서버가 만든 키) 줄이 있으면 그것부터(네이버페이 내역 줄)
      const rows = listInfo.orders.filter((o) => o.platform === 'naver' && o.kind === 'list');
      const pick = rows.find((o) => !/^\d{4}$/.test(o.orderNo.slice(-4))) ?? rows[0];
      if (!pick) { stStage.current = 'done'; stLog('one skipped no-list-row'); close(); return; }
      stStage.current = 'one';
      const key = outcomeKey(pick.orderNo, pick.orderedAt, pick.amount);
      stStart.current = Date.now();
      stLog(`one start tailShape=${/^\d{4}$/.test(pick.orderNo.slice(-4)) ? 'n4' : 'other'}`);
      fetchOne(key);
      return;
    }
    if (stStage.current === 'one' && single) {
      stStage.current = 'done';
      const o = single.only.map((k) => outcomes[k]).filter(Boolean)[0];
      { const t = `one sec=${Math.round((Date.now() - stStart.current) / 1000)} mode=${mode} reason=${endReason || '-'} outcome=${o ? (o.state === 'failed' ? `failed:${o.code}` : o.state) : 'none-reported'}`; stLog(t); stPost(api, platform, t); }
      close();
    }
  }, [selftest, mode, reading, onLogin, drv.state, single, listInfo.orders.length]);

  // 웹뷰를 사용자에게 보이면 알림이 그대로 보이게(__ytQuiet=0), 다시 숨기면 삼키게(=1) 한다 — 보이는 로그인 화면의 오류를 삼키면 사용자가 못 본다
  useEffect(() => {
    webRef.current?.injectJavaScript(setQuietScript(!showWeb));
  }, [showWeb]);

  // 읽기·보내기가 끝나면 숨은 웹뷰를 언마운트한다(대표님 10-30 먹통) — iOS 에서 보이지 않는 전체화면 웹뷰가 터치를 가로채던 문제를 막는 2중 안전장치.
  // (웹뷰 자체 pointerEvents 로도 막지만, 결과 화면에서는 아예 떼어 둔다. 읽는 중·보내는 중만 띄워 둔다.)
  useEffect(() => {
    if (mode !== 'reading' && mode !== 'sending') setWebOn(false);
  }, [mode]);

  // 읽는 동안 0.5초마다 구동기 시계를 돌린다(읽기 예약 · 20초 감시 · 상한)
  useEffect(() => {
    if (mode !== 'reading') return undefined;
    const t = setInterval(() => driver.current?.tick(), TICK_MS);
    return () => clearInterval(t);
  }, [mode]);

  /** 서버 목록을 받은 결과를 모은다 — 목록 자리(renderOrders)가 알려 주거나, 목록이 없는 앱은 아래 효과가 직접 받는다 */
  const onLoaded = (key: number, c: ListCounts | null, orders?: LinkOrder[]) => setListInfo((p) => ({ key: Math.max(p.key, key), counts: c ?? p.counts, orders: orders ?? p.orders }));
  // 목록을 그리지 않는 앱(사임캐시) — 서버 목록 수만 받아 진행 줄 · 끝 상태에 쓴다(올라간 묶음마다 다시 받는다)
  useEffect(() => {
    if (config.renderOrders) return undefined;
    let on = true;
    const key = ordersKey;
    api.listOrders().then((r) => { if (!on || !alive.current) return; const mine = r.orders.filter((o) => o.platform === platform); onLoaded(key, listCounts(mine), mine); })
      .catch(() => { if (on && alive.current) onLoaded(key, null); });
    return () => { on = false; };
  }, [ordersKey]);

  const wrap = (body: React.ReactNode) => (
    <View style={[s.full, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
      <View style={s.top}>
        <Text style={s.title}>{label} 주문 불러오기</Text>
        <Pressable onPress={close} hitSlop={8} accessibilityLabel="닫기">
          <Text style={s.close}>닫기</Text>
        </Pressable>
      </View>
      {body}
    </View>
  );

  /** 읽지 못하는 자리 — 다음 할 일(사진 · 종이로 올리기)을 항상 보인다 */
  const paperExit = (message: string) => wrap(
    <View style={s.body}>
      <Text style={s.line}>{message}</Text>
      <View style={s.bar}>
        <Button label="사진으로 올리기" compact tone="ghost" onPress={close} />
      </View>
    </View>);

  const WebView = config.WebView;
  if (offByServer || readOff) return paperExit(`쿠팡은 준비 중이에요 · 종이 영수증이나 사진으로 올려 주세요`);
  if (!WebView) return paperExit(`이 기기에서는 주문을 읽을 수 없어요. 종이 영수증이나 사진으로 올려 주세요`);
  if (probe === null) return wrap(<View style={s.body}><Text style={s.line}>불러오는 중…</Text></View>);

  const layout = webHostLayout(showWeb ? 'shown' : 'hidden', Platform.OS, win);
  // 끝난 뒤에는 서버 목록이 끝난 뒤 것으로 새로 올 때까지 「보내는 중」으로 둔다(낡은 목록으로 끝 상태를 먼저 보이지 않게)
  const shown = settledMode(mode, listInfo.key >= ordersKey);
  const run = runView(shown, drv.total, endReason, REPORTS_OUTCOMES.includes(platform) ? outcomes : undefined, single);
  const counts = listInfo.counts;
  // 영수증이 없는 결제 · 못 가져온 줄 · 남은 줄 수 — 줄 상태(rowViews)와 같은 기준으로 센다
  const tally = tallyPending(listInfo.orders, run);
  /** 새 주문 0건으로 끝난 까닭이 있으면 그 글자를 쓴다 — 목록 숫자가 끝난 뒤 것으로 온 뒤에만(settledMode 와 같은 기준) */
  const noteLine = endNote && (mode === 'stalled' || (mode === 'ended' && shown === 'ended')) ? endNoteLine(endNote, label, counts ? { total: counts.total, claimable: counts.claimable } : null) : null;
  const line = noteLine ?? statusLine({
    label, mode: shown, state: onLogin && drv.state === 'running' ? 'login' : drv.state, total: drv.total, timeouts: drv.timeouts,
    pending: prog.pending, failed: prog.failed, partial,
    listTotal: counts ? counts.total : null, fetched: counts ? counts.fetched : 0, claimable: counts ? counts.claimable : 0,
    missed: tally.failed, none: tally.none, newFetched: drv.orders,
  });
  const stalled = mode === 'stalled';
  const claimText = counts && config.claimLine ? config.claimLine(counts.claimable) : null;

  // 진행 상태는 읽는 중 · 보내는 중엔 팝업으로(대표님 10-29 18:10 「이거 팝업으로 해」). 로그인 화면이 떠 있으면 팝업은 숨긴다
  const busyNow = (mode === 'reading' || mode === 'sending') && !showWeb;
  return wrap(
    <>
      {!busyNow ? (
        <View style={s.statusRow}>
          <Text style={s.status} numberOfLines={3}>{line}</Text>
        </View>
      ) : null}
      <View style={s.web}>
        {/* 읽기 웹뷰 — 숨김일 때도 실제 크기 · 살아 있는 상태로 둔다(이유는 webHostStyle.ts). 목록보다 먼저 그려 목록 뒤에 깔린다 */}
        {webOn && source ? (
          <View style={layout.style} pointerEvents={layout.pointerEvents}>
            <WebView
              ref={webRef}
              pointerEvents={layout.pointerEvents}
              source={source}
              style={s.webFill}
              javaScriptEnabled
              domStorageEnabled
              incognito={false}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              setSupportMultipleWindows={false}
              injectedJavaScriptBeforeContentLoaded={beforeContentLoaded(platform, probe ? [probeObserveScript(), SHAPE_TAP_SCRIPT] : [])}
              onOpenWindow={onOpenWindow}
              onShouldStartLoadWithRequest={onShouldStart}
              onLoadEnd={onLoadEnd}
              onNavigationStateChange={onNavChange}
              onMessage={onMessage}
            />
          </View>
        ) : null}
        {/* 못 읽고 끝났어도 서버에 이미 불러온 줄이 있으면 그 목록은 그대로 보인다 */}
        {config.renderOrders && (!stalled || (counts && counts.total > 0)) ? config.renderOrders({ platform, reading, onClose: close, reloadKey: ordersKey, run, onFetchOne: fetchOne, onRefill: platform === 'naver' ? refillDetails : undefined, fetchBusy: mode === 'sending' || (reading && !single), onLoaded }) : null}
      </View>
      {busyNow ? (
        <View style={s.popOverlay} pointerEvents="box-none">
          <View style={s.popCard}>
            <ActivityIndicator size="small" color={config.theme.brandDark} />
            <Text style={s.popLine} numberOfLines={4}>{line}</Text>
            {claimText ? <Text style={s.popClaim}>{claimText}</Text> : null}
            {/* 중단 버튼은 카드 안 좌우로 가득(대표님 10-29 19:12) — 래퍼 stretch 로 폭을 늘린다 */}
            <View style={s.popBtn}><Button label="중단" onPress={stopReading} /></View>
          </View>
        </View>
      ) : null}
      <View style={s.bar}>
        {reading && drv.state === 'attention' ? <Button label="확인 끝났어요" compact tone="ghost" onPress={() => driver.current?.resume()} /> : null}
        {stalled && (tries < MAX_TRIES || endNote === 'login') ? <Button label="다시 시도" compact tone="ghost" onPress={retry} /> : null}
        {stalled ? <Button label="사진/종이로 올리기" compact tone="ghost" onPress={close} /> : null}
        {stalled ? <Button label="건너뛰기" compact tone="ghost" onPress={close} /> : null}
        {mode === 'sendFailed' ? <Button label="다시 보내기" compact tone="ghost" onPress={resendOrders} /> : null}
      </View>
    </>);
}

const ZERO_INSETS = { top: 0, bottom: 0 };

const makeStyles = ({ bg, text, sub, brandDark, space: S }: ScreenTheme) => StyleSheet.create({
  popOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.28)', alignItems: 'center', justifyContent: 'center', zIndex: 40, elevation: 40 },
  popCard: { backgroundColor: bg, borderRadius: 16, paddingVertical: S.xl, paddingHorizontal: S.lg, gap: S.md, alignItems: 'center', width: '80%', maxWidth: 340, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { height: 4, width: 2 }, elevation: 8 },
  popLine: { fontSize: 15, color: text, textAlign: 'center', lineHeight: 22 },
  popClaim: { fontSize: 14, fontWeight: '700', color: brandDark, textAlign: 'center' },
  popBtn: { alignSelf: 'stretch' },
  full: { flex: 1, backgroundColor: bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: S.lg, paddingVertical: S.sm },
  title: { fontSize: 17, fontWeight: '800', color: text },
  close: { fontSize: 15, fontWeight: '700', color: brandDark },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingBottom: S.sm },
  status: { flex: 1, fontSize: 13, lineHeight: 18, color: sub },
  web: { flex: 1, backgroundColor: bg },
  webFill: { flex: 1 },
  body: { flex: 1, paddingHorizontal: S.lg, justifyContent: 'center', gap: S.md },
  line: { fontSize: 14, lineHeight: 21, color: text },
  bar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: S.sm, paddingHorizontal: S.lg, paddingVertical: S.sm, backgroundColor: bg },
});
