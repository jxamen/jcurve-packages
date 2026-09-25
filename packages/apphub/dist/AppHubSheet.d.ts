/**
 * 「앱 모아보기」 — 계열 앱을 한 줄씩 보여 주고, 누르면 그 기기의 스토어로 보낸다.
 *
 * **이 화면이 패키지에 들어 있는 이유**: 앱마다 따로 만들면 앱마다 다른 말을 하게 된다
 * (2026-09-20 지시: 「이걸 다른 앱에도 다 넣을 거니까 패키지 형태로 만들어 줘, 누르면
 * 나오는 내용이 같게끔」). 들어가는 입구(하단 버튼)는 앱마다 그 앱답게 따로 달고,
 * **눌러서 나오는 내용은 여기 한 곳에서만 고친다.**
 *
 * 목록의 원본은 어드민 「앱관리」다 — 서버가 `{base}/family` 로 내준다. 그래서 새 앱이
 * 늘어도 어느 앱도 다시 빌드하지 않는다.
 *
 * 색만 앱에서 받는다(`theme`). 문구 · 순서 · 동작은 받지 않는다 — 그걸 열어 두면 앱마다
 * 달라지고, 이 패키지를 만든 이유가 없어진다.
 */
import React from 'react';
import { type FamilyApp } from './pick';
import { type FamilySection, type Loader } from './load';
export type AppHubTheme = {
    /** 화면 바탕 */
    bg?: string;
    /** 카드 바탕 */
    card?: string;
    /** 가르는 선 */
    line?: string;
    text?: string;
    sub?: string;
    dim?: string;
    /** 「받으러 가기」 알약 */
    accent?: string;
    accentSoft?: string;
};
export type AppHubSheetProps = {
    open: boolean;
    onClose: () => void;
    /** 앱 API 주소 — 슬러그까지 들어간 그대로(예: `https://api.j-curve.co.kr/v1/carrotcash`) */
    base?: string;
    /** 앱 공개 키(`X-App-Token`) — 서버가 어느 앱이 묻는지 알아야 자기 앱을 뺄 수 있다 */
    token?: string;
    /** 앱이 자기 통로로 직접 받아 오고 싶을 때 — 주면 `base` 대신 이것을 쓴다 */
    load?: Loader;
    theme?: AppHubTheme;
    /** `useAppHub` 로 이미 받은 목록 — 주면 다시 부르지 않는다(2026-09-25) */
    items?: FamilyApp[] | null;
    /** 어드민이 정한 제목 · 설명 — null 이면 기존 문구 */
    section?: FamilySection;
    /** 계측 — 앱의 `track()` 을 그대로 넘긴다(패키지는 아무 데도 보내지 않는다) */
    onEvent?: (name: string, props?: Record<string, string | number | boolean | null>) => void;
};
export declare function AppHubSheet({ open, onClose, base, token, load, theme, items, section, onEvent }: AppHubSheetProps): React.JSX.Element | null;
