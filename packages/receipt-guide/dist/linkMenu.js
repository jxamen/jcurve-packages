"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.linkedMenuTitle = void 0;
exports.linkedMenuItems = linkedMenuItems;
/** 시트 제목 — 「네이버 연동됨」 */
const linkedMenuTitle = (name) => name + ' 연동됨';
exports.linkedMenuTitle = linkedMenuTitle;
function linkedMenuItems(on, opts = {}) {
    return [
        { label: '주문 불러오기', onPress: on.importOrders },
        { label: '불러온 주문 보기', onPress: on.showOrders },
        { label: '사용 방법 보기', onPress: on.showGuide },
        ...(opts.probe === true && on.openLogin ? [{ label: '로그인 창 열기 (구조 기록)', onPress: on.openLogin }] : []),
        { label: '연동 해제', destructive: true, onPress: on.withdraw },
    ];
}
