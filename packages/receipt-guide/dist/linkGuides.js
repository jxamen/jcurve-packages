"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markLinkSeen = void 0;
exports.linkGuide = linkGuide;
exports.parseLinkSeen = parseLinkSeen;
/**
 * 전자 영수증(주문내역 연동) 처음 쓰는 법 — 칩마다 그 곳 전용(대표님 11-03 07:55 「네이버 버튼 누르면 나오고 쿠팡 … 무신사 버튼 누르면 나오게」).
 * 배민 안내와 같은 재생기 · 같은 가짜 화면(막대 · 카드 · 글자)으로 그린다. 로그인 화면은 A32 에서 「로그인 창 열기」로 연
 * 실제 웹페이지(11-03 08:01 캡처)를 보고 본떴다 — 캡처 그림 자체는 넣지 않는다(회원 주문 · 계정이 들어가므로).
 * 단계: ① 칩 → 동의 → 그 곳 로그인 ② 주문 불러오기 ③ 광고 보고 적립. RN 에 기대지 않는다(노드 시험이 읽는다).
 */
const data_1 = require("./data");
const NAME = { naver: '네이버', coupang: '쿠팡', kurly: '마켓컬리', musinsa: '무신사', daiso: '다이소몰', oliveyoung: '올리브영' };
const APP = { naver: 'naverpay', coupang: 'coupang', kurly: 'kurly', musinsa: 'musinsa', daiso: 'daiso', oliveyoung: 'oliveyoung' };
const ACCENT = { naver: '#03C75A', coupang: '#E52528', kurly: '#5F0080', musinsa: '#2B2B2B', daiso: data_1.LINK_ONLY_ACCENT.daiso, oliveyoung: data_1.LINK_ONLY_ACCENT.oliveyoung };
/** 모든 회원에게 보이는 칩 — 다이소몰 · 올리브영은 서버가 허용한 회원에게만 붙는다(1.1.0, 가짜 화면에는 누른 칩을 덧붙여 그린다) */
const CHIPS = ['naver', 'coupang', 'kurly', 'musinsa'];
const SITES = [...CHIPS, 'daiso', 'oliveyoung'];
/** 그 곳 로그인 화면(실제 페이지를 본뜬 것) — 마지막 장면의 「로그인」이 누를 곳 */
function loginSteps(site) {
    const title = `${NAME[site]} 로그인`;
    const sub = '아이디 · 비밀번호는 {앱}이 보지도 저장하지도 않아요';
    switch (site) {
        case 'naver':
            return [{ no: 1, say: '네이버 로그인 화면에서 직접 로그인해요', sub, nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'section', title: 'NAVER' },
                        { type: 'rows', rows: [['아이디', ''], ['비밀번호', '']] }, { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] }];
        case 'coupang':
            return [{ no: 1, say: '쿠팡 로그인 화면에서 직접 로그인해요', sub, nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'tabs', items: ['이메일 로그인', '휴대폰번호 로그인'], on: 0 },
                        { type: 'rows', rows: [['아이디(이메일)', ''], ['비밀번호', '']] }, { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] }];
        case 'kurly':
            return [
                { no: 1, say: '「로그인하셔야 …」 창이 뜨면 「확인」을 눌러요', nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'section', title: '로그인하셔야 본 서비스를 이용하실 수 있습니다.' },
                        { type: 'buttons', items: ['확인'], tap: 0 },
                    ] },
                { no: 1, say: '마켓컬리 로그인 화면에서 직접 로그인해요', sub, nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'rows', rows: [['아이디', ''], ['비밀번호', '']] },
                        { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] },
            ];
        case 'daiso':
            return [{ no: 1, say: '다이소몰 로그인 화면에서 직접 로그인해요', sub: '카카오 · 네이버로 시작해도 돼요. ' + sub, nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'section', title: '다이소몰' },
                        { type: 'rows', rows: [['아이디', ''], ['비밀번호', '']] }, { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] }];
        case 'oliveyoung':
            return [{ no: 1, say: '올리브영 로그인 화면에서 직접 로그인해요', sub: '카카오 · 네이버 · Apple 로 시작해도 돼요. ' + sub, nodes: [
                        { type: 'header', title, right: '닫기' }, { type: 'section', title: 'OLIVE YOUNG' },
                        { type: 'rows', rows: [['아이디', ''], ['비밀번호', '']] }, { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] }];
        case 'musinsa':
        default:
            return [{ no: 1, say: '무신사 로그인 화면에서 직접 로그인해요', sub: '카카오 · Apple 로 시작해도 돼요. ' + sub, nodes: [
                        { type: 'header', title: '로그인/회원가입', back: true }, { type: 'section', title: 'MUSINSA' },
                        { type: 'rows', rows: [['통합계정 또는 이메일', ''], ['비밀번호', '']] }, { type: 'buttons', items: ['로그인'], solid: 0, tap: 0 },
                    ] }];
    }
}
const chooser = (site, tap) => {
    const chips = CHIPS.includes(site) ? CHIPS : [...CHIPS, site];
    return [
        { type: 'header', title: '영수증 올리기' },
        { type: 'section', title: '전자 영수증' },
        { type: 'chips', items: chips.map((c) => NAME[c]), ...(tap ? { tap: chips.indexOf(site) } : {}) },
    ];
};
function linkGuide(site) {
    const name = NAME[site];
    return {
        app: APP[site],
        name,
        accent: ACCENT[site],
        summary: [
            `{앱} 「영수증 올리기」 → 전자 영수증 「${name}」 → 「동의하고 로그인」 → ${name} 로그인`,
            `「${name} 연동됨」 → 「주문 불러오기」 — 주문을 읽어 영수증을 가져와요`,
            '불러온 주문에서 「광고 보고 적립」',
        ],
        doneSub: '로그인은 처음 한 번만 하면 돼요',
        seller: '영수증을 가져온 주문만 적립할 수 있어요',
        steps: [
            { no: 1, say: `전자 영수증에서 「${name}」을 눌러요`, nodes: [...chooser(site, true), { type: 'bars', n: 3 }] },
            { no: 1, say: '읽는 칸을 확인하고 「동의하고 로그인」을 눌러요', sub: '주문번호 · 일시 · 판매처 · 상품명 · 금액 · 결제수단만 읽어요', nodes: [
                    { type: 'header', title: `${name} 주문내역 연결` }, { type: 'bars', n: 4 },
                    { type: 'buttons', items: ['동의하고 로그인'], solid: 0, tap: 0 },
                ] },
            ...loginSteps(site),
            { no: 2, say: `「${name} 연동됨」 창에서 「주문 불러오기」를 눌러요`, nodes: [
                    ...chooser(site, false), { type: 'menu', items: ['주문 불러오기', '불러온 주문 보기', '사용 방법 보기', '연동 해제'], tap: 0 },
                ] },
            { no: 2, say: '주문을 읽는 동안 잠깐 기다려요', sub: '로그인이 풀렸으면 로그인 화면이 다시 떠요', toast: '다 가져왔어요', nodes: [
                    { type: 'header', title: `${name} 주문 불러오기` }, { type: 'bars', n: 4 },
                ] },
            { no: 3, say: '불러온 주문에서 「광고 보고 적립」을 눌러요', result: true, nodes: [
                    { type: 'header', title: '불러온 주문', close: true },
                    { type: 'order', shop: '○○상점', meta: '2026.10.20 · 카드영수증', amount: '18,500원', button: '광고 보고 적립', small: true, tap: 'button' },
                    { type: 'order', shop: '△△마켓', meta: '2026.10.12 · 구매영수증', amount: '9,000원', button: '광고 보고 적립', small: true, dim: true },
                ] },
        ],
    };
}
/** 이 곳 가이드를 본 적이 있나 — 저장 값은 본 곳 목록(JSON). 틀린 값이면 아무것도 안 봤다 */
function parseLinkSeen(raw) {
    try {
        const v = JSON.parse(raw ?? '[]');
        return Array.isArray(v) ? v.filter((x) => typeof x === 'string' && SITES.includes(x)) : [];
    }
    catch {
        return [];
    }
}
const markLinkSeen = (seen, site) => (seen.includes(site) ? [...seen] : [...seen, site]);
exports.markLinkSeen = markLinkSeen;
