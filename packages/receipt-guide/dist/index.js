"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.LINK_STAGE_LABEL = exports.linkedMenuTitle = exports.linkedMenuItems = exports.DEFAULT_MENU_THEME = exports.ActionMenu = exports.DEFAULT_THEME = exports.stitchLayout = exports.stitchReceipts = exports.parseLinkSeen = exports.markLinkSeen = exports.linkGuide = exports.pickReceiptImages = exports.NEED_TWO_TEXT = exports.NEED_TWO_SHOTS = exports.shotChoices = exports.platformName = exports.pickLimit = exports.needsTwo = exports.isPlatform = exports.guideOf = exports.TWO_SHOT = exports.TWO_SAME_ORDER = exports.PLATFORM_ORDER = exports.GUIDES = void 0;
exports.ReceiptGuide = ReceiptGuide;
exports.PlatformChooser = PlatformChooser;
/**
 * @jcurve/receipt-guide 입구 — 전자 영수증 칩 카드(PlatformChooser) · 「○○ 연동됨」 시트(ActionMenu + linkedMenuItems) · 올리는 법 안내(ReceiptGuide · linkGuide) · 사진첩 · 이어 붙이기. 쓰는 법은 README.md.
 * 영테크 src/receiptGuide 를 그대로 옮겼다(2026-11-05 대표님 「전자 영수증 화면도 패키지로 — 디자인만 앱마다 다르게」).
 *
 * 이 폴더 밖 앱 파일은 부르지 않는다 — 색 · 캐릭터 · 기록은 props 로 받는다.
 */
const react_1 = __importStar(require("react"));
const data_1 = require("./data");
const Chooser_1 = require("./Chooser");
const Player_1 = require("./Player");
const ui_1 = require("./ui");
var data_2 = require("./data");
Object.defineProperty(exports, "GUIDES", { enumerable: true, get: function () { return data_2.GUIDES; } });
Object.defineProperty(exports, "PLATFORM_ORDER", { enumerable: true, get: function () { return data_2.PLATFORM_ORDER; } });
Object.defineProperty(exports, "TWO_SAME_ORDER", { enumerable: true, get: function () { return data_2.TWO_SAME_ORDER; } });
Object.defineProperty(exports, "TWO_SHOT", { enumerable: true, get: function () { return data_2.TWO_SHOT; } });
Object.defineProperty(exports, "guideOf", { enumerable: true, get: function () { return data_2.guideOf; } });
Object.defineProperty(exports, "isPlatform", { enumerable: true, get: function () { return data_2.isPlatform; } });
Object.defineProperty(exports, "needsTwo", { enumerable: true, get: function () { return data_2.needsTwo; } });
Object.defineProperty(exports, "pickLimit", { enumerable: true, get: function () { return data_2.pickLimit; } });
Object.defineProperty(exports, "platformName", { enumerable: true, get: function () { return data_2.platformName; } });
Object.defineProperty(exports, "shotChoices", { enumerable: true, get: function () { return data_2.shotChoices; } });
var pick_1 = require("./pick");
Object.defineProperty(exports, "NEED_TWO_SHOTS", { enumerable: true, get: function () { return pick_1.NEED_TWO_SHOTS; } });
Object.defineProperty(exports, "NEED_TWO_TEXT", { enumerable: true, get: function () { return pick_1.NEED_TWO_TEXT; } });
Object.defineProperty(exports, "pickReceiptImages", { enumerable: true, get: function () { return pick_1.pickReceiptImages; } });
var linkGuides_1 = require("./linkGuides");
Object.defineProperty(exports, "linkGuide", { enumerable: true, get: function () { return linkGuides_1.linkGuide; } });
Object.defineProperty(exports, "markLinkSeen", { enumerable: true, get: function () { return linkGuides_1.markLinkSeen; } });
Object.defineProperty(exports, "parseLinkSeen", { enumerable: true, get: function () { return linkGuides_1.parseLinkSeen; } });
var stitch_1 = require("./stitch");
Object.defineProperty(exports, "stitchReceipts", { enumerable: true, get: function () { return stitch_1.stitchReceipts; } });
var stitchLayout_1 = require("./stitchLayout");
Object.defineProperty(exports, "stitchLayout", { enumerable: true, get: function () { return stitchLayout_1.stitchLayout; } });
var ui_2 = require("./ui");
Object.defineProperty(exports, "DEFAULT_THEME", { enumerable: true, get: function () { return ui_2.DEFAULT_THEME; } });
var ActionMenu_1 = require("./ActionMenu");
Object.defineProperty(exports, "ActionMenu", { enumerable: true, get: function () { return ActionMenu_1.ActionMenu; } });
Object.defineProperty(exports, "DEFAULT_MENU_THEME", { enumerable: true, get: function () { return ActionMenu_1.DEFAULT_MENU_THEME; } });
var linkMenu_1 = require("./linkMenu");
Object.defineProperty(exports, "linkedMenuItems", { enumerable: true, get: function () { return linkMenu_1.linkedMenuItems; } });
Object.defineProperty(exports, "linkedMenuTitle", { enumerable: true, get: function () { return linkMenu_1.linkedMenuTitle; } });
var Chooser_2 = require("./Chooser");
Object.defineProperty(exports, "LINK_STAGE_LABEL", { enumerable: true, get: function () { return Chooser_2.LINK_STAGE_LABEL; } });
function useCtx({ theme, renderCharacter }) {
    return (0, react_1.useMemo)(() => ({ theme: { ...ui_1.DEFAULT_THEME, ...theme }, renderCharacter }), [theme, renderCharacter]);
}
/** 앱별 안내 재생기 — 저절로 흘러가며 되풀이하고, 아래에 [지금 올리기] 가 늘 떠 있다 */
function ReceiptGuide({ platform, appName, onClose, onUpload, cta, track, guide, ...common }) {
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
    return (react_1.default.createElement(ui_1.GuideProvider, { value: ctx },
        react_1.default.createElement(Player_1.Player, { key: current, guide: guide ?? (0, data_1.guideOf)(current), appName: appName, onClose: onClose, onUpload: () => onUpload(current), onDone: () => trackRef.current?.('receipt_guide_done', { app: current }), onSwitch: setCurrent, cta: cta })));
}
/** 어떤 영수증인가 고르는 칸 — 올리기 화면 첫 자리에 그대로 놓는다 */
function PlatformChooser({ theme, renderCharacter, track, onPick, onQuick, ...rest }) {
    const ctx = useCtx({ theme, renderCharacter });
    return (react_1.default.createElement(ui_1.GuideProvider, { value: ctx },
        react_1.default.createElement(Chooser_1.Chooser, { ...rest, onPick: (app) => { onPick(app); track?.('receipt_platform_pick', { platform: app }); }, onQuick: (app) => { onQuick(app); track?.('receipt_platform_pick', { platform: app }); } })));
}
