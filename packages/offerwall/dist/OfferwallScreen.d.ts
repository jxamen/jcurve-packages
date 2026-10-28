import type { ReactElement } from 'react';
/** 「찬스2」 같은 전체 화면 제공자 칸의 글. 앱이 `launcherCopy` 로 일부만 바꿀 수 있다. */
export type LauncherCopy = {
    title: string;
    body: string;
    open: string;
    retry: string;
    error: string;
};
export declare const DEFAULT_LAUNCHER_COPY: LauncherCopy;
export type OfferwallScreenProps = {
    usn: string | null;
    onClose: () => void;
    onRetry: () => void;
    loadingColor?: string;
    /** Only pass a top inset when the host has not already applied its safe area. */
    topInset?: number;
    /** 0.5.0 — 쓸 수 있는 제공자가 둘 이상일 때만 위쪽에 「찬스1 · 찬스2」 탭이 생긴다(하나뿐이면 예전 화면 그대로). 선택된 탭 글자 · 밑줄 색. */
    tabColor?: string;
    /** 0.5.0 — 탭 아래 작은 글씨로 제공자 이름을 보인다. 기본 꺼짐(이용자에게는 「찬스1 · 찬스2」만). */
    showProviderNames?: boolean;
    /** 0.5.0 — 전체 화면 제공자 탭을 누르면 바로 연다(기본 true). false 면 칸의 「찬스 열기」 단추를 눌러야 열린다. */
    autoOpenLauncher?: boolean;
    /** 0.5.0 — 제공자에 알려 줄 화면 표시 이름(선택). 닉네임이 드러나면 안 되면 가려서(우리****) 준다. */
    displayName?: string;
    launcherCopy?: Partial<LauncherCopy>;
};
export declare const OFFERWALL_SCREEN_MARK = "jcurve-offerwall-screen:headerless-v1";
/** 0.5.0 번들 표식 — 배포 검사가 「찬스1 · 찬스2 탭이 들어 있는 판」인지 문자열로 본다. */
export declare const OFFERWALL_CHANCE_TABS_MARK = "jcurve-offerwall-chance-tabs:v1";
/** Until the tab row has been measured, its height is taken as this (44 minHeight + the 1px border + the 2px selected line fits inside the 44). */
export declare const CHANCE_TAB_FALLBACK_HEIGHT = 45;
/** How long the AdPopcorn wall may take to report that it has loaded before the screen says 「찬스를 불러오지 못했어요」. */
export declare const CLASSIC_WALL_TIMEOUT_MS = 20000;
/**
 * 0.6.4 — when the 20 s load timer may run: only with a member (`usn`) to load for, only while the wall is on screen (not behind the other 찬스 tab), only while it has neither
 * loaded nor failed. With no member yet, or while the wall is hidden, nothing is wrong with the wall, so the clock is stopped; it starts again from zero when the member arrives
 * or the wall is shown. (Before, the clock ran through both and the error screen could appear before the wall ever had a chance.)
 */
export declare function wallTimerShouldRun({ usn, hidden, loaded, error }: {
    usn: string | null;
    hidden: boolean;
    loaded: boolean;
    error: boolean;
}): boolean;
/**
 * 0.6.4 — the wall is shown again and is in the error state (it failed, or its load could not be told while it was hidden): try once on its own. At most one automatic
 * try per error (`retried`: set by it and by the 「다시 시도」 button, cleared by a successful load or a new member); after that only the button retries.
 */
export declare function wallAutoRetryOnShow({ wasHidden, hidden, error, retried }: {
    wasHidden: boolean;
    hidden: boolean;
    error: boolean;
    retried: boolean;
}): boolean;
/**
 * Tab content: no host header. The host owns status-bar and bottom-tab safe areas.
 *
 * 0.5.0 — 찬스 제공자(`chanceProviders()`)가 둘 이상이면 위쪽에 「찬스1 · 찬스2」 탭이 생긴다: 1 = 이 화면(애드팝콘), 2 = 스냅플레이처럼 전체 화면을 여는 SDK(탭을 누르면 열고,
 * 닫고 돌아오면 「다시 열기」 칸이 보인다). 쓸 수 있는 제공자가 하나뿐이면(스냅플레이 모듈이 없는 옛 빌드 · 서버 설정이 아직 없음) 탭도 오류도 없이 예전 화면 그대로다.
 * 애드팝콘 화면은 탭을 오가도 다시 불러오지 않고 그대로 둔다(숨기기만).
 */
export declare function OfferwallScreen({ usn, onClose, onRetry, loadingColor, topInset, tabColor, showProviderNames, autoOpenLauncher, displayName, launcherCopy }: OfferwallScreenProps): ReactElement;
