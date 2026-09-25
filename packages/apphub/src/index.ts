/**
 * `@jcurve/apphub` — 리워드 앱 공용 「앱 모아보기」.
 *
 * 하단 버튼(입구)은 앱마다 그 앱답게 따로 달고, **눌러서 나오는 내용은 이 패키지 하나**를 쓴다.
 * 목록의 원본은 어드민 「앱관리」이고 서버가 `{API_BASE}/family` 로 내준다.
 */
export { AppHubSheet, type AppHubSheetProps, type AppHubTheme } from './AppHubSheet';
export { familyRows, tintOf, type FamilyApp, type FamilyRow } from './pick';
export { storeLoader, hubLoader, parseHub, DEFAULT_SECTION, type Loader, type Hub, type FamilySection } from './load';
export { useAppHub, type UseAppHub } from './hook';
