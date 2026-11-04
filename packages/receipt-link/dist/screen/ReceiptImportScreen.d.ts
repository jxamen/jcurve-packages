/**
 * 주문 불러오기 화면(패키지 1.1.0 — 첫 앱의 OrderImportView.tsx 를 그대로 옮겼다. 앱마다 다른 것은 config 로 받는다: screen/config.ts).
 * 연동 칩 「주문 불러오기」가 연다. 사이트의 영수증을 주문마다 건건이 읽어(receiptLink/flows.ts 의 사이트별 흐름 + flowDriver.ts) 서버에 올린다.
 * 읽기 웹뷰는 **뒤에서** 돈다(webHostStyle.ts: 보이지 않지만 멈추지 않게 놓는다). 사용자가 보는 것은 이 화면 하나 — 진행 줄과, 읽는 대로 올라가는 주문 목록(ReceiptOrdersSheet).
 * 웹뷰를 보이는 것은 로그인이 필요할 때(흐름이 login 을 내거나 로그인 주소) · 캡차 같은 확인이 필요할 때뿐이다. 끝나면 바로 다시 숨기고 읽기를 이어 간다.
 * 읽은 주문은 importUploader.ts 가 읽는 대로 50건 이하로 올린다(실패는 다음 회차에 다시). 입력란 · 토큰 · 쿠키 · 영수증 주소는 읽지도 올리지도 않는다.
 * 20초 동안 답이 없으면 구동기가 흐름에 시간 초과를 먹이고(다시 확인), 끝내 한 건도 못 읽으면 「못 읽었어요 · 다시 시도 · 사진/종이로 올리기」를 낸다.
 * 쿠팡은 서버 스위치(coupangRead)가 켜져 있을 때만 읽는다 — 꺼져 있거나 서버가 read_disabled 를 주면 읽기를 시작하지 않고 안내만 보인다.
 */
import React from 'react';
import { type ImportResult } from '../importPlan';
import { type LinkPlatform } from '../model';
import type { ReceiptLinkScreenConfig } from './config';
export type ReceiptImportProps = {
    /** 앱이 한 번 만들어 둔 설정(defineReceiptLinkScreen) */
    config: ReceiptLinkScreenConfig;
    platform: LinkPlatform;
    onClose: () => void;
    /** 안전 영역(앱의 useSafeAreaInsets 값) — 없으면 0 */
    insets?: {
        top: number;
        bottom: number;
    };
    /** 쿠팡 읽기 스위치(LinkState.coupangRead). 쿠팡인데 이게 true 가 아니면 읽지 않고 준비 중 안내만 낸다 */
    coupangRead?: boolean;
    /** 호환용(OrderLinkFlow 가 넘긴다). 이 화면이 이미 불러온 주문 목록이라 읽기가 끝나도 부르지 않는다 */
    onFinished?: (r: ImportResult) => void;
    /**
     * 자동 점검(npv2 회원, 홈의 OrderLinkSelftest 가 안 보이게 띄운다) — 전체 1번이 끝나면 못 가져온 줄 하나를 개별로 1번 돌리고,
     * 결과(개수 · 까닭만, 값 없음)를 `[receiptLink] selftest …` 줄로 남긴 뒤 닫는다. 로그인이 필요하면 그 사실만 남기고 닫는다(슬랙대표님요청 16:09)
     */
    selftest?: boolean;
};
export declare function ReceiptImportScreen({ config, platform, onClose, coupangRead, selftest, insets }: ReceiptImportProps): React.JSX.Element;
