/**
 * OTA 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진
 * 빌드에서 정적 import 는 앱 시작 자체를 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로
 * 더 그렇다.
 */
/** 시험에서만 쓴다 — 켠 상태를 처음으로 되돌린다 */
export declare function __reset(): void;
/**
 * 다 받으면 알려 달라 — 띠를 내는 화면이 부른다.
 *
 * **이미 받아 뒀으면 그 자리에서 한 번 부른다.** 받는 것이 홈보다 먼저 끝난 기기에서
 * 등록만 하고 기다리면 그 사이에 온 알림을 놓쳐 **띠가 영영 안 뜬다**(캐시팡에 있던 구멍).
 */
export declare function onUpdateReady(fn: () => void): void;
/** 받아 둔 새 판이 있는가 */
export declare const hasWaiting: () => boolean;
/**
 * 띠를 낼 때인가 — 받아 둔 것이 있고, 알려 주기를 켰고, 키보드가 자리를 쓰지 않을 때.
 *
 * 순수 함수라 화면 없이 확인할 수 있다.
 */
export declare function bandShows(gotOne: boolean, notice: boolean, keyboard: boolean): boolean;
/** 지금 돌고 있는 판 이름 — 기본 판(스토어에서 받은 그대로)이면 빈 문자열 */
export declare function bundleLabel(): string;
/**
 * 새 버전을 받아 둔다 — **어느 화면에서든 받는다.**
 *
 * 홈에 도착한 뒤에만 받게 하면 **로그인 화면을 고친 변경이 영영 안 내려간다** —
 * 로그인하지 않은 기기는 홈에 갈 일이 없고 `checkAutomatically` 도 꺼 두었기 때문이다.
 *
 * 앞에 잠깐 텀을 둔다 — 첫 화면이 쓸 네트워크를 같이 먹지 않게. **6초는 너무 길었다**
 * (그 전에 앱을 끄면 못 받는다).
 */
export declare function pullUpdateSoon(delayMs?: number): void;
/**
 * 받아 둔 판으로 다시 시작한다 — **사람이 눌렀을 때만 부른다.**
 *
 * **이 함수 말고 어디에서도 `reloadAsync` 를 부르지 않는다.** 앱이 스스로 다시 시작하면
 * 소셜 로그인처럼 앱 밖으로 나갔다 돌아오는 흐름이 끊긴다 — 돌아올 곳이 사라져 결과를 못 받는다.
 */
export declare function applyUpdate(): Promise<void>;
