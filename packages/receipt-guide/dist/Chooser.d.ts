/**
 * 어떤 영수증인가 고르는 칸 — 영수증 올리기의 **첫 자리**(대표님 10-03 23:25 「선택하게 해야겠네」).
 *
 * 앱(배민 · 쿠팡 …)을 고르면 부르는 앱이 **그 앱 영수증 팝업**을 연다 — 처음이면 올리는 법 안내부터, 아니면 등록 칸만
 * (대표님 10-04 12:24 「배민 누르면 팝업 뜨고 … 처음 눌렀으면 안내가 나오는 거고 아니면 아래 영수증 등록 하는 안내만」).
 * 예전 [영수증 확인 방법] 켜고 끄기는 뺐다 — 안내는 팝업 위 「안내 다시 보기」로 본다.
 * 지난번에 고른 앱이 있으면 맨 위에 [바로 올리기] — 안내를 건너뛰고 곧장 사진첩.
 * 종이 영수증은 안내가 없다 — 부르는 앱의 촬영 · 스캔 버튼을 `paper` 자리에 그대로 넣는다.
 * 연동 칩이 있으면(대표님 계정) 처음엔 여섯 칸(3열 2줄)만 보이고 「더보기 ∨」로 전부 · 「접기 ∧」로 여섯 칸으로 접는다. 「컬리(네이버페이)」 칸은 「컬리」 칩과 겹쳐 뺀다.
 * 종이 영수증은 그때 「전자 영수증」 아래 따로 카드로 내린다.
 */
import React from 'react';
import type { GuideApp, ReceiptPlatform } from './types';
export type ChooserProps = {
    /** 지난번에 고른 곳 — 앱이면 [바로 올리기] 를 낸다 */
    remembered: ReceiptPlatform | null;
    /** 앱 칸을 골랐다 — 부르는 앱이 그 앱 영수증 팝업을 연다 */
    onPick: (app: GuideApp) => void;
    /** [바로 올리기] — 안내 없이 사진첩 */
    onQuick: (app: GuideApp) => void;
    /** 지금 못 올린다(캡슐 없음 등) — [바로 올리기] 만 막는다. 앱 칸은 언제나 팝업을 연다 */
    quickDisabled?: boolean;
    /** 종이 영수증 자리 — 부르는 앱의 [촬영하기] · [사진 올리기] */
    paper: React.ReactNode;
    /** 칸에서 뺄 앱 — 서버가 숨기라고 하면 그 앱 칸과 [바로 올리기] 를 뺀다(없으면 전부) */
    hidden?: GuideApp[];
    /** 주문내역 연동 칩 — 칸 맨 앞에 이 순서로 놓고 「연동 / 미연동」을 붙인다. app 의 안내 칸은 이 칩이 대신하고 색을 빌려 온다(없으면 칸은 지금 그대로) */
    linkChips?: LinkChip[];
    /** 연동 칩을 눌렀다 — 부르는 앱이 동의 · 로그인 창 · (연동됨이면) 고르기를 연다. 안내 칸은 onPick 그대로 */
    onLinkPick?: (key: string, connected: boolean) => void;
    /** 종이 영수증 카드 바로 위에 놓을 안내(연동 칩이 있을 때만) — 찍는 법 안내는 전자 영수증과 상관없다(대표님 11-03 09:31) */
    paperHint?: React.ReactNode;
};
export type LinkChip = {
    key: string;
    app: GuideApp;
    name: string;
    connected: boolean;
};
export declare function Chooser({ remembered, onPick, onQuick, quickDisabled, paper, hidden, linkChips, onLinkPick, paperHint }: ChooserProps): React.JSX.Element;
