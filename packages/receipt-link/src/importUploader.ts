/**
 * 주문 불러오기 — 읽는 대로 서버에 올리는 순수 로직(노드에서 시험한다). react-native 를 import 하지 않는다.
 * 흐름이 주문을 내면 add 로 검사 · 중복 거르기(최근 1년 · 주문번호)를 거쳐 줄에 세우고, 한 번에 한 요청씩 50건 이하로 올린다.
 * 요청이 실패하면 그 묶음은 줄 맨 앞에 남고, 다음 add 나 finish 에서 다시 올린다. 주문 내용은 로그나 예외에 넣지 않는다.
 */
import { createCollector, readFlowOrders, WINDOW_DAYS, type ImportResult } from './importPlan';
import { emptyTally, ORDERS_PER_REQUEST, type ImportTally, type OrderInput } from './model';

export type UploadProgress = {
  /** 지금까지 읽어 담은 주문(중복 · 기간 밖 · 한도 밖은 빼고) */
  read: number;
  /** 서버가 받은 주문 수(요청이 성공한 묶음의 건수) */
  sent: number;
  /** 아직 못 올린 주문 */
  pending: number;
  /** 마지막 요청이 실패했다 — 다음 add · finish 에서 다시 올린다 */
  failed: boolean;
  /** 서버가 이 곳 읽기를 막고 있다(read_disabled) */
  readOff: boolean;
  /** 주머니가 가득 차서 더 올리지 않는다 */
  full: boolean;
};
/** errors: 실패한 요청의 응답 번호별 횟수(「send-422」 · 「send-net」) — 값 없이 개수만, 실행 끝 기록용(11-03 네이버 56건) */
export type UploadSummary = { result: ImportResult; pending: number; readOff: boolean; tally: ImportTally; unreadable: number; errors: Record<string, number>; dropped: number };
export type UploaderSend = (orders: OrderInput[]) => Promise<{ tally: ImportTally; unreadable: number }>;
export type Uploader = {
  /** 흐름이 낸 주문들 — 검사 · 중복 거르기 뒤 줄에 세우고 바로 올린다 */
  add(orders: unknown[]): void;
  /** 줄에 남은 것을 모두 올린다(실패하면 거기서 멈춘다) */
  flush(): Promise<void>;
  /** 읽기 기간(일)을 바꾼다 — 플랫폼마다 서버 설정이 다르므로 흐름을 시작하기 전에 맞춘다. 없으면 365 */
  setWindowDays(days?: number): void;
  progress(): UploadProgress;
  /** 끝: 남은 것을 올려 보고(실패하면 간격을 두고 몇 번 더) 결과를 낸다 */
  finish(): Promise<UploadSummary>;
  /** 아직 못 올린 주문(복사본) — 앱이 서버 목록과 맞춰 「정말 서버에 없는 것」만 세는 데 쓴다 */
  pendingOrders(): OrderInput[];
};

const statusOf = (e: unknown): number => { const s = (e as { status?: unknown })?.status; return typeof s === 'number' ? s : 0; };
/** 묶음의 어느 줄 때문에 서버가 통째로 거절했을 수 있는 응답 — 반으로 나눠 다시 보낸다(로그인 · 막힘 · 연동 안 됨 · 너무 잦음은 제외) */
const isRowReject = (st: number): boolean => st >= 400 && st < 500 && ![401, 403, 404, 409, 429].includes(st);
/** 끝낼 때 다시 보내기 전 기다리는 시간 — 서버가 잠깐 바쁘거나 응답이 늦을 때(11-03 네이버 56건 「보내지 못함」) */
export const FINISH_RETRY_MS = [2000, 5000, 10000];

const isReadDisabled = (e: unknown): boolean => (e as { status?: number })?.status === 403 && (e as { code?: string })?.code === 'read_disabled';

function sum(a: ImportTally, b: ImportTally): ImportTally {
  const out = emptyTally();
  for (const k of Object.keys(out) as (keyof ImportTally)[]) out[k] = a[k] + b[k];
  return out;
}

