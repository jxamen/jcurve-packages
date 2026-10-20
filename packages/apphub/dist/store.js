"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HUB_STORAGE_WAIT_MS = exports.HUB_STORAGE_KEY = void 0;
exports.hubStorageUsable = hubStorageUsable;
exports.readStoredHub = readStoredHub;
exports.saveStoredHub = saveStoredHub;
exports.hubInitial = hubInitial;
exports.hubReduce = hubReduce;
exports.hubView = hubView;
/**
 * (1.2.0) 마지막으로 받은 「앱 모아보기」 목록 · 칸 설정(section)을 앱 저장소에 두었다가 **켤 때 그 값으로 먼저** 그린다 —
 * 입구(「추천 앱 둘러보기」)가 서버 응답(`section.on`)을 받기 전에는 숨겨져 있다가 늦게 나타나던 것(대표님 10-20 19:01 「늦게 로딩」)을 막는다.
 * React 를 가져오지 않는다(시험이 바로 돈다).
 */
const load_1 = require("./load");
function storageIo(storage) {
    if (!storage || typeof storage !== 'object')
        return null;
    if ('get' in storage && typeof storage.get === 'function' && 'set' in storage && typeof storage.set === 'function') {
        const s = storage;
        return { get: k => s.get(k), set: (k, v) => s.set(k, v) };
    }
    if ('getItem' in storage && typeof storage.getItem === 'function' && 'setItem' in storage && typeof storage.setItem === 'function') {
        const s = storage;
        return { get: k => s.getItem(k), set: (k, v) => s.setItem(k, v) };
    }
    return null;
}
/** 이 저장소를 쓸 수 있는가. 쓸 수 없으면 저장소를 안 넘긴 것과 같다 — 입구를 기다리게 하지 않는다 */
function hubStorageUsable(storage) {
    return storageIo(storage) !== null;
}
/** 저장 키 기본값 — 서버 · 계정마다 다른 목록을 쓰는 앱만 `storageKey` 로 바꾼다 */
exports.HUB_STORAGE_KEY = 'jcurve.apphub.family.v1';
/** 저장값을 읽는 데 이만큼(ms)까지만 기다린다 — 저장소가 응답이 없어도 입구가 영영 안 뜨지 않게 */
exports.HUB_STORAGE_WAIT_MS = 300;
const STORED_MAX_CHARS = 100000;
/** 저장해 둔 마지막 목록 · 칸 설정 — 없음 · 깨짐 · 모르는 판 · 저장소 오류는 null(첫 설치와 같다). 읽을 때도 서버 응답처럼 다시 거른다 */
async function readStoredHub(storage, key = exports.HUB_STORAGE_KEY) {
    const io = storageIo(storage);
    if (!io)
        return null;
    try {
        const raw = await io.get(key);
        if (typeof raw !== 'string' || raw === '' || raw.length > STORED_MAX_CHARS)
            return null;
        const saved = JSON.parse(raw);
        if (!saved || typeof saved !== 'object' || saved.v !== 1 || !saved.hub || typeof saved.hub !== 'object')
            return null;
        return (0, load_1.parseHub)(saved.hub);
    }
    catch {
        return null;
    }
}
/** 서버에서 **정상으로** 받은 목록 · 칸 설정을 저장한다 — 저장소 오류는 삼킨다(화면은 이미 그려졌다). 칸이 꺼짐(on:false)이라는 것도 저장한다 */
async function saveStoredHub(storage, hub, key = exports.HUB_STORAGE_KEY) {
    const io = storageIo(storage);
    if (!io)
        return;
    try {
        await io.set(key, JSON.stringify({ v: 1, at: Date.now(), hub: { items: hub.items, section: hub.section } }));
    }
    catch { /* 저장 실패는 다음에 다시 */ }
}
function hubInitial(hasStorage) {
    return { hub: null, ready: !hasStorage, fresh: false, fromStorage: false, failed: false, storage: hasStorage };
}
function hubReduce(s, e) {
    switch (e.type) {
        case 'stored':
            if (s.fresh)
                return s.ready ? s : { ...s, ready: true }; // 서버가 먼저 왔다 — 저장값은 낡은 것
            return { ...s, hub: e.hub ?? s.hub, fromStorage: e.hub !== null, ready: true };
        case 'server':
            return { ...s, hub: e.hub, fresh: true, ready: true, failed: false };
        case 'failed':
            return { ...s, failed: true, ready: s.storage ? s.ready : true }; // 저장값을 이미 그렸다면 그대로 두고 실패만 알린다
        case 'retry':
            return s.failed ? { ...s, failed: false } : s;
        case 'timeout':
            return s.ready ? s : { ...s, ready: true };
    }
}
/** 화면이 쓰는 값 — 받기 전(첫 설치 · 저장값 없음)에는 기본 칸 설정(켜짐 · 기존 문구) */
function hubView(s) {
    const section = s.hub?.section ?? load_1.DEFAULT_SECTION;
    return { items: s.hub?.items ?? null, section, visible: s.ready && section.on };
}
