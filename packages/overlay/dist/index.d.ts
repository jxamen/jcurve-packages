export type FloatingPopupParams = {
    imageUrl: string;
    name: string;
    price: string;
    durationSec: number;
};
/** Check if overlay module is available on this platform. */
export declare function isAvailable(): boolean;
/** Check if device has overlay permission (Android only; always false on iOS). */
export declare function hasPermission(): boolean;
/** Request overlay permission from user (Android only; no-op on iOS). */
export declare function requestPermission(): void;
/** Show floating popup card with image, product name, and price. Returns success status. */
export declare function show(params: FloatingPopupParams): Promise<boolean>;
/** Hide the floating popup. */
export declare function hide(): void;
