/**
 * 홈 「바로 받는 혜택」 목록 9줄의 **정의 전체**(0.7.5, 대표님 10-20 20:23 「패키지잖아 갖다 넣으면 똑같은 게 그냥 튀어 나와야 하는데」).
 * 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서를 **패키지가 가진다** — 기준은 당근캐시 홈(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS).
 * 앱은 **아이템 이름 · 포인트 이름 · 줄마다 누르기 동작**과 값(걸음 수 · 무료 받은/남은 횟수 · 추천 부제)만 넘긴다 — 앱이 아이콘 · 부제 · 숨김을 덮어쓰지 못한다.
 * **동작(actions)을 안 넘긴 줄은 그 앱에서 빠진다**(예: 기능이 없는 앱의 무료 아이템 줄). 서버 home_rows 가 덮는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐이고 아이콘 · 바탕색은 늘 여기 정의다.
 *
 * 순수 TS — react / react-native 를 가져오지 않는다(타입만 `import type`). 시험이 바로 돈다. 다른 줄(0.4.x)에 파일 그대로 옮길 수 있게 `pages/rows` 등 다른 모듈에 기대지 않는다.
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { HomeRowKey } from './home';
/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
export declare const HOME_ORDER: readonly HomeRowKey[];
/** 줄마다 누르면 할 일 — 넣은 줄만 그려진다 */
export type HomeActions = Partial<Record<HomeRowKey, () => void>>;
/** 앱이 넘기는 이름 · 값 — 아이콘 · 부제 · 숨김은 받지 않는다 */
export type HomeContext = {
    /** 앱 이름(접근성 등에 쓸 자리 — 지금 문구에는 안 들어간다) */
    appName?: string;
    /** 아이템 이름 — 「무료 ○○ 받기」 · 「하루 기회로 ○○ 뽑기」. 당근 「당근」, 감자밭 「감자」. 기본 「포인트」 */
    itemName?: string;
    /** 포인트 이름 — 「포인트 받기」. 기본 「포인트」 */
    pointName?: string;
    /** 포인트 단위 — 「최대 100P」. 기본 「P」 */
    pointUnit?: string;
    /** 오늘 걸음 수 — 주면 「오늘 N걸음」, 없으면 「만보기」 */
    steps?: number | null;
    /** (0.7.7) 걸음 권한이 아직 없다(묻기 전 · 거부) — true 면 걸음 줄 버튼이 「걸음 켜기」(누르면 권한부터 받는다), 아니면 「보상 받기」(대표님 20:11 아이폰 만보기 줄) */
    stepsNeedsPermission?: boolean;
    /** 무료 아이템 줄 — 하루 방문 칸 수(기본 3) · 남은 칸(left) · 받은 횟수(received) */
    free?: {
        total?: number;
        left?: number;
        received?: number;
    };
    /** 무료 아이템 그림(앱 아이템 그림) — 없으면 🌱 */
    itemIcon?: BenefitQuickItem['icon'];
    /** 오늘의 미션 줄의 앱 제목(보너스 문구 같은 동적 제목) · 막대 — 서버 제목이 비어 있으면 이것이 보인다 */
    todayMissions?: {
        title?: string;
        progress?: {
            done: number;
            total: number;
        };
        progressLabel?: string;
    };
    /** 추천 앱 줄 부제(서버 promo.desc) · 캐릭터 그림(앱 자산) */
    recommend?: {
        desc?: string;
        icon?: BenefitQuickItem['icon'];
    };
    /**
     * (0.7.6) **앱 테마색을 따르는 세 줄만** 바탕색을 앱이 넘길 수 있다 — 걸음 · 추천은 당근 carrotSoft(#FFEEE2), 무료 아이템은 heartSoft(#E6F5EA)가 기본이고 앱 테마의 soft 색이 있으면 그것이 우선.
     * 나머지 줄(퀴즈 · 출석 · 오늘의 미션 · 행운 찬스 · 초대)의 바탕색과 모든 아이콘은 못 바꾼다
     */
    tints?: Partial<Record<'steps' | 'free_item' | 'recommend', string>>;
};
/** 무료 아이템 줄의 완료 버튼 글자 — 방문형이라 오늘 칸이 끝나면 「내일 다시」(대표님 10-20 19:01) */
export declare const FREE_DONE_LABEL = "\uB0B4\uC77C \uB2E4\uC2DC";
/** 걸음 권한이 없을 때 걸음 줄의 버튼 글자(0.7.7) */
export declare const STEPS_PERMISSION_LABEL = "\uAC78\uC74C \uCF1C\uAE30";
/** 한 줄을 만든다 — 줄 key 는 서버 key 그대로라 `homeKeys` 맞춤표가 필요 없다 */
export declare function homeItem(key: HomeRowKey, c: HomeContext, onPress: () => void): BenefitQuickItem;
/**
 * 목록 기본 줄 — **actions 에 있는 줄만**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작을 안 넘긴 줄(그 앱에 기능이 없음)은 만들지 않는다.
 */
export declare function buildHomeItems(c: HomeContext, actions: HomeActions): BenefitQuickItem[];
