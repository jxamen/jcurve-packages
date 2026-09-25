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
export declare function useAppHub(opts: {
    base?: string;
    token?: string;
    load?: () => Promise<Hub>;
}): UseAppHub;
