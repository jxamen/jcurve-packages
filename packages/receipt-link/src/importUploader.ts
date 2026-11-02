/**
 * 주문 불러오기 — 읽는 대로 서버에 올리는 순수 로직(노드에서 시험한다). react-native 를 import 하지 않는다.
 * 흐름이 주문을 내면 add 로 검사 · 중복 거르기(최근 1년 · 주문번호)를 거쳐 줄에 세우고, 한 번에 한 요청씩 50건 이하로 올린다.
 * 요청이 실패하면 그 묶음은 줄 맨 앞에 남고, 다음 add 나 finish 에서 다시 올린다. 주문 내용은 로그나 예외에 넣지 않는다.
 */
import { createCollector, readFlowOrders, type ImportResult } from './importPlan';
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
export type UploadSummary = { result: ImportResult; pending: number; readOff: boolean };
export type UploaderSend = (orders: OrderInput[]) => Promise<{ tally: ImportTally; unreadable: number }>;
export type Uploader = {
  /** 흐름이 낸 주문들 — 검사 · 중복 거르기 뒤 줄에 세우고 바로 올린다 */
  add(orders: unknown[]): void;
  /** 줄에 남은 것을 모두 올린다(실패하면 거기서 멈춘다) */
  flush(): Promise<void>;
  progress(): UploadProgress;
  /** 끝: 남은 것을 올려 보고(실패 시 한 번 더) 결과를 낸다 */
  finish(): Promise<UploadSummary>;
};

const isReadDisabled = (e: unknown): boolean => (e as { status?: number })?.status === 403 && (e as { code?: string })?.code === 'read_disabled';

function sum(a: ImportTally, b: ImportTally): ImportTally {
  const out = emptyTally();
  for (const k of Object.keys(out) as (keyof ImportTally)[]) out[k] = a[k] + b[k];
  return out;
}

export function createUploader(args: { send: UploaderSend; onChange?: (p: UploadProgress) => void; nowMs?: number }): Uploader {
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

  const progress = (): UploadProgress => ({ read: coll.size(), sent, pending: queue.length, failed, readOff, full });
  const notify = (): void => { if (args.onChange) args.onChange(progress()); };

  const pump = async (): Promise<void> => {
    do {
      rerun = false;
      while (queue.length > 0 && !full && !readOff) {
        const chunk = queue.slice(0, ORDERS_PER_REQUEST);
        try {
          const r = await args.send(chunk);
          queue.splice(0, chunk.length);
          sent += chunk.length;
          unreadable += r.unreadable;
          tally = sum(tally, r.tally);
          failed = false;
          if (r.tally.pouch_full > 0) {
            // 주머니가 가득 찼다 — 남은 것은 보내도 모두 pouch_full 이라 보내지 않고 같은 사유로 센다
            full = true;
            tally.pouch_full += queue.length;
            queue.length = 0;
          }
          notify();
        } catch (e) {
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
    progress,
    async finish() {
      for (let i = 0; i < 2; i++) {
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
      return { result, pending: queue.length, readOff };
    },
  };
}
