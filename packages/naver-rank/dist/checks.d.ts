import { type ShoppingTarget } from './shopping';
export declare function checkPlaceRank(keyword: string, placeId: string): Promise<import("./placeInApp").PlaceCollection>;
export declare function checkShoppingRank(keyword: string, target: ShoppingTarget): Promise<{
    rank: number | null;
    items: {
        rank: number;
        productId: string;
        link: string;
        title: string;
        mallName: string;
    }[];
}>;
