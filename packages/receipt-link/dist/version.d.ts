/**
 * 이 패키지의 판 — run-end · fails 본문의 `pkg` 로 서버에 간다(2026-11-05 대표님 「저장소가 달라도 패키지 최신 버전 점검」).
 * 서버(jcurve-api)는 공개 저장소의 최신 릴리스와 견줘 낮으면 `receipt_link.pkg_old` 경고와 실패 기록 info.pkg_old 로 남긴다.
 * package.json 의 version 과 같아야 한다(version.test.ts 가 확인).
 */
export declare const PKG_NAME = "receipt-link";
export declare const PKG_VERSION = "1.1.3";
