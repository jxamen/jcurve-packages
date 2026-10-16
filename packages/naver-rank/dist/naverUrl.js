"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.normalizeTargetUrl = normalizeTargetUrl;
exports.targetUrlId = targetUrlId;
exports.validateTargetUrl = validateTargetUrl;
/** Canonicalize known Naver product/place URLs; preserve all other targets. */
function normalizeTargetUrl(input) {
    const value = input.trim().replace(/[\r\n]/g, '');
    if (!value)
        return '';
    if (!/^(?:https?:\/\/)?[^/\s]+\.[^/\s]+(?:\/|$)/i.test(value))
        return value;
    let url;
    try {
        url = new URL(/^[a-z]+:\/\//i.test(value) ? value : 'https://' + value);
    }
    catch {
        return value;
    }
    if (!/^https?:$/.test(url.protocol))
        return value;
    const host = url.hostname.toLowerCase(), path = url.pathname.replace(/\/+$/, '');
    const product = path.match(/^\/([^/]+)\/products\/(\d+)$/i);
    if (/^(m\.)?(smartstore|brand)\.naver\.com$/.test(host) && product)
        return `https://${host.replace(/^m\./, '')}/${product[1].toLowerCase()}/products/${product[2]}`;
    if (/^(m\.)?shopping\.naver\.com$/.test(host)) {
        const id = path.match(/\/(?:catalog|products?|detail)\/(\d+)(?:\/|$)/i)?.[1] ?? url.searchParams.get('nvMid') ?? url.searchParams.get('productId');
        if (id && /^\d+$/.test(id))
            return `https://shopping.naver.com/catalog/${id}`;
    }
    if (['m.place.naver.com', 'place.naver.com', 'map.naver.com'].includes(host)) {
        const id = path.match(/\/(?:place|restaurant|cafe|hospital|hairshop|nailshop|accommodation|entry\/place)\/(\d+)(?:\/|$)/i)?.[1] ?? url.searchParams.get('placeId') ?? url.searchParams.get('id');
        if (id && /^\d+$/.test(id))
            return `https://m.place.naver.com/place/${id}`;
    }
    return value;
}
function targetUrlId(input, kind) {
    const value = normalizeTargetUrl(input);
    if (/^\d+$/.test(input.trim()))
        return input.trim();
    if (kind ? validateTargetUrl(value, kind) : validateTargetUrl(value, 'shop') && validateTargetUrl(value, 'place'))
        return undefined;
    return value.match(/\/(?:products|catalog|place)\/(\d+)$/)?.[1];
}
function validateTargetUrl(input, kind) {
    const url = normalizeTargetUrl(input);
    if (/^https:\/\/naver\.me\//i.test(url))
        return 'naver.me 단축 주소예요. 링크를 열어 상품 · 플레이스의 원본 주소를 붙여 넣어 주세요';
    const valid = kind === 'shop' ? /^https:\/\/(?:(?:smartstore|brand)\.naver\.com\/[^/]+\/products\/\d+|shopping\.naver\.com\/catalog\/\d+)$/ : /^https:\/\/m\.place\.naver\.com\/place\/\d+$/;
    return valid.test(url) ? null : kind === 'shop' ? '스마트스토어 · 네이버 쇼핑 상품 주소가 아니에요. 상품 상세 주소를 확인해 주세요' : '네이버 플레이스 주소가 아니에요. 가게 상세 주소를 확인해 주세요';
}
