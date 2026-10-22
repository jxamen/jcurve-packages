import type { ReactElement } from 'react';
export type OfferwallScreenProps = {
    usn: string | null;
    onClose: () => void;
    onRetry: () => void;
    loadingColor?: string;
    /** Only pass a top inset when the host has not already applied its safe area. */
    topInset?: number;
};
export declare const OFFERWALL_SCREEN_MARK = "jcurve-offerwall-screen:headerless-v1";
/** Tab content: no host header. The host owns status-bar and bottom-tab safe areas. */
export declare function OfferwallScreen({ usn, onClose, onRetry, loadingColor, topInset }: OfferwallScreenProps): ReactElement;
