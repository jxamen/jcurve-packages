"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.record = void 0;
exports.nextData = nextData;
function nextData(html) {
    const raw = html.match(/<script\b[^>]*id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i)?.[1];
    if (!raw)
        throw Error('네이버 검색 응답 형식이 바뀌었거나 직접 조회가 제한됐어요');
    try {
        return JSON.parse(raw);
    }
    catch {
        throw Error('네이버 검색 결과를 해석하지 못했어요');
    }
}
const record = (v) => v !== null && typeof v === 'object' ? v : {};
exports.record = record;
