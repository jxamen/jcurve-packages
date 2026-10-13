import React, { type ReactNode } from 'react';
import { type ImageSourcePropType } from 'react-native';
import { type MissionCard, type MissionCardType } from './cards';
import type { Requester } from './entry';
import { type MissionTheme } from './states';
import { type Lang } from './i18n';
export type MissionCardsTheme = {
    colors?: Partial<MissionTheme>;
    radius?: number;
};
export type MissionCardsProps = {
    fetchJson: Requester;
    fallbackCards?: readonly MissionCard[];
    title?: string;
    subtitle?: string;
    theme?: MissionCardsTheme;
    icons?: Partial<Record<MissionCardType, ReactNode | ImageSourcePropType>>;
    character?: ReactNode;
    renderAfterCards?: () => ReactNode;
    onOpenShopping: (card: MissionCard) => void;
    onOpenStamps: (card: MissionCard) => void;
    /** (0.2.1) 기본 제목 · 부제 언어 — 앱이 넘긴다. 없거나 'ko' 면 한국어. 카드 제목 · 설명은 서버(mission/cards) 글 그대로 */
    lang?: Lang;
};
/** 모든 앱이 같은 머리글·카드 목록·광고 슬롯 구조를 쓴다. */
export declare function MissionCards({ fetchJson, fallbackCards, title, subtitle, theme, icons, character, renderAfterCards, onOpenShopping, onOpenStamps, lang }: MissionCardsProps): React.JSX.Element;
