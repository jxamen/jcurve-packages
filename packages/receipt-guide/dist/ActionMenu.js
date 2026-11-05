"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_MENU_THEME = void 0;
exports.ActionMenu = ActionMenu;
/**
 * 바텀시트 동작 고르개 — 「○○ 연동됨」 시트(주문 불러오기 · 불러온 주문 보기 · 사용 방법 보기 · 연동 해제 · 닫기).
 * 두 OS 모두 같은 앱 자체 시트 하나로 보인다(대표님 10-30: 안드 Alert 는 버튼 3개 한계로 「연동 해제 · 닫기」가 잘렸다).
 * 영수증 올리기 화면(Modal) 안에서 덮는 층(absoluteFill)으로 쓴다 — 중첩 Modal 을 피한다.
 * 항목 순서 · 글자는 호출한 쪽이 정해 넘긴다(연동됨 시트는 linkedMenuItems). 바깥(어둑한 바탕) · 「닫기」를 누르면 onClose.
 * 색 · 둥글기 · 글자 크기는 theme 으로(빠진 값은 기본값) — 영테크 ui/ActionMenu 를 옮겼다(2026-11-05 대표님 「화면도 패키지로 · 디자인만 앱마다」).
 */
const react_1 = __importDefault(require("react"));
const react_native_1 = require("react-native");
exports.DEFAULT_MENU_THEME = {
    bg: '#F4F8FF', card: '#FFFFFF', text: '#162343', sub: '#7D8598', danger: '#E5484D',
    radius: 24, itemRadius: 16, titleSize: 13, itemSize: 16, pad: 20,
};
function ActionMenu({ title, items, cancelLabel = '닫기', onClose, theme, insetBottom = 0 }) {
    const t = { ...exports.DEFAULT_MENU_THEME, ...theme };
    const gap = Math.round(t.pad / 2.5);
    return (react_1.default.createElement(react_native_1.View, { style: [react_native_1.StyleSheet.absoluteFill, s.root] },
        react_1.default.createElement(react_native_1.Pressable, { style: react_native_1.StyleSheet.absoluteFill, accessibilityRole: "button", accessibilityLabel: "\uB2EB\uAE30", onPress: onClose }),
        react_1.default.createElement(react_native_1.View, { style: { backgroundColor: t.bg, borderTopLeftRadius: t.radius, borderTopRightRadius: t.radius, paddingHorizontal: t.pad, paddingTop: t.pad, paddingBottom: insetBottom + Math.round(t.pad * 0.6), gap } },
            title ? react_1.default.createElement(react_native_1.Text, { style: { fontSize: t.titleSize, fontWeight: '700', color: t.sub, textAlign: 'center', paddingVertical: gap } }, title) : null,
            items.map((it, i) => (react_1.default.createElement(react_native_1.Pressable, { key: i, accessibilityRole: "button", accessibilityLabel: it.label, style: ({ pressed }) => [s.item, { backgroundColor: t.card, borderRadius: t.itemRadius }, pressed && s.pressed], onPress: () => { onClose(); it.onPress(); } },
                react_1.default.createElement(react_native_1.Text, { style: { fontSize: t.itemSize, fontWeight: '600', color: it.destructive ? t.danger : t.text } }, it.label)))),
            react_1.default.createElement(react_native_1.Pressable, { accessibilityRole: "button", accessibilityLabel: cancelLabel, style: ({ pressed }) => [s.item, { backgroundColor: t.card, borderRadius: t.itemRadius, marginTop: Math.round(gap / 2) }, pressed && s.pressed], onPress: onClose },
                react_1.default.createElement(react_native_1.Text, { style: { fontSize: t.itemSize, fontWeight: '600', color: t.sub } }, cancelLabel)))));
}
const s = react_native_1.StyleSheet.create({
    root: { backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end', zIndex: 40, elevation: 40 },
    item: { paddingVertical: 16, alignItems: 'center' },
    pressed: { opacity: 0.6 },
});