export function createUploader(args: { send: UploaderSend; onChange?: (p: UploadProgress) => void; nowMs?: number; retryMs?: number[] }): Uploader {
  const coll = createCollector(args.nowMs);
  const queue: OrderInput[] = [];
  let tally = emptyTally();
  let sent = 0;
  let unreadable = 0;
  let failed = false;
  let readOff = false;
  let full = false;
  let running: Promise<void> | null = null;
  let rerun = false;
  let size = ORDERS_PER_REQUEST;   // 4xx 로 묶음이 거절되면 반씩 줄인다 — 한 줄 때문에 뒤 줄이 전부 막히지 않게
  let dropped = 0;                 // 혼자 보내도 거절된 줄(뺐다)
  const errors: Record<string, number> = {};

  const progress = (): UploadProgress => ({ read: coll.size(), sent, pending: queue.length, failed, readOff, full });
  const notify = (): void => { if (args.onChange) args.onChange(progress()); };

  const pump = async (): Promise<void> => {
    do {
      rerun = false;
      while (queue.length > 0 && !full && !readOff) {
        const chunk = queue.slice(0, size);
        try {
          const r = await args.send(chunk);
          queue.splice(0, chunk.length);
          sent += chunk.length;
          unreadable += r.unreadable;
          tally = sum(tally, r.tally);
          failed = false;
          size = Math.min(ORDERS_PER_REQUEST, size * 2);
          if (r.tally.pouch_full > 0) {
            // 주머니가 가득 찼다 — 남은 것은 보내도 모두 pouch_full 이라 보내지 않고 같은 사유로 센다
            full = true;
            tally.pouch_full += queue.length;
            queue.length = 0;
          }
          notify();
        } catch (e) {
          const st = statusOf(e);
          const ek = `send-${st || 'net'}`;
          errors[ek] = (errors[ek] ?? 0) + 1;
          if (!isReadDisabled(e) && isRowReject(st)) {
            if (chunk.length > 1) { size = Math.ceil(chunk.length / 2); continue; }
            queue.splice(0, 1); dropped++; tally.invalid++; notify(); continue;   // 혼자 보내도 거절 — 그 줄만 빼고 다음 줄로
          }
          if (isReadDisabled(e)) { readOff = true; queue.length = 0; } else failed = true;
          notify();
          return;
        }
      }
    } while (rerun);
  };

  const flush = (): Promise<void> => {
    if (running) { rerun = true; return running; }
    running = pump().finally(() => {
      running = null;
      if (rerun && queue.length > 0 && !failed && !full && !readOff) void flush();
    });
    return running;
  };

  return {
    add(raw) {
      const { orders, dropped } = readFlowOrders(raw);
      const fresh = coll.accept({ orders, dropped });
      if (fresh.length === 0) return;
      if (full) { tally.pouch_full += fresh.length; notify(); return; }
      queue.push(...fresh);
      notify();
      void flush();
    },
    flush,
    setWindowDays(days?: number) { coll.setWindowDays(days ?? WINDOW_DAYS); },
    progress,
    async finish() {
      const waits = args.retryMs ?? FINISH_RETRY_MS;
      for (let i = 0; i <= waits.length; i++) {
        if (i > 0) await new Promise((r) => setTimeout(r, waits[i - 1]));
        await flush();
        if (queue.length === 0 || readOff || full) break;
      }
      const c = coll.finish();
      const result: ImportResult = {
        read: c.read,
        sent,
        added: tally.new,
        duplicates: c.duplicates + tally.duplicate,
        rejected: c.rejected + unreadable + tally.taken + tally.out_of_range + tally.invalid + tally.amount + tally.pouch_full,
        note: c.read === 0 ? 'no_orders' : undefined,
      };
      return { result, pending: queue.length, readOff, tally: { ...tally }, unreadable, errors: { ...errors }, dropped };
    },
    pendingOrders() {
      return queue.slice();
    },
  };
}
