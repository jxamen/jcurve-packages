/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 */
import { useCallback, useEffect, useState } from 'react';
import { DEFAULT_SECTION, hubLoader, type FamilySection, type Hub } from './load';
import type { FamilyApp } from './pick';

export type UseAppHub = {
  /** 아직 못 받았으면 null */
  items: FamilyApp[] | null;
  /** 받기 전 · 못 받았으면 기본값(켜짐 · 기존 문구) */
  section: FamilySection;
  failed: boolean;
  reload: () => void;
};

export function useAppHub(opts: { base?: string; token?: string; load?: () => Promise<Hub> }): UseAppHub {
  const [hub, setHub] = useState<Hub | null>(null);
  const [failed, setFailed] = useState(false);
  const { base, token, load } = opts;

  const reload = useCallback(() => {
    const loader = load ?? (base ? hubLoader({ base, token }) : null);
    if (!loader) { setFailed(true); return; }
    setFailed(false);
    loader().then(setHub, () => setFailed(true));
  }, [base, token, load]);

  useEffect(() => { reload(); }, [reload]);

  return { items: hub?.items ?? null, section: hub?.section ?? DEFAULT_SECTION, failed, reload };
}
