"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.stepsPermission = stepsPermission;
exports.requestStepsPermission = requestStepsPermission;
exports.readDays = readDays;
exports.watchSteps = watchSteps;
exports.readToday = readToday;
/** iOS CoreMotion; Android Health Connect with foreground sensor fallback. Native modules load only when used. */
const react_native_1 = require("react-native");
const storage_1 = require("./storage");
const days_1 = require("./days");
const SENSOR_KEY = 'sensor';
const IOS_DAYS = 1;
const ANDROID_DAYS = 1;
/** 헬스 커넥트 사용 가능(SdkAvailabilityStatus.SDK_AVAILABLE) */
const HC_AVAILABLE = 3;
/*
 | **네이티브가 있는지 먼저 본다 — 없는 모듈을 require 하면 앱이 죽는다**(0.1.1, 당근 10-19 23:00 운영 사고).
 | 앱이 다 뜬 뒤 함수 안에서 부른 require 는 Metro 가 `guardedLoadModule` 로 감싸, 모듈을 읽다 던진 오류를
 | 호출한 쪽 try 로 돌려주지 않고 `ErrorUtils.reportFatalError` 로 보낸다(expo-updates 가 복구 못 하면 강제 종료).
 | expo-sensors 의 Pedometer 는 읽을 때 `requireNativeModule('ExponentPedometer')`, 헬스 커넥트는
 | `TurboModuleRegistry.getEnforcing('HealthConnect')` 라 옛 빌드(모듈 없음)에서 바로 이 길로 간다.
 | 그래서 던지지 않는 조회로 있을 때만 require 한다.
 */
function nativeExists(name) {
    try {
        const core = require('expo-modules-core');
        if (core.requireOptionalNativeModule?.(name))
            return true;
    }
    catch { /* 아래 */ }
    try {
        const rn = require('react-native');
        return !!(rn.TurboModuleRegistry?.get?.(name) ?? rn.NativeModules?.[name]);
    }
    catch {
        return false;
    }
}
function pedometer() {
    if (!nativeExists('ExponentPedometer'))
        return null;
    try {
        return require('expo-sensors').Pedometer;
    }
    catch {
        return null;
    }
}
let hcReady = null;
/** 헬스 커넥트 — 없거나(안드로이드 13 이하 미설치 · 옛 빌드) 초기화 실패면 null */
function healthConnect() {
    if (react_native_1.Platform.OS !== 'android')
        return Promise.resolve(null);
    if (!hcReady) {
        hcReady = (async () => {
            if (!nativeExists('HealthConnect'))
                return null;
            try {
                const hc = require('react-native-health-connect');
                if ((await hc.getSdkStatus()) !== HC_AVAILABLE)
                    return null;
                return (await hc.initialize()) ? hc : null;
            }
            catch {
                return null;
            }
        })();
        // 실패는 들고 있지 않는다 — 헬스 커넥트를 깔고 돌아오면 다시 본다
        void hcReady.then((m) => { if (!m)
            hcReady = null; });
    }
    return hcReady;
}
async function hcGranted(hc) {
    try {
        const got = await hc.getGrantedPermissions();
        return got.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
    }
    catch {
        return false;
    }
}
async function sensorPermission(ask) {
    const p = pedometer();
    if (!p)
        return 'unavailable';
    try {
        if (!(await p.isAvailableAsync()))
            return 'unavailable';
        const r = ask ? await p.requestPermissionsAsync() : await p.getPermissionsAsync();
        if (r.granted)
            return 'granted';
        return r.status === 'undetermined' ? 'unknown' : 'denied';
    }
    catch {
        return 'unavailable';
    }
}
/** 지금 권한 — 묻지 않고 본다 */
async function stepsPermission() {
    const hc = await healthConnect();
    if (hc && (await hcGranted(hc)))
        return 'granted';
    return sensorPermission(false);
}
/** 권한을 묻는다 — 안드로이드는 헬스 커넥트 먼저, 없거나 거부하면 걸음 센서 */
async function requestStepsPermission(explain) {
    if (!(await explain()))
        return stepsPermission();
    const hc = await healthConnect();
    if (hc) {
        try {
            await hc.requestPermission([
                { accessType: 'read', recordType: 'Steps' },
            ]);
        }
        catch {
            /* 창을 못 띄웠다 — 아래에서 센서로 */
        }
        if (await hcGranted(hc)) {
            // 센서 권한도 이어서 묻는다 — 헬스 커넥트가 비어 있어도 앱이 켜진 동안은 센서로 센다(`watchSteps`)
            await sensorPermission(true);
            return 'granted';
        }
    }
    return sensorPermission(true);
}
async function sensorCounts(bookStorage = storage_1.stepsStorage) {
    return (await bookStorage.getJson(SENSOR_KEY)) ?? {};
}
/** 오늘 KST 걸음 — 권한 없음/읽기 실패는 빈 목록으로, readToday가 상태를 구분한다. */
async function readDays(now) {
    if (react_native_1.Platform.OS === 'ios') {
        const p = pedometer();
        if (!p)
            return [];
        // 권한 전에 읽으면 iOS 가 동작 권한 창을 저절로 띄운다 — 묻기는 「걸음 수 켜기」 누를 때만
        if ((await sensorPermission(false)) !== 'granted')
            return [];
        const out = [];
        for (const d of (0, days_1.recentDays)(now, IOS_DAYS)) {
            try {
                const r = await p.getStepCountAsync(new Date(d.start), new Date(d.end));
                out.push({ date: d.date, steps: r.steps, source: 'coremotion' });
            }
            catch {
                /* 권한이 없거나 그날 기록이 없다 */
            }
        }
        return out;
    }
    const out = Object.entries(await sensorCounts())
        .map(([date, steps]) => ({ date, steps, source: 'sensor' }));
    const hc = await healthConnect();
    if (hc && (await hcGranted(hc))) {
        try {
            const days = (0, days_1.recentDays)(now, ANDROID_DAYS);
            const rows = await hc.aggregateGroupByDuration({
                recordType: 'Steps',
                timeRangeFilter: {
                    operator: 'between',
                    startTime: new Date(days[0].start).toISOString(),
                    endTime: new Date(now).toISOString(),
                },
                // 한국시간 자정에서 시작해 24시간씩 — 한국은 서머타임이 없어 날짜와 딱 맞는다
                timeRangeSlicer: { duration: 'DAYS', length: 1 },
            });
            for (const r of rows) {
                out.push({ date: (0, days_1.kstDay)(Date.parse(r.startTime)), steps: r.result.COUNT_TOTAL ?? 0, source: 'healthconnect' });
            }
            // 오늘 칸이 비면(기록 없음) 0 으로라도 넣어 오늘 날짜를 보낸다
            if (!rows.length)
                out.push({ date: (0, days_1.kstDay)(now), steps: 0, source: 'healthconnect' });
        }
        catch { /* Health Connect can fail while the sensor still works. */ }
    }
    if (!out.some(d => d.date === (0, days_1.kstDay)(now)) && await sensorPermission(false) === 'granted') {
        out.push({ date: (0, days_1.kstDay)(now), steps: 0, source: 'sensor' });
    }
    return out.filter((d) => d.date === (0, days_1.kstDay)(now));
}
/**
 * 앱이 켜진 동안 걸음이 늘면 알린다 — 화면이 다시 읽는다.
 * 안드로이드 센서 방식이면 **이때 늘어난 만큼 그날에 적는다**(이것이 유일한 기록이다).
 */
