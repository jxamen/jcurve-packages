/**
 * 앱 오프닝 광고 가드 — 앱을 떠나거나 전체화면 광고를 띄우는 자리가 **떠나기 전에** 부른다.
 * 기기 모듈을 읽지 않는다(`flow.ts` 같은 노드 시험 파일도 부른다). 판단 규칙은 `appOpenRules.ts`.
 */
import { type GuardReason } from './appOpenRules';
/** 보상형 · 전면 · 미션(외부 앱/웹) · 결제 · 로그인으로 앱을 떠나기 직전에 부른다 — 돌아온 직후엔 앱 오프닝을 안 띄운다 */
export declare function markReturnGuard(reason: GuardReason): void;
/** 지금부터 `ms` 동안 앱 오프닝을 막는다 */
export declare function noAppOpenFor(ms: number): void;
/** 전체화면 광고(보상형 · 전면 · 앱 오프닝 자신)가 떠 있는 동안 true 로 — 겹쳐도 센다 */
export declare function setFullScreenAd(showing: boolean): void;
export declare function watchFullScreenAd(fn: ((showing: boolean) => void) | null): void;
export declare function onFullScreenAd(listener: (showing: boolean) => void): () => void;
/** 앱이 앞으로 왔다 — 훅이 부른다 */
export declare function guardForeground(now?: number): void;
export declare const isGuarded: (now?: number) => boolean;
export declare const isFullScreenAd: () => boolean;
/** 시험용 */
export declare function resetAppOpenGuard(): void;
