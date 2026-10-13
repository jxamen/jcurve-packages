import { type Lang } from './i18n';
import { type FamilySection, type Hub } from './load';
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
export declare function localizeSection(section: FamilySection, lang?: Lang): FamilySection;
export declare function useAppHub(opts: {
    base?: string;
    token?: string;
    load?: () => Promise<Hub>; /** (1.1.1) 없거나 'ko' 면 지금 그대로 */
    lang?: Lang;
}): UseAppHub;
