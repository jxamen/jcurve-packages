import React, { type ReactNode } from 'react';
export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
    key: string;
    title: string;
    subtitle: string;
    badge?: string;
    ctaLabel: string;
    icon: BenefitQuickIcon | ReactNode;
    tint: string;
    onPress: () => void;
    done?: boolean;
    hidden?: boolean;
};
export type BenefitQuickListProps = {
    title?: string;
    doneLabel?: string;
    buttonWidth?: number;
    seeAllLabel?: string;
    onSeeAll?: () => void;
    accentColor?: string;
    items: readonly BenefitQuickItem[];
    footer?: ReactNode;
};
export declare function BenefitQuickList({ title, seeAllLabel, onSeeAll, accentColor, items, footer, doneLabel, buttonWidth }: BenefitQuickListProps): React.JSX.Element;
