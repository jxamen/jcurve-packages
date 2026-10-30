"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.notifyState = notifyState;
exports.defaultTrialNotifyDeps = defaultTrialNotifyDeps;
exports.ensureTrialNotify = ensureTrialNotify;
const BACK_MAX_MS = 120000;
function notifications() {
    try {
        return require('expo-notifications');
    }
    catch {
        return null;
    }
}
async function notifyState() {
    const N = notifications();
    if (!N)
        return 'none';
    try {
        const p = await N.getPermissionsAsync();
        if (p.granted)
            return 'on';
        return p.canAskAgain ? 'ask' : 'off';
    }
    catch {
        return 'none';
    }
}
/** The default dependencies: the real phone. */
function defaultTrialNotifyDeps(hooks = {}) {
    const rn = () => require('react-native');
    return {
        state: notifyState,
        ask: async () => {
            const N = notifications();
            if (!N)
                return 'none';
            try {
                await hooks.beforeAsk?.();
                await N.requestPermissionsAsync();
            }
            catch {
                return 'none';
            }
            return notifyState();
        },
        confirmSettings: () => new Promise(resolve => {
            const { Alert } = rn();
            Alert.alert('알림이 꺼져 있어요', '설정에서 켜 주세요', [
                { text: '나중에', style: 'cancel', onPress: () => resolve(false) },
                { text: '설정 열기', onPress: () => resolve(true) },
            ], { cancelable: true, onDismiss: () => resolve(false) });
        }),
        openSettings: async () => {
            try {
                await hooks.beforeSettings?.();
            }
            catch { /* a hook must not stop the settings page */ }
            try {
                await rn().Linking.openSettings();
            }
            catch { /* it stays where it was */ }
        },
        backFromSettings: () => new Promise(resolve => {
            const { AppState } = rn();
            let left = AppState.currentState !== 'active';
            let done = false;
            let timer;
            let subscription;
            const finish = () => { if (done)
                return; done = true; if (timer)
                clearTimeout(timer); try {
                subscription?.remove();
            }
            catch { /* ignore */ } resolve(); };
            subscription = AppState.addEventListener('change', (next) => {
                if (next !== 'active')
                    left = true;
                else if (left)
                    finish();
            });
            timer = setTimeout(finish, BACK_MAX_MS);
        }),
        syncToken: async () => { try {
            await hooks.syncToken?.();
        }
        catch { /* the token upload is retried by the app on its own */ } },
    };
}
async function ensureTrialNotify(deps = defaultTrialNotifyDeps()) {
    try {
        let now = await deps.state();
        if (now === 'none')
            return 'none';
        if (now === 'ask')
            now = await deps.ask();
        if (now === 'on') {
            await deps.syncToken();
            return 'on';
        }
        if (now === 'none')
            return 'none';
        // refused: the app cannot ask again — tell, and open the settings
        if (!(await deps.confirmSettings()))
            return 'off';
        await deps.openSettings();
        await deps.backFromSettings();
        now = await deps.state();
        if (now === 'on') {
            await deps.syncToken();
            return 'on';
        }
        return 'off';
    }
    catch {
        return 'none';
    }
}
