import React, { type ReactNode } from 'react';
export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
    key: string;
    title: string;
    subtitle: string;
    ctaLabel: string;
    icon: BenefitQuickIcon | ReactNode;
    tint: string;
    onPress: () => void;
    done?: boolean;
    hidden?: boolean;
};
export type BenefitQuickListProps = {
    title?: string;
    seeAllLabel?: string;
    onSeeAll?: () => void;
    accentColor?: string;
    items: readonly BenefitQuickItem[];
    footer?: ReactNode;
};
export declare function BenefitQuickList({ title, seeAllLabel, onSeeAll, accentColor, items, footer }: BenefitQuickListProps): React.JSX.Element;
