import React, { type ReactNode } from 'react';
export type FloatingRewardChipProps = {
    visible: boolean;
    icon?: ReactNode;
    label: string;
    onPress: () => void;
    /** Distance from the bottom of the containing view, in points. */
    bottomOffset: number;
};
/** Place inside a positioned content view above the tab bar. */
export declare function FloatingRewardChip({ visible, icon, label, onPress, bottomOffset }: FloatingRewardChipProps): React.JSX.Element | null;
