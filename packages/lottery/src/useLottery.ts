import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createLotteryOpener, fetchLotteryState, fetchLotteryWinners, lotteryChipCount,
  type LotteryState, type LotteryWinner, type OpenOutcome, type Requester,
} from './lottery';

/**
 * 복권 상태 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 · 미션을 끝내고 올 때) 서버 상태를 읽는다(읽는 순간 서버가 오늘 줄 복권을 만든다).
 * 꺼졌거나 실패하면 state 가 null 이라 칩이 안 보인다. 열기는 한 번에 하나, 끝나면 상태를 다시 읽는다.
 *
 *   const lot = useLottery(fetchJson, tab === 'home');
 *   <LotteryChip count={lot.chip} onPress={() => { void lot.loadWinners(); setSheet(true); }} />
 *   <LotterySheet open={sheet} state={lot.state} winners={lot.winners} busy={lot.busy} onOpen={tier => lot.open(tier).then(showResult)} … />
 */
export function useLottery(fetchJson: Requester | undefined, refreshKey?: unknown): {
  state: LotteryState | null; winners: LotteryWinner[]; busy: boolean; chip: number;
  refresh: () => Promise<LotteryState | null>; loadWinners: () => Promise<void>; open: (tier: number, src?: 'basic' | 'mission') => Promise<OpenOutcome>;
} {
  const [state, setState] = useState<LotteryState | null>(null);
  const [winners, setWinners] = useState<LotteryWinner[]>([]);
  const [busy, setBusy] = useState(false);
  const opener = useMemo(() => (fetchJson ? createLotteryOpener(fetchJson) : null), [fetchJson]);

  const refresh = useCallback(async () => {
    if (!fetchJson) return null;
    const s = await fetchLotteryState(fetchJson);
    setState(s);

    return s;
  }, [fetchJson]);
  useEffect(() => { void refresh(); }, [refresh, refreshKey]);

  const loadWinners = useCallback(async () => {
    if (fetchJson) setWinners(await fetchLotteryWinners(fetchJson));
  }, [fetchJson]);

  const open = useCallback(async (tier: number, src?: 'basic' | 'mission'): Promise<OpenOutcome> => {
    if (!opener) return { ok: false, error: 'off' };
    setBusy(true);
    try {
      const out = await opener(tier, src);
      if (out.ok || out.error === 'already_opened' || out.error === 'not_reached') await refresh();

      return out;
    } finally {
      setBusy(false);   // 어떤 경우에도 풀린다
    }
  }, [opener, refresh]);

  return { state, winners, busy, chip: lotteryChipCount(state), refresh, loadWinners, open };
}
