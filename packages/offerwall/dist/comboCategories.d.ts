/**
 * 항목별 탭 (대표님 10/27 22:49~22:50 「항목별 탭으로 바꾸기」): the guide sheet with one tab per server category — 회원가입 · 팔로우·구독 ·
 * 앱 설치 · 무료체험 · 게임 · 쇼핑 · 보험 · 상담·조회 · 계좌·카드 · 그 밖, in the order of the server's `combos.categories`. Each tab has the one-line
 * total (「다 하면 +N P」, the server's `total_points`: only items that cost nothing), the same numbered rows as the steps, and a small pill for what
 * costs money (`cost`: 「월 1,100원」 「보험료 납입 필요」 「3만원 이상 구매」). The 무료체험 tab has no total, just the cancel note.
 * Without `categories` the guide is the steps screen as before (see ComboGuideScreen).
 */
import type { ReactElement } from 'react';
import type { ComboCategory, ComboCategoryItem, ComboGuideScreenProps, ComboMission } from './combos';
/** Rows shown at first in a tab, and added by each 「더 보기」 (a tab can have a few hundred rows: games, and the server's midnight reset made 「쉬운 미션」 186). */
export declare const COMBO_CATEGORY_PAGE = 40;
/** The tab with free trials: no total, the cancel note instead. */
export declare const COMBO_TRIAL_CATEGORY = "trial";
/** A category row as a mission (id = campaign key), for the tap, the check marks and the 「paid today」 mark. */
export declare function categoryItemMission(item: ComboCategoryItem): ComboMission;
/** What 「다 하면 +N P」 shows: the server's total minus what this member already did among the items that cost nothing; null = no total. */
export declare function categoryRemaining(category: ComboCategory, isDone: (campaignKey: string) => boolean): {
    total: number;
    paid: number;
} | null;
export declare function ComboCategoryScreen({ combos, loading, onClose, onPressMission, usn, theme, showHeader, topInset, variant, done, onToggleDone, onTrialTab, onShown, }: ComboGuideScreenProps): ReactElement;
