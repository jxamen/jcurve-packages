/**
 * 친구 초대 — 코드를 나누고, 받은 코드를 넣는다 (0.4.0, carrot InviteCard · InviteScreen 그대로).
 *
 * 문자 인증이 아니라 **간편 인증**이다(대표님 10-19 22:47 「문자 인증이 아니라 간편 인증이야」).
 * 자격이 없으면 코드를 내주지 않고 「간편 인증하기」 를 보인다 — 누르면 앱의 `onVerify` 가 간편 인증 창을 연다.
 * 지급 · 자격 판정은 서버 · 앱이 한다. 패키지는 값을 그리고 누름을 넘긴다.
 */
import React, { type ReactNode } from 'react';
import { type MissionPageTheme } from './PageFrame';
export type InvitePageProps = {
    /** 내 초대 코드 — 자격이 없으면 안 그린다 */
    code: string;
    /** 자격 없음(간편 인증 · 가입 전) — 코드 대신 안내 · 단추 */
    locked?: boolean;
    /** 자격 없는 이유 — 기본 'verify'(간편 인증). 'signup' 이면 가입 안내로 바뀐다 */
    lockReason?: 'verify' | 'signup';
    /** 「간편 인증하기」 — 앱이 간편 인증 창을 연다. 끝나면 앱이 자격을 다시 읽어 `locked` 를 내린다 */
    onVerify: () => void | Promise<void>;
    /** 「가입하러 가기」 — lockReason='signup' 일 때 */
    onSignup?: () => void;
    /** 간편 인증 창이 열려 있는 동안 단추를 막는다 */
    verifying?: boolean;
    /** 초대한 사람이 받는 P · 친구가 받는 P */
    inviterPoint: number;
    inviteePoint: number;
    /** 확률권 장수(있으면 줄 아래 「확률권 n장」) */
    inviterBoost?: number;
    inviteeBoost?: number;
    /** 초대 성공한 친구 수 · 아직 받지 않은 친구 수 */
    invited: number;
    waiting: number;
    /** 이미 받은 초대 코드를 넣었나 */
    joined?: boolean;
    /** 초대 보상을 받았나 */
    rewarded?: boolean;
    /** 받은 코드 넣기 — 결과 문구(message)를 돌려주면 그대로 보인다 */
    onJoin: (code: string) => Promise<{
        ok: boolean;
        message?: string;
    }> | {
        ok: boolean;
        message?: string;
    };
    /** 「링크 복사」 「카톡으로 공유하기」 — 앱이 공유 시트를 연다 */
    onShare: () => void;
    onBack: () => void;
    /** (0.4.13) iOS 왼쪽 가장자리를 오른쪽으로 밀면 onBack(기본 true). 안드로이드는 그대로. 이미 앱에서 밀기를 감싼 화면은 false */
    swipeBack?: boolean;
    /** 안내 문장 — 기본은 carrot 안내 4줄(기기 · 국가 중립) */
    notice?: readonly string[];
    title?: string;
    theme?: Partial<MissionPageTheme>;
    footer?: ReactNode;
};
export declare function InvitePage({ code, locked, lockReason, onVerify, onSignup, verifying, inviterPoint, inviteePoint, inviterBoost, inviteeBoost, invited, waiting, joined, rewarded, onJoin, onShare, onBack, swipeBack, notice, title, theme: themeIn, footer }: InvitePageProps): React.JSX.Element;