function watchSteps(onChange) {
    const watchStorage = (0, storage_1.getStepsStorage)();
    const p = pedometer();
    if (!p)
        return () => { };
    let last = null;
    let pending = null;
    let saving = false;
    const flush = async () => {
        if (saving || !pending)
            return;
        saving = true;
        try {
            const add = pending;
            pending = null;
            let counts = await sensorCounts(watchStorage);
            for (const [date, n] of Object.entries(add))
                counts = (0, days_1.addSensorSteps)(counts, date, n);
            await watchStorage.setJson(SENSOR_KEY, counts);
        }
        finally {
            saving = false;
        }
        onChange();
        if (pending)
            void flush().catch(() => { });
    };
    let sub = null;
    let stopped = false;
    void (async () => {
        /*
         | 헬스 커넥트를 써도 앱이 켜진 동안은 센서로도 센다 — 날짜별 **큰 값**만 쓰므로 두 번 세지 않는다.
         | 헬스 커넥트에 걸음을 넣어 주는 앱(삼성헬스 동기화 등)이 없으면 헬스 커넥트는 0 이라, 전에는 권한이 있는데도
         | 걸음이 0 에 머물렀다(2026-09-25 사임캐시 1:1 문의 「권한 · 배터리 다 했는데 안 올라가요」 대조).
         */
        if ((await sensorPermission(false)) !== 'granted' || stopped)
            return;
        try {
            sub = p.watchStepCount((r) => {
                /*
                 | 첫 알림은 **기준값**으로만 잡는다 — 안드로이드 센서는 구독하자마자 1 을 한 번 보내, 그대로 더하면 폰이 가만히
                 | 있어도 앱을 열 때마다 1보씩 늘었다(A32 2026-09-26 1 → 2 → 3). 켜는 순간의 1보를 놓치는 것이 더 낫다.
                 */
                if (last === null) {
                    last = r.steps;
                    return;
                }
                const delta = r.steps - last;
                last = r.steps;
                if (delta <= 0)
                    return;
                if (react_native_1.Platform.OS === 'ios') {
                    onChange();
                    return;
                }
                const date = (0, days_1.kstDay)(Date.now());
                pending = (0, days_1.addSensorSteps)(pending ?? {}, date, delta);
                void flush().catch(() => { });
            });
        }
        catch {
            sub = null;
        }
    })();
    return () => { stopped = true; sub?.remove(); };
}
async function readToday(now = Date.now()) {
    const status = await stepsPermission();
    if (status !== 'granted')
        return { status, steps: null, days: [], sensorOnly: false };
    try {
        const days = await readDays(now);
        return { status: days.length ? 'ready' : 'error', steps: days.length ? Math.max(...days.map(d => d.steps)) : null,
            days, sensorOnly: react_native_1.Platform.OS === 'android' && !days.some(d => d.source === 'healthconnect') };
    }
    catch {
        return { status: 'error', steps: null, days: [], sensorOnly: false };
    }
}
