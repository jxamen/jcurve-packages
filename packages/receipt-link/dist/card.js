"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LOGIN_URL = void 0;
exports.loadCardState = loadCardState;
exports.linkStatus = linkStatus;
exports.consentLines = consentLines;
const model_1 = require("./model");
/** 카드 상태 — 서버 스위치가 꺼졌거나(404) 읽기가 실패하면 null → 카드를 그리지 않는다 */
async function loadCardState(client) {
    try {
        return await client.fetchLinkState();
    }
    catch {
        return null;
    }
}
/** 사이트의 공식 로그인 페이지 — 회원이 여기서 직접 로그인한다 */
exports.LOGIN_URL = {
    naver: 'https://nid.naver.com/nidlogin.login',
    coupang: 'https://login.coupang.com/login/login.pang',
    musinsa: 'https://www.musinsa.com/auth/login',
    kurly: 'https://www.kurly.com/member/login',
};
/** 한 줄 상태 — 「연결 안 됨」 또는 「연결됨 · 동의한 날」 */
function linkStatus(s, p) {
    if (!(0, model_1.isConnected)(s, p))
        return '연결 안 됨';
    return '연결됨 · ' + (s.links[p]?.linkedAt ?? '').slice(0, 10).replace(/-/g, '.');
}
/** 동의 화면 문구 — 기획서 §6.1 초안(법무 최종 문안 전). 가져오는 칸 · 로그인 정보 · 철회를 그대로 적는다 */
function consentLines(p, app = { appName: '앱' }) {
    const name = model_1.LINK_LABEL[p];
    const who = app.appName;
    return [
        `${who}가 회원님의 ${name} 주문내역(주문번호 · 주문일시 · 판매처 · 상품명 · 결제금액 · 결제수단)을 읽어 영수증 보상으로 드리려면 동의가 필요해요.`,
        `로그인은 ${name} 로그인 화면에서 직접 해요. ${who}는 아이디와 비밀번호를 보지도, 저장하지도 않아요.`,
        `로그인 정보는 회원님 휴대폰 안에만 있고, ${who} 서버로 보내지 않아요.`,
        app.viaDeveloperServer
            ? '주문내역은 앱 서버를 거쳐 연동 서버에 저장돼요. 저장하는 것은 주문내역과 「연결한 시각」뿐이고, 수취인 · 주소 · 전화번호 · 카드번호는 읽지 않아요.'
            : '서버에는 주문내역과 「연결한 시각」만 저장해요. 수취인 · 주소 · 전화번호 · 카드번호는 읽지 않아요.',
        '언제든 「연결 끊기」로 그만둘 수 있어요.',
        `${name} 이용약관에 따라 자동으로 정보를 읽는 것은 제한될 수 있어요. 계정 이용에 불이익이 생길 수 있어요. 동의는 선택이에요.`,
    ];
}
