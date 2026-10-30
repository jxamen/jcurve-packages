// 0.6.6 — the 「포인트 빨리 모으기」 sheet in a Modal (a window above the app, out of the Chance screen's view tree), placed from two window measures; every doubt falls back to the
// tree-drawn sheet of 0.6.5. Server switches: display.sheet_modal "off" (no Modal), display.sheet_embed_block "off" (no shielding of the embedded 찬스2 view).
const {test} = require('node:test');
const assert = require('node:assert/strict');
const {withReact, walk, byLabel, texts, tick, hasSheet, findSheet} = require('./harness.cjs');
const api = require('../dist');
const frameMod = require('../dist/comboSheetFrame');

const TODAY = () => api.kstDate();
const mission = (id, extra = {}) => ({id, name: `일 ${id}`, points: 1008, todo: '하나 하기', level: 'easy', ...extra});
const raw = (display) => ({date: TODAY(), bundles: [{goal: 1000, missions: [mission('abc123def456', {campaignKey: '352216486'})]}], ...(display ? {display} : {})});
const box = (x, y, w, h) => ({x, y, w, h});
const node = (b) => ({measureInWindow: (cb) => cb(b.x, b.y, b.w, b.h)});
const THROWS = {measureInWindow() { throw new Error('native gone'); }};
const anchor = (tree) => walk(tree).find((n) => n.props && n.props.testID === 'jcurve-combo-anchor');
const modalAnchor = (tree) => walk(tree).find((n) => n.props && n.props.testID === 'jcurve-combo-modal-anchor');
const modal = (tree) => walk(tree).find((n) => n.type === 'Modal');
const sheetInModal = (tree) => (modal(tree) ? findSheet(modal(tree)) : undefined);

// A Chance entry whose container has been laid out (`containerNode` answers measureInWindow with `containerBox`) — as soon as it renders on a device.
const start = async ({make}, {display, containerNode, onLayout = true, extra = {}} = {}) => {
  const host = make();
  const mount = () => host.render(() => api.ComboEntry({placement: 'chance', load: async () => ({ok: true, combos: raw(display)}), loadKey: 1, usn: 'a'.repeat(64), campaigns: {list: async () => [], open: async () => true}, ...extra}));
  mount(); host.flush(); await tick(); mount(); host.flush(); await tick();
  let tree = mount(); host.flush();
  if (containerNode !== undefined) {
    const a = anchor(tree);
    if (a) { a.props.ref(containerNode); if (onLayout) a.props.onLayout(); }
    tree = mount(); host.flush();
  }
  const again = () => { host.flush(); return mount(); };
  return {host, tree, again, openNow: () => { assert.equal(api.requestOpenCombos(), true); return again(); }};
};
const CONTAINER = box(0, 100, 400, 700);

/* ── the placement rules (pure) ─────────────────────────────────────────────────────────────────── */

test('sheetFrame: the container\'s place inside the Modal is its window position minus the Modal\'s own origin; anything that does not make sense is null', () => {
  const win = {width: 400, height: 900};
  assert.deepEqual(frameMod.sheetFrame(box(0, 100, 400, 700), box(0, 0, 1, 1), win), {left: 0, top: 100, width: 400, height: 700});
  assert.deepEqual(frameMod.sheetFrame(box(0, 124, 400, 700), box(0, 24, 1, 1), win), {left: 0, top: 100, width: 400, height: 700}, 'a Modal window that starts below the status bar');
  assert.deepEqual(frameMod.sheetFrame(box(12, 100, 380, 700), box(0, 0, 1, 1), win), {left: 12, top: 100, width: 380, height: 700});
  assert.equal(frameMod.sheetFrame(null, box(0, 0, 1, 1), win), null);
  assert.equal(frameMod.sheetFrame(box(0, 100, 400, 700), null, win), null);
  assert.equal(frameMod.sheetFrame(box(NaN, 100, 400, 700), box(0, 0, 1, 1), win), null);
  assert.equal(frameMod.sheetFrame(box(0, 100, 0, 0), box(0, 0, 1, 1), win), null, 'a zero-size container is not real');
  assert.equal(frameMod.sheetFrame(box(0, 100, 99, 700), box(0, 0, 1, 1), win), null, 'too narrow');
  assert.equal(frameMod.sheetFrame(box(0, 100, 400, 199), box(0, 0, 1, 1), win), null, 'too short');
  assert.equal(frameMod.sheetFrame(box(0, 5000, 400, 700), box(0, 0, 1, 1), win), null, 'further away than a screen: different coordinate systems');
  assert.equal(frameMod.sheetFrame(box(0, 100, 400, 700), box(0, 0, 1, 1), {width: NaN, height: 900}), null);
});

