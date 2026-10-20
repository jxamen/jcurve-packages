"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useAppHub = useAppHub;
/**
 * 입구(하단 버튼)를 그리는 앱이 쓰는 훅 — 목록과 칸 설정을 **한 번에** 받는다.
 *
 * 입구를 보일지(`section.on`) · 제목(`section.title`)을 알려고 `/family` 를 따로 부르고, 시트를 열 때 또 부르던 것을
 * 한 번으로 줄인다(2026-09-25). 받은 것을 `AppHubSheet` 의 `items` · `section` 에 그대로 넘기면 시트는 다시 부르지 않는다.
 *
 * (1.2.0) `storage` 를 넘기면 마지막으로 받은 목록 · 칸 설정을 저장해 두었다가 **켤 때 그 값으로 먼저** 그린다 — 서버 응답을 기다리느라 입구가
 * 늦게 나타나지 않는다(대표님 10-20 19:01 「늦게 로딩」). 입구는 `hub.visible` 로 그린다:
 *   - 저장값이 있으면 그 `section.on` 으로 바로(저장값을 읽는 동안 최대 300ms 는 false)
 *   - **첫 설치(저장값 없음)는 켜짐**
 *   - 서버가 **분명히 꺼짐(on:false)** 이라고 답한 뒤에만 숨기고, 그 꺼짐도 저장해 다음 켜기부터는 처음부터 숨긴다
 *   - 서버가 실패하면 저장값을 그대로 둔다
 * `storage` 를 안 넘기면 예전과 같고(`ready`/`visible` 은 처음부터 section.on 기준) 값 모양도 그대로다.
 *
 *   const hub = useAppHub({ base: API_BASE, token: APP_TOKEN, storage: AsyncStorage });
 *   {hub.visible ? <Entrance title={hub.section.title ?? '추천 포인트 앱 둘러보기'} /> : null}
 */
const react_1 = require("react");
const load_1 = require("./load");
const store_1 = require("./store");
function useAppHub(opts) {
    const { base, token, load, storage, storageKey } = opts;
    const hasStorage = (0, store_1.hubStorageUsable)(storage);
    const [state, dispatch] = (0, react_1.useReducer)(store_1.hubReduce, hasStorage, store_1.hubInitial);
    const storageRef = (0, react_1.useRef)(storage);
    storageRef.current = storage;
    const reload = (0, react_1.useCallback)(() => {
        const loader = load ?? (base ? (0, load_1.hubLoader)({ base, token }) : null);
        if (!loader) {
            dispatch({ type: 'failed' });
            return;
        }
        dispatch({ type: 'retry' });
        loader().then(hub => {
            dispatch({ type: 'server', hub });
            void (0, store_1.saveStoredHub)(storageRef.current, hub, storageKey);
        }, () => dispatch({ type: 'failed' }));
    }, [base, token, load, storageKey]);
    (0, react_1.useEffect)(() => { reload(); }, [reload]);
    // 저장값 — 켤 때 한 번(저장소가 바뀌면 다시). 저장소 객체가 렌더마다 새로 만들어져도 다시 읽지 않도록 ref 로 잡는다
    (0, react_1.useEffect)(() => {
        if (!hasStorage)
            return;
        let live = true;
        void (0, store_1.readStoredHub)(storageRef.current, storageKey).then(hub => { if (live)
            dispatch({ type: 'stored', hub }); });
        const timer = setTimeout(() => { if (live)
            dispatch({ type: 'timeout' }); }, store_1.HUB_STORAGE_WAIT_MS);
        return () => { live = false; clearTimeout(timer); };
    }, [hasStorage, storageKey]);
    const view = (0, store_1.hubView)(state);
    return { items: view.items, section: view.section, failed: state.failed, reload, visible: view.visible, ready: state.ready };
}
