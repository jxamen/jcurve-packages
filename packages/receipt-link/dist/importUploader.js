"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUploader = createUploader;
/**
 * 주문 불러오기 — 읽는 대로 서버에 올리는 순수 로직(노드에서 시험한다). react-native 를 import 하지 않는다.
 * 흐름이 주문을 내면 add 로 검사 · 중복 거르기(최근 1년 · 주문번호)를 거쳐 줄에 세우고, 한 번에 한 요청씩 50건 이하로 올린다.
 * 요청이 실패하면 그 묶음은 줄 맨 앞에 남고, 다음 add 나 finish 에서 다시 올린다. 주문 내용은 로그나 예외에 넣지 않는다.
 */
const importPlan_1 = require("./importPlan");
const model_1 = require("./model");
const isReadDisabled = (e) => e?.status === 403 && e?.code === 'read_disabled';
function sum(a, b) {
    const out = (0, model_1.emptyTally)();
    for (const k of Object.keys(out))
        out[k] = a[k] + b[k];
    return out;
}
function createUploader(args) {
    const coll = (0, importPlan_1.createCollector)(args.nowMs);
    const queue = [];
    let tally = (0, model_1.emptyTally)();
    let sent = 0;
    let unreadable = 0;
    let failed = false;
    let readOff = false;
    let full = false;
    let running = null;
    let rerun = false;
    const progress = () => ({ read: coll.size(), sent, pending: queue.length, failed, readOff, full });
    const notify = () => { if (args.onChange)
        args.onChange(progress()); };
    const pump = async () => {
        do {
            rerun = false;
            while (queue.length > 0 && !full && !readOff) {
                const chunk = queue.slice(0, model_1.ORDERS_PER_REQUEST);
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
                }
                catch (e) {
                    if (isReadDisabled(e)) {
                        readOff = true;
                        queue.length = 0;
                    }
                    else
                        failed = true;
                    notify();
                    return;
                }
            }
        } while (rerun);
    };
    const flush = () => {
        if (running) {
            rerun = true;
            return running;
        }
        running = pump().finally(() => {
            running = null;
            if (rerun && queue.length > 0 && !failed && !full && !readOff)
                void flush();
        });
        return running;
    };
    return {
        add(raw) {
            const { orders, dropped } = (0, importPlan_1.readFlowOrders)(raw);
            const fresh = coll.accept({ orders, dropped });
            if (fresh.length === 0)
                return;
            if (full) {
                tally.pouch_full += fresh.length;
                notify();
                return;
            }
            queue.push(...fresh);
            notify();
            void flush();
        },
        flush,
        progress,
        async finish() {
            for (let i = 0; i < 2; i++) {
                await flush();
                if (queue.length === 0 || readOff || full)
                    break;
            }
            const c = coll.finish();
            const result = {
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