test('measureBox: calls back exactly once, with null for a node that cannot be measured, throws, or answers with non-numbers', () => {
  const got = [];
  frameMod.measureBox(node(box(1, 2, 3, 4)), (b) => got.push(b));
  frameMod.measureBox(null, (b) => got.push(b));
  frameMod.measureBox({}, (b) => got.push(b));
  frameMod.measureBox(THROWS, (b) => got.push(b));
  frameMod.measureBox(node(box(1, NaN, 3, 4)), (b) => got.push(b));
  frameMod.measureBox({measureInWindow: (cb) => { cb(1, 2, 3, 4); cb(5, 6, 7, 8); }}, (b) => got.push(b));
  frameMod.measureBox(node(box(1, 2, 3, 4)), () => { throw new Error('the caller\'s bug'); });
  assert.deepEqual(got, [box(1, 2, 3, 4), null, null, null, null, box(1, 2, 3, 4)]);
});

/* ── the sheet in a Modal ───────────────────────────────────────────────────────────────────────── */

test('a measured container opens the sheet in a Modal: dimmed at once, the sheet in the container\'s place as soon as the Modal\'s origin is measured (a status-bar offset cancels out)', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(box(0, 124, 400, 700))});
  assert.equal(modal(s.tree), undefined, 'no Modal while closed');
  const opened = s.openNow();
  const m = modal(opened);
  assert.ok(m, 'a Modal');
  assert.equal(m.props.transparent, true); assert.equal(m.props.animationType, 'none'); assert.equal(m.props.visible, true);
  assert.equal(typeof m.props.onRequestClose, 'function');
  assert.ok(byLabel(m, '닫기'), 'a backdrop that closes');
  assert.ok(sheetInModal(opened), '0.6.8: the sheet is in the Modal at once (the whole window until the origin is known)');
  const ma = modalAnchor(opened);
  assert.ok(ma, 'the 1×1 anchor at the Modal\'s origin');
  assert.deepEqual(ma.props.style, {position: 'absolute', left: 0, top: 0, width: 1, height: 1});
  ma.props.ref(node(box(0, 24, 1, 1))); ma.props.onLayout();
  const placed = s.again();
  const sheet = sheetInModal(placed);
  assert.ok(sheet, 'the sheet is in the Modal now');
  const frame = walk(modal(placed)).find((n) => n.props && n.props.style && n.props.style.position === 'absolute' && n.props.style.width === 400 && n.props.style.height === 700);
  assert.deepEqual([frame.props.style.left, frame.props.style.top], [0, 100], 'container (124) minus the Modal\'s origin (24)');
  assert.equal(frame.props.pointerEvents, 'box-none');
  assert.equal(sheet.props.style.top, api.COMBO_SHEET_TOP, 'and under the chip row exactly as in the tree');
  assert.equal(sheet.props.style.bottom, 0);
  assert.ok(texts(placed).some((x) => String(x).includes('일 abc123def456')), 'the guide is the sheet\'s content');
  assert.equal(hasSheet({children: [placed]}) && walk(placed).filter((n) => n.type === 'Animated.View' && n.props.style && n.props.style.bottom === 0).length, 1, 'one sheet, not two');
}));

