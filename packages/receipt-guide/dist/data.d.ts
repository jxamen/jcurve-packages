/**
 * 앱별 영수증 올리는 법 — **단계 글은 전부 이 파일 하나에 있다**(대표님 10-03 23:17~23:28).
 *
 * 글자는 대표님 아이폰 화면에서 읽은 그대로다(배민 · 쿠팡 · 쿠팡이츠 · N+스토어 · 네이버페이 · 무신사 · 컬리 · 카카오페이).
 * 「기타 앱」만 어느 앱에나 맞게 일반적으로 적었다. 앱 화면이 바뀌면 여기 글자만 고치면 된다.
 *
 * `{앱}` 은 쓰는 앱 이름(영테크 등 — ReceiptGuide 의 appName)으로 바뀐다.
 *
 * 한 단계(①)에 누를 곳이 여럿이면 장면을 나눈다 — 번호(`no`)는 같고 장면만 늘어난다.
 * 가게 · 상품 이름과 금액은 지어낸 값이다. 실제 이름 · 전화 · 주소 · 카드번호는 넣지 않는다.
 */
import type { GuideApp, ReceiptGuide, ReceiptPlatform } from './types';
/** 고르는 칸 순서(대표님 10-03 — 네이버페이는 N+스토어 다음, 컬리는 무신사 다음, 카카오페이는 기타 앱 앞) — 종이 영수증은 맨 끝 */
export declare const GUIDES: ReceiptGuide[];
export declare const PLATFORM_ORDER: ReceiptPlatform[];
export declare function guideOf(app: GuideApp): ReceiptGuide;
export declare function isPlatform(v: unknown): v is ReceiptPlatform;
/** 고르는 칸 이름 */
export declare function platformName(p: ReceiptPlatform): string;
/** 사진첩에서 한 번에 고를 수 있는 장 수 — 길어서 여러 장 캡처하는 곳만 2장 넘게 */
export declare function pickLimit(p: ReceiptPlatform | null): number;
