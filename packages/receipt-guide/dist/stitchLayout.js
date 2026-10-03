"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.STITCH_MAX_COUNT = exports.STITCH_MAX_HEIGHT = exports.STITCH_MAX_WIDTH = void 0;
exports.stitchLayout = stitchLayout;
/**
 * 여러 장 이어 붙이기 자리 계산 — 대표님 10-03 23:25 「N+스토어가 길어」.
 *
 * 긴 영수증(N+스토어 「카드 영수증」 · 기타 앱)은 캡처 2~3장으로 나뉜다. 고른 순서대로 **위에서 아래로**
 * 한 장에 붙여 영수증 1건으로 올린다(포인트 1번 · 서버 중복 검사도 1건 그대로).
 *
 * - 폭: 고른 사진 중 가장 넓은 폭, 단 1440 을 넘지 않는다. 좁은 사진은 그 폭에 맞춰 키운다.
 * - 높이: 각 사진을 그 폭에 맞춘 비율 그대로 쌓는다. 겹친 부분을 찾아 지우지는 않는다(순서만 지킨다).
 * - 합친 높이가 8000 을 넘으면 폭째로 줄인다 — 기기 그래픽 텍스처 한계(흔히 8192) 밑에서 그려야
 *   오프스크린 캔버스가 안 깨진다.
 *
 * 순수 함수 — 그리기는 stitch.ts(Skia).
 */
exports.STITCH_MAX_WIDTH = 1440;
exports.STITCH_MAX_HEIGHT = 8000;
exports.STITCH_MAX_COUNT = 3;
function stitchLayout(sizes, maxWidth = exports.STITCH_MAX_WIDTH, maxHeight = exports.STITCH_MAX_HEIGHT) {
    if (!sizes.length || sizes.some((s) => !(s.width > 0) || !(s.height > 0)))
        throw new Error('stitch_bad_size');
    const heightsAt = (w) => sizes.map((s) => Math.max(1, Math.round((s.height * w) / s.width)));
    const sum = (hs) => hs.reduce((a, b) => a + b, 0);
    let width = Math.min(Math.max(...sizes.map((s) => s.width)), maxWidth);
    let heights = heightsAt(width);
    if (sum(heights) > maxHeight) {
        width = Math.max(1, Math.floor((width * maxHeight) / sum(heights)));
        heights = heightsAt(width);
        // 반올림 때문에 몇 px 넘을 수 있다 — 들어갈 때까지 한 칸씩 줄인다
        while (sum(heights) > maxHeight && width > 1) {
            width -= 1;
            heights = heightsAt(width);
        }
    }
    let y = 0;
    const rects = heights.map((h) => { const r = { x: 0, y, width, height: h }; y += h; return r; });
    return { width, height: y, rects };
}
