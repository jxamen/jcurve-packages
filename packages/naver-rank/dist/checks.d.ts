import { type ShoppingTarget } from './shopping';
export declare function checkPlaceRank(keyword: string, placeId: string): Promise<import("./placeInApp").PlaceCollection>;
type ShoppingResult = {
    rank: number | null;
    items: import('./shopping').ShoppingItem[];
    timestamp: number;
    cached: boolean;
};
export declare function checkShoppingRank(keyword: string, target: ShoppingTarget): Promise<ShoppingResult>;
export {};
