/** The tap is on (native confirmed). Counts as a new activation only when it was off before. */
export declare function tapGateActivated(): void;
/** The tap is off again (switch off, member change, stop()). */
export declare function tapGateDeactivated(): void;
export declare function tapGateState(): {
    active: boolean;
    epoch: number;
};
/** Called with the new epoch at every activation. Returns the unsubscribe function. */
export declare function subscribeTapGate(listener: (epoch: number) => void): () => void;
/** A wall view mounted this recently (ms) before the tap turned on is mounted once more so that its web view gets the script. */
export declare const TAP_REMOUNT_WINDOW_MS = 30000;
