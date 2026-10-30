"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADPOPCORN_PROVIDER_ID = void 0;
exports.isClosedProvider = isClosedProvider;
exports.registerChanceProvider = registerChanceProvider;
exports.unregisterChanceProvider = unregisterChanceProvider;
exports.chanceProviders = chanceProviders;
exports.chanceProviderById = chanceProviderById;
exports.subscribeChanceProviders = subscribeChanceProviders;
exports.notifyChanceProviders = notifyChanceProviders;
exports.useChanceProviders = useChanceProviders;
const entries = [];
const listeners = new Set();
/** 0.6.8: 이 회원에게 닫혀 있는가. 던지면 닫힌 것으로 본다(안전한 쪽). */
function isClosedProvider(provider) {
    try {
        return provider.closed?.() === true;
    }
    catch {
        return true;
    }
}
function usable(provider) {
    try {
        return provider.available() === true;
    }
    catch {
        return false;
    }
}
/** 같은 id 가 있으면 그 자리에서 바꾸고, 없으면 맨 뒤에 넣는다(= 탭 순서는 등록 순서). */
function registerChanceProvider(provider) {
    const at = entries.findIndex((entry) => entry.id === provider.id);
    if (at >= 0)
        entries[at] = provider;
    else
        entries.push(provider);
    notifyChanceProviders();
}
function unregisterChanceProvider(id) {
    const at = entries.findIndex((entry) => entry.id === id);
    if (at >= 0) {
        entries.splice(at, 1);
        notifyChanceProviders();
    }
}
/** 쓸 수 있는 제공자들(등록 순서). */
function chanceProviders() { return entries.filter(usable); }
function chanceProviderById(id) { return entries.find((entry) => entry.id === id); }
/** 제공자가 쓸 수 있게 되었거나 못 쓰게 되었을 때(설정이 왔다 · 초기화됨) 부른다. 화면이 탭을 다시 계산한다. 구독 해제 함수를 돌려준다. */
function subscribeChanceProviders(listener) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
}
function notifyChanceProviders() {
    for (const listener of [...listeners]) {
        try {
            listener();
        }
        catch { /* 듣는 쪽 하나가 나머지를 막지 않는다 */ }
    }
}
const signature = (list) => list.map((provider) => provider.id).join('|');
/** 화면용: 쓸 수 있는 제공자 목록. 목록이 바뀔 때만 다시 그린다. */
function useChanceProviders() {
    const React = require('react');
    const [list, setList] = React.useState(() => chanceProviders());
    React.useEffect(() => {
        const refresh = () => setList((now) => { const next = chanceProviders(); return signature(next) === signature(now) ? now : next; });
        refresh();
        return subscribeChanceProviders(refresh);
    }, []);
    return list;
}
/** 애드팝콘 — 찬스 화면의 본문 그 자체(`OfferwallView`). 이 자리는 항상 첫 번째다. */
exports.ADPOPCORN_PROVIDER_ID = 'adpopcorn';
registerChanceProvider({ id: exports.ADPOPCORN_PROVIDER_ID, name: '애드팝콘', kind: 'embedded', available: () => true });
