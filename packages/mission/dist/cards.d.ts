import type { Requester } from './entry';
export type MissionCardType = 'apihub_shopping' | 'place_stamp';
export type MissionCard = {
    id: string;
    type: MissionCardType;
    title: string;
    desc?: string;
    icon?: string | null;
    order?: number;
    enabled?: boolean;
};
/** 서버와 fallback 모두 같은 검증·중복 제거·안정 정렬을 적용한다. */
export declare function normalizeCards(raw: unknown): MissionCard[];
/** 빈 성공 목록은 어드민이 모두 끈 상태일 수 있으므로 fallback으로 바꾸지 않는다. */
export declare function parseCardsResponse(response: unknown, fallbackCards?: readonly MissionCard[]): MissionCard[];
export declare function fetchCards(fetchJson: Requester, fallbackCards?: readonly MissionCard[]): Promise<MissionCard[]>;
