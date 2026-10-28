"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SHEET_MIN_CONTAINER = exports.SHEET_MEASURE_TIMEOUT_MS = void 0;
exports.measureBox = measureBox;
exports.sheetFrame = sheetFrame;
exports.containerBoxOk = containerBoxOk;
exports.useSheetPlacement = useSheetPlacement;
/** How long a Modal sheet waits for its origin to be measured before it gives up and is drawn in the tree. */
exports.SHEET_MEASURE_TIMEOUT_MS = 800;
/** A container smaller than this cannot hold the sheet: the measure is not believed. */
exports.SHEET_MIN_CONTAINER = { w: 100, h: 200 };
const finite = (n) => typeof n === 'number' && Number.isFinite(n);
/** `node.measureInWindow` as a callback that is called exactly once with a box, or with null when the node cannot be measured or answers with numbers that are not numbers. Never throws. */
function measureBox(node, done) {
    let finished = false;
    const finish = (box) => { if (finished)
        return; finished = true; try {
        done(box);
    }
    catch { /* the caller's problem must not break the screen */ } };
    try {
        const target = node;
        if (!target || typeof target.measureInWindow !== 'function') {
            finish(null);
            return;
        }
        target.measureInWindow((x, y, w, h) => finish(finite(x) && finite(y) && finite(w) && finite(h) ? { x, y, w, h } : null));
    }
    catch {
        finish(null);
    }
}
/**
 * The container's rectangle inside the Modal: its window position minus the position of the Modal's own origin anchor. Null when either is missing, the container is too small to be
 * real, or the result lies further away than a screen (which would mean the two measures were taken in different coordinate systems).
 */
function sheetFrame(container, modalOrigin, win) {
    if (!container || !modalOrigin)
        return null;
    if (![container.x, container.y, container.w, container.h, modalOrigin.x, modalOrigin.y, win.width, win.height].every(finite))
        return null;
    if (container.w < exports.SHEET_MIN_CONTAINER.w || container.h < exports.SHEET_MIN_CONTAINER.h)
        return null;
    const left = container.x - modalOrigin.x;
    const top = container.y - modalOrigin.y;
    if (Math.abs(left) > win.width || Math.abs(top) > win.height)
        return null;
    if (left + container.w <= 0 || top + container.h <= 0)
        return null;
    return { left, top, width: container.w, height: container.h };
}
/** Could this box be the Chance container at all? (A zero-size or sliver box is a layout that has not happened yet, or a measure that is not to be believed.) */
function containerBoxOk(box) {
    return !!box && [box.x, box.y, box.w, box.h].every(finite) && box.w >= exports.SHEET_MIN_CONTAINER.w && box.h >= exports.SHEET_MIN_CONTAINER.h;
}
const same = (a, b) => (a === b) || (!!a && !!b && a.x === b.x && a.y === b.y && a.w === b.w && a.h === b.h);
/**
 * `enabled` = this entry may use a Modal at all (Chance placement, not switched off by the server). `sheetUp` = a sheet is open. The container is measured when its anchor is laid out
 * and again when a sheet opens; the Modal's origin is measured when the Modal's anchor is laid out and kept for the rest of the session (per window size). A sheet opened with no
 * container measure yet is drawn in the tree. A Modal that cannot be placed within `SHEET_MEASURE_TIMEOUT_MS` is given up for that opening.
 */
function useSheetPlacement({ enabled, sheetUp }) {
    const React = require('react');
    const { Dimensions } = require('react-native');
    const containerNode = React.useRef(null);
    const modalNode = React.useRef(null);
    const [container, setContainer] = React.useState(null);
    const [origin, setOrigin] = React.useState(null);
    const [gaveUp, setGaveUp] = React.useState(false);
    const win = Dimensions.get('window');
    const size = `${Math.round(win.width)}x${Math.round(win.height)}`;
    const sizeNow = React.useRef(size);
    sizeNow.current = size;
    const handlers = React.useRef(null);
    if (!handlers.current) {
        handlers.current = {
            setContainerNode(node) { containerNode.current = node; },
            setModalNode(node) { modalNode.current = node; },
            measureContainer() { measureBox(containerNode.current, (measured) => { const box = containerBoxOk(measured) ? measured : null; setContainer((prev) => (same(prev, box) ? prev : box)); }); },
            measureOrigin() { measureBox(modalNode.current, (box) => { if (box)
                setOrigin({ box, size: sizeNow.current }); }); },
        };
    }
    // a sheet opens: look at the container again (it may have moved since it was laid out); a sheet closes: the next opening starts with a clean slate
    React.useEffect(() => {
        if (sheetUp)
            handlers.current.measureContainer();
        else
            setGaveUp(false);
    }, [sheetUp]);
    const originBox = origin && origin.size === size ? origin.box : null;
    const frame = sheetFrame(container, originBox, win);
    // Decided once per opening, at the moment it opens: a Modal only with a container that had been measured by then. A sheet that opened in the tree stays in the tree (a measure
    // that arrives later must not swap it for a Modal halfway through its slide); a Modal can still be given up later (see below), never the other way round.
    const decided = React.useRef(null);
    if (!sheetUp)
        decided.current = null;
    else if (decided.current === null)
        decided.current = enabled && containerBoxOk(container) ? 'modal' : 'tree';
    // once the origin is known too, a frame that does not make sense also means the tree
    const wanted = decided.current === 'modal' && !gaveUp && !(originBox && !frame);
    const waiting = wanted && !frame;
    React.useEffect(() => {
        if (!waiting)
            return undefined;
        const timer = setTimeout(() => setGaveUp(true), exports.SHEET_MEASURE_TIMEOUT_MS);
        return () => clearTimeout(timer);
    }, [waiting]);
    return {
        mode: wanted ? 'modal' : 'tree',
        frame: wanted ? frame : null,
        anchorProps: {
            ref: handlers.current.setContainerNode, onLayout: handlers.current.measureContainer, collapsable: false, pointerEvents: 'none', testID: 'jcurve-combo-anchor',
            style: { position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 },
        },
        modalAnchorProps: {
            ref: handlers.current.setModalNode, onLayout: handlers.current.measureOrigin, collapsable: false, pointerEvents: 'none', testID: 'jcurve-combo-modal-anchor',
            style: { position: 'absolute', left: 0, top: 0, width: 1, height: 1 },
        },
    };
}
