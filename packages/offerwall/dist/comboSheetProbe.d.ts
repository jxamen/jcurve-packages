/** TEMP-DIAG 0.6.5: a new sheet opening — every step may be said once again. */
export declare function resetComboSheetProbe(): void;
/** TEMP-DIAG 0.6.5: say a step once per opening. Never throws. */
export declare function comboSheetProbe(step: string, detail?: string): void;
/** The props of a sheet's vertical list (merged into the ScrollView's own props by each screen). */
export declare function comboListProps(): Record<string, unknown>;
