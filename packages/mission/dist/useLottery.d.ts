import type { Requester } from './entry';
import { type LotteryState, type LotteryWinner, type OpenOutcome } from './lottery';
/**
 * (0.6.0) 복권 상태 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 · 미션을 끝내고 올 때) 서버 상태를 읽는다(읽는 순간 서버가 오늘 줄 복권을 만든다).
 * 꺼졌거나 실패하면 state 가 null 이라 칩이 안 보인다. 열기는 한 번에 하나, 끝나면 상태를 다시 읽는다.
 *
 *   const lot = useLottery(fetchJson, tab === 'home');
 *   <LotteryChip count={lot.chip} onPress={() => { void lot.loadWinners(); setSheet(true); }} />
 *   <LotterySheet open={sheet} state={lot.state} winners={lot.winners} busy={lot.busy} onOpen={tier => lot.open(tier).then(showResult)} … />
 */
export declare function useLottery(fetchJson: Requester | undefined, refreshKey?: unknown): {
    state: LotteryState | null;
    winners: LotteryWinner[];
    busy: boolean;
    chip: number;
    refresh: () => Promise<LotteryState | null>;
    loadWinners: () => Promise<void>;
    open: (tier: number, src?: 'basic' | 'mission') => Promise<OpenOutcome>;
};
