/**
 * `@jcurve/scanner` — 리워드 앱이 **같이 쓰는 문서 스캐너**.
 *
 * 영수증·서류를 찍으면 테두리를 잡아 자르고 반듯하게 편 사진 파일을 준다.
 * **네이티브 모듈이라 새 스토어 빌드가 있어야 한다 — OTA 로는 안 들어간다.**
 *
 * ```ts
 * import { scanDocument, scannerMessage, ScannerError } from '@jcurve/scanner';
 *
 * try {
 *   const pages = await scanDocument({ maxPages: 1 });   // 취소하면 null
 *   if (pages) use(pages[0]);                            // 'file:///…/scan.jpg'
 * } catch (e) {
 *   say(scannerMessage((e as ScannerError).code));       // 실패면 일반 촬영 버튼을 보인다
 * }
 * ```
 *
 * OCR 에 넘길 때는 `@jcurve/ocr` 의 `preparePhoto({ uri })` 를 거친다.
 */
export { scanDocument, scannerMessage, ScannerError } from './scanner';
export type { ScanOptions, ScannerCode, ScannerDeps } from './scanner';
