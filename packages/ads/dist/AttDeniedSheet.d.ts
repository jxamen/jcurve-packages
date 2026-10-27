import React, { type ReactNode } from 'react';
import { type AttDeniedTexts, type AttPrimerTexts, type AttSheetTexts, type AttStorage } from './attSheet';
/**
 * ATT 안내 화면 — 앱 루트에 한 번 붙인다(`<AttDeniedSheet storage={AsyncStorage} />`). **붙이는 것만으로는 아무것도 뜨지 않는다.**
 * `ads.requestTracking()` · `ensureTrackingBeforeOfferwall()` 이 부를 때만 두 가지 중 하나가 열린다. 둘 다 화면 가운데 카드다.
 *
 * ① 중립 안내(`primer`) — 시스템 ATT 창 바로 앞. 상태가 미정일 때만, 한 번, 버튼 「계속」 하나. 누르면 곧바로 시스템 창.
 *    닫기 · 건너뛰기가 없다(건너뛰고 다시 묻지 않는다). 시스템 창을 흉내 내지 않는다.
 * ② 추적이 꺼져 있을 때의 팝업(`denied`, 1.9.13) — 사용자가 오퍼월/참여형 미션을 눌러 `ensureTrackingBeforeOfferwall` 이 불렸을 때만,
 *    하루 한 번. 「설정 열기」(설정 앱, 돌아오면 이어서) · 「그냥 보기」(바로 이어서) — **둘 다 오퍼월 진입을 막지 않는다.**
 * 앱을 켤 때 · 홈에서 스스로 열리는 일은 없다. iOS 가 아니면 아무것도 그리지 않는다. 안 뜨는 경우에도 던지지 않는다.
 */
export type AttSheetTheme = {
    background?: string;
    text?: string;
    subText?: string;
    /** 「계속」 버튼 */
    primary?: string;
    primaryText?: string;
    overlay?: string;
};
/**
 * (1.9.14) 앱이 자기 팝업 모양으로 그릴 때 받는 값. 문구 · 버튼 · 동작(하루 한 번 · 진입 안 막음)은 패키지가 정하고 **모양만** 앱 것이다.
 * - `primer`: 시스템 창 앞 중립 안내 — 버튼 하나(「계속」). 닫기 · 건너뛰기 버튼을 만들지 않는다.
 * - `denied`: 추적이 꺼져 있을 때 — 버튼 둘(「그냥 보기」 · 「설정 열기」, 이 순서). 같은 비중으로 그린다.
 * 버튼의 `onPress` 를 그대로 부르면 된다(안내를 닫고 이어서 간다).
 */
export type AttPopupRenderProps = {
    kind: 'primer' | 'denied';
    title: string;
    body: string;
    buttons: Array<{
        label: string;
        onPress: () => void;
    }>;
};
export type AttDeniedSheetProps = {
    /** 1.9.13 부터 쓰이지 않는다(단계 시트에서 앱 이름을 넣던 자리 — 옛 호출 코드가 그대로 컴파일되도록 남김) */
    appName?: string;
    theme?: AttSheetTheme;
    /** 가운데 팝업을 띄운 날을 적어 둘 곳(예 AsyncStorage) — 넘기면 「하루 한 번」이 앱을 껐다 켜도 지켜진다. 없으면 메모리(껐다 켜면 잊는다) */
    storage?: AttStorage;
    /** 1.9.13 부터 쓰이지 않는다(옛 단계 시트 문구 덮어쓰기) */
    texts?: Partial<AttSheetTexts>;
    /** 시스템 창 앞 중립 안내 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_PRIMER_TEXTS` */
    primerTexts?: Partial<AttPrimerTexts>;
    /** 추적이 꺼져 있을 때의 팝업 문구 덮어쓰기(선택) — 빠진 항목은 `ATT_DENIED_TEXTS` */
    deniedTexts?: Partial<AttDeniedTexts>;
    /**
     * (1.9.14) 앱이 자기 팝업으로 그린다(선택) — 안내가 열려 있는 동안에만 불리고, 돌려준 요소(보통 앱의 Modal 팝업)를 그린다. 안 주면 기본 카드.
     * 훅을 쓰려면 함수 안에서 직접 쓰지 말고 컴포넌트를 돌려준다: `renderPopup={(p) => <AppPopup {...p} />}`.
     */
    renderPopup?: (p: AttPopupRenderProps) => ReactNode;
};
/** 안내가 사라지는 동안(페이드) — 이 뒤에 시스템 창 · 오퍼월 화면을 올려야 iOS 가 겹쳐서 놓치지 않는다 */
export declare const DISMISS_MS = 400;
/** (1.9.15) 카드 위아래 여백 — 노치 · 다이내믹 아일랜드(위 ~59) · 홈 인디케이터(아래 ~34) 밖에 카드가 머물게 한다. 카드는 가운데 정렬이라 짧은 글에서는 모양이 안 바뀐다 */
export declare const CARD_EDGE = 64;
export declare function AttDeniedSheet({ theme, storage, primerTexts, deniedTexts, renderPopup }: AttDeniedSheetProps): React.FunctionComponentElement<React.FragmentProps> | null;