test('the tab-row inset moves the sheet down inside the Modal as it does in the tree', () => withReact(async (ctx) => {
  api.setChanceTabInset(45);
  try {
    const s = await start(ctx, {containerNode: node(CONTAINER)});
    const opened = s.openNow();
    const ma = modalAnchor(opened); ma.props.ref(node(box(0, 0, 1, 1))); ma.props.onLayout();
    assert.equal(sheetInModal(s.again()).props.style.top, api.COMBO_SHEET_TOP + 45);
  } finally { api.setChanceTabInset(0); }
}));

test('tapping outside the sheet (the backdrop) or the system back closes it, and the next opening already knows the Modal\'s origin', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(CONTAINER)});
  let opened = s.openNow();
  const ma = modalAnchor(opened); ma.props.ref(node(box(0, 0, 1, 1))); ma.props.onLayout();
  opened = s.again();
  assert.ok(sheetInModal(opened));
  byLabel(modal(opened), '닫기').props.onPress();
  assert.equal(modal(s.again()), undefined, 'the backdrop closed it');
  opened = s.openNow();
  assert.ok(sheetInModal(opened), 'reopened with no new measure of the origin: the sheet is there at once');
  modal(opened).props.onRequestClose();
  assert.equal(modal(s.again()), undefined, 'the system back closed it');
}));

test('the 「무료체험 확인」 sheet is drawn the same way (a Modal, the sheet in the container\'s place once the origin is known)', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(CONTAINER), extra: {loadTrials: async () => ({ok: true, trials: []})}});
  assert.equal(api.requestOpenTrials(), true);       // the way a push opens it
  const tree = s.again();
  assert.ok(modal(tree), 'a Modal for the trials sheet too');
  const ma = modalAnchor(tree); ma.props.ref(node(box(0, 0, 1, 1))); ma.props.onLayout();
  const placed = s.again();
  assert.ok(sheetInModal(placed), 'the sheet is in the Modal');
  assert.ok(texts(placed).includes('무료체험 확인'), 'and it is the trials screen: ' + texts(placed).join('|'));
}));

/* ── falling back to the tree ───────────────────────────────────────────────────────────────────── */

test('display.sheet_modal "off": no Modal, no anchor, the sheet is in the tree exactly as in 0.6.5', () => withReact(async (ctx) => {
  const s = await start(ctx, {display: {sheet_modal: 'off'}, containerNode: node(CONTAINER)});
  assert.equal(anchor(s.tree), undefined, 'no measuring anchor either');
  const opened = s.openNow();
  assert.equal(modal(opened), undefined);
  assert.equal(hasSheet(opened), true);
}));

test('0.6.8: a container that was never laid out or cannot be measured still opens the sheet in its Modal (the whole window: over the tab bar and banner)', () => withReact(async (ctx) => {
  for (const spec of [{containerNode: undefined}, {containerNode: node(CONTAINER), onLayout: false}, {containerNode: THROWS}, {containerNode: node(box(0, NaN, 400, 700))}, {containerNode: node(box(0, 100, 0, 0))}, {containerNode: null}]) {
    const s = await start(ctx, spec);
    const opened = s.openNow();
    assert.ok(modal(opened), JSON.stringify(Object.keys(spec)));
    assert.equal(hasSheet(opened), true, 'the sheet is there');
    assert.equal(sheetInModal(s.again()) !== undefined, true, 'still in the Modal');
    api.listenForComboRequests({priority: 0, open() {}})();
  }
}));

test('0.6.8: a frame that does not make sense (the two measures in different coordinate systems): the sheet stays in its Modal, over the whole window', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(CONTAINER)});
  const opened = s.openNow();
  assert.ok(modal(opened));
  const ma = modalAnchor(opened); ma.props.ref(node(box(0, 5000, 1, 1))); ma.props.onLayout();
  const after = s.again();
  assert.ok(modal(after), 'the Modal stays');
  assert.ok(sheetInModal(after), 'the sheet is in it');
}));

