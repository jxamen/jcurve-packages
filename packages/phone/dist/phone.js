"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksValid = exports.digits = void 0;
exports.format = format;
/** Phone display helpers only. Identity verification belongs to @jcurve/identity. */
const digits = (value) => value.replace(/\D/g, '');
exports.digits = digits;
function format(value) {
    const d = (0, exports.digits)(value).slice(0, 11);
    if (d.length < 4)
        return d;
    if (d.length < 8)
        return `${d.slice(0, 3)}-${d.slice(3)}`;
    return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
}
const looksValid = (value) => /^01[016789]\d{7,8}$/.test((0, exports.digits)(value));
exports.looksValid = looksValid;
