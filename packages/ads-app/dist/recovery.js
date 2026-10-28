"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SETTLED_CODES = exports.MAX_PENDING_AGE = void 0;
exports.createPendingAds = createPendingAds;
exports.resolvePurpose = resolvePurpose;
exports.undeclaredPurposes = undeclaredPurposes;
exports.parseStepsStagePurpose = parseStepsStagePurpose;
exports.createAdRecovery = createAdRecovery;
exports.stepsStageRule = stepsStageRule;
exports.MAX_PENDING_AGE = 24 * 60 * 60 * 1000;
/** 열린 광고 기록 저장소 — 같은 id 는 한 건만, 종료하면 지우고, 24시간 지난 것은 목록을 읽을 때 정리한다. 쓰기는 순서대로 한 줄로 선다. */
function createPendingAds(storage, key, options = {}) {
    const maxAgeMs = options.maxAgeMs && options.maxAgeMs > 0 ? options.maxAgeMs : exports.MAX_PENDING_AGE; // 0.2.2: 캐시팡팡 10-23 「대기 뿌리 뽑기」 줄은 30분
    let queue = Promise.resolve();
    const serial = (f) => {
        const p = queue.then(f);
        queue = p.catch(() => undefined);
        return p;
    };
    const read = async () => {
        const raw = await storage.get(key);
        try {
            const rows = JSON.parse(raw ?? '[]');
            return Array.isArray(rows)
                ? rows.filter((r) => !!r && typeof r.id === 'string' && typeof r.purpose === 'string' && typeof r.memberId === 'string' && Number.isFinite(r.openedAt))
                : [];
        }
        catch {
            return [];
        }
    };
    const write = (rows) => storage.set(key, JSON.stringify(rows));
    return {
        add: (row) => serial(async () => { const rows = await read(); if (!rows.some((r) => r.id === row.id))
            await write([...rows, row]); }),
        remove: (id) => serial(async () => write((await read()).filter((r) => r.id !== id))),
        list: (now = Date.now()) => serial(async () => { const rows = (await read()).filter((r) => now - r.openedAt < maxAgeMs); await write(rows); return rows; }),
        maxAgeMs,
    };
}
function resolvePurpose(table, purpose) {
    if (Object.prototype.hasOwnProperty.call(table, purpose))
        return table[purpose];
    let best;
    for (const name of Object.keys(table)) {
        if (!name.endsWith('*') || name.length < 2)
            continue;
        const prefix = name.slice(0, -1);
        if (purpose.startsWith(prefix) && (best === undefined || prefix.length > best.length - 1))
            best = name;
    }
    return best === undefined ? undefined : table[best];
}
/** 앱의 시험용: 앱이 광고에 쓰는 용도 이름 목록 가운데 표에 선언되지 않은 것(예: 접미사 붙은 용도는 대표 이름 하나를 넣는다). 비어 있어야 한다. */
function undeclaredPurposes(purposes, table) {
    return purposes.filter((purpose) => resolvePurpose(table, purpose) === undefined);
}
/** 서버가 「이미 처리됨」이라고 답한 오류 코드 — 기록을 지운다. 그 밖의 오류(네트워크 · 시간 초과)는 남겨서 다음 실행에 다시 시도한다. */
exports.SETTLED_CODES = /^(no_ad|duplicate|already|already_processed|already_claimed|day_changed|bad_day|bad_stage)$/; // 0.2.1: 걷기 단계 청구가 더는 받을 수 없는 날 · 단계(day_changed · bad_day · bad_stage)도 지운다
/** 걷기 단계 용도 `steps_stage:<YYYY-MM-DD>:<stage_id>` → { day, stageId } (0.2.1). 모양이 다르면 null. 복구 표의 `'steps_stage:*'` 청구 함수가 `claimStepsStage(stageId, day)` 를 부를 때 쓴다. */
function parseStepsStagePurpose(purpose) {
    const m = /^steps_stage:(\d{4}-\d{2}-\d{2}):(stage_[1-9][0-9]?)$/.exec(purpose);
    return m ? { day: m[1], stageId: m[2] } : null;
}
/** 앱당 한 번, 순차 실행. 실패한 네트워크 요청은 다음 실행에서 같은 키로 재시도한다. */
function createAdRecovery() {
    let started = false;
    return async (o) => {
        if (started)
            return;
        started = true;
        let rewarded = false;
        const warned = new Set();
        for (const row of await o.pending.list()) {
            if (row.memberId !== o.memberId)
                continue;
            if (o.only && !o.only(row.purpose))
                continue;
            const rule = resolvePurpose(o.purposes, row.purpose);
            if (!rule) {
                if (!warned.has(row.purpose)) {
                    warned.add(row.purpose);
                    try {
                        o.onUndeclared?.(row);
                    }
                    catch { /* 알림이 복구를 막지 않는다 */ }
                }
                continue;
            }
            if (rule.kind === 'skip') {
                await o.pending.remove(row.id);
                continue;
            }
            try {
                const status = await o.seen(row);
                // 서버가 이미 처리했다고 알려 준다(settled) — 청구 없이 기록을 지우고, 받은 포인트가 있었다면 안내만 낸다
                if (status !== null && typeof status === 'object' && status.settled === true) {
                    await o.pending.remove(row.id);
                    if (Number(status.settledPoints) > 0)
                        rewarded = true;
                    continue;
                }
                if (Date.now() - row.openedAt >= o.pending.maxAgeMs) {
                    await o.pending.remove(row.id);
                    continue;
                }
                // true · null(확인 경로 없음) 이면 청구, false 이거나 객체인데 seen 이 true 가 아니면 남긴다 (캐시팡팡 10-23 판과 같다)
                const claimNow = status === null ? true : typeof status === 'object' ? status.seen === true : status === true;
                if (!claimNow)
                    continue;
                const result = await rule.claim('ad-recovery:' + row.id, row);
                await o.pending.remove(row.id);
                // 청구가 던지지 않고 { ok: false } 로 거절하는 경우(예: 뽑기) — 받은 것이 아니므로 안내하지 않고 조용히 지운다
                if (result?.ok === false)
                    continue;
                rewarded = true;
            }
            catch (e) {
                const code = e?.code ?? '';
                if (exports.SETTLED_CODES.test(code) || o.extraSettledCodes?.includes(code))
                    await o.pending.remove(row.id);
            }
        }
        if (rewarded) {
            try {
                await o.refresh();
            }
            finally {
                o.say(o.message ?? '광고 보상을 받았어요');
            }
        }
    };
}
/**
 * 걷기 단계 복구 칸 (0.2.2) — `purposes['steps_stage:*']` 에 그대로 넣는다. 용도에서 날짜 · 단계를 풀어 `claimStage(stageId, day)` 를 부르고,
 * **받은 포인트가 있을 때만**(`gained > 0`) 결과를 돌려준다. 이미 받은 단계(0P · replayed)의 남은 SSV 행은 `{ ok: false }` 로 돌려 조용히 지운다 — 가짜 「보상 받았어요」 안내가 뜨지 않는다.
 * 모양이 다른 용도면 던지지 않고 `{ ok: false }`.
 */
function stepsStageRule(claimStage) {
    return {
        kind: 'claim',
        claim: async (_key, row) => {
            const parsed = parseStepsStagePurpose(row.purpose);
            if (!parsed)
                return { ok: false };
            const result = await claimStage(parsed.stageId, parsed.day);
            return Number(result?.gained) > 0 ? result : { ok: false };
        },
    };
}
