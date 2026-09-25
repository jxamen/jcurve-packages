"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECTION = void 0;
exports.parseHub = parseHub;
exports.storeLoader = storeLoader;
exports.hubLoader = hubLoader;
exports.DEFAULT_SECTION = { on: true, title: null, desc: null };
/** `{base}/family` 응답 → 목록 + 칸 설정. 칸이 없던 옛 서버면 켜짐 · 기존 문구 */
function parseHub(j) {
    const o = (j && typeof j === 'object' ? j : {});
    const sec = o.section && typeof o.section === 'object' ? o.section : {};
    const text = (v) => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);
    return {
        items: Array.isArray(o.items) ? o.items : [],
        section: { on: sec.on !== false, title: text(sec.title), desc: text(sec.desc) },
    };
}
/**
 * `{base}/family` 를 부른다. `base` 는 앱이 쓰는 API 주소 그대로다
 * (예: `https://api.j-curve.co.kr/v1/carrotcash`) — 슬러그가 이미 들어 있다.
 *
 * **못 받으면 예외를 낸다.** 빈 목록으로 삼키면 화면이 「아직 다른 앱이 없어요」라고
 * 거짓말을 한다 — 「지금 못 불러왔다」와 「없다」는 다른 말이다.
 */
function storeLoader(opts) {
    const hub = hubLoader(opts);
    return async () => (await hub()).items;
}
/** `storeLoader` 와 같지만 칸 설정(`section`)도 함께 — 입구를 보일지 · 제목을 한 번 부르기로 정한다 */
function hubLoader(opts) {
    return async () => {
        const ctrl = new AbortController();
        const t = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 8000);
        try {
            const res = await fetch(opts.base.replace(/\/+$/, '') + '/family', {
                method: 'GET',
                headers: opts.token
                    ? { Accept: 'application/json', 'X-App-Token': opts.token }
                    : { Accept: 'application/json' },
                signal: ctrl.signal,
            });
            if (!res.ok)
                throw new Error('family ' + res.status);
            return parseHub(await res.json());
        }
        finally {
            clearTimeout(t);
        }
    };
}
