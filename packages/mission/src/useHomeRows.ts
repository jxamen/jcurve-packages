import { useEffect, useMemo, useState } from 'react';
import type { BenefitQuickItem } from './BenefitQuickList';
import type { Requester } from './entry';
import { applyHomeRows, EMPTY_HOME, fetchHomeConfig, type HomeConfig, type HomeRowKey } from './home';

/**
 * (0.5.0) 홈 목록에 서버 설정(mission/home)을 얹는 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 등) 받는다(60초 캐시).
 * 받기 전 · 실패면 앱 기본 목록 그대로라 목록이 비거나 깜빡이지 않는다.
 *
 *   const { items, config } = useHomeRows(fetchJson, baseItems, { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }, tab === 'home');
 *   <BenefitQuickList items={items} … />
 */
export function useHomeRows(fetchJson: Requester | undefined, items: readonly BenefitQuickItem[], keys: Readonly<Record<string, HomeRowKey>>, refreshKey?: unknown): { items: BenefitQuickItem[]; config: HomeConfig } {
  const [config, setConfig] = useState<HomeConfig>(EMPTY_HOME);
  useEffect(() => {
    if (!fetchJson) return;
    let live = true;
    void fetchHomeConfig(fetchJson).then(c => { if (live) setConfig(c); });
    return () => { live = false; };
  }, [fetchJson, refreshKey]);
  const merged = useMemo(() => applyHomeRows(items, config.rows, keys), [items, config.rows, keys]);

  return { items: merged, config };
}
