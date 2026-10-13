/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { normLang, t, type Lang } from './i18n';
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

/**
 * (1.1.1) 어드민 제목 · 설명을 그 언어로 — 표에 있는 문구(예 「추천 앱 둘러보기」)만 바꾸고 나머지는 그대로.
 * 한국어면 **받은 객체 그대로** 돌려준다(지금과 같은 값 · 같은 참조).
 */
export function localizeSection(section: FamilySection, lang?: Lang): FamilySection {
  if (normLang(lang) === 'ko') return section;

  return { ...section, title: section.title === null ? null : t(section.title, lang), desc: section.desc === null ? null : t(section.desc, lang) };
}

export function useAppHub(opts: { base?: string; token?: string; load?: () => Promise<Hub>; /** (1.1.1) 없거나 'ko' 면 지금 그대로 */ lang?: Lang }): UseAppHub {
  const [hub, setHub] = useState<Hub | null>(null);
  const [failed, setFailed] = useState(false);
  const { base, token, load, lang } = opts;

  const reload = useCallback(() => {
    const loader = load ?? (base ? hubLoader({ base, token }) : null);
    if (!loader) { setFailed(true); return; }
    setFailed(false);
    loader().then(setHub, () => setFailed(true));
  }, [base, token, load]);

  useEffect(() => { reload(); }, [reload]);

  const raw = hub?.section ?? DEFAULT_SECTION;
  const section = useMemo(() => localizeSection(raw, lang), [raw, lang]);

  return { items: hub?.items ?? null, section, failed, reload };
}
