"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLottery = useLottery;
const react_1 = require("react");
const lottery_1 = require("./lottery");
/**
 * (0.6.0) 복권 상태 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 · 미션을 끝내고 올 때) 서버 상태를 읽는다(읽는 순간 서버가 오늘 줄 복권을 만든다).
 * 꺼졌거나 실패하면 state 가 null 이라 칩이 안 보인다. 열기는 한 번에 하나, 끝나면 상태를 다시 읽는다.
 *
 *   const lot = useLottery(fetchJson, tab === 'home');
 *   <LotteryChip count={lot.chip} onPress={() => { void lot.loadWinners(); setSheet(true); }} />
 *   <LotterySheet open={sheet} state={lot.state} winners={lot.winners} busy={lot.busy} onOpen={tier => lot.open(tier).then(showResult)} … />
 */
function useLottery(fetchJson, refreshKey) {
    const [state, setState] = (0, react_1.useState)(null);
    const [winners, setWinners] = (0, react_1.useState)([]);
    const [busy, setBusy] = (0, react_1.useState)(false);
    const opener = (0, react_1.useMemo)(() => (fetchJson ? (0, lottery_1.createLotteryOpener)(fetchJson) : null), [fetchJson]);
    const refresh = (0, react_1.useCallback)(async () => {
        if (!fetchJson)
            return null;
        const s = await (0, lottery_1.fetchLotteryState)(fetchJson);
        setState(s);
        return s;
    }, [fetchJson]);
    (0, react_1.useEffect)(() => { void refresh(); }, [refresh, refreshKey]);
    const loadWinners = (0, react_1.useCallback)(async () => {
        if (fetchJson)
            setWinners(await (0, lottery_1.fetchLotteryWinners)(fetchJson));
    }, [fetchJson]);
    const open = (0, react_1.useCallback)(async (tier, src) => {
        if (!opener)
            return { ok: false, error: 'off' };
        setBusy(true);
        try {
            const out = await opener(tier, src);
            if (out.ok || out.error === 'already_opened' || out.error === 'not_reached')
                await refresh();
            return out;
        }
        finally {
            setBusy(false); // 어떤 경우에도 풀린다
        }
    }, [opener, refresh]);
    return { state, winners, busy, chip: (0, lottery_1.lotteryChipCount)(state), refresh, loadWinners, open };
}
