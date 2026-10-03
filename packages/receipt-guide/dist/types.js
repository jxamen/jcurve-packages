"use strict";
/**
 * 배달 · 쇼핑 앱 영수증 올리는 법 — **그림 없는 데이터**로만 적는다(대표님 10-03 23:17).
 *
 * 화면은 같은 폴더의 재생기(Player.tsx)가 이 데이터로 흉내 낸다. 앱마다 화면 코드를 따로 두지 않는다 —
 * 단계 글은 전부 `data.ts` 한 파일에 있다. 새 앱은 거기에 한 덩어리를 더 쓰고 `GUIDES` 순서에 올리면 끝이다.
 *
 * 가짜 화면은 **막대 · 둥근 카드 · 글자**뿐이다. 진짜 앱의 로고 · 그림 · 캡처는 쓰지 않는다.
 * 가게 이름 · 금액은 지어낸 값(「○○치킨 △△점」 · 18,500원)이다 — 실제 이름 · 전화 · 주소를 넣지 않는다.
 *
 * RN 에 기대지 않는 파일이라 노드 시험(data.test.ts)이 바로 읽는다.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.targetsOf = targetsOf;
exports.fillApp = fillApp;
/** 그 장면에서 누를 곳 수 — 한 화면에 하나여야 손가락이 어디로 갈지 정해진다 */
function targetsOf(step) {
    let n = 0;
    for (const node of step.nodes) {
        if (node.type === 'album')
            n += node.pick.length ? 1 : 0;
        else if ('tap' in node && node.tap !== undefined)
            n += 1;
    }
    return n;
}
/** 글 속 `{앱}` 을 쓰는 앱 이름으로 바꾼다 */
function fillApp(text, appName) {
    return text.split('{앱}').join(appName);
}
