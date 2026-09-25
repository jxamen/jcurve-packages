"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppHub = useAppHub;
/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 */
const react_1 = require("react");
const load_1 = require("./load");
function useAppHub(opts) {
    const [hub, setHub] = (0, react_1.useState)(null);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const { base, token, load } = opts;
    const reload = (0, react_1.useCallback)(() => {
        const loader = load ?? (base ? (0, load_1.hubLoader)({ base, token }) : null);
        if (!loader) {
            setFailed(true);
            return;
        }
        setFailed(false);
        loader().then(setHub, () => setFailed(true));
    }, [base, token, load]);
    (0, react_1.useEffect)(() => { reload(); }, [reload]);
    return { items: hub?.items ?? null, section: hub?.section ?? load_1.DEFAULT_SECTION, failed, reload };
}
