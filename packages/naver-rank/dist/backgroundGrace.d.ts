/** Permission sheets may briefly background the app. Keep the current job intact. */
export declare function backgroundGrace(onBackground: () => void): {
    change(state: string): void;
    dispose(): void;
};
