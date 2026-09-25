/**
 * 목록을 받아 오는 쪽.
 *
 * 앱마다 자기 API 통로(토큰 · 오류 처리 · 재시도)가 있으므로 **직접 받아서 넘겨도 된다**
 * (`AppHubSheet` 의 `load`). 그럴 필요가 없는 앱을 위해 기본 구현을 같이 낸다.
 *
 * **로그인 토큰은 붙이지 않는다** — 이 목록에는 회원의 것이 하나도 없고 공개 스토어 주소뿐이라,
 * 둘러보는 사람에게도 그대로 보여야 한다. 다만 서버는 어느 앱이 묻는지 알아야 해서
 * 앱 공개 키(`X-App-Token`)는 보낸다 — 앱 번들에 이미 들어 있는 값이고, 그것으로
 * 자기 앱을 목록에서 뺀다.
 */
import type { FamilyApp } from './pick';
export type Loader = () => Promise<FamilyApp[]>;
/**
 * 하단 「추천 포인트 앱 둘러보기」 칸 — 어드민 앱관리에서 앱마다 켜고 끄고 제목 · 설명을 정한다(2026-09-25 대표님).
 * `title` · `desc` 가 null 이면 앱 · 패키지의 기존 문구를 쓴다.
 */
export type FamilySection = {
    on: boolean;
    title: string | null;
    desc: string | null;
};
export type Hub = {
    items: FamilyApp[];
    section: FamilySection;
};
export declare const DEFAULT_SECTION: FamilySection;
/** `{base}/family` 응답 → 목록 + 칸 설정. 칸이 없던 옛 서버면 켜짐 · 기존 문구 */
export declare function parseHub(j: unknown): Hub;
/**
 * `{base}/family` 를 부른다. `base` 는 앱이 쓰는 API 주소 그대로다
 * (예: `https://api.j-curve.co.kr/v1/carrotcash`) — 슬러그가 이미 들어 있다.
 *
 * **못 받으면 예외를 낸다.** 빈 목록으로 삼키면 화면이 「아직 다른 앱이 없어요」라고
 * 거짓말을 한다 — 「지금 못 불러왔다」와 「없다」는 다른 말이다.
 */
export declare function storeLoader(opts: {
    base: string;
    token?: string;
    timeoutMs?: number;
}): Loader;
/** `storeLoader` 와 같지만 칸 설정(`section`)도 함께 — 입구를 보일지 · 제목을 한 번 부르기로 정한다 */
export declare function hubLoader(opts: {
    base: string;
    token?: string;
    timeoutMs?: number;
}): () => Promise<Hub>;
