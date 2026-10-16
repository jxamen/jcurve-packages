export interface ShoppingItem {
    rank: number;
    title: string;
    mallName: string;
    productId: string;
    link: string;
}
export type ShoppingTarget = {
    productId: string;
    mallName?: never;
    titleIncludes?: never;
} | {
    mallName: string;
    productId?: never;
    titleIncludes?: never;
} | {
    titleIncludes: string;
    productId?: never;
    mallName?: never;
};
/** 추정한 견본 스키마다. 실제 응답 확인 후 이 필드 매핑을 교체한다. */
export declare const SHOPPING_FIELDS: {
    readonly root: "shoppingResult";
    readonly items: "products";
    readonly title: "productTitle";
    readonly mall: "mallName";
    readonly id: "productId";
    readonly link: "productUrl";
};
export declare function parseShoppingSlots(json: unknown): ShoppingItem[];
export declare function findMyRank(items: ShoppingItem[], target: ShoppingTarget): number | undefined;
export declare function parseShoppingPage(html: string, page: number): ShoppingItem[];
