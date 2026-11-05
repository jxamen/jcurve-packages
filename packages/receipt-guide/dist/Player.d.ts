/**
 * 영수증 올리는 법 재생기 — **저절로 흘러가고, 끝나면 처음부터 다시 돈다**(대표님 10-03 23:17 · 23:51).
 *
 * 미션 「따라 하기」와 같은 틀(캐릭터 말풍선 + 가운데 가짜 화면 + 누를 곳 표시)이다. 직접 누를 필요가 없다:
 * 장면마다 약 2.6초 — 누를 곳이 두껍게 두 번 깜빡이고(껌벅껌벅), 손가락이 가서 톡 누르고(물결),
 * 다음 화면으로 넘어간다. 마지막 장면 뒤에는 첫 장면으로 돌아간다. 아래에는 [지금 올리기] 가 늘 떠 있다.
 * 위에는 작은 장면 막대와 「멈춤/재생」 · 「건너뛰기」(= 바로 올리기)만 둔다. 가짜 화면을 누르면 바로 다음.
 *
 * **움직임 줄이기가 켜져 있어도 저절로 넘어간다** — 대표님 아이폰에서 [다음] 을 계속 눌러야 했다(23:51 「다음다음
 * 내가 눌러야하는거네?」). 그때는 손가락 이동 · 깜빡임 · 물결만 빼고(누를 곳은 굵은 테두리로 고정) 시간만 잰다.
 *
 * 움직임은 **장면 진행 값 p(0 → 1) 하나**로 그린다 — 깜빡임(0~0.58) · 손가락 이동(0.06~0.3) · 누름(0.7~0.84) ·
 * 물결(0.72~0.95) · 알림(0.8~) · 캡처 번쩍(0.62~0.85). 멈추면 p 만 멈추니 화면이 그 순간에 그대로 선다.
 * 투명도 · 이동 · 크기만 쓴다(네이티브 드라이버).
 */
import React from 'react';
import { type GuideApp, type GuideCta, type ReceiptGuide } from './types';
export type PlayerProps = {
    guide: ReceiptGuide;
    /** 글 속 {앱} 자리 — 「영테크 「사진 올리기」」 */
    appName: string;
    onClose: () => void;
    /** [지금 올리기] · 「건너뛰기」 */
    onUpload: () => void;
    /** 처음 한 바퀴를 다 봤다 */
    onDone?: () => void;
    /** 다른 안내로(장면의 link) */
    onSwitch?: (app: GuideApp) => void;
    /** 맨 아래 버튼 — 없으면 [지금 올리기] → onUpload */
    cta?: GuideCta;
};
export declare function Player({ guide, appName, onClose, onUpload, onDone, onSwitch, cta }: PlayerProps): React.JSX.Element;
