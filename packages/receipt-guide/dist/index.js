"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stitchLayout = exports.stitchReceipts = exports.pickReceiptImages = exports.platformName = exports.pickLimit = exports.isPlatform = exports.guideOf = exports.PLATFORM_ORDER = exports.GUIDES = void 0;
exports.ReceiptGuide = ReceiptGuide;
exports.PlatformChooser = PlatformChooser;
const jsx_runtime_1 = require("react/jsx-runtime");
/**
 * 영수증 올리는 법 — 패키지 입구(나중에 `@jcurve/receipt-guide`). 쓰는 법은 README.md.
 *
 * 이 폴더 밖 앱 파일은 부르지 않는다 — 색 · 캐릭터 · 기록은 props 로 받는다.
 */
const react_1 = require("react");
const data_1 = require("./data");
const Chooser_1 = require("./Chooser");
const Player_1 = require("./Player");
const ui_1 = require("./ui");
var data_2 = require("./data");
Object.defineProperty(exports, "GUIDES", { enumerable: true, get: function () { return data_2.GUIDES; } });
Object.defineProperty(exports, "PLATFORM_ORDER", { enumerable: true, get: function () { return data_2.PLATFORM_ORDER; } });
Object.defineProperty(exports, "guideOf", { enumerable: true, get: function () { return data_2.guideOf; } });
Object.defineProperty(exports, "isPlatform", { enumerable: true, get: function () { return data_2.isPlatform; } });
Object.defineProperty(exports, "pickLimit", { enumerable: true, get: function () { return data_2.pickLimit; } });
Object.defineProperty(exports, "platformName", { enumerable: true, get: function () { return data_2.platformName; } });
var pick_1 = require("./pick");
Object.defineProperty(exports, "pickReceiptImages", { enumerable: true, get: function () { return pick_1.pickReceiptImages; } });
var stitch_1 = require("./stitch");
Object.defineProperty(exports, "stitchReceipts", { enumerable: true, get: function () { return stitch_1.stitchReceipts; } });
var stitchLayout_1 = require("./stitchLayout");
Object.defineProperty(exports, "stitchLayout", { enumerable: true, get: function () { return stitchLayout_1.stitchLayout; } });
function useCtx({ theme, renderCharacter }) {
    return (0, react_1.useMemo)(() => ({ theme: { ...ui_1.DEFAULT_THEME, ...theme }, renderCharacter }), [theme, renderCharacter]);
}
/** 앱별 안내 재생기 — 저절로 흘러가고 끝에서 [지금 올리기] */
function ReceiptGuide({ platform, appName, onClose, onUpload, blockedNote, track, ...common }) {
    const ctx = useCtx(common);
    const trackRef = (0, react_1.useRef)(track);
    trackRef.current = track;
    /** 지금 보는 안내 — 장면의 link(컬리 → 네이버페이)로 바뀔 수 있다. 부모가 다른 앱을 열면 그쪽으로 */
    const [current, setCurrent] = (0, react_1.useState)(platform);
    (0, react_1.useEffect)(() => { setCurrent(platform); }, [platform]);
    (0, react_1.useEffect)(() => { if (current)
        trackRef.current?.('receipt_guide_open', { app: current }); }, [current]);
    if (!platform || !current)
        return null;
    return ((0, jsx_runtime_1.jsx)(ui_1.GuideProvider, { value: ctx, children: (0, jsx_runtime_1.jsx)(Player_1.Player, { guide: (0, data_1.guideOf)(current), appName: appName, onClose: onClose, onUpload: () => onUpload(current), onDone: () => trackRef.current?.('receipt_guide_done', { app: current }), onSwitch: setCurrent, blockedNote: blockedNote }, current) }));
}
/** 어떤 영수증인가 고르는 칸 — 올리기 화면 첫 자리에 그대로 놓는다 */
function PlatformChooser({ theme, renderCharacter, track, onGuide, onQuick, ...rest }) {
    const ctx = useCtx({ theme, renderCharacter });
    return ((0, jsx_runtime_1.jsx)(ui_1.GuideProvider, { value: ctx, children: (0, jsx_runtime_1.jsx)(Chooser_1.Chooser, { ...rest, onGuide: (app) => { onGuide(app); track?.('receipt_platform_pick', { platform: app }); }, onQuick: (app) => { onQuick(app); track?.('receipt_platform_pick', { platform: app }); } }) }));
}
