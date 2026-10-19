/** iOS CoreMotion; Android Health Connect with foreground sensor fallback. Native modules load only when used. */
import { Platform } from 'react-native';
import { stepsStorage as storage, getStepsStorage } from './storage';
import { addSensorSteps, kstDay, recentDays, type DaySteps } from './days';

export type StepsPermission = 'unknown' | 'granted' | 'denied' | 'unavailable';

const SENSOR_KEY = 'sensor';
const IOS_DAYS = 1;
const ANDROID_DAYS = 1;
/** 헬스 커넥트 사용 가능(SdkAvailabilityStatus.SDK_AVAILABLE) */
const HC_AVAILABLE = 3;

type PermissionReply = { granted: boolean; status: string };
type PedometerMod = {
  isAvailableAsync(): Promise<boolean>;
  requestPermissionsAsync(): Promise<PermissionReply>;
  getPermissionsAsync(): Promise<PermissionReply>;
  getStepCountAsync(start: Date, end: Date): Promise<{ steps: number }>;
  watchStepCount(callback: (result: { steps: number }) => void): { remove(): void };
};
type HcMod = {
  getSdkStatus(): Promise<number>; initialize(): Promise<boolean>;
  getGrantedPermissions(): Promise<Array<{ recordType: string; accessType: string }>>;
  requestPermission(permissions: Array<{ recordType: 'Steps'; accessType: 'read' }>): Promise<unknown>;
  aggregateGroupByDuration(options: { recordType: 'Steps'; timeRangeFilter: { operator: 'between'; startTime: string; endTime: string }; timeRangeSlicer: { duration: 'DAYS'; length: number } }): Promise<Array<{ startTime: string; result: { COUNT_TOTAL?: number } }>>;
};

function pedometer(): PedometerMod | null {
  try {
    return (require('expo-sensors') as { Pedometer: PedometerMod }).Pedometer;
  } catch {
    return null;
  }
}

let hcReady: Promise<HcMod | null> | null = null;

/** 헬스 커넥트 — 없거나(안드로이드 13 이하 미설치 · 옛 빌드) 초기화 실패면 null */
function healthConnect(): Promise<HcMod | null> {
  if (Platform.OS !== 'android') return Promise.resolve(null);
  if (!hcReady) {
    hcReady = (async () => {
      try {
        const hc = require('react-native-health-connect') as HcMod;
        if ((await hc.getSdkStatus()) !== HC_AVAILABLE) return null;

        return (await hc.initialize()) ? hc : null;
      } catch {
        return null;
      }
    })();
    // 실패는 들고 있지 않는다 — 헬스 커넥트를 깔고 돌아오면 다시 본다
    void hcReady.then((m) => { if (!m) hcReady = null; });
  }

  return hcReady;
}

async function hcGranted(hc: HcMod): Promise<boolean> {
  try {
    const got = await hc.getGrantedPermissions();

    return got.some((p) => p.recordType === 'Steps' && p.accessType === 'read');
  } catch {
    return false;
  }
}

async function sensorPermission(ask: boolean): Promise<StepsPermission> {
  const p = pedometer();
  if (!p) return 'unavailable';
  try {
    if (!(await p.isAvailableAsync())) return 'unavailable';
    const r = ask ? await p.requestPermissionsAsync() : await p.getPermissionsAsync();
    if (r.granted) return 'granted';

    return r.status === 'undetermined' ? 'unknown' : 'denied';
  } catch {
    return 'unavailable';
  }
}

/** 지금 권한 — 묻지 않고 본다 */
export async function stepsPermission(): Promise<StepsPermission> {
  const hc = await healthConnect();
  if (hc && (await hcGranted(hc))) return 'granted';

  return sensorPermission(false);
}

