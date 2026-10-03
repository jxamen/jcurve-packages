/**
 * 영수증 올리는 법 재생기 — **저절로 흘러간다**(대표님 10-03 23:17).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 다른 점은
 * 직접 누르지 않아도 된다는 것: 장면마다 약 3초 동안 손가락이 누를 곳으로 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 위에 몇 번째 장면인지 막대가 차오른다. [멈춤] · [이전] · [다음] 이 있고,
 * 가짜 화면을 누르면 바로 다음으로 간다.
 *
 * 모든 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 손가락 이동(0.12~0.38) · 누름(0.42~0.56) ·
 * 물결(0.44~0.66) · 알림(0.55~) · 캡처 번쩍(0.4~0.6). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 *
 * 움직임 줄이기가 켜져 있으면 저절로 넘기지 않는다 — 손가락이 누를 곳에 멈춘 장면을 보여 주고 [다음] 으로 넘긴다.
 */
import React from 'react';
import { type GuideApp, type ReceiptGuide } from './types';
export type PlayerProps = {
    guide: ReceiptGuide;
    /** 글 속 {앱} 자리 — 「영테크 「사진 올리기」」 */
    appName: string;
    onClose: () => void;
    /** 끝 카드 「지금 올리기」 */
    onUpload: () => void;
    /** 끝 카드에 닿았다(한 번 볼 때마다) */
    onDone?: () => void;
    /** 다른 안내로(장면의 link) */
    onSwitch?: (app: GuideApp) => void;
    /** 지금은 못 올리는 까닭(캡슐 없음 · 바구니 가득) — 있으면 「지금 올리기」 대신 [닫기] */
    blockedNote?: string;
};
export declare function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, blockedNote }: PlayerProps): React.JSX.Element;
