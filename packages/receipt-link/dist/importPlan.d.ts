/**
 * 주문 불러오기 — 읽기 결과(옛 목록 스크립트 메시지 · 영수증 흐름의 주문)를 검사해 모으는 순수 함수(노드에서 바로 시험한다). react-native 를 import 하지 않는다.
 * 주문 내용은 여기서도 로그로 남기거나 예외 메시지에 넣지 않는다. 틀린 메시지는 null, 틀린 주문 한 건은 세고 버린다.
 */
import { ORDER_PAGES } from './readers';
import { type LinkPlatform, type OrderInput } from './model';
export type ReaderSite = keyof typeof ORDER_PAGES;
/** 한 곳을 연동하면 읽는 사이트 목록(순서대로). 쿠팡은 서버 스위치(coupangRead)가 켜진 뒤에만 연다 */
export declare const SITES_FOR_PLATFORM: Record<LinkPlatform, ReaderSite[]>;
export declare const SITE_LABEL: Record<ReaderSite, string>;
/** 서버가 받는 기간(일) — 대표님 2026-10-28 20:20 「최근 일 년치까지」 */
export declare const WINDOW_DAYS = 365;
export declare const MAX_PER_MESSAGE = 50;
export declare const MAX_TOTAL = 500;
export type ImportResult = {
    read: number;
    sent: number;
    added: number;
    duplicates: number;
    rejected: number;
    note?: string;
};
export type ReaderMessage = {
    site: ReaderSite;
    done: boolean;
    orders: OrderInput[];
    dropped: number;
    note?: string;
};
export type CollectResult = {
    orders: OrderInput[];
    read: number;
    duplicates: number;
    rejected: number;
};
/** 흐름(구동기)이 낸 주문 목록 → 검사를 통과한 주문과 버린 수. 목록 모양이 아니면 아무것도 읽지 않는다 */
export declare function readFlowOrders(list: unknown): {
    orders: OrderInput[];
    dropped: number;
};
/** 웹뷰 메시지 한 덩이. 모양이 틀리거나 사이트 키가 다르거나 50건을 넘으면 null(메시지 통째로 버림) */
export declare function parseReaderMessage(raw: string): ReaderMessage | null;
/** 로그인 페이지인지 주소만 보고 판단한다(네이버 통합 로그인 · 각 사이트의 /login 경로) */
export declare const isLoginUrl: (url: string) => boolean;
/** 주소의 호스트(소문자). 주소가 아니면 빈 문자열 */
export declare const hostOf: (url: string) => string;
/** 이 주소가 사이트 주문내역 페이지와 같은 호스트인지 — SPA 안에서 옮겨 간 페이지를 다시 읽을지 볼 때 쓴다 */
export declare const isOnSite: (url: string, siteUrl: string) => boolean;
/** 밀리초 → KST 「YYYY-MM-DD HH:mm」(주문일시와 같은 모양이라 문자열로 비교한다) */
export declare function kstStamp(ms: number): string;
/**
 * 여러 페이지 · 여러 사이트의 주문을 모은다. 주문번호로 중복을 거르고, 최근 1년(WINDOW_DAYS)만 남기고, 최신순으로 MAX_TOTAL 건까지만 담는다.
 * 같은 주문번호가 네이버 쇼핑 · 네이버페이에 둘 다 있으면 한 건으로 센다(서버도 주문번호로 거른다).
 * add 는 한꺼번에 모아 finish 에서 자르고, accept 는 읽는 대로 받아 새로 담긴 것만 돌려준다(읽는 순서가 최신순이라 한도는 먼저 온 것부터 채운다).
 */
export declare function createCollector(nowMs?: number): {
    add(msg: {
        orders: OrderInput[];
        dropped: number;
    }): void;
    /** 읽는 대로 받는다 — 새로 담긴 주문만 돌려준다(중복 · 기간 밖 · 한도 밖은 세고 버린다) */
    accept(msg: {
        orders: OrderInput[];
        dropped: number;
    }): OrderInput[];
    /** 지금까지 담은 주문 수 */
    size(): number;
    /** 지금까지 모은 결과 — 여러 번 불러도 같다 */
    finish(): CollectResult;
};
