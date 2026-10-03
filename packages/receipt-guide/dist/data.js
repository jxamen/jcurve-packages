"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TWO_SAME_ORDER = exports.TWO_SHOT = exports.PLATFORM_ORDER = exports.GUIDES = void 0;
exports.guideOf = guideOf;
exports.isPlatform = isPlatform;
exports.platformName = platformName;
exports.pickLimit = pickLimit;
exports.needsTwo = needsTwo;
/* ── 함께 쓰는 장면 ── */
/** 마지막 장면 — {앱} 「사진 올리기」로 사진첩에서 고른다. pick 이 둘이면 여러 장 */
const upload = (say, sub, pick = [0]) => ({
    no: 0, say, sub, nodes: [{ type: 'header', title: '사진첩', close: true }, { type: 'album', pick }],
});
/** 번호를 붙인다 — upload() 는 번호를 모르니 마지막에 채운다 */
const last = (no, step) => ({ ...step, no });
/* ── 배민 — 「저장하기」로 사진첩에 이미지가 들어간다(1장) ── */
const BAEMIN_NAV = ['홈', '검색', '찜', '주문내역', '마이'];
const baemin = {
    app: 'baemin',
    name: '배민',
    accent: '#2AC1BC',
    summary: [
        '아래 탭 「주문내역」 → 「배달·픽업」 탭 → 주문 카드 오른쪽 위 「주문상세」',
        '「주문상세」 화면 위 칩 「결제 정보」',
        '결제 정보 아래 「카드영수증」 버튼',
        '「카드영수증」 화면(주문금액 탭) 아래 「저장하기」 — 저장한 이미지가 사진첩에 들어가요',
        '{앱} 「사진 올리기」로 그 이미지 고르기',
    ],
    doneSub: '사진첩에 저장한 카드영수증을 고르면 돼요',
    seller: '판매자 정보(상호 · 사업자번호)까지 보이게 저장해요',
    steps: [
        {
            no: 1, say: '아래 탭 「주문내역」을 눌러요',
            nodes: [{ type: 'chips', items: ['배달', '포장', '장보기'], on: 0 }, { type: 'bars', n: 6 }, { type: 'nav', items: BAEMIN_NAV, on: 0, tap: 3 }],
        },
        {
            no: 1, say: '「배달·픽업」 탭을 골라요',
            nodes: [
                { type: 'header', title: '주문내역' },
                { type: 'tabs', items: ['배달·픽업', '장보기·쇼핑'], on: 1, tap: 0 },
                { type: 'bars', n: 4 },
                { type: 'nav', items: BAEMIN_NAV, on: 3 },
            ],
        },
        {
            no: 1, say: '주문 카드 오른쪽 위 「주문상세」를 눌러요',
            nodes: [
                { type: 'header', title: '주문내역' },
                { type: 'tabs', items: ['배달·픽업', '장보기·쇼핑'], on: 0 },
                { type: 'order', shop: '○○치킨 △△점', meta: '배달완료 · 10/3(금)', amount: '18,500원', corner: '주문상세', tap: 'corner' },
                { type: 'order', shop: '□□분식 ◇◇점', meta: '배달완료 · 9/28(일)', amount: '12,000원', corner: '주문상세', dim: true },
                { type: 'nav', items: BAEMIN_NAV, on: 3 },
            ],
        },
        {
            no: 2, say: '위쪽 칩 「결제 정보」를 눌러요',
            nodes: [
                { type: 'header', title: '주문상세', back: true },
                { type: 'chips', items: ['주문 정보', '결제 정보'], on: 0, tap: 1 },
                { type: 'section', title: '○○치킨 △△점' },
                { type: 'rows', rows: [['후라이드 치킨', '17,000원'], ['콜라 1.25L', '1,500원']] },
                { type: 'bars', n: 3 },
            ],
        },
        {
            no: 3, say: '결제 정보 아래 「카드영수증」을 눌러요',
            nodes: [
                { type: 'header', title: '주문상세', back: true },
                { type: 'chips', items: ['주문 정보', '결제 정보'], on: 1 },
                { type: 'section', title: '결제 정보' },
                { type: 'rows', rows: [['주문금액', '18,500원'], ['배달팁', '0원'], ['결제금액', '18,500원']], strong: 2 },
                { type: 'buttons', items: ['카드영수증'], tap: 0 },
            ],
        },
        {
            no: 4, say: '아래 「저장하기」를 눌러요', sub: '저장한 이미지가 사진첩에 들어가요', result: true,
            toast: '사진첩에 저장했어요',
            nodes: [
                { type: 'header', title: '카드영수증', close: true },
                { type: 'tabs', items: ['주문금액', '배달팁'], on: 0 },
                { type: 'rows', rows: [['카드종류', '신용카드'], ['승인번호', '0000****'], ['거래일시', '2026.10.03 19:20'], ['합계', '18,500원']], strong: 3 },
                { type: 'section', title: '판매자 정보' },
                { type: 'rows', rows: [['상호', '○○치킨 △△점'], ['사업자번호', '000-00-00000']] },
                { type: 'buttons', items: ['이메일로 받기', '저장하기'], solid: 1, tap: 1 },
            ],
        },
        last(5, upload('{앱} 「사진 올리기」로 그 이미지를 골라요', '방금 저장한 카드영수증이에요')),
    ],
};
/* ── 쿠팡 — 「카드영수증」 한 화면 캡처(1장) ── */
const COUPANG_NAV = ['홈', '카테고리', '검색', { icon: 'person', label: '마이쿠팡' }, '장바구니'];
const coupang = {
    app: 'coupang',
    name: '쿠팡',
    accent: '#E5483D',
    summary: [
        '아래 탭 사람 모양(마이쿠팡) → 「주문 내역」 「전체 보기 >」',
        '「주문내역」에서 그 주문의 「배송 · 주문 관리」',
        '「배송 · 주문 관리」 → 「주문 정보」 「주문 상세보기 >」',
        '주문 상세에서 「카드영수증」',
        '「카드영수증」 화면(결제정보 · 구매정보 · 이용상점정보)을 화면 캡처',
        '{앱} 「사진 올리기」',
    ],
    doneSub: '캡처한 카드영수증을 고르면 돼요',
    seller: '판매자 사업자등록번호까지 보이게 캡처해요',
    steps: [
        {
            no: 1, say: '아래 탭 사람 모양(마이쿠팡)을 눌러요',
            nodes: [{ type: 'bars', n: 7 }, { type: 'nav', items: COUPANG_NAV, on: 0, tap: 3 }],
        },
        {
            no: 1, say: '「주문 내역」 옆 「전체 보기 >」를 눌러요',
            nodes: [
                { type: 'header', title: '마이쿠팡' },
                { type: 'bars', n: 2 },
                { type: 'section', title: '주문 내역', links: ['전체 보기 >'], tap: 0 },
                { type: 'order', shop: '○○ 생수 2L × 12', meta: '배송완료 · 10/3(금) 도착', amount: '12,900원' },
                { type: 'nav', items: COUPANG_NAV, on: 3 },
            ],
        },
        {
            no: 2, say: '그 주문의 「배송 · 주문 관리」를 눌러요',
            nodes: [
                { type: 'header', title: '주문내역', back: true },
                { type: 'order', shop: '○○ 생수 2L × 12', meta: '배송완료 · 10/3(금) 도착', amount: '12,900원', button: '배송 · 주문 관리', tap: 'button' },
                { type: 'order', shop: '△△ 키친타월 6롤', meta: '배송완료 · 9/27(토) 도착', amount: '8,900원', button: '배송 · 주문 관리', dim: true },
            ],
        },
        {
            no: 3, say: '「주문 정보」의 「주문 상세보기 >」를 눌러요',
            nodes: [
                { type: 'header', title: '배송 · 주문 관리', back: true },
                { type: 'bars', n: 3 },
                { type: 'section', title: '주문 정보', links: ['주문 상세보기 >'], tap: 0 },
                { type: 'rows', rows: [['주문번호', '0000-0000-0000'], ['주문일자', '2026.10.03']] },
            ],
        },
        {
            no: 4, say: '주문 상세에서 「카드영수증」을 눌러요',
            nodes: [
                { type: 'header', title: '주문 상세', back: true },
                { type: 'section', title: '결제 정보' },
                { type: 'rows', rows: [['상품금액', '12,900원'], ['배송비', '0원'], ['총 결제금액', '12,900원']], strong: 2 },
                { type: 'buttons', items: ['카드영수증'], tap: 0 },
            ],
        },
        {
            no: 5, say: '「카드영수증」 화면을 캡처해요', sub: '결제정보 · 구매정보 · 이용상점정보가 한 화면에 나와요',
            action: 'capture', toast: '화면을 캡처했어요',
            nodes: [
                { type: 'header', title: '카드영수증', close: true },
                { type: 'section', title: '결제정보' },
                { type: 'rows', rows: [['카드종류', '신용카드'], ['승인번호', '0000****'], ['결제금액', '12,900원']] },
                { type: 'section', title: '구매정보' },
                { type: 'rows', rows: [['상품명', '○○ 생수 2L × 12'], ['구매일자', '2026.10.03']] },
                { type: 'section', title: '이용상점정보' },
                { type: 'rows', rows: [['상점명', '○○마켓'], ['사업자등록번호', '000-00-00000']] },
            ],
        },
        last(6, upload('{앱} 「사진 올리기」로 그 캡처를 골라요', '캡처 한 장이면 돼요')),
    ],
};
/* ── 쿠팡이츠 — 「영수증」 창 한 장 캡처(1장) ── */
const EATS_NAV = ['홈', '검색', '즐겨찾기', '주문내역', '마이'];
const coupangeats = {
    app: 'coupangeats',
    name: '쿠팡이츠',
    accent: '#1AA0DC',
    summary: [
        '아래 탭 「주문내역」',
        '「과거 주문 내역」 탭에서 주문 카드의 금액 옆 「영수증」 버튼',
        '「영수증」 창을 화면 캡처 한 장',
        '{앱} 「사진 올리기」로 그 캡처 고르기',
    ],
    doneSub: '캡처한 영수증을 고르면 돼요',
    seller: '가게 이름까지 다 보이게 캡처해요',
    steps: [
        {
            no: 1, say: '아래 탭 「주문내역」을 눌러요',
            nodes: [{ type: 'chips', items: ['한식', '치킨', '분식'], on: 0 }, { type: 'bars', n: 6 }, { type: 'nav', items: EATS_NAV, on: 0, tap: 3 }],
        },
        {
            no: 2, say: '「과거 주문 내역」에서 금액 옆 「영수증」을 눌러요',
            nodes: [
                { type: 'header', title: '주문내역' },
                { type: 'tabs', items: ['준비중', '과거 주문 내역'], on: 1 },
                { type: 'order', shop: '○○치킨 △△점', meta: '배달완료 · 10/3(금)', amount: '18,500원', button: '영수증', small: true, tap: 'button' },
                { type: 'order', shop: '□□분식 ◇◇점', meta: '배달완료 · 9/28(일)', amount: '12,000원', button: '영수증', small: true, dim: true },
                { type: 'nav', items: EATS_NAV, on: 3 },
            ],
        },
        {
            no: 3, say: '「영수증」 창을 화면 캡처 한 장 해요', sub: '가게 이름 · 주문번호 · 날짜 · 메뉴별 금액 · 총 결제금액이 보여요',
            action: 'capture', toast: '화면을 캡처했어요',
            nodes: [
                { type: 'header', title: '영수증', close: true },
                { type: 'rows', rows: [['가게 이름', '○○치킨 △△점'], ['주문번호', 'A0B1C2D3'], ['주문일시', '2026.10.03 19:20']] },
                { type: 'section', title: '메뉴' },
                { type: 'rows', rows: [['후라이드 치킨', '17,000원'], ['콜라 1.25L', '1,500원']] },
                { type: 'rows', rows: [['총 결제금액', '18,500원']], strong: 0 },
            ],
        },
        last(4, upload('{앱} 「사진 올리기」로 그 캡처를 골라요', '캡처 한 장이면 돼요')),
    ],
};
/* ── 네이버 「카드 영수증」 — N+스토어 · 네이버페이가 같은 화면이다. 길어서 위 · 아래 2장 ── */
const NAVER_RECEIPT_TOP = [
    { type: 'header', title: '카드 영수증', close: true },
    { type: 'rows', rows: [['카드사', '○○카드'], ['승인번호', '0000****'], ['결제일자', '2026.10.03 14:05'], ['상품명', '○○ 무선 이어폰']] },
    { type: 'section', title: '판매자 정보' },
    { type: 'rows', rows: [['상호', '○○스토어'], ['사업자번호', '000-00-00000']] },
];
const NAVER_RECEIPT_BOTTOM = [
    { type: 'section', title: '가맹점 정보' },
    { type: 'rows', rows: [['가맹점명', '○○페이'], ['사업자번호', '000-00-00000']] },
    { type: 'section', title: '금액' },
    { type: 'rows', rows: [['과세금액', '36,182원'], ['부가세', '3,618원'], ['합계', '39,800원']], strong: 2 },
];
const naverCaptures = (no) => [
    {
        no, say: '「카드 영수증」 위쪽을 한 장 캡처해요', sub: '카드사/승인번호 · 결제일자 · 상품명 · 판매자 정보',
        action: 'capture', toast: '1장째 캡처했어요', nodes: NAVER_RECEIPT_TOP,
    },
    {
        no, say: '내려서 아래쪽도 한 장 캡처해요', sub: '가맹점 정보 · 금액 · 합계',
        action: 'capture', toast: '2장째 캡처했어요', scrolled: true, nodes: NAVER_RECEIPT_BOTTOM,
    },
];
/* ── N+스토어(네이버) — 「카드 영수증」이 길어 2장 캡처 → 이어 붙여 1장으로 ── */
const NAVER_NAV = ['홈', '쇼핑', '마이쇼핑', '더보기'];
const NPLUS_ORDER = { shop: '○○ 무선 이어폰', meta: '구매확정 · 10/3(금)', amount: '39,800원' };
const nplus = {
    app: 'nplus',
    name: 'N+스토어',
    accent: '#03C75A',
    summary: [
        '네이버 아래 탭 「마이쇼핑」 → 「주문/배송내역」 「전체보기 >」',
        '「주문/배송내역」에서 그 주문 카드 오른쪽 아래 「…」 버튼',
        '아래에서 올라온 창에서 「영수증조회」',
        '「영수증 발급 내역」 화면에서 「카드영수증」',
        '「카드 영수증」이 길어서 캡처 2장 — 위 한 장, 내려서 아래 한 장',
        '{앱} 「사진 올리기」에서 2장 함께 고르기(위 → 아래 순서) → 한 장으로 이어 붙여 올려요',
    ],
    doneSub: '캡처 2장을 위 → 아래 순서로 함께 고르면 돼요',
    seller: '판매자 정보(상호 · 사업자번호)까지 보이게 캡처해요',
    multi: 3,
    pickHint: '위 → 아래 순서로 2장 골라 주세요',
    steps: [
        {
            no: 1, say: '네이버 아래 탭 「마이쇼핑」을 눌러요',
            nodes: [{ type: 'bars', n: 7 }, { type: 'nav', items: NAVER_NAV, on: 0, tap: 2 }],
        },
        {
            no: 1, say: '「주문/배송내역」 옆 「전체보기 >」를 눌러요',
            nodes: [
                { type: 'header', title: '마이쇼핑' },
                { type: 'bars', n: 2 },
                { type: 'section', title: '주문/배송내역', links: ['전체보기 >'], tap: 0 },
                { type: 'order', ...NPLUS_ORDER },
                { type: 'nav', items: NAVER_NAV, on: 2 },
            ],
        },
        {
            no: 2, say: '그 주문 카드 오른쪽 아래 「…」을 눌러요',
            nodes: [
                { type: 'header', title: '주문/배송내역', back: true },
                { type: 'order', ...NPLUS_ORDER, more: true, tap: 'more' },
                { type: 'order', shop: '△△ 휴대폰 케이스', meta: '구매확정 · 9/26(금)', amount: '9,900원', more: true, dim: true },
            ],
        },
        {
            no: 3, say: '아래에서 올라온 창에서 「영수증조회」를 눌러요',
            nodes: [
                { type: 'header', title: '주문/배송내역', back: true },
                { type: 'order', ...NPLUS_ORDER, more: true },
                { type: 'menu', items: ['주문상세', '영수증조회', '문의하기'], tap: 1 },
            ],
        },
        {
            no: 4, say: '「영수증 발급 내역」에서 「카드영수증」을 눌러요',
            nodes: [
                { type: 'header', title: '영수증 발급 내역', back: true },
                { type: 'section', title: '○○스토어' },
                { type: 'rows', rows: [['상품명', '○○ 무선 이어폰'], ['결제일', '2026.10.03']] },
                { type: 'buttons', items: ['카드영수증'], tap: 0 },
            ],
        },
        ...naverCaptures(5),
        last(6, upload('{앱} 「사진 올리기」에서 2장을 함께 골라요', '위 → 아래 순서로 고르면 한 장으로 이어 붙여 올려요', [0, 1])),
    ],
};
/* ── 네이버페이 — 결제내역 → 결제상세 → 「영수증」 → 「카드 영수증」 2장 캡처 → 이어 붙여 1장 ── */
const NPAY_ORDER = { shop: '○○ 무선 이어폰', meta: '결제완료 · 10/3(금)', amount: '39,800원' };
const naverpay = {
    app: 'naverpay',
    name: '네이버페이',
    accent: '#03C75A',
    summary: [
        '네이버 앱 홈 왼쪽 위 「pay」',
        'N pay 화면 「결제내역」',
        '「N pay 결제 | 내역」 목록에서 그 결제 카드 오른쪽 「⋮」',
        '아래 창 「결제상세」',
        '「결제 상세정보」 오른쪽 위 「영수증」',
        '「카드 영수증」 위(카드사/승인번호 · 결제일자 · 상품명 · 판매자 정보) + 아래(가맹점 정보 · 금액 · 합계) 2장 캡처',
        '{앱} 「사진 올리기」에서 2장 함께 고르기(위 → 아래) → 한 장으로 이어 붙여 올려요',
    ],
    doneSub: '캡처 2장을 위 → 아래 순서로 함께 고르면 돼요',
    seller: '판매자 정보(상호 · 사업자번호)까지 보이게 캡처해요',
    note: '아래 「PDF로 저장」은 사진첩에 안 들어가요 — 캡처 2장으로 올려 주세요',
    multi: 3,
    pickHint: '위 → 아래 순서로 2장 골라 주세요',
    steps: [
        {
            no: 1, say: '네이버 앱 홈 왼쪽 위 「pay」를 눌러요',
            nodes: [{ type: 'header', title: '', left: 'pay', tap: 'left' }, { type: 'bars', n: 7 }, { type: 'nav', items: NAVER_NAV, on: 0 }],
        },
        {
            no: 2, say: 'N pay 화면에서 「결제내역」을 눌러요',
            nodes: [
                { type: 'header', title: 'N pay', back: true },
                { type: 'bars', n: 3 },
                { type: 'section', title: '결제내역', links: ['>'], tap: 'title' },
                { type: 'bars', n: 3 },
            ],
        },
        {
            no: 3, say: '그 결제 카드 오른쪽 「⋮」을 눌러요',
            nodes: [
                { type: 'header', title: 'N pay 결제 | 내역', back: true },
                { type: 'order', ...NPAY_ORDER, corner: '⋮', tap: 'corner' },
                { type: 'order', shop: '△△ 휴대폰 케이스', meta: '결제완료 · 9/26(금)', amount: '9,900원', corner: '⋮', dim: true },
            ],
        },
        {
            no: 4, say: '아래 창에서 「결제상세」를 눌러요',
            nodes: [
                { type: 'header', title: 'N pay 결제 | 내역', back: true },
                { type: 'order', ...NPAY_ORDER, corner: '⋮' },
                { type: 'menu', items: ['결제상세', '닫기'], tap: 0 },
            ],
        },
        {
            no: 5, say: '「결제 상세정보」 오른쪽 위 「영수증」을 눌러요',
            nodes: [
                { type: 'header', title: '결제 상세정보', back: true, right: '영수증', tap: 'right' },
                { type: 'section', title: '○○스토어' },
                { type: 'rows', rows: [['상품명', '○○ 무선 이어폰'], ['결제일시', '2026.10.03 14:05'], ['결제금액', '39,800원']], strong: 2 },
                { type: 'bars', n: 3 },
            ],
        },
        ...naverCaptures(6),
        last(7, upload('{앱} 「사진 올리기」에서 2장을 함께 골라요', '위 → 아래 순서로 고르면 한 장으로 이어 붙여 올려요', [0, 1])),
    ],
};
/* ── 무신사 — 「신용/체크카드 매출전표」 한 화면 캡처(1장) ── */
const MUSINSA_NAV = ['홈', '카테고리', '검색', '좋아요', '마이'];
const musinsa = {
    app: 'musinsa',
    name: '무신사',
    accent: '#2B2B2B',
    summary: [
        '무신사 아래 탭 「마이」 → 「주문 내역」',
        '「주문 내역」에서 그 주문 날짜 오른쪽 「주문 상세」',
        '「주문 상세」 아래 「결제 정보」 오른쪽 「영수증」(옆 「거래명세서」)',
        '「신용/체크카드 매출전표」 한 화면 캡처',
        '{앱} 「사진 올리기」',
    ],
    doneSub: '캡처한 매출전표를 고르면 돼요',
    seller: '이용상점(상호 · 사업자번호)까지 보이게 캡처해요',
    steps: [
        {
            no: 1, say: '무신사 아래 탭 「마이」를 눌러요',
            nodes: [{ type: 'bars', n: 7 }, { type: 'nav', items: MUSINSA_NAV, on: 0, tap: 4 }],
        },
        {
            no: 1, say: '「주문 내역」을 눌러요',
            nodes: [
                { type: 'header', title: '마이' },
                { type: 'bars', n: 2 },
                { type: 'section', title: '주문 내역', links: ['>'], tap: 'title' },
                { type: 'bars', n: 3 },
                { type: 'nav', items: MUSINSA_NAV, on: 4 },
            ],
        },
        {
            no: 2, say: '그 주문 날짜 오른쪽 「주문 상세」를 눌러요',
            nodes: [
                { type: 'header', title: '주문 내역', back: true },
                { type: 'order', shop: '2026.10.03', meta: '○○ 반팔 티셔츠 · 배송완료', amount: '29,000원', corner: '주문 상세', tap: 'corner' },
                { type: 'order', shop: '2026.09.21', meta: '△△ 양말 3켤레 · 구매확정', amount: '9,000원', corner: '주문 상세', dim: true },
            ],
        },
        {
            no: 3, say: '「결제 정보」 오른쪽 「영수증」을 눌러요', sub: '옆의 「거래명세서」 말고 「영수증」이에요',
            nodes: [
                { type: 'header', title: '주문 상세', back: true },
                { type: 'bars', n: 3 },
                { type: 'section', title: '결제 정보', links: ['거래명세서', '영수증'], tap: 1 },
                { type: 'rows', rows: [['상품 금액', '29,000원'], ['배송비', '0원'], ['결제 금액', '29,000원']], strong: 2 },
            ],
        },
        {
            no: 4, say: '「신용/체크카드 매출전표」를 한 화면 캡처해요',
            action: 'capture', toast: '화면을 캡처했어요',
            nodes: [
                { type: 'header', title: '신용/체크카드 매출전표', close: true },
                { type: 'rows', rows: [['카드종류', '○○카드'], ['승인번호', '0000****'], ['거래일시', '2026.10.03 21:10'], ['상품명', '○○ 반팔 티셔츠']] },
                { type: 'section', title: '이용상점 정보' },
                { type: 'rows', rows: [['상호', '○○몰'], ['사업자번호', '000-00-00000']] },
                { type: 'rows', rows: [['합계', '29,000원']], strong: 0 },
            ],
        },
        last(5, upload('{앱} 「사진 올리기」로 그 캡처를 골라요', '캡처 한 장이면 돼요')),
    ],
};
/* ── 컬리 — 결제방법에 따라 칸이 둘(대표님 10-03 23:36 · 23:53) ──
 | kurly      카드 결제: 「카드 영수증 보기」 → 「신용카드 매출전표」 한 장 캡처(1장)
 | kurly_npay 네이버페이(신용카드): 「주문 내역 상세」 화면 자체를 위 · 아래 2장 캡처 → 이어 붙여 1장(2장 꼭)
 */
