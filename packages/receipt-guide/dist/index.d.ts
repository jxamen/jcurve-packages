/**
 * @jcurve/receipt-guide 입구 — 전자 영수증 칩 카드(PlatformChooser) · 「○○ 연동됨」 시트(ActionMenu + linkedMenuItems) · 올리는 법 안내(ReceiptGuide · linkGuide) · 사진첩 · 이어 붙이기. 쓰는 법은 README.md.
 * 영테크 src/receiptGuide 를 그대로 옮겼다(2026-11-05 대표님 「전자 영수증 화면도 패키지로 — 디자인만 앱마다 다르게」).
 *
 * 이 폴더 밖 앱 파일은 부르지 않는다 — 색 · 캐릭터 · 기록은 props 로 받는다.
 */
import React from 'react';
import { type ChooserProps } from './Chooser';
import type { TrackFn } from './pick';
import type { GuideApp, GuideCta, ReceiptGuide as ReceiptGuideData } from './types';
import { type CharacterRender, type GuideTheme } from './ui';
export type { GuideApp, GuideCta, GuideStep, MockNode, ReceiptGuide as GuideData, ReceiptPlatform } from './types';
export { GUIDES, PLATFORM_ORDER, TWO_SAME_ORDER, TWO_SHOT, guideOf, isPlatform, needsTwo, pickLimit, platformName, shotChoices } from './data';
export { NEED_TWO_SHOTS, NEED_TWO_TEXT, pickReceiptImages, type PickedReceipt, type TrackFn } from './pick';
export { linkGuide, markLinkSeen, parseLinkSeen, type LinkSite } from './linkGuides';
export { stitchReceipts } from './stitch';
export { stitchLayout } from './stitchLayout';
export type { GuideTheme, CharacterRender } from './ui';
export { DEFAULT_THEME } from './ui';
export { ActionMenu, DEFAULT_MENU_THEME, type ActionMenuItem, type ActionMenuProps, type ActionMenuTheme } from './ActionMenu';
export { linkedMenuItems, linkedMenuTitle, type LinkedMenuHandlers } from './linkMenu';
export type { ChooserProps, LinkChip, LinkStage } from './Chooser';
export { LINK_STAGE_LABEL } from './Chooser';
type Common = {
    /** 색 — 빠진 값은 기본값 */
    theme?: Partial<GuideTheme>;
    /** 말풍선 옆 캐릭터(없으면 말풍선만) */
    renderCharacter?: CharacterRender;
};
export type ReceiptGuideProps = Common & {
    /** 열 안내 — null 이면 아무것도 그리지 않는다. 부모 영역을 꽉 채운다(안전 영역 여백은 부모가) */
    platform: GuideApp | null;
    /** 글 속 {앱} 자리 — 「영테크 「사진 올리기」」 */
    appName: string;
    onClose: () => void;
    /** [지금 올리기] · 「건너뛰기」 — 보통 안내를 닫고 pickReceiptImages(platform) 로 사진첩을 연다. 장면 link 로 옮겨 갔으면 옮긴 앱 */
    onUpload: (platform: GuideApp) => void;
    /** 맨 아래 버튼을 앱이 정한다(영테크: 「영수증 등록하기」 → 등록 칸 — 캡슐 · 장 수는 거기서). 없으면 [지금 올리기] → onUpload */
    cta?: GuideCta;
    /** receipt_guide_open {app} · receipt_guide_done {app}(첫 바퀴를 다 봤을 때) */
    track?: TrackFn;
    /** 이 안내를 그대로 튼다(전자 영수증 연동 안내처럼 GUIDES 밖 안내) — 없으면 platform 의 영수증 안내 */
    guide?: ReceiptGuideData;
};
/** 앱별 안내 재생기 — 저절로 흘러가며 되풀이하고, 아래에 [지금 올리기] 가 늘 떠 있다 */
export declare function ReceiptGuide({ platform, appName, onClose, onUpload, cta, track, guide, ...common }: ReceiptGuideProps): React.JSX.Element | null;
export type PlatformChooserProps = Common & Omit<ChooserProps, 'onPick' | 'onQuick'> & {
    onPick: ChooserProps['onPick'];
    onQuick: ChooserProps['onQuick'];
    /** receipt_platform_pick {platform} — 앱 칸(팝업 열기) · [바로 올리기]. 종이 영수증 버튼은 부르는 쪽이 기록한다 */
    track?: TrackFn;
};
/** 어떤 영수증인가 고르는 칸 — 올리기 화면 첫 자리에 그대로 놓는다 */
export declare function PlatformChooser({ theme, renderCharacter, track, onPick, onQuick, ...rest }: PlatformChooserProps): React.JSX.Element;
