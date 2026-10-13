"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.localizeSection = localizeSection;
exports.useAppHub = useAppHub;
/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 */
const react_1 = require("react");
const i18n_1 = require("./i18n");
const load_1 = require("./load");
/**
 * (1.1.1) 어드민 제목 · 설명을 그 언어로 — 표에 있는 문구(예 「추천 앱 둘러보기」)만 바꾸고 나머지는 그대로.
 * 한국어면 **받은 객체 그대로** 돌려준다(지금과 같은 값 · 같은 참조).
 */
function localizeSection(section, lang) {
    if ((0, i18n_1.normLang)(lang) === 'ko')
        return section;
    return { ...section, title: section.title === null ? null : (0, i18n_1.t)(section.title, lang), desc: section.desc === null ? null : (0, i18n_1.t)(section.desc, lang) };
}
function useAppHub(opts) {
    const [hub, setHub] = (0, react_1.useState)(null);
    const [failed, setFailed] = (0, react_1.useState)(false);
    const { base, token, load, lang } = opts;
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
    const raw = hub?.section ?? load_1.DEFAULT_SECTION;
    const section = (0, react_1.useMemo)(() => localizeSection(raw, lang), [raw, lang]);
    return { items: hub?.items ?? null, section, failed, reload };
}
