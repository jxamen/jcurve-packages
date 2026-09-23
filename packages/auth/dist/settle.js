"use strict";
/**
 * 로그인 직후 **안전 시점**(2.6) — 로그인 창이 완전히 닫히고 앱이 앞에 돌아와 조용해진 뒤.
 *
 * 머니트리 iOS(2026-09-23): 첫 설치 뒤 구글 로그인 → 홈에 들어오는 순간 가이드 팝업(RN `Modal`)을 열었는데,
 * 구글 창이 **닫히는 중**이라 Modal 이 못 올라가고 **보이지 않는 막만 남아 화면이 전부 안 눌렸다.**
 * `createReturnWatch` 가 막는 「밖에 다녀옴」과 다른 원인이라 그것으로는 못 막았다.
 *
 * 조용해졌다 = 도는 로그인이 없고 · 앱이 `active` 이고 · 로그인이 끝난 때와 마지막 AppState 변화에서
 * 둘 다 `quietMs`(기본 1초)가 지났다. 그 뒤 한 틱 더 기다려 푼다.
 * 이 파일은 `auth.ts` 를 부르지 않는다(import 고리를 만들지 않는다).
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.createSettle = createSettle;
function createSettle(busy, env, quietMs = 1000) {
    let state = env.appState() || 'active';
    let changedAt = 0;
    let endedAt = 0;
    env.onAppState((next) => { state = next; changedAt = env.now(); });
    let queue = Promise.resolve();
    const settled = () => !busy() && state === 'active' && env.now() - Math.max(changedAt, endedAt) >= quietMs;
    async function wait() {
        // 짧게 자주 본다 — 창이 닫히는 순간은 AppState 한 번으로 안 잡히는 경우가 있어(구글 iOS) 시각으로 가른다
        while (!settled())
            await env.sleep(100);
        await env.sleep(0); // 한 틱 더 — 막 닫힌 창의 마무리 그리기가 끝나게
    }
    return {
        /** 로그인이 끝났다(성공·실패·잊음) — 여기서부터 조용해질 때까지 센다 */
        ended: () => { endedAt = env.now(); },
        settled,
        wait,
        /** 차례로 — 앞의 것(돌려준 약속까지)이 끝나야 다음을 연다. 앞의 것이 실패해도 뒤는 연다 */
        run(fn) {
            const next = queue.then(wait).then(fn);
            queue = next.catch(() => undefined);
            return next;
        },
    };
}
