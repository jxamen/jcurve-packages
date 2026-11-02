"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.settledMode = settledMode;
exports.runView = runView;
exports.statusLine = statusLine;
/** 끝난 모드인데 서버 목록이 아직 끝난 뒤 것으로 새로 오지 않았으면 「보내는 중」으로 둔다 — 낡은 목록으로 「다 가져왔어요」 · 「못 가져옴」을 먼저 보이지 않게 */
function settledMode(mode, listFresh) {
    return !listFresh && (mode === 'ended' || mode === 'stopped' || mode === 'sendFailed') ? 'sending' : mode;
}
/** 줄 상태 판단에 넘기는 읽기 진행 — 영수증 단계(total > 0) · 끝남(끝난 모드, 까닭은 reason) · 그 전은 목록 읽는 단계. outcomes 는 흐름이 알린 줄 결과(없으면 안 싣는다) */
function runView(mode, total, reason, outcomes, single) {
    const extra = { ...(outcomes ? { outcomes } : {}), ...(single ? { only: single.only, base: single.base } : {}) };
    if (mode === 'ended' || mode === 'stopped' || mode === 'sendFailed' || mode === 'stalled')
        return { stage: 'ended', reason, ...extra };
    return { stage: total > 0 ? 'receipt' : 'list', reason: '', ...extra };
}
function statusLine(a) {
    const n = (v) => String(Math.max(0, Math.floor(v)));
    const all = a.listTotal;
    /** 「영수증 없음 K건 · 못 가져옴 F건」 — 없는 쪽은 뺀다. 영수증 없음(포인트 · 계좌이체 등 영수증이 없는 결제)은 실패가 아니라 따로 센다 */
    const tail = [(a.none ?? 0) > 0 ? `영수증 없음 ${n(a.none ?? 0)}건` : '', a.missed > 0 ? `못 가져옴 ${n(a.missed)}건` : ''].filter(Boolean).join(' · ');
    /** 끝난 뒤에는 두 번째 줄로 덧붙인다 */
    const missed = tail ? `\n${tail}` : '';
    switch (a.mode) {
        case 'reading': {
            if (a.state === 'login')
                return `${a.label} 로그인 후 자동으로 이어져요`;
            if (a.state === 'attention')
                return `화면에서 확인이 필요해요 — 끝나면 「확인 끝났어요」를 눌러 주세요`;
            if (a.state === 'closing')
                return `${a.label} 화면을 확인하는 중…`;
            // 짧은 줄 여러 개로 — 한 줄에 「·」로 길게 붙이면 단어 중간에서 줄바꿈된다(대표님 10-30 「가/져옴」). 각 줄은 짧은 완성 문장
            const lines = [];
            const already = a.newFetched === undefined ? 0 : Math.max(0, a.fetched - a.newFetched); // 이번 실행 전에 이미 받아 둔 영수증
            if (a.total > 0) {
                // 영수증 받는 단계
                lines.push(all === null ? '영수증 받는 중…' : `주문 ${n(all)}건 찾음`);
                const got = a.newFetched === undefined ? a.fetched : a.newFetched;
                if (all === null)
                    lines.push(`새 영수증 받는 중 ${n(got)}건`);
                else
                    lines.push(`새 영수증 받는 중 ${n(got)}/${n(all - already)}건`);
                if (already > 0)
                    lines.push(`이미 받은 ${n(already)}건`);
                if ((a.none ?? 0) > 0)
                    lines.push(`영수증 없음 ${n(a.none ?? 0)}건`);
                if (a.missed > 0)
                    lines.push(`못 가져옴 ${n(a.missed)}건`);
            }
            else {
                // 목록 읽는 단계
                lines.push(all === null ? '주문 목록 읽는 중…' : `주문 ${n(all)}건 찾음`);
                if (already > 0)
                    lines.push(`이미 받은 영수증 ${n(already)}건`);
                else if (a.newFetched === undefined && a.fetched > 0 && all !== null)
                    lines.push(`이미 받은 영수증 ${n(a.fetched)}건`);
            }
            if (a.timeouts > 0)
                lines.push('응답이 느려요, 다시 확인하는 중');
            else if (a.failed)
                lines.push('올리지 못한 주문은 다시 보내요');
            return lines.join('\n');
        }
        case 'sending':
            return '주문을 보내는 중…';
        case 'ended':
            // 끝까지 가지 못하고 멈췄으면(시간 초과 · 실패 등) 멈췄다고 말한다. 못 가져온 줄이 있는데 「다 가져왔어요」라고 하지 않는다
            if (a.partial)
                return `멈췄어요 · 가져온 건 ${n(a.fetched)}건${missed}`;
            return `${a.missed > 0 ? '가져오기를 마쳤어요' : '다 가져왔어요'} · 적립 가능 ${n(a.claimable)}건${missed}`;
        case 'stopped':
            // 사용자가 중단했다 — 남은 건은 실패가 아니라 대기다. 「주문 불러오기」를 다시 하면 가져온 건 건너뛰고 남은 것만 이어서 가져온다(하단 「다시 가져오기」 단추는 뺐다, 대표님 10-30)
            return `중단했어요 · 가져온 건 ${n(a.fetched)}건${tail ? ` · ${tail}` : ''}\n「주문 불러오기」를 다시 하면 남은 것만 이어서 가져와요`;
        case 'sendFailed':
            return `보내지 못한 주문이 ${n(a.pending)}건 있어요. 잠시 뒤 다시 보내 주세요`;
        case 'stalled':
        default:
            return `${a.label}에서 주문을 못 읽었어요. 잠시 뒤 다시 시도하거나 종이·사진으로 올려 주세요`;
    }
}
