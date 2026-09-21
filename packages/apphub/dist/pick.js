"use strict";
/**
 * 서버가 준 계열 앱 목록에서 **이 기기로 받을 수 있는 주소**를 고른다.
 *
 * 서버는 iOS · 안드로이드 주소를 둘 다 준다 — 고르는 것은 기기를 아는 앱 몫이다. 서버가
 * User-Agent 로 고르면 캐시를 태울 수 없고 아이패드 · 웹뷰에서 애매해진다.
 *
 * **그 기기 스토어에 없는 앱은 아예 빼 버린다**(2026-09-20 지시: 「안드로이드면 안드로이드 승인 난
 * 애들, 애플이면 애플 승인 난 애들이 나오면 된다」). 처음에는 「준비 중」으로 흐리게 남겼는데,
 * 누를 수 없는 줄은 목록만 길게 만들고 **그 기기에서는 할 수 있는 일이 하나도 없다.**
 *
 * 첫 글자 · 색도 여기서 정한다. 어드민에 아이콘 칸이 아직 없어 이름 첫 글자를 동그라미에
 * 넣는데, **색이 한 가지면 목록이 한 덩어리로 보인다.** 그래서 slug 로 고른다 — 앱이 늘어도
 * 서로 다른 색이 붙고, 같은 앱은 어느 앱에서 보든 늘 같은 색이다.
 *
 * RN 에 기대지 않는 순수 파일이라 vitest 로 검증한다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.tintOf = tintOf;
exports.familyRows = familyRows;
/**
 * 동그라미 색.
 *
 * 계열 앱들이 저마다 다른 바탕색(크림 · 흰색 · 분홍)을 쓰므로 **어느 바탕에서나 읽히는
 * 진한 색**만 고른다. 연한 색을 섞으면 흰 글자가 안 보이는 앱이 생긴다.
 */
const TINTS = ['#FF7A2F', '#3FA65C', '#2C6BE8', '#E8A93C', '#B15BE8', '#E5484D', '#7B4B27', '#0F9B8E'];
function tintOf(slug) {
    let n = 0;
    for (let i = 0; i < slug.length; i += 1)
        n = (n + slug.charCodeAt(i)) % 997;
    return TINTS[n % TINTS.length];
}
function familyRows(items, platform) {
    const ios = platform === 'ios';
    const urlOf = (a) => (ios ? a.ios : a.android) ?? null;
    return (Array.isArray(items) ? items : [])
        .filter((a) => !!urlOf(a))
        .map((a) => ({
        slug: String(a.slug ?? ''),
        name: String(a.name ?? ''),
        desc: a.desc ?? null,
        url: urlOf(a),
        icon: a.icon ?? null,
        initial: String(a.name ?? '?').trim()[0] ?? '?',
        tint: tintOf(String(a.slug ?? '')),
    }));
}
