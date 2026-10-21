import { type FamilySection, type Hub } from './load';
import { type Lang } from './i18n';
import type { FamilyApp } from './pick';
import { type HubStorage } from './store';
export type UseAppHub = {
    /** 아직 못 받았으면 null (저장값이 있으면 저장값) */
    items: FamilyApp[] | null;
    /** 받기 전 · 못 받았으면 기본값(켜짐 · 기존 문구) — 저장값이 있으면 저장값 */
    section: FamilySection;
    failed: boolean;
    reload: () => void;
    /** (1.2.0) 입구를 그려도 되는가 = 저장값을 읽은 뒤(저장소를 안 쓰면 처음부터) 이고 section.on */
    visible: boolean;
    /** (1.2.0) 저장값을 읽는 중이면 false — 입구를 `section.on` 으로 직접 그리는 앱은 이 값이 true 가 된 뒤에 그린다 */
    ready: boolean;
};
export declare function localizeSection(section: FamilySection, lang?: Lang): FamilySection;
export declare function useAppHub(opts: {
    base?: string;
    token?: string;
    load?: () => Promise<Hub>;
    storage?: HubStorage;
    storageKey?: string;
    lang?: Lang;
}): UseAppHub;
