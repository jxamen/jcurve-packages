"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.topLinkLayer = topLinkLayer;
function topLinkLayer(s) {
    if (s.ordersOpen)
        return 'orders';
    if (s.importing)
        return 'importing';
    if (s.login)
        return 'login';
    if (s.consenting)
        return 'consenting';
    return null;
}
