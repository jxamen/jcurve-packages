import React from 'react';
import { type StepsState } from './stages';
import { syncToday } from './sync';
export type StepsTheme = {
    bg: string;
    card: string;
    text: string;
    sub: string;
    line: string;
    dim: string;
    primary: string;
    primarySoft: string;
    onPrimary: string;
    radius: number;
};
export declare const defaultStepsTheme: StepsTheme;
export type PendingStepsClaim = {
    stage_id: string;
    day: string;
    purpose: string;
    key: string;
    earned: boolean;
};
export type StepsScreenProps = {
    api: {
        fetchStages(): Promise<StepsState>;
        claimStage(stageId: string, day: string, earned?: boolean): Promise<StepsState & {
            gained: number;
            balance: number;
        }>;
        sync: Parameters<typeof syncToday>[1];
    };
    showRewardedAd(purpose: string): Promise<{
        earned: boolean;
        opened?: boolean;
        noAd?: boolean;
        message?: string;
    }>;
    onPendingClaim?(claim: PendingStepsClaim): void;
    onBalance?(): void | Promise<unknown>;
    theme?: Partial<StepsTheme>;
    strings?: Record<string, string>;
    header?: React.ReactNode;
    adSlot?: React.ReactNode;
    onClose(): void;
    ensureVersion?(): Promise<boolean>;
    memberId: string | number;
};
export declare function StepsScreen({ api, showRewardedAd, onPendingClaim, onBalance, theme, strings, header, adSlot, onClose, ensureVersion, memberId }: StepsScreenProps): React.JSX.Element;
