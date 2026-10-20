"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useHomeRows = useHomeRows;
const react_1 = require("react");
const home_1 = require("./home");
/**
 * (0.5.0) 홈 목록에 서버 설정(mission/home)을 얹는 훅 — 화면이 뜰 때 · `refreshKey` 가 바뀔 때(홈으로 돌아올 때 등) 받는다(60초 캐시).
 * 받기 전 · 실패면 앱 기본 목록 그대로라 목록이 비거나 깜빡이지 않는다.
 *
 *   const { items, config } = useHomeRows(fetchJson, baseItems, { bag: 'quiz1', pin: 'quiz2', ticket: 'lucky_chance' }, tab === 'home');
 *   <BenefitQuickList items={items} … />
 */
function useHomeRows(fetchJson, items, keys, refreshKey) {
    const [config, setConfig] = (0, react_1.useState)(home_1.EMPTY_HOME);
    (0, react_1.useEffect)(() => {
        if (!fetchJson)
            return;
        let live = true;
        void (0, home_1.fetchHomeConfig)(fetchJson).then(c => { if (live)
            setConfig(c); });
        return () => { live = false; };
    }, [fetchJson, refreshKey]);
    const merged = (0, react_1.useMemo)(() => (0, home_1.applyHomeRows)(items, config.rows, keys), [items, config.rows, keys]);
    return { items: merged, config };
}
