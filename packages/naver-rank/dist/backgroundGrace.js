"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.backgroundGrace = backgroundGrace;
/** Permission sheets may briefly background the app. Keep the current job intact. */
function backgroundGrace(onBackground) {
    let timer;
    let disposed = false;
    const cancel = () => { clearTimeout(timer); timer = undefined; };
    return {
        change(state) {
            if (disposed)
                return;
            if (state === 'active') {
                cancel();
                return;
            }
            // Inactive alone is not background, and must not extend an existing deadline.
            if (state === 'background' && timer === undefined)
                timer = setTimeout(() => {
                    timer = undefined;
                    if (!disposed)
                        onBackground();
                }, 10000);
        },
        dispose() { disposed = true; cancel(); },
    };
}