test('0.6.8: a Modal whose origin never gets measured keeps the sheet in the Modal (full window) after the wait', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(CONTAINER)});
  const opened = s.openNow();
  assert.ok(modal(opened) && sheetInModal(opened), 'at once');
  s.again();
  await tick(frameMod.SHEET_MEASURE_TIMEOUT_MS + 80);
  const after = s.again();
  assert.ok(modal(after) && sheetInModal(after), 'still in the Modal');
}));

test('a closed sheet starts the next opening with a clean slate (a give-up does not stick)', () => withReact(async (ctx) => {
  const s = await start(ctx, {containerNode: node(CONTAINER)});
  s.openNow(); s.again();
  await tick(frameMod.SHEET_MEASURE_TIMEOUT_MS + 80);
  assert.equal(hasSheet(s.again()), true, 'tree after the give-up');
  byLabel(s.again(), '닫기').props.onPress();
  s.again();
  assert.ok(modal(s.openNow()), 'the Modal is tried again on the next opening');
}));

/* ── the diagnostics and the embed switch ──────────────────────────────────────────────────────── */

const withLog = async (run) => {
  const real = console.log; const lines = [];
  console.log = (...args) => { lines.push(args.join(' ')); };
  try { await run(lines); } finally { console.log = real; }
};

test('no diagnostic lines: opening a Modal sheet writes nothing to the console (0.6.7)', () => withReact(async (ctx) => {
  await withLog(async (lines) => {
    const s = await start(ctx, {containerNode: node(CONTAINER)});
    const opened = s.openNow();
    const ma = modalAnchor(opened); ma.props.ref(node(box(0, 0, 1, 1))); ma.props.onLayout();
    s.again(); s.again();
    assert.deepEqual(lines.filter((l) => String(l).includes('[combos-sheet]')), []);
  });
}));

test('the sheet signal for the embedded view: true while a sheet is open (default), false after, and never true when display.sheet_embed_block is "off"', () => withReact(async (ctx) => {
  api.setChanceSheetOpen(false);
  const s = await start(ctx, {containerNode: node(CONTAINER)});
  assert.equal(api.getChanceSheetOpen(), false);
  s.openNow(); s.again();
  assert.equal(api.getChanceSheetOpen(), true, 'a sheet is open and the shield is on by default');
  byLabel(modal(s.again()) || s.again(), '닫기').props.onPress();
  s.again(); s.again();
  assert.equal(api.getChanceSheetOpen(), false, 'closed');
  api.listenForComboRequests({priority: 0, open() {}})();
  const off = await start(ctx, {display: {sheet_embed_block: 'off'}, containerNode: node(CONTAINER)});
  off.openNow(); off.again();
  assert.equal(api.getChanceSheetOpen(), false, 'switched off by the server');
}));

test('display switches survive normalizing (the server\'s spelling is read, the kept spelling too, anything but "off" is ignored)', () => {
  const d = (display) => api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', {points: 1000})]}], display}).display;
  assert.deepEqual([d({sheet_modal: 'off'}).sheetModal, d({sheet_embed_block: 'off'}).sheetEmbedBlock], ['off', 'off']);
  assert.deepEqual([d({sheetModal: 'off'}).sheetModal, d({sheetEmbedBlock: 'off'}).sheetEmbedBlock], ['off', 'off']);
  for (const v of ['on', 'yes', true, 0, null, undefined]) { assert.equal(d({sheet_modal: v}).sheetModal, undefined, String(v)); assert.equal(d({sheet_embed_block: v}).sheetEmbedBlock, undefined, String(v)); }
  const once = d({sheet_modal: 'off', sheet_embed_block: 'off'});
  assert.deepEqual(api.normalizeTodayCombos({date: TODAY(), bundles: [{goal: 1000, missions: [mission('b1', {points: 1000})]}], display: once}).display, once, 'normalizing twice is the same');
});
