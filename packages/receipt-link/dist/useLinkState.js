"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUseLinkState = createUseLinkState;
/** 주문내역 연동 상태 — 서버 스위치가 꺼졌거나 못 받으면 state 는 null. react 는 호출할 때 읽는다(없는 환경에서 import 만 해도 안전). */
const card_1 = require("./card");
function createUseLinkState(client) {
    return function useLinkState() {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const React = require('react');
        const [state, setState] = React.useState(null);
        const [loaded, setLoaded] = React.useState(false);
        React.useEffect(() => {
            let alive = true;
            void (0, card_1.loadCardState)(client).then((s) => { if (alive) {
                setState(s);
                setLoaded(true);
            } });
            return () => { alive = false; };
        }, []);
        return { state, setState, loaded };
    };
}
