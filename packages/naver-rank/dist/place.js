"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.parsePlacePage = parsePlacePage;
const naver_1 = require("./naver");
function parsePlacePage(html, page) {
    const props = (0, naver_1.record)((0, naver_1.record)((0, naver_1.nextData)(html)).props);
    const data = (0, naver_1.record)(props.pageProps);
    const rows = (0, naver_1.record)(data.placeList).items;
    if (!Array.isArray(rows))
        throw Error('네이버 플레이스 검색 응답 형식을 확인할 수 없어요');
    return rows.map((row, index) => { const id = (0, naver_1.record)(row).id; if (!/^\d+$/.test(String(id)))
        throw Error('플레이스 번호를 확인할 수 없어요'); return { id: String(id), rank: (page - 1) * 30 + index + 1 }; });
}
