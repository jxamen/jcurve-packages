import type { ReceiptGuide } from './types';
export type LinkSite = 'naver' | 'coupang' | 'kurly' | 'musinsa' | 'daiso' | 'oliveyoung';
export declare function linkGuide(site: LinkSite): ReceiptGuide;
/** 이 곳 가이드를 본 적이 있나 — 저장 값은 본 곳 목록(JSON). 틀린 값이면 아무것도 안 봤다 */
export declare function parseLinkSeen(raw: string | null | undefined): LinkSite[];
export declare const markLinkSeen: (seen: readonly LinkSite[], site: LinkSite) => LinkSite[];
