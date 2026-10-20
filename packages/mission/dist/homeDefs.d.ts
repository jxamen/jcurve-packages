/**
 * 홈 「바로 받는 혜택」 목록 10줄의 **정의 전체**(0.7.5, 대표님 10-20 20:23 「패키지잖아 갖다 넣으면 똑같은 게 그냥 튀어 나와야 하는데」).
 * 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서를 **패키지가 가진다** — 기준은 당근캐시 홈(ota/carrot-ios-106-benefit-1020 814f2f4, FarmScreen HOME_BENEFITS).
 * 앱은 **아이템 이름 · 포인트 이름 · 줄마다 누르기 동작**과 값(걸음 수 · 무료 받은/남은 횟수 · 추천 부제)만 넘긴다 — 앱이 아이콘 · 부제 · 숨김을 덮어쓰지 못한다.
 * **줄은 앱에서 빠지지 않는다**(0.7.13, 대표님 10-21 07:07 「이거 패키지잖아 왜 다르냐고 매번」) — 동작(actions)은 전 줄 필수(타입). 숨기는 길은 원격설정 `home.row.<줄id>`('0'/'false') · 걸음 줄의 `steps.on` · 서버 home_rows 의 visible:false 뿐이다. 서버 home_rows 가 덮는 것은 제목 · 설명 · 버튼 · 배지 · 보임 · 순서뿐이고 아이콘 · 바탕색은 늘 여기 정의다.
 *
 * 순수 TS — react / react-native 를 가져오지 않는다(타입만 `import type`). 시험이 바로 돈다. 다른 줄(0.4.x)에 파일 그대로 옮길 수 있게 `pages/rows` 등 다른 모듈에 기대지 않는다.
 */
import type { BenefitQuickItem } from './BenefitQuickList';
import type { HomeRowKey } from './home';
/** 줄 순서 — 서버 home_rows 기본 순서와 같다(HOME_KEYS) */
export declare const HOME_ORDER: readonly HomeRowKey[];
/** 줄마다 누르면 할 일 — **전 줄 필수**(0.7.13: 빼면 컴파일 오류. 기능이 아직 없는 줄은 그 앱이 만들어 넘긴다). 런타임에 빠져 있으면 줄은 그려지고 누름은 아무 일도 안 한다 */
export type HomeActions = Record<HomeRowKey, () => void>;
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
    /** (0.7.8) 오늘 출석을 이미 했다 — `=== true` 일 때만 출석 줄이 완료 모양(회색 · 「출석 완료」, 다른 줄의 done 과 같음) */
    checkinDone?: boolean;
    /** 무료 아이템 줄 — 하루 방문 칸 수(기본 3) · 남은 칸(left) · 받은 횟수(received) */
    free?: {
        total?: number;
        left?: number;
        received?: number;
        claimableNow?: boolean;
    };
    /** 무료 · 광고 아이템 그림(앱 아이템 그림) — 없으면 🌱 */
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
     * (0.7.6) **앱 테마색을 따르는 네 줄만** 바탕색을 앱이 넘길 수 있다 — 걸음 · 추천은 당근 carrotSoft(#FFEEE2), 무료 · 광고 아이템은 heartSoft(#E6F5EA)가 기본이고 앱 테마의 soft 색이 있으면 그것이 우선.
     * 나머지 줄(퀴즈 · 출석 · 오늘의 미션 · 행운 찬스 · 초대)의 바탕색과 모든 아이콘은 못 바꾼다
     */
    tints?: Partial<Record<'steps' | 'free_item' | 'ad_item' | 'recommend', string>>;
};
/** 무료 아이템 줄의 완료 버튼 글자 — 방문형이라 오늘 칸이 끝나면 「내일 다시」(대표님 10-20 19:01) */
export declare const FREE_DONE_LABEL = "\uB0B4\uC77C \uB2E4\uC2DC";
/** 출석을 이미 했을 때 출석 줄의 완료 버튼 글자(0.7.8) */
export declare const CHECKIN_DONE_LABEL = "\uCD9C\uC11D \uC644\uB8CC";
/** 지금 받을 수 있는 칸이 있을 때 무료 아이템 줄의 배지(0.7.8) — 서버 home_rows 에 배지가 있으면 서버 값이 우선 */
export declare const FREE_NOW_BADGE = "\uC9C0\uAE08 \uBC1B\uAE30";
/** 걸음 권한이 없을 때 걸음 줄의 버튼 글자(0.7.7) */
export declare const STEPS_PERMISSION_LABEL = "\uAC78\uC74C \uCF1C\uAE30";
/** 한 줄을 만든다 — 줄 key 는 서버 key 그대로라 `homeKeys` 맞춤표가 필요 없다 */
export declare function homeItem(key: HomeRowKey, c: HomeContext, onPress: () => void): BenefitQuickItem;
/** 원격설정 값 맵(앱 설정 `values` — 키는 「그룹.항목」) */
export type RemoteValues = Readonly<Record<string, unknown>>;
/** 줄마다 숨기기/보이기 원격설정 키(어드민 앱 설정 그룹 `home` · 항목 `row.<줄id>`) — 값 '0' / 'false' 면 숨김, 값이 없으면 켜짐 */
export declare const homeRowRemoteKey: (key: HomeRowKey) => string;
/**
 * 원격설정으로 이 줄을 숨겨야 하나 — `values` 가 없으면(앱이 안 넘김) 아무것도 적용하지 않는다(앱 기존 게이팅 그대로).
 * ① `home.row.<줄id>` 가 '0' / 'false' ② 걸음 줄은 기존 키 `steps.on` 이 '1' / 'true' 가 **아니면**(없음 포함) 숨김 — 지금 당근 규칙 그대로.
 * 오퍼월(찬스 탭)은 줄이 아니라 탭이라 여기 범위 밖
 */
export declare function homeRowOff(key: HomeRowKey, values: RemoteValues | undefined): boolean;
/**
 * 목록 기본 줄 — **전 줄**, 순서는 HOME_ORDER. 서버 home_rows 는 이 위에 얹힌다(`composeHomeRows`).
 * 동작이 빠져 있으면(타입을 우회한 옛 코드) 줄은 그려지고 누름은 아무 일도 안 한다 — 개발 중에는 경고를 한 번 낸다.
 * 숨김은 `homeRowOff`(원격설정)로만 — 앱이 줄을 뺄 수 없다
 */
export declare function buildHomeItems(c: HomeContext, actions: Partial<HomeActions>, values?: RemoteValues): BenefitQuickItem[];
