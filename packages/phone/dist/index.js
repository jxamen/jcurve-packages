"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.looksValid = exports.format = exports.digits = void 0;
/** Display-only helpers. SMS verification was removed in v2; use @jcurve/identity. */
var phone_1 = require("./phone");
Object.defineProperty(exports, "digits", { enumerable: true, get: function () { return phone_1.digits; } });
Object.defineProperty(exports, "format", { enumerable: true, get: function () { return phone_1.format; } });
Object.defineProperty(exports, "looksValid", { enumerable: true, get: function () { return phone_1.looksValid; } });
