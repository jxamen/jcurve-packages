/**
 * 문서 스캐너 — 테두리를 잡아 자르고 반듯하게 편 사진 파일을 받는다.
 *
 * 부품은 `react-native-document-scanner-plugin` 2.0.4 다. 안드로이드는 구글 ML Kit 문서 스캐너
 * (Play 서비스 화면), 아이폰은 VisionKit 이다. 영테크 `src/receipt/scanner.ts` 와 총무님
 * `RecordScreen.tsx` 의 호출을 합쳐 떼어 냈다.
 */
export type ScanOptions = {
    /** 받을 장 수. 기본 1. 안드로이드는 여기서 막고, 아이폰 VisionKit 은 못 막는다 — 넘으면 `extraPages` 대로 */
    maxPages?: number;
    /** 잘라 낸 사진의 JPEG 품질 0~100. 기본 90 */
    quality?: number;
    /**
     * 아이폰에서 `maxPages` 보다 많이 찍었을 때.
     *   'reject'(기본) — `scanner_multiple_pages` 로 다시 찍게 한다(영테크: 영수증 한 장에 한 건)
     *   'keep'         — 찍은 것을 다 준다. 앱이 앞에서 잘라 쓰고 「N장까지」를 알린다(총무님: 찍은 것을 잃지 않게)
     * 어느 쪽이든 **조용히 버리지 않는다.**
     */
    extraPages?: 'reject' | 'keep';
};
export type ScannerCode = 'scanner_unavailable' | 'scanner_permission' | 'scanner_multiple_pages' | 'scanner_empty' | 'scanner_failed';
export declare class ScannerError extends Error {
    readonly code: ScannerCode;
    /** `scanner_permission` 일 때만 — false 면 다시 물어도 창이 안 뜬다. 설정으로 보내야 한다 */
    readonly canAskAgain: boolean;
    constructor(code: ScannerCode, 
    /** `scanner_permission` 일 때만 — false 면 다시 물어도 창이 안 뜬다. 설정으로 보내야 한다 */
    canAskAgain?: boolean, options?: {
        cause?: unknown;
    });
}
/** 시험할 때 바꾼다. 앱은 넘기지 않는다 */
export type ScannerDeps = {
    os?: string;
    plugin?: () => {
        scanDocument: (o: object) => Promise<{
            status?: string;
            scannedImages?: string[];
        }>;
    };
    askCamera?: () => Promise<{
        granted: boolean;
        canAskAgain?: boolean;
    }>;
};
/**
 * 스캐너를 연다. 찍은 사진의 **파일 주소**(`file://…`)를 순서대로 준다. 취소하면 `null`.
 *
 * 실패는 {@link ScannerError} 로 던진다. `scanner_unavailable`·`scanner_failed` 면
 * **일반 촬영(`expo-image-picker` 의 `launchCameraAsync`)으로 넘어갈 길을 앱이 준다** — 영테크·총무님 모두 그렇다.
 */
export declare function scanDocument(options?: ScanOptions, deps?: ScannerDeps): Promise<string[] | null>;
/** 오류 코드 → 사용자에게 보일 문구. `maxPages` 는 `scanner_multiple_pages` 문구에 쓴다 */
export declare function scannerMessage(code: string, maxPages?: number): string;
