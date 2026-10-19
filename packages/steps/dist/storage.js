"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepsStorage = void 0;
exports.configureStepsStorage = configureStepsStorage;
exports.getStepsStorage = getStepsStorage;
let adapter = null;
let prefix = '';
/** Use an account-specific namespace. Never mix different members' sensor counts. */
function configureStepsStorage(storage, namespace) { adapter = storage; prefix = namespace; }
/** A subscription retains its own account even when configuration changes. */
function getStepsStorage() {
    const scoped = adapter;
    const namespace = prefix;
    return {
        async getJson(key) {
            if (!scoped)
                throw new Error('configureStepsStorage required');
            const raw = await scoped.getItem(namespace + '.' + key);
            try {
                return raw ? JSON.parse(raw) : null;
            }
            catch {
                return null;
            }
        },
        async setJson(key, value) {
            if (!scoped)
                throw new Error('configureStepsStorage required');
            await scoped.setItem(namespace + '.' + key, JSON.stringify(value));
        },
    };
}
exports.stepsStorage = {
    getJson: (key) => getStepsStorage().getJson(key),
    setJson: (key, value) => getStepsStorage().setJson(key, value),
};
