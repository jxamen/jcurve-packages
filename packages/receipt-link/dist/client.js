"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createReceiptLinkClient = createReceiptLinkClient;
const model_1 = require("./model");
const statusOf = (e) => e?.status;
function createReceiptLinkClient({ request }) {
    /** 서버 스위치가 꺼져 있으면 404 — 앱은 연동 영역을 그리지 않는다(null) */
    async function fetchLinkState() {
        try {
            return (0, model_1.parseLinkState)(await request.get('receipt-link'));
        }
        catch (e) {
            if (statusOf(e) === 404)
                return null;
            throw e;
        }
    }
    async function consentLink(platform) {
        return (0, model_1.parseLinkState)(await request.post('receipt-link', { platform, consent: true }));
    }
    async function revokeLink(platform) {
        return (0, model_1.parseLinkState)(await request.post('receipt-link/revoke', { platform }));
    }
    /** 구조 기록 — 모양만 담은 본문을 보낸다. 거절(422 · 실패)이면 false */
    async function postProbe(body) {
        try {
            await request.post('receipt-link/probe', body);
            return true;
        }
        catch {
            return false;
        }
    }
    /**
     * 읽어 온 주문을 서버에 등록한다. cleanOrder 를 통과한 것만, `ordersPerRequest`(서버 값, 기본 50)씩 보낸다.
     * 주머니가 가득 차면(pouch_full) 남은 묶음은 보내지 않는다 — 어차피 모두 pouch_full 이다.
     * 이 앱에서 주문 가져오기가 아직 열리지 않았으면(서버 404, 예: 사임캐시 보상 경로 준비 전) 오류 없이 `disabled: true`.
     */
    async function sendOrders(platform, raw, options = {}) {
        const orders = raw.map(model_1.cleanOrder);
        const readable = orders.filter((o) => o !== null);
        const unreadable = orders.length - readable.length;
        let clean = readable;
        let tally = (0, model_1.emptyTally)();
        // 서버가 알려 준 금액 상한을 넘는 주문은 미리 거른다(서버도 검사한다) — 「amount」로 센다
        if (typeof options.amountMax === 'number') {
            const over = clean.filter((o) => o.amount > options.amountMax);
            tally.amount += over.length;
            clean = clean.filter((o) => o.amount <= options.amountMax);
        }
        const batches = (0, model_1.chunkOrders)(clean, options.ordersPerRequest);
        for (let i = 0; i < batches.length; i++) {
            let res;
            try {
                res = await request.post('receipt-orders', { platform, orders: batches[i] });
            }
            catch (e) {
                if (statusOf(e) === 404)
                    return { tally, unreadable, disabled: true };
                throw e;
            }
            tally = (0, model_1.addTally)(tally, res.results);
            if (tally.pouch_full > 0) { // 남은 묶음은 보내지 않고 같은 사유로 센다
                tally.pouch_full += batches.slice(i + 1).reduce((n, b) => n + b.length, 0);
                break;
            }
        }
        return { tally, unreadable, disabled: false };
    }
    return { fetchLinkState, consentLink, revokeLink, postProbe, sendOrders };
}