/** 권한을 묻는다 — 안드로이드는 헬스 커넥트 먼저, 없거나 거부하면 걸음 센서 */
export async function requestStepsPermission(explain: () => Promise<boolean>): Promise<StepsPermission> {
  if (!(await explain())) return stepsPermission();
  const hc = await healthConnect();
  if (hc) {
    try {
      await hc.requestPermission([
        { accessType: 'read', recordType: 'Steps' },
      ]);
    } catch {
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

async function sensorCounts(bookStorage = storage): Promise<Record<string, number>> {
  return (await bookStorage.getJson<Record<string, number>>(SENSOR_KEY)) ?? {};
}

/** 오늘 KST 걸음 — 권한 없음/읽기 실패는 빈 목록으로, readToday가 상태를 구분한다. */
export async function readDays(now: number): Promise<DaySteps[]> {
  if (Platform.OS === 'ios') {
    const p = pedometer();
    if (!p) return [];
    // 권한 전에 읽으면 iOS 가 동작 권한 창을 저절로 띄운다 — 묻기는 「걸음 수 켜기」 누를 때만
    if ((await sensorPermission(false)) !== 'granted') return [];
    const out: DaySteps[] = [];
    for (const d of recentDays(now, IOS_DAYS)) {
      try {
        const r = await p.getStepCountAsync(new Date(d.start), new Date(d.end));
        out.push({ date: d.date, steps: r.steps, source: 'coremotion' });
      } catch {
        /* 권한이 없거나 그날 기록이 없다 */
      }
    }

    return out;
  }

  const out: DaySteps[] = Object.entries(await sensorCounts())
    .map(([date, steps]) => ({ date, steps, source: 'sensor' as const }));

  const hc = await healthConnect();
  if (hc && (await hcGranted(hc))) {
    try {
      const days = recentDays(now, ANDROID_DAYS);
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
        out.push({ date: kstDay(Date.parse(r.startTime)), steps: r.result.COUNT_TOTAL ?? 0, source: 'healthconnect' });
      }
      // 오늘 칸이 비면(기록 없음) 0 으로라도 넣어 오늘 날짜를 보낸다
      if (!rows.length) out.push({ date: kstDay(now), steps: 0, source: 'healthconnect' });
    } catch { /* Health Connect can fail while the sensor still works. */ }
  }
  if (!out.some(d => d.date === kstDay(now)) && await sensorPermission(false) === 'granted') {
    out.push({ date: kstDay(now), steps: 0, source: 'sensor' });
  }

  return out.filter((d) => d.date === kstDay(now));
}

/**
 * 앱이 켜진 동안 걸음이 늘면 알린다 — 화면이 다시 읽는다.
 * 안드로이드 센서 방식이면 **이때 늘어난 만큼 그날에 적는다**(이것이 유일한 기록이다).
 */
export function watchSteps(onChange: () => void): () => void {
  const watchStorage = getStepsStorage();
  const p = pedometer();
  if (!p) return () => {};

  let last: number | null = null;
  let pending: Record<string, number> | null = null;
  let saving = false;
  const flush = async () => {
    if (saving || !pending) return;
    saving = true;
    try {
      const add = pending;
      pending = null;
      let counts = await sensorCounts(watchStorage);
      for (const [date, n] of Object.entries(add)) counts = addSensorSteps(counts, date, n);
      await watchStorage.setJson(SENSOR_KEY, counts);
    } finally { saving = false; }
    onChange();
    if (pending) void flush().catch(() => {});
  };

  let sub: { remove: () => void } | null = null;
  let stopped = false;
  void (async () => {
    /*
     | 헬스 커넥트를 써도 앱이 켜진 동안은 센서로도 센다 — 날짜별 **큰 값**만 쓰므로 두 번 세지 않는다.
     | 헬스 커넥트에 걸음을 넣어 주는 앱(삼성헬스 동기화 등)이 없으면 헬스 커넥트는 0 이라, 전에는 권한이 있는데도
     | 걸음이 0 에 머물렀다(2026-09-25 사임캐시 1:1 문의 「권한 · 배터리 다 했는데 안 올라가요」 대조).
     */
    if ((await sensorPermission(false)) !== 'granted' || stopped) return;
    try {
      sub = p.watchStepCount((r) => {
        /*
         | 첫 알림은 **기준값**으로만 잡는다 — 안드로이드 센서는 구독하자마자 1 을 한 번 보내, 그대로 더하면 폰이 가만히
         | 있어도 앱을 열 때마다 1보씩 늘었다(A32 2026-09-26 1 → 2 → 3). 켜는 순간의 1보를 놓치는 것이 더 낫다.
         */
        if (last === null) { last = r.steps; return; }
        const delta = r.steps - last;
        last = r.steps;
        if (delta <= 0) return;
        if (Platform.OS === 'ios') { onChange(); return; }
        const date = kstDay(Date.now());
        pending = addSensorSteps(pending ?? {}, date, delta);
        void flush().catch(() => {});
      });
    } catch {
      sub = null;
    }
  })();

  return () => { stopped = true; sub?.remove(); };
}

export type TodayReading = { status: StepsPermission | 'ready' | 'error'; steps: number | null; days: DaySteps[]; sensorOnly: boolean };
export async function readToday(now = Date.now()): Promise<TodayReading> {
  const status = await stepsPermission();
  if (status !== 'granted') return { status, steps: null, days: [], sensorOnly: false };
  try {
    const days = await readDays(now);
    return { status: days.length ? 'ready' : 'error', steps: days.length ? Math.max(...days.map(d => d.steps)) : null,
      days, sensorOnly: Platform.OS === 'android' && !days.some(d => d.source === 'healthconnect') };
  } catch { return { status: 'error', steps: null, days: [], sensorOnly: false }; }
}
