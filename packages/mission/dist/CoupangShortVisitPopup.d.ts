import React from 'react';
export type CoupangShortVisitPopupProps = {
    seconds: number;
    points: number;
    onRetry: () => void;
    onClose: () => void;
};
/** Apps can render these actions with their existing common popup. */
export declare function CoupangShortVisitPopup({ seconds, points, onRetry, onClose }: CoupangShortVisitPopupProps): React.JSX.Element;
