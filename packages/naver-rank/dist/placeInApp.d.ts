import { type WebRow } from './webQueue';
import { placePayloads } from './placePayloads';
export type PlaceTop = {
    id: string;
    name: string;
    photo: string | null;
    reviews: number | null;
};
export type PlaceCollection = {
    rank: number | null;
    total: number;
    top: PlaceTop[];
};
export type PlaceCategory = keyof typeof placePayloads;
export declare function placeCategory(path: string, label?: string): PlaceCategory;
export declare function placePayload(keyword: string, page: number, category?: PlaceCategory): any;
export declare function parsePlaceGraphql(value: unknown, status?: number): {
    total: number;
    items: PlaceTop[];
};
export declare function scanPlacePages(keyword: string, placeId: string, category: PlaceCategory, request: (body: unknown) => Promise<{
    status: number;
    body: unknown;
}>, wait: (ms: number) => Promise<void>): Promise<PlaceCollection>;
export declare function collectPlaceInApp(keyword: string, placeId: string): Promise<PlaceCollection>;
export declare function placeRows(result: PlaceCollection, placeId: string): WebRow[];
