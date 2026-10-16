"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shoppingPageDelay = exports.SHOPPING_MAX_PAGES = exports.SHOPPING_MAX_RANK = exports.SHOPPING_PAGE_SIZE = void 0;
exports.shoppingNextPage = shoppingNextPage;
exports.shoppingFallback = shoppingFallback;
const webThrottle_1 = require("./webThrottle");
exports.SHOPPING_PAGE_SIZE = 40;
exports.SHOPPING_MAX_RANK = 100;
exports.SHOPPING_MAX_PAGES = Math.ceil(exports.SHOPPING_MAX_RANK / exports.SHOPPING_PAGE_SIZE);
function shoppingNextPage(page, found) { return found || page >= exports.SHOPPING_MAX_PAGES ? undefined : page + 1; }
function shoppingFallback(code, page, attempts, manual) { return page === 1 && attempts < 2 && !manual && ['network', 'http_4xx'].includes(code); }
const shoppingPageDelay = (random = Math.random) => (0, webThrottle_1.randomDelay)(3, 6, random);
exports.shoppingPageDelay = shoppingPageDelay;
