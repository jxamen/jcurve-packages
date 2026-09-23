"use strict";
/**
 * 문서 스캐너 — 테두리를 잡아 자르고 반듯하게 편 사진 파일을 받는다.
 *
 * 부품은 `react-native-document-scanner-plugin` 2.0.4 다. 안드로이드는 구글 ML Kit 문서 스캐너
 * (Play 서비스 화면), 아이폰은 VisionKit 이다. 영테크 `src/receipt/scanner.ts` 와 총무님
 * `RecordScreen.tsx` 의 호출을 합쳐 떼어 냈다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScannerError = void 0;
exports.scanDocument = scanDocument;
exports.scannerMessage = scannerMessage;
class ScannerError extends Error {
    constructor(code, 
    /** `scanner_permission` 일 때만 — false 면 다시 물어도 창이 안 뜬다. 설정으로 보내야 한다 */
    canAskAgain = true, options) {
        // 메시지를 코드와 같게 둔다 — 영테크가 `e.message === 'scanner_multiple_pages'` 로 가른다
        super(code);
        this.code = code;
        this.canAskAgain = canAskAgain;
        /** 네이티브가 던진 원래 오류 — 로그에 남길 때 쓴다 */
        this.cause = options?.cause;
        this.name = 'ScannerError';
    }
}
exports.ScannerError = ScannerError;
/**
 * 스캐너를 연다. 찍은 사진의 **파일 주소**(`file://…`)를 순서대로 준다. 취소하면 `null`.
 *
 * 실패는 {@link ScannerError} 로 던진다. `scanner_unavailable`·`scanner_failed` 면
 * **일반 촬영(`expo-image-picker` 의 `launchCameraAsync`)으로 넘어갈 길을 앱이 준다** — 영테크·총무님 모두 그렇다.
 */
async function scanDocument(options = {}, deps = {}) {
    const os = deps.os ?? platformOS();
    if (os === 'web')
        throw new ScannerError('scanner_unavailable');
    const maxPages = Math.max(1, Math.floor(options.maxPages ?? 1));
    const quality = Math.min(100, Math.max(0, Math.round(options.quality ?? 90)));
    /*
     | 카메라 권한은 **아이폰만** 묻는다. VisionKit 은 앱 권한이 필요하고, 안드로이드 스캐너는 구글 Play 서비스
     | 화면이라 앱 권한이 필요 없다. 안드로이드에서 묻다가 「이번만 허용」을 고르면 스캐너가 떠 있는 동안
     | 권한이 거둬져 **앱이 죽고 찍은 사진을 잃었다**(2026-09-22 총무님, 갤럭시 A32 — one-time permission revoked).
     */
    if (os === 'ios') {
        const ask = deps.askCamera ?? loadAskCamera();
        if (ask) {
            const perm = await ask();
            if (!perm.granted)
                throw new ScannerError('scanner_permission', perm.canAskAgain !== false);
        }
    }
    // 지연 require — 네이티브 모듈이 없는 빌드에서 정적 import 는 앱 시작을 죽인다(플러그인이 getEnforcing 으로 찾는다)
    let plugin;
    try {
        plugin = (deps.plugin ?? loadPlugin)();
    }
    catch (cause) {
        throw new ScannerError('scanner_unavailable', true, { cause });
    }
    let result;
    try {
        result = await plugin.scanDocument({ maxNumDocuments: maxPages, croppedImageQuality: quality, responseType: 'imageFilePath' });
    }
    catch (cause) {
        throw new ScannerError('scanner_failed', true, { cause });
    }
    if (result?.status === 'cancel')
        return null;
    const pages = (result?.scannedImages ?? []).filter((p) => typeof p === 'string' && p !== '');
    if (!pages.length)
        throw new ScannerError('scanner_empty');
    // VisionKit 은 장 수를 못 막는다. 넘친 것을 조용히 버리면 영수증을 잃는다 — 다시 찍게 한다
    if (pages.length > maxPages && options.extraPages !== 'keep')
        throw new ScannerError('scanner_multiple_pages');
    return pages;
}
/** 오류 코드 → 사용자에게 보일 문구. `maxPages` 는 `scanner_multiple_pages` 문구에 쓴다 */
function scannerMessage(code, maxPages = 1) {
    switch (code) {
        case 'scanner_permission': return '카메라를 쓸 수 있게 허락해 주세요. 설정에서 바꿀 수 있어요';
        case 'scanner_multiple_pages': return maxPages <= 1
            ? '한 장씩 찍어 주세요. 한 장만 찍고 다시 완료해 주세요'
            : `${maxPages}장까지 찍을 수 있어요. 다시 찍어 주세요`;
        case 'scanner_unavailable':
        case 'scanner_failed':
        case 'scanner_empty':
        default: return '자동 스캔을 열지 못했어요. 다시 해 보거나 일반 촬영으로 찍어 주세요';
    }
}
function platformOS() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        return require('react-native').Platform.OS;
    }
    catch {
        return 'web';
    }
}
function loadPlugin() {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('react-native-document-scanner-plugin');
    return mod.default ?? mod;
}
function loadAskCamera() {
    try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const picker = require('expo-image-picker');
        return () => picker.requestCameraPermissionsAsync();
    }
    catch {
        return null; // 없으면 VisionKit 이 처음 열 때 스스로 묻는다 — 거절하면 검은 화면이라 넣어 두는 것이 맞다
    }
}
