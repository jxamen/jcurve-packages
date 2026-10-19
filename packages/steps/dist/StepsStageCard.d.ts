import React from 'react';
import { type StepsStage, type StepsState } from './stages';
export declare function StepsStageCard({ state, disabled, onWatchAd, onClaim, onError }: {
    state: StepsState;
    disabled?: boolean;
    onWatchAd: (stage: StepsStage) => Promise<boolean>;
    onClaim: (stage: StepsStage, day: string) => Promise<void>;
    onError: (error: unknown) => void;
}): React.JSX.Element;
