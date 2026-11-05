/**
 * 앱별 영수증 올리는 법 — **단계 글은 전부 이 파일 하나에 있다**(대표님 10-03 23:17~23:28).
 *
 * 글자는 대표님 아이폰 화면에서 읽은 그대로다(배민 · 쿠팡 · 쿠팡이츠 · N+스토어 · 네이버페이 · 무신사 · 컬리 · 카카오페이).
 * 앱 화면이 바뀌면 여기 글자만 고치면 된다. 「기타 앱」 칸은 없다(대표님 10-04 「기타 앱은 없어」).
 *
 * `{앱}` 은 쓰는 앱 이름(영테크 등 — ReceiptGuide 의 appName)으로 바뀐다.
 *
 * 한 단계(①)에 누를 곳이 여럿이면 장면을 나눈다 — 번호(`no`)는 같고 장면만 늘어난다.
 * 가게 · 상품 이름과 금액은 지어낸 값이다. 실제 이름 · 전화 · 주소 · 카드번호는 넣지 않는다.
 */
import type { GuideApp, ReceiptGuide, ReceiptPlatform } from './types';
/** 고르는 칸 순서(대표님 10-03 — 네이버페이는 N+스토어 다음, 컬리 · 컬리(네이버페이)는 무신사 다음, 카카오페이 다음) — 종이 영수증은 맨 끝 */
export declare const GUIDES: ReceiptGuide[];
export declare const PLATFORM_ORDER: ReceiptPlatform[];
export declare function guideOf(app: GuideApp): ReceiptGuide;
/** 연동 칩에만 있는 곳(사진 안내 없음)의 색 — 칩 점 색에 쓴다 */
export declare const LINK_ONLY_ACCENT: Partial<Record<GuideApp, string>>;
/** 안내 색 — 사진 안내가 없는 곳(다이소몰 · 올리브영)도 안전하게 */
export declare function accentOf(app: GuideApp): string;
export declare function isPlatform(v: unknown): v is ReceiptPlatform;
/** 고르는 칸 이름 */
export declare function platformName(p: ReceiptPlatform): string;
/** 사진첩에서 한 번에 고를 수 있는 장 수 — 길어서 여러 장 캡처하는 곳만 2장 넘게 */
export declare function pickLimit(p: ReceiptPlatform | null): number;
/**
 * **2장이 꼭 필요한 곳**(대표님 10-03 23:53 「2장 아니면 업로드 안되게 막아야 함」) — 영수증이 길어 위 · 아래 2장 캡처를
 * 이어 붙여야 결제 정보가 다 들어간다. 1장만 고르면 올리지 않는다. 서버도 shots < 2 면 422 need_two_shots.
 */
export declare const TWO_SHOT: ReadonlySet<ReceiptPlatform>;
/** 2장 곳 작은 알림 — 서버는 이어 붙인 사진에 주문번호가 둘 이상이면 반려한다 */
export declare const TWO_SAME_ORDER = "\uAC19\uC740 \uC601\uC218\uC99D\uC758 \uB9E8 \uC704 \u00B7 \uB05D \uCEA1\uCC98 2\uC7A5\uC774\uC5B4\uC57C \uD574\uC694";
export declare function needsTwo(p: ReceiptPlatform | null): boolean;
/**
 * 등록 칸에서 고를 수 있는 장 수(대표님 10-04 12:24 「한장으로 올릴 때 두장으로 올릴지 거기서 하는 거고」).
 * 2장이 꼭 필요한 곳은 [2] 만 — 1장은 앱도 서버도 받지 않는다(need_two_shots). 웹은 이어 붙이기를 못 하니 [1] 만.
 */
export declare function shotChoices(p: ReceiptPlatform | null, web?: boolean): (1 | 2)[];
