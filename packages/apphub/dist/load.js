"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.storeLoader = storeLoader;
/**
 * `{base}/family` 를 부른다. `base` 는 앱이 쓰는 API 주소 그대로다
 * (예: `https://api.j-curve.co.kr/v1/carrotcash`) — 슬러그가 이미 들어 있다.
 *
 * **못 받으면 예외를 낸다.** 빈 목록으로 삼키면 화면이 「아직 다른 앱이 없어요」라고
 * 거짓말을 한다 — 「지금 못 불러왔다」와 「없다」는 다른 말이다.
 */
function storeLoader(opts) {
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
            const j = (await res.json());
            return Array.isArray(j.items) ? j.items : [];
        }
        finally {
            clearTimeout(t);
        }
    };
}
