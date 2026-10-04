/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 **바로 그 앱 영수증 올리기(사진첩)** — 대표님 10-04 11:52 「이 화면에선 해당 플랫폼별 바로 영수증 등록하게 해줘」.
 * 올리는 법 안내는 [영수증 확인 방법] 을 누른 뒤 앱을 고를 때만(「영수증 확인 방법 버튼 넣고 누르면 안내가 나오게」).
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 */
import React from 'react';
import type { GuideApp, ReceiptPlatform } from './types';
export type ChooserProps = {
    /** 지난번에 고른 곳 — 앱이면 [바로 올리기] 를 낸다 */
    remembered: ReceiptPlatform | null;
    /** [영수증 확인 방법] 을 켠 뒤 앱을 골랐다 — 안내를 연다 */
    onGuide: (app: GuideApp) => void;
    /**
     * 앱을 골랐다 — 바로 올리기(사진첩 · 캡슐이 없으면 부르는 앱이 캡슐 받기부터).
     * (0.3.0) **주지 않으면 예전처럼** 앱 칸이 곧장 안내(onGuide)를 열고 [영수증 확인 방법] 버튼도 없다 — 다른 앱이 깨지지 않게.
     */
    onPick?: (app: GuideApp) => void;
    /** [바로 올리기] — 안내 없이 사진첩 */
    onQuick: (app: GuideApp) => void;
    /** 지금 못 올린다(캡슐 없음 등) — [바로 올리기] 만 막는다. 안내는 언제나 볼 수 있다 */
    quickDisabled?: boolean;
    /** 종이 영수증 자리 — 부르는 앱의 [촬영하기] · [사진 올리기] */
    paper: React.ReactNode;
};
export declare function Chooser({ remembered, onGuide, onPick, onQuick, quickDisabled, paper }: ChooserProps): React.JSX.Element;
