"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useHomeRows = useHomeRows;
const react_1 = require("react");
const home_1 = require("./home");
const useHomeConfig_1 = require("./useHomeConfig");
/**
 * (0.5.0) 홈 목록에 서버 설정(mission/home)을 얹는 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 등) 받는다(60초 캐시).
 * 받기 전 · 실패면 앱 기본 목록 그대로라 목록이 비거나 깜빡이지 않는다.
 *
 *   const { items, config } = useHomeRows(fetchJson, baseItems, { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }, tab === 'home');
 *   <BenefitQuickList items={items} … />
 *
 * (0.4.6) 5번째 인자 `{ storage }` — 앱이 AsyncStorage 같은 저장소(`get`/`set`)를 넘기면 마지막으로 받은 서버 목록을 저장해 두고 켤 때 **그 값으로 먼저** 그린다
 * (앱 기본 순서로 그렸다가 서버 순서로 바뀌지 않게). 저장값을 읽는 동안(최대 300ms)은 `ready` 가 false 이니 그때는 목록을 그리지 않는 쪽이 좋다.
 * 저장소를 안 넘기면 예전과 같고 `ready` 는 늘 true.
 *
 *   const { items, ready } = useHomeRows(fetchJson, baseItems, keys, tab === 'home', { storage: AsyncStorage });
 */
function useHomeRows(fetchJson, items, keys, refreshKey, opts = {}) {
    const { config, ready } = (0, useHomeConfig_1.useHomeConfig)(fetchJson, refreshKey, opts.storage, opts.storageKey);
    const merged = (0, react_1.useMemo)(() => (0, home_1.applyHomeRows)(items, config.rows, keys), [items, config.rows, keys]);
    return { items: merged, config, ready };
}
