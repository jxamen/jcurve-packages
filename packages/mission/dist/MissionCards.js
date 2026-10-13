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
exports.MissionCards = MissionCards;
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = __importStar(require("react"));
const react_native_1 = require("react-native");
const cards_1 = require("./cards");
const states_1 = require("./states");
const i18n_1 = require("./i18n");
const EMPTY = [];
function renderIcon(icon) {
    if (typeof icon === 'number' || (icon && typeof icon === 'object' && !react_1.default.isValidElement(icon) && ('uri' in icon || Array.isArray(icon)))) {
        return (0, jsx_runtime_1.jsx)(react_native_1.Image, { source: icon, style: s.image, resizeMode: "contain" });
    }
    return icon;
}
/** 모든 앱이 같은 머리글·카드 목록·광고 슬롯 구조를 쓴다. */
function MissionCards({ fetchJson, fallbackCards = EMPTY, title, subtitle, theme, icons, character, renderAfterCards, onOpenShopping, onOpenStamps, lang }) {
    const heading = title === undefined ? (0, i18n_1.t)('미션', lang) : title;
    const sub = subtitle === undefined ? (0, i18n_1.t)('미션에 참여하고 포인트를 받아요', lang) : subtitle;
    const colors = { ...states_1.DEFAULT_THEME, ...theme?.colors };
    const [cards, setCards] = (0, react_1.useState)(() => (0, cards_1.normalizeCards)(fallbackCards));
    (0, react_1.useEffect)(() => {
        let live = true;
        setCards((0, cards_1.normalizeCards)(fallbackCards));
        void (0, cards_1.fetchCards)(fetchJson, fallbackCards).then(result => { if (live)
            setCards(result); });
        return () => { live = false; };
    }, [fetchJson, fallbackCards]);
    return (0, jsx_runtime_1.jsxs)(react_native_1.ScrollView, { style: { flex: 1, backgroundColor: colors.bg }, contentContainerStyle: s.content, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.header, children: [(0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.texts, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { accessibilityRole: "header", style: [s.heading, { color: colors.text }], children: heading }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.subtitle, { color: colors.sub }], children: sub })] }), character] }), (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.cards, children: cards.map(card => (0, jsx_runtime_1.jsxs)(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: `${card.title}, ${card.desc || ''}`, onPress: () => card.type === 'apihub_shopping' ? onOpenShopping(card) : onOpenStamps(card), style: ({ pressed }) => [s.card, { backgroundColor: colors.card, borderColor: colors.line, borderRadius: theme?.radius ?? 20, opacity: pressed ? 0.9 : 1 }], children: [(0, jsx_runtime_1.jsx)(react_native_1.View, { style: [s.icon, { backgroundColor: colors.bg }], children: card.icon ? (0, jsx_runtime_1.jsx)(react_native_1.Image, { source: { uri: card.icon }, style: s.image, resizeMode: "contain" }) : renderIcon(icons?.[card.type] ?? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: { color: colors.accent, fontSize: 28 }, children: card.type === 'apihub_shopping' ? '▣' : '✓' })) }), (0, jsx_runtime_1.jsxs)(react_native_1.View, { style: s.texts, children: [(0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.title, { color: colors.text }], children: card.title }), card.desc ? (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.subtitle, { color: colors.sub }], children: card.desc }) : null] }), (0, jsx_runtime_1.jsx)(react_native_1.Text, { style: [s.chevron, { color: colors.sub }], children: "\u203A" })] }, card.id)) }), renderAfterCards ? (0, jsx_runtime_1.jsx)(react_native_1.View, { style: s.after, children: renderAfterCards() }) : null] });
}
const s = react_native_1.StyleSheet.create({
    content: { padding: 16, paddingBottom: 32 },
    header: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
    heading: { fontSize: 26, fontWeight: '800' },
    texts: { flex: 1, gap: 4 },
    cards: { gap: 16 },
    card: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 20, borderWidth: 1 },
    icon: { width: 64, height: 64, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
    image: { width: 52, height: 52 },
    title: { fontSize: 16, fontWeight: '800' },
    subtitle: { fontSize: 13, lineHeight: 20 },
    chevron: { fontSize: 28 },
    after: { marginTop: 16 },
});
