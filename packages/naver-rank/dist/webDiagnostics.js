"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shoppingRoutes = void 0;
exports.shoppingUrl = shoppingUrl;
exports.safeEvidence = safeEvidence;
exports.shoppingRoutes = [
    'https://m.search.naver.com/search.naver?where=m_shop&query=',
    'https://msearch.shopping.naver.com/search/all?query=',
    'https://search.shopping.naver.com/ns/search?query=',
];
function shoppingUrl(keyword, page, route) { return exports.shoppingRoutes[route] + encodeURIComponent(keyword) + '&pagingIndex=' + page + '&pagingSize=40'; }
// Only provider-owned diagnostic phrases are retained: page bodies can contain account PII.
function safeEvidence(title, text) {
    const safe = (value) => value.match(/네이버|NAVER|쇼핑|검색|로그인|접속이? 제한(?:되었습니다|됩니다)?|서비스 이용이 제한|요청이 너무 많|보안문자|보안 확인|캡차|captcha|Access Denied|Forbidden/gi)?.join(' · ') || '(개인정보 보호를 위해 생략)';
    return '제목: ' + safe(title).slice(0, 80) + ' / 본문: ' + safe(text.slice(0, 120)).slice(0, 120);
}
