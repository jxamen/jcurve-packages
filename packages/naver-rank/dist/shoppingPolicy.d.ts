export declare const SHOPPING_PAGE_SIZE = 40;
export declare const SHOPPING_MAX_RANK = 100;
export declare const SHOPPING_MAX_PAGES: number;
export declare function shoppingNextPage(page: number, found: boolean): number | undefined;
export declare function shoppingFallback(code: string, page: number, attempts: number, manual: boolean): boolean;
export declare const shoppingPageDelay: (random?: () => number) => number;
