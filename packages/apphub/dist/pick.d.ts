/**
 * 서버가 준 계열 앱 목록에서 **이 기기로 받을 수 있는 주소**를 고른다.
 *
 * 서버는 iOS · 안드로이드 주소를 둘 다 준다 — 고르는 것은 기기를 아는 앱 몫이다. 서버가
 * User-Agent 로 고르면 캐시를 태울 수 없고 아이패드 · 웹뷰에서 애매해진다.
 *
 * **그 기기 스토어에 없는 앱은 아예 빼 버린다**(2026-09-20 지시: 「안드로이드면 안드로이드 승인 난
 * 애들, 애플이면 애플 승인 난 애들이 나오면 된다」). 처음에는 「준비 중」으로 흐리게 남겼는데,
 * 누를 수 없는 줄은 목록만 길게 만들고 **그 기기에서는 할 수 있는 일이 하나도 없다.**
 *
 * 첫 글자 · 색도 여기서 정한다. 어드민에 아이콘 칸이 아직 없어 이름 첫 글자를 동그라미에
 * 넣는데, **색이 한 가지면 목록이 한 덩어리로 보인다.** 그래서 slug 로 고른다 — 앱이 늘어도
 * 서로 다른 색이 붙고, 같은 앱은 어느 앱에서 보든 늘 같은 색이다.
 *
 * RN 에 기대지 않는 순수 파일이라 vitest 로 검증한다.
 */
/** 서버가 주는 한 줄 — `GET {API_BASE}/family` */
export type FamilyApp = {
    slug: string;
    name: string;
    /** 아랫줄 한 줄 소개 — 어드민 설명이 정본, 없으면 스토어 소개 첫 줄 */
    desc?: string | null;
    site: string | null;
    ios: string | null;
    android: string | null;
    iosId?: string | null;
    androidId?: string | null;
    icon?: string | null;
};
/** 화면이 그대로 그리는 한 줄 */
export type FamilyRow = {
    slug: string;
    name: string;
    desc: string | null;
    /** 이 기기에서 열 주소 — 없으면 아직 그 스토어에 없다 */
    url: string | null;
    icon: string | null;
    /** 아이콘이 없을 때 동그라미에 넣을 한 글자 */
    initial: string;
    /** 동그라미 색 — slug 로 고른다(같은 앱은 늘 같은 색) */
    tint: string;
};
export declare function tintOf(slug: string): string;
export declare function familyRows(items: FamilyApp[], platform: string): FamilyRow[];
