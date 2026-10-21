/**
 * 표준 줄 두 개 — 홈 「바로 받는 혜택」 목록에 그대로 넣는다(0.4.0, 대표님 #24).
 * 앱은 아이템 이름 · 남은 수 · 누를 곳만 준다. react-native 를 가져오지 않는다(시험이 바로 돈다).
 */
import type { ReactNode } from 'react';
import type { BenefitQuickItem } from '../BenefitQuickList';
/**
 * 「무료 {item} 받기 · 하루 3번 들르면 {item} 받기 [받기]」 줄 — carrot 홈 freeHeart 줄과 같은 모양.
 * 부제 기본은 **방문형** 「하루 N번 들르면 ○○ 받기」(0.7.1, 대표님 10-20 — 당근 문구). 광고형 앱은 `subtitle` 로 바꾼다(예: 「하루 3번 광고 없이 받기」).
 */
export declare function freeItemRow(args: {
    /** 아이템 이름 — 양분 · 캡슐 · 열매 · 먹이 */
    itemName: string;
    /** 줄 부제 — 기본 「하루 N번 들르면 {itemName} 받기」(방문형). 광고형 앱은 이 값으로 덮는다 */
    subtitle?: string;
    /** 오늘 남은 방문 수(0~total). 주면 「N번 남았어요」, 0 이면 완료(done) — 놓친 칸이 있으면 받은 수와 다를 수 있다(`received` 를 같이 준다) */
    left?: number;
    /**
     * (0.7.4) 오늘 **받은** 횟수(0~total). 방문형은 아침 · 점심을 놓친 칸이 있어 「남은 칸 0 = 다 받음」이 아니다(저녁 1번만 받아도 left=0).
     * 주면 칸 막대의 초록 칸은 `received` 만큼, 완료 글자는 받은 횟수대로 — 0<r<total 「오늘 r번 받았어요」 · r=total 「오늘 다 받았어요」 · r=0 「오늘은 시간이 지났어요」.
     * 아직 받을 칸이 남았으면(left>0) 글자는 「N번 남았어요」. `left` 없이 `received` 만 주면 막대와 받은 횟수 글자만 그린다(done 은 아님)
     */
    received?: number;
    /** (0.7.4) 완료(done) 줄의 버튼 글자 — 이 줄만. 안 주면 목록의 `doneLabel`(기본 「완료」). 예: 방문형 「내일 다시」 */
    doneLabel?: string;
    /** 하루 방문 수 — 기본 3 */
    total?: number;
    onPress: () => void;
    /** 아이콘 — 기본 🌱 글자 */
    icon?: ReactNode;
    /** 바탕색 — 기본 연한 주황 */
    tint?: string;
    hidden?: boolean;
    /** 줄 key — 기본 'freeItem' */
    key?: string;
}): BenefitQuickItem;
/** 「추천 앱 둘러보기 · 보러가기」 줄 — 앱이 추천 앱 기능을 켰을 때만 hidden 을 끈다 */
export declare function appHubRow(args: {
    onPress: () => void;
    /** 줄 부제 — 기본 「추천 앱 둘러보기」(carrot 과 같은 기본) */
    subtitle?: string;
    icon?: ReactNode;
    tint?: string;
    hidden?: boolean;
    key?: string;
}): BenefitQuickItem;
