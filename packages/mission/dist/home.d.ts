/**
 * (0.5.0) 메인 「바로 받는 혜택」 목록을 **서버 설정으로** — 대표님 10-20 10:56 「메인 패키지 반영도 바로 안되고」.
 * 줄 제목 · 설명 · 버튼 · 배지 · 보임 · 순서를 어드민 앱 설정(mission.home_rows)에서 바꾸면 앱 빌드 · OTA 없이 1분 안에 바뀐다.
 * 서버 GET mission/home → { ok, rows: HomeRow[] | null, list: { adAfter, shoppingFirst } }. rows 가 null(설정 없음) · 실패면 앱의 기본 목록 그대로.
 * react-native 를 가져오지 않는다(시험이 바로 돈다).
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { Requester } from './entry';
/** 서버가 아는 줄 행동 — jcurve-api MissionCardsController::HOME_KEYS 와 같다 */
export declare const HOME_KEYS: readonly ["quiz1", "quiz2", "checkin", "steps", "free_item", "today_missions", "lucky_chance", "invite", "recommend"];
export type HomeRowKey = typeof HOME_KEYS[number];
export type HomeRow = {
    key: HomeRowKey;
    title: string;
    desc: string;
    button: string;
    badge: string;
    visible: boolean;
    order: number;
};
export type HomeConfig = {
    rows: HomeRow[] | null;
    list: {
        adAfter: number | null;
        shoppingFirst: boolean | null;
    };
};
export declare const EMPTY_HOME: HomeConfig;
/** 서버 응답을 믿지 않고 다시 거른다 — 모르는 key · 빈 제목 · 같은 key 두 번째는 버린다. 깨진 응답은 EMPTY_HOME */
export declare function parseHomeResponse(response: unknown): HomeConfig;
/** GET mission/home — `maxAgeMs`(기본 60초) 안이면 받아 둔 것. 실패하면 받아 둔 것 또는 EMPTY_HOME(앱 기본 목록) */
export declare function fetchHomeConfig(fetchJson: Requester, opts?: {
    maxAgeMs?: number;
    now?: number;
}): Promise<HomeConfig>;
/** 시험용 · 로그아웃 · 앱 전환 */
export declare function resetHomeConfig(): void;
/**
 * 앱의 기본 목록에 서버 설정을 얹는다 — `keys` 는 앱 줄 key → 서버 행동 key(예 { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }).
 *  - 설정이 있는 줄: 제목은 서버 것, 설명 · 버튼 · 배지는 서버 값이 있을 때만(빈 값이면 앱 것 그대로), visible:false 면 숨김
 *  - 순서: 설정이 있는 줄은 서버 순서대로 앞에, 설정에 없는 줄(앱만의 줄 · 서버가 안 적은 줄)은 그 뒤에 원래 순서대로
 *  - rows 가 null 이면 아무것도 안 바꾼다. 누르는 동작(onPress) · 완료 · 칸 막대는 늘 앱 것
 */
export declare function applyHomeRows(items: readonly BenefitQuickItem[], rows: readonly HomeRow[] | null, keys: Readonly<Record<string, HomeRowKey>>): BenefitQuickItem[];
/**
 * 목록 사이 광고 자리(list.adAfter) — 앞에서 몇 번째 **보이는** 줄 뒤에 둘지. null 이면 앱 기본, 0 이면 맨 앞, 보이는 줄 수보다 크면 맨 뒤
 */
export declare function adSlotIndex(items: readonly BenefitQuickItem[], adAfter: number | null, fallback: number | null): number | null;
