import React, { type ReactNode } from 'react';
import type { Requester } from './entry';
import { type HomeRowKey, type HomeStorage } from './home';
import { type CoupangShortVisitPopupProps } from './CoupangShortVisitPopup';
import { type HomeActions, type HomeContext, type RemoteValues } from './homeDefs';
export type BenefitQuickIcon = 'calendar' | 'bag' | 'pin' | 'star' | 'ticket' | 'friend';
export type BenefitQuickItem = {
    key: string;
    title: string;
    subtitle: string;
    badge?: string;
    ctaLabel: string;
    icon: BenefitQuickIcon | ReactNode;
    tint: string;
    onPress: () => void;
    done?: boolean;
    hidden?: boolean;
    /** 부제 대신 칸 막대로 몇 개 했는지 보여 준다(2026-10-19 당근 대표님 「여기처럼 몇 개 있는지 표기」) */
    progress?: {
        done: number;
        total: number;
    };
    /** 칸 막대 옆 한 줄(예: 「3개 남았어요」, 대표님 10-19 「아래 줄 남은 횟수 표기」) */
    progressLabel?: string;
    /** (0.7.4) 완료(done) 줄의 버튼 글자 — 이 줄만. 안 주면 목록의 `doneLabel` */
    doneLabel?: string;
    /** Always visible, wrapping disclosure below the row. */
    disclosure?: string;
};
export type BenefitQuickListProps = {
    renderCoupangShortVisit?: (props: CoupangShortVisitPopupProps) => ReactNode;
    title?: string;
    doneLabel?: string;
    buttonWidth?: number;
    /** 버튼 높이(기본 40) — 당근 대표님 10-19 「버튼 사이즈 좀 더 작게」 */
    buttonHeight?: number;
    seeAllLabel?: string;
    onSeeAll?: () => void;
    accentColor?: string;
    /** 앱이 직접 만든 줄(예전 방식). `homeActions` 를 주면 이 값은 쓰지 않는다 */
    items?: readonly BenefitQuickItem[];
    /**
     * (0.7.5) **줄 정의 전체를 패키지가 가진다**(당근 기준 9줄 — 제목 · 부제 · 버튼 · 아이콘 · 바탕색 · 순서): 앱은 줄마다 누르기 동작만 넘기면 그 줄이 그려지고,
     * **줄은 앱에서 빠지지 않는다**(0.7.13 — 동작은 전 줄 필수, 숨기는 길은 `remoteValues` 의 `home.row.<줄id>` · 걸음 줄 `steps.on` · 서버 home_rows visible:false 뿐). 서버 home_rows 는 이 위에 제목 · 설명 · 버튼 · 배지 · 보임 · 순서만 얹고 아이콘 · 바탕색은 늘 패키지 정의다. 앱이 아이콘 · 부제 · 숨김을 덮어쓸 수 없다.
     * 이 prop 을 주면 `items` · `homeKeys` · `itemName` · `onFreeItem` · `onRow` 는 쓰지 않는다(서버에만 있고 동작이 없는 줄은 그리지 않는다)
     */
    homeActions?: HomeActions;
    /** (0.7.5) `homeActions` 와 함께 — 아이템 이름 · 포인트 이름 · 걸음 수 · 무료 받은/남은 횟수 같은 값(글자 일부만 앱 값) */
    homeContext?: HomeContext;
    /** (0.7.13) `homeActions` 와 함께 — 어드민 앱 설정 값 맵(예 `values`). `home.row.<줄id>` 가 '0' / 'false' 면 그 줄을 숨기고 값이 없으면 켜짐, 걸음 줄은 `steps.on` 이 '1' / 'true' 일 때만 보임. 안 넘기면 원격 규칙은 적용하지 않는다 */
    remoteValues?: RemoteValues;
    footer?: ReactNode;
    /**
     * (0.4.4) 앱의 요청 함수 — 있으면 서버 `GET mission/home` 의 home_rows(어드민 mission.home_rows)를 **스스로 읽어** items 에 적용한다(제목 · 설명 · 버튼 · 배지 · 보임 · 순서).
     * 실패하면 앱 기본 그대로, 60초 캐시, 앱이 앞으로 돌아올 때 · `refreshKey` 가 바뀔 때 다시. 없으면 예전 그대로(적용 없음).
     */
    fetchJson?: Requester;
    /** (0.4.4) 앱 줄 key → 서버 줄 key(9개 고정) 맞춤표. 안 적은 줄은 key 가 서버 key 와 같으면 그대로. 예: { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' } */
    homeKeys?: Readonly<Record<string, HomeRowKey>>;
    /** (0.4.4) 기본 free_item 줄(「무료 ○○ 받기 · 하루 3번 들르면 ○○ 받기」)의 ○○ — 앱 아이템 이름. 없으면 「아이템」 */
    itemName?: string;
    /** (0.4.4) 기본 free_item 줄을 눌렀을 때. **없으면 그 줄을 만들지 않는다**. 앱 items 에 이미 free_item(맞춤표 기준)이 있으면 겹치지 않는다 */
    onFreeItem?: () => void;
    /** (0.4.4) 서버 home_rows 에 있는데 앱 items 에 짝이 없는 줄(퀴즈 · 출석 · 만보기 · 오늘 미션 · 행운 찬스 · 초대 · 추천 앱 …)을 누르면. **없으면 그 줄은 그리지 않는다** */
    onRow?: (key: HomeRowKey) => void;
    /** (0.4.4) 홈으로 돌아올 때마다 바꿔 주면(예: tab === 'home') 서버 목록을 다시 읽는다 */
    refreshKey?: unknown;
    /**
     * (0.4.6) 앱이 넘기는 저장소(`get`/`set` 또는 `getItem`/`setItem`(0.7.3~) — 순정 AsyncStorage 를 그대로 넘기면 된다, 새 네이티브 의존 없음). 있으면 마지막으로 받은 서버 목록을 저장해 두고 **앱을 켤 때 그 값으로 먼저** 그린 뒤
     * 서버 응답으로 갱신한다(앱 기본 순서로 그렸다가 서버 순서로 바뀌지 않게, 대표님 10-20 18:54). 저장값을 읽는 동안(최대 300ms)은 목록을 그리지 않는다. 없으면 예전과 같다. `fetchJson` 이 있을 때만 쓴다.
     */
    storage?: HomeStorage;
    /** (0.4.6) 저장 키 — 기본 'jcurve.mission.home.v1'. 서버 · 계정마다 다른 목록을 쓰는 앱만 바꾼다 */
    storageKey?: string;
};
/**
 * 아이콘 종류(0.7.9) — 'palette' 는 위 기본 그림 이름, 'text' 는 그 밖의 글자(이모지 👟 🌱 등), 'node' 는 앱이 넘긴 ReactNode.
 * RN 은 `<View>` 안의 글자를 그리지 않는다(iOS 빈 칸 · Android 오류) — 0.7.5~0.7.8 감자밭 「오늘 N걸음」 줄 아이콘이 빈 칸이던 원인(대표님 20:5x 캡처). 'text' 는 `<Text>` 로 감싼다
 */
export declare function iconKind(icon: BenefitQuickItem['icon']): 'palette' | 'text' | 'node';
/** 빠른 두 번 누름을 막는 시간(0.4.3) — 잠금 상태가 없어 영영 남을 수 없다. 이 시간이 지나면 다음 누름은 늘 들어간다 */
export declare const TAP_GUARD_MS = 700;
/** 줄 누름 — 직전 누름에서 TAP_GUARD_MS 안이면 무시. 처리 함수가 던져도 다음 누름은 막히지 않는다 */
export declare function pressOnce(run: () => void, now?: number): boolean;
/** 시험용 — 누름 기록을 지운다 */
export declare function resetTapGuard(): void;
/**
 * 「바로 받는 혜택」 목록. (0.4.4) `fetchJson` 을 주면 서버 home_rows 를 스스로 적용하고, `onFreeItem` 을 주면 free_item 기본 줄이 생긴다 — 둘 다 없으면 0.4.3 과 똑같이 그린다.
 */
export declare function BenefitQuickList(props: BenefitQuickListProps): React.JSX.Element;