const KURLY_NAV = ['홈', '카테고리', '검색', '마이컬리'];
/** 컬리 앞쪽 — 마이컬리 → 주문내역 → 주문 카드 「>」(두 칸이 같다) */
const KURLY_HEAD = [
    {
        no: 1, say: '아래 탭 「마이컬리」를 눌러요',
        nodes: [{ type: 'bars', n: 7 }, { type: 'nav', items: KURLY_NAV, on: 0, tap: 3 }],
    },
    {
        no: 1, say: '「주문내역」을 눌러요',
        nodes: [
            { type: 'header', title: '마이컬리' },
            { type: 'bars', n: 2 },
            { type: 'section', title: '주문내역', links: ['>'], tap: 'title' },
            { type: 'bars', n: 3 },
            { type: 'nav', items: KURLY_NAV, on: 3 },
        ],
    },
    {
        no: 2, say: '주문 카드 오른쪽 「>」를 눌러요',
        nodes: [
            { type: 'header', title: '주문내역', back: true },
            { type: 'order', shop: '○○ 샐러드 외 2건', meta: '배송완료 · 10/3(금)', amount: '24,800원', corner: '>', tap: 'corner' },
            { type: 'order', shop: '△△ 우유 900mL 외 1건', meta: '배송완료 · 9/29(월)', amount: '7,600원', corner: '>', dim: true },
        ],
    },
];
const kurlyPay = (method, tap) => [
    { type: 'header', title: '주문 내역 상세', back: true },
    { type: 'bars', n: 2 },
    { type: 'section', title: '결제 정보' },
    { type: 'rows', rows: [['결제금액', '24,800원'], ['결제방법', method]], strong: 0, tap: tap === 'row' ? 1 : undefined },
    ...(method === '신용카드' ? [{ type: 'buttons', items: ['카드 영수증 보기'], tap: tap === 'button' ? 0 : undefined }] : []),
];
const kurly = {
    app: 'kurly',
    name: '컬리',
    accent: '#5F0080',
    summary: [
        '아래 탭 「마이컬리」 → 「주문내역」',
        '주문 카드 오른쪽 「>」',
        '「주문 내역 상세」 아래 「결제 정보」 → 「카드 영수증 보기」',
        '「신용카드 매출전표」 한 장 캡처',
        '{앱} 「사진 올리기」',
    ],
    doneSub: '캡처한 매출전표 1장을 고르면 돼요',
    seller: '상점 정보(상호 · 사업자번호)까지 보이게 캡처해요',
    steps: [
        ...KURLY_HEAD,
        {
            no: 3, say: '「결제 정보」의 「카드 영수증 보기」를 눌러요', sub: '네이버페이로 결제했다면 「컬리(네이버페이)」를 골라 주세요',
            nodes: kurlyPay('신용카드', 'button'),
        },
        {
            no: 4, say: '「신용카드 매출전표」를 한 장 캡처해요',
            action: 'capture', toast: '화면을 캡처했어요',
            nodes: [
                { type: 'header', title: '신용카드 매출전표', close: true },
                { type: 'rows', rows: [['카드종류', '○○카드'], ['승인번호', '0000****'], ['거래일시', '2026.10.03 08:40']] },
                { type: 'section', title: '상점 정보' },
                { type: 'rows', rows: [['상호', '○○마켓'], ['사업자번호', '000-00-00000']] },
                { type: 'rows', rows: [['합계', '24,800원']], strong: 0 },
            ],
        },
        last(5, upload('{앱} 「사진 올리기」로 그 캡처를 골라요', '캡처 한 장이면 돼요')),
    ],
};
const NPAY_LINK = { text: '네이버페이 결제내역에서도 찾을 수 있어요', label: '네이버페이 안내 보기', app: 'naverpay' };
const kurlyNpay = {
    app: 'kurly_npay',
    name: '컬리(네이버페이)',
    accent: '#5F0080',
    summary: [
        '아래 탭 「마이컬리」 → 「주문내역」',
        '주문 카드 오른쪽 「>」',
        '「주문 내역 상세」 아래 「결제 정보」 결제방법이 「네이버페이(신용카드)」',
        '「주문 내역 상세」 화면을 위(주문 상품) · 아래(결제 정보 · 주문 정보: 주문번호 · 결제 일시) 2장 캡처',
        '{앱} 「사진 올리기」에서 2장 함께(위 → 아래) — 한 장으로 이어 붙여 올려요',
    ],
    doneSub: '캡처 2장을 위 → 아래 순서로 함께 골라요',
    seller: '주문번호 · 결제 일시까지 보이게 캡처해요',
    multi: 3,
    pickHint: '위 → 아래 순서로 2장 골라 주세요',
    steps: [
        ...KURLY_HEAD,
        {
            no: 3, say: '결제방법이 「네이버페이(신용카드)」인지 봐요', sub: '카드 결제라면 「컬리」를 골라 주세요',
            nodes: kurlyPay('네이버페이(신용카드)', 'row'),
        },
        {
            no: 4, say: '「주문 내역 상세」 위쪽을 캡처해요', sub: '주문 상품이 보이게',
            action: 'capture', toast: '1장째 캡처했어요', link: NPAY_LINK,
            nodes: [
                { type: 'header', title: '주문 내역 상세', back: true },
                { type: 'section', title: '주문 상품' },
                { type: 'rows', rows: [['○○ 샐러드', '9,900원'], ['△△ 그릭요거트', '6,900원'], ['□□ 식빵', '8,000원']] },
                { type: 'bars', n: 2 },
            ],
        },
        {
            no: 4, say: '내려서 아래쪽도 캡처해요', sub: '결제 정보 · 주문 정보(주문번호 · 결제 일시)',
            action: 'capture', toast: '2장째 캡처했어요', scrolled: true, link: NPAY_LINK,
            nodes: [
                { type: 'section', title: '결제 정보' },
                { type: 'rows', rows: [['결제금액', '24,800원'], ['결제방법', '네이버페이(신용카드)']], strong: 0 },
                { type: 'section', title: '주문 정보' },
                { type: 'rows', rows: [['주문번호', '0000000000000'], ['결제 일시', '2026.10.03 08:40']] },
            ],
        },
        last(5, upload('{앱} 「사진 올리기」에서 2장을 함께 골라요', '위 → 아래 순서로 고르면 한 장으로 이어 붙여 올려요', [0, 1])),
    ],
};
/* ── 카카오페이 — 온라인 결제 「거래확인증」 위 · 아래 2장 캡처 → 이어 붙여 1장 ── */
const KAKAO_ORDER = { shop: '○○몰', meta: '결제완료 · 10/3(금)', amount: '29,000원' };
const kakaopay = {
    app: 'kakaopay',
    name: '카카오페이',
    accent: '#E6C200',
    summary: [
        '카카오페이 홈(마이) 오른쪽 위 「≡」',
        '「전체 서비스」 → 「결제」',
        '「결제」 → 「온라인 결제」',
        '위 탭 「온라인」의 「결제내역」',
        '결제 하나 → 「상세내역」 아래 「거래확인증」',
        '「거래확인증」 위(가맹점명 · 금액 · 결제 정보) + 아래(공급자 정보 · 결제대행사 정보) 2장 캡처 — 「발급하기」는 안 눌러도 돼요',
        '{앱} 「사진 올리기」에서 2장 함께 고르기(위 → 아래)',
    ],
    doneSub: '캡처 2장을 위 → 아래 순서로 함께 고르면 돼요',
    seller: '공급자 정보(상호 · 사업자번호)까지 보이게 캡처해요',
    note: '온라인 결제만 돼요 — 오프라인 결제 내역은 올릴 수 없어요',
    multi: 3,
    pickHint: '위 → 아래 순서로 2장 골라 주세요',
    steps: [
        {
            no: 1, say: '카카오페이 홈(마이) 오른쪽 위 「≡」를 눌러요',
            nodes: [{ type: 'header', title: '', right: '≡', tap: 'right' }, { type: 'bars', n: 8 }],
        },
        {
            no: 2, say: '「전체 서비스」에서 「결제」를 눌러요',
            nodes: [
                { type: 'header', title: '전체 서비스', back: true },
                { type: 'bars', n: 2 },
                { type: 'section', title: '결제', links: ['>'], tap: 'title' },
                { type: 'bars', n: 4 },
            ],
        },
        {
            no: 3, say: '「결제」에서 「온라인 결제」를 눌러요',
            nodes: [
                { type: 'header', title: '결제', back: true },
                { type: 'section', title: '온라인 결제', links: ['>'], tap: 'title' },
                { type: 'section', title: '오프라인 결제', links: ['>'] },
                { type: 'bars', n: 3 },
            ],
        },
        {
            no: 4, say: '위 탭 「온라인」의 「결제내역」을 눌러요',
            nodes: [
                { type: 'header', title: '온라인 결제', back: true },
                { type: 'tabs', items: ['온라인', '오프라인'], on: 0 },
                { type: 'bars', n: 2 },
                { type: 'section', title: '결제내역', links: ['>'], tap: 'title' },
                { type: 'bars', n: 2 },
            ],
        },
        {
            no: 5, say: '결제 하나를 눌러요',
            nodes: [
                { type: 'header', title: '결제내역', back: true },
                { type: 'order', ...KAKAO_ORDER, corner: '>', tap: 'corner' },
                { type: 'order', shop: '△△마켓', meta: '결제완료 · 9/27(토)', amount: '11,500원', corner: '>', dim: true },
            ],
        },
        {
            no: 5, say: '「상세내역」 아래 「거래확인증」을 눌러요',
            nodes: [
                { type: 'header', title: '상세내역', back: true },
                { type: 'section', title: '○○몰' },
                { type: 'rows', rows: [['결제일시', '2026.10.03 20:15'], ['결제금액', '29,000원']], strong: 1 },
                { type: 'buttons', items: ['거래확인증'], tap: 0 },
            ],
        },
        {
            no: 6, say: '「거래확인증」 위쪽을 한 장 캡처해요', sub: '가맹점명 · 금액 · 결제 정보',
            action: 'capture', toast: '1장째 캡처했어요',
            nodes: [
                { type: 'header', title: '거래확인증', close: true },
                { type: 'rows', rows: [['가맹점명', '○○몰'], ['결제금액', '29,000원']], strong: 1 },
                { type: 'section', title: '결제 정보' },
                { type: 'rows', rows: [['결제수단', '○○카드'], ['결제일시', '2026.10.03 20:15'], ['승인번호', '0000****']] },
            ],
        },
        {
            no: 6, say: '내려서 아래쪽도 한 장 캡처해요', sub: '공급자 정보 · 결제대행사 정보 — 「발급하기」는 안 눌러도 돼요',
            action: 'capture', toast: '2장째 캡처했어요', scrolled: true,
            nodes: [
                { type: 'section', title: '공급자 정보' },
                { type: 'rows', rows: [['상호', '○○몰'], ['사업자번호', '000-00-00000']] },
                { type: 'section', title: '결제대행사 정보' },
                { type: 'rows', rows: [['상호', '○○페이'], ['사업자번호', '000-00-00000']] },
                { type: 'buttons', items: ['발급하기'] },
            ],
        },
        last(7, upload('{앱} 「사진 올리기」에서 2장을 함께 골라요', '위 → 아래 순서로 고르면 한 장으로 이어 붙여 올려요', [0, 1])),
    ],
};
/* ── 목록 ── */
/** 고르는 칸 순서(대표님 10-03 — 네이버페이는 N+스토어 다음, 컬리 · 컬리(네이버페이)는 무신사 다음, 카카오페이 다음) — 종이 영수증은 맨 끝 */
exports.GUIDES = [baemin, coupang, coupangeats, nplus, naverpay, musinsa, kurly, kurlyNpay, kakaopay];
exports.PLATFORM_ORDER = [...exports.GUIDES.map((g) => g.app), 'paper'];
function guideOf(app) {
    return exports.GUIDES.find((g) => g.app === app);
}
function isPlatform(v) {
    return typeof v === 'string' && exports.PLATFORM_ORDER.includes(v);
}
/** 고르는 칸 이름 */
function platformName(p) {
    return p === 'paper' ? '종이 영수증' : guideOf(p).name;
}
/** 사진첩에서 한 번에 고를 수 있는 장 수 — 길어서 여러 장 캡처하는 곳만 2장 넘게 */
function pickLimit(p) {
    return p && p !== 'paper' ? guideOf(p).multi ?? 1 : 1;
}
/**
 * **2장이 꼭 필요한 곳**(대표님 10-03 23:53 「2장 아니면 업로드 안되게 막아야 함」) — 영수증이 길어 위 · 아래 2장 캡처를
 * 이어 붙여야 결제 정보가 다 들어간다. 1장만 고르면 올리지 않는다. 서버도 shots < 2 면 422 need_two_shots.
 */
exports.TWO_SHOT = new Set(['nplus', 'naverpay', 'kakaopay', 'kurly_npay']);
/** 2장 곳 작은 알림 — 서버는 이어 붙인 사진에 주문번호가 둘 이상이면 반려한다 */
exports.TWO_SAME_ORDER = '같은 주문의 위 · 아래 2장이어야 해요';
function needsTwo(p) {
    return p !== null && exports.TWO_SHOT.has(p);
}
