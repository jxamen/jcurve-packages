/**
 * 로컬 알림 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 무엇을 언제 띄울지는 두 곳에서 온다.
 *   - **시각**은 앱이 준다(게임 상태·남은 시간은 서버가 알 수 없다)
 *   - **문구·켬끔·재알림**은 어드민 설정이 준다(고치려고 배포하지 않게)
 *
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 모듈이 빠진 빌드에서 정적 import 는
 * 앱 시작 자체를 죽이고, OTA 로 옛 런타임에 같은 JS 가 내려가므로 더 그렇다.
 */

/** 안 울리는 시간대. `from`~`to` 사이에 걸린 예약은 `at` 으로 미룬다 */
export type Quiet = {
  /** 이 시각부터 안 울린다 (0~23) */
  from: number;
  /** 이 시각부터 다시 울린다 (0~23) */
  to: number;
  /** 미룰 시각 `HH:MM` */
  at: string;
};

/**
 * 어드민이 정하는 알림 한 줄.
 *
 * `key` 는 **앱 코드와 맞춘 이름**이다 — 앱이 이 키로 시각을 준다. 어드민에서 키를 바꾸면
 * 그 항목은 시각을 못 받아 **조용히 안 뜬다**(오류가 아니라 없는 것처럼 보인다).
 */
export type NotifyItem = {
  key: string;
  /** 사용자 알림 설정 화면에 보일 이름. 없으면 `key` */
  label?: string;
  /** 어드민 스위치. `false` 면 아무에게도 안 간다 */
  on?: boolean;
  title: string;
  /** `{이름}` 자리는 앱이 준 값으로 바뀐다 */
  body: string;
  /** 놓쳤을 때 이만큼 뒤에 한 번 더(분). 0·없음이면 안 건다 */
  repeatAfterMin?: number;
};

export type NotifyConfig = {
  quiet?: Quiet | null;
  /**
   * 안드로이드 알림 채널.
   *
   * **`id` 를 바꿔야 설정이 바뀐다.** 안드로이드는 한 번 만든 채널의 소리·진동을
   * 앱이 못 고친다 — 진동을 넣으려면 `care` → `care2` 처럼 새 id 를 줘야 한다.
   * 그래서 이 값이 어드민에 있다(배포 없이 바꾸려고).
   */
  channel?: { id: string; name: string; vibrate?: boolean } | null;
  items?: NotifyItem[];
};

/** 앱이 주는 시각 — `key` → 밀리초. 배열이면 그 시각마다 하나씩 */
export type Bases = Record<string, number | number[] | null | undefined>;

export type Planned = { key: string; at: number; title: string; body: string };

/** 이보다 가까운 예약은 걸지 않는다 — 지금 화면을 보고 있는 사람에게 울릴 뿐이다 */
const MIN_LEAD_MS = 30_000;

/** `HH:MM` → [시, 분]. 못 읽으면 8시 30분 */
function wakeAt(s: string | undefined): [number, number] {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s ?? ''));
  if (!m) return [8, 30];
  const h = Number(m[1]);
  const i = Number(m[2]);

  return h >= 0 && h <= 23 && i >= 0 && i <= 59 ? [h, i] : [8, 30];
}

/**
 * 안 울리는 시간대에 걸렸으면 아침으로 미룬다.
 *
 * `from > to` 면 자정을 넘는 창이다(21시~8시). 밤 쪽에 걸린 것은 **다음 날** 아침으로 간다.
 * 한 번만 옮긴다 — 미룬 시각이 또 창 안이면(설정이 잘못된 경우) 그대로 둔다.
 * 그래야 영원히 도는 일이 없다. 그 조합은 어드민 입력에서 막는다.
 */
export function clampQuiet(at: number, quiet?: Quiet | null): number {
  if (!quiet) return at;
  const from = Number(quiet.from);
  const to = Number(quiet.to);
  if (!Number.isInteger(from) || !Number.isInteger(to)) return at;
  if (from < 0 || from > 23 || to < 0 || to > 23 || from === to) return at;

  const d = new Date(at);
  const h = d.getHours();
  const inQuiet = from > to ? h >= from || h < to : h >= from && h < to;
  if (!inQuiet) return at;

  const [hh, mm] = wakeAt(quiet.at);
  if (from > to && h >= from) d.setDate(d.getDate() + 1);
  d.setHours(hh, mm, 0, 0);

  return d.getTime();
}

/** `{이름}` 을 값으로 바꾼다 — 없는 이름은 그대로 둔다(빈칸보다 낫다) */
export function fillVars(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;

  return String(text).replace(/\{(\w+)\}/g, (all, name) => (name in vars ? String(vars[name]) : all));
}

export type PlanOpts = {
  now?: number;
  vars?: Record<string, string | number>;
  /** 사용자가 끈 항목 — `false` 인 키만 끈 것으로 본다(없으면 켜짐) */
  prefs?: Record<string, boolean>;
};

/**
 * 설정 + 앱이 준 시각 → 실제로 걸 예약 목록(이른 것부터).
 *
 * 순수 함수라 기기 없이 확인할 수 있다 — 이 패키지에서 틀리기 쉬운 것이 전부 여기 있다.
 */
export function planItems(config: NotifyConfig | null | undefined, bases: Bases, opts: PlanOpts = {}): Planned[] {
  const now = opts.now ?? Date.now();
  const quiet = config?.quiet;
  const out: Planned[] = [];

  for (const it of config?.items ?? []) {
    if (!it || !it.key) continue;
    if (it.on === false) continue;                  // 어드민이 껐다 — 아무에게도 안 간다
    if (opts.prefs?.[it.key] === false) continue;   // 이 사람이 껐다

    const raw = bases[it.key];
    if (raw == null) continue;                      // 앱이 시각을 안 줬다 = 지금 해당 없음
    const list = (Array.isArray(raw) ? raw : [raw]).filter((n) => typeof n === 'number' && n > 0);
    if (!list.length) continue;

    const title = fillVars(it.title ?? '', opts.vars);
    const body = fillVars(it.body ?? '', opts.vars);
    const push = (at: number) => {
      const t = clampQuiet(at, quiet);
      if (t > now + MIN_LEAD_MS) out.push({ key: it.key, at: t, title, body });
    };

    for (const t of list) push(t);

    /*
     | 재알림은 **첫 시각 뒤**로 건다. 그 시각이 이미 지났으면 지금부터 센다 —
     | 우물이 가득 찬 채로 앱을 나간 사람에게 알림이 아예 없던 구멍이 여기였다
     | (꼬꼬농장 2026-09-12 제보: 가득 차는 시각에만 걸어서 이미 가득이면 안 걸렸다).
     */
    const rep = Number(it.repeatAfterMin ?? 0);
    if (rep > 0) push(Math.max(list[0], now) + rep * 60_000);
  }

  out.sort((a, b) => a.at - b.at);

  return out;
}

/* ─────────────────────────── 여기서부터 기기가 필요하다 ─────────────────────────── */

type ExpoNotifications = {
  setNotificationHandler: (h: unknown) => void;
  getPermissionsAsync: () => Promise<{ granted?: boolean; canAskAgain?: boolean } | null>;
  requestPermissionsAsync: () => Promise<{ granted?: boolean } | null>;
  setNotificationChannelAsync: (id: string, c: unknown) => Promise<unknown>;
  cancelAllScheduledNotificationsAsync: () => Promise<void>;
  setBadgeCountAsync: (n: number) => Promise<unknown>;
  scheduleNotificationAsync: (r: unknown) => Promise<string>;
  AndroidImportance?: { DEFAULT?: number };
  SchedulableTriggerInputTypes?: { DATE?: string };
};

function mod(): ExpoNotifications | null {
  try {
    return require('expo-notifications') as ExpoNotifications;
  } catch {
    return null;   // 모듈이 빠진 빌드 — 이 경로만 조용히 접는다
  }
}

function isAndroid(): boolean {
  try {
    return (require('react-native') as { Platform: { OS: string } }).Platform.OS === 'android';
  } catch {
    return false;
  }
}

export type NotifyDeps = {
  /**
   * 어드민이 정한 설정(`content/config/notify`).
   *
   * **앱이 캐시해야 한다** — `schedule()` 마다 불리고, 그 자리가 앱이 백그라운드로
   * 넘어가는 순간이라 네트워크를 기다릴 시간이 없다.
   */
  config: () => NotifyConfig | null | Promise<NotifyConfig | null>;
  /** 사용자 알림 설정 — `false` 인 키만 끈 것으로 본다 */
  prefs?: () => Record<string, boolean> | Promise<Record<string, boolean>>;
  /** 앱 고유 게이트(계정 동의 등). `false` 면 아무것도 예약하지 않는다 */
  allowed?: () => boolean | Promise<boolean>;
};

export type Notify = {
  /** 앱 시작에 한 번 — 배너 표시 방식과 안드로이드 채널을 준비한다 */
  init: () => Promise<void>;
  /** 권한 요청. **한 번 실행에 한 번만 묻는다** */
  ask: () => Promise<boolean>;
  /** 예약을 모두 지우고 배지를 0 으로 — 앱으로 돌아왔을 때 부른다 */
  clear: () => Promise<void>;
  /** 지금 상태로 다시 예약한다 — 앱이 백그라운드로 갈 때 부른다 */
  schedule: (bases: Bases, vars?: Record<string, string | number>) => Promise<Planned[]>;
  /** 이번에 무엇이 걸릴지만 본다(예약하지 않는다) — 설정을 고친 뒤 확인용 */
  preview: (bases: Bases, vars?: Record<string, string | number>) => Promise<Planned[]>;
};

export function createNotify(deps: NotifyDeps): Notify {
  let asking: Promise<boolean> | null = null;
  let inited = false;

  /*
   | 예약을 한 줄로 세운다 — iOS 는 백그라운드로 갈 때 inactive → background 로 **두 번**
   | 알려 준다. 겹쳐 돌면 '전체 취소'와 '예약'이 엇갈려 같은 알림이 두 개 남는다
   | (꼬꼬농장 2026-08-29 제보).
   */
  let queue: Promise<Planned[]> = Promise.resolve([]);

  async function read(bases: Bases, vars?: Record<string, string | number>): Promise<Planned[]> {
    const cfg = await deps.config();
    const prefs = (await deps.prefs?.()) ?? {};

    return planItems(cfg, bases, { vars, prefs });
  }

  async function doSchedule(bases: Bases, vars?: Record<string, string | number>): Promise<Planned[]> {
    const N = mod();
    if (!N) return [];

    await N.cancelAllScheduledNotificationsAsync().catch(() => {});

    const perm = await N.getPermissionsAsync().catch(() => null);
    if (!perm?.granted) return [];
    if (deps.allowed && !(await deps.allowed())) return [];

    const cfg = await deps.config();
    const items = planItems(cfg, bases, { vars, prefs: (await deps.prefs?.()) ?? {} });
    const channelId = cfg?.channel?.id;
    const android = isAndroid();

    for (let i = 0; i < items.length; i++) {
      try {
        await N.scheduleNotificationAsync({
          /*
           | sound 를 안 주면 iOS 는 **소리도 진동도 없는** 알림으로 띄운다 — 배너만 뜨고
           | 주머니 안에서는 못 알아챈다. 안드로이드는 채널 설정이 우선이라 영향이 없다.
           |
           | 배지는 도착 순서대로 1,2,3… 이다. iOS 배지는 '하나 더하기'가 아니라
           | '이 숫자로 맞춰라' 라서, 늦게 오는 알림일수록 큰 수여야 한다.
           */
          content: { title: items[i].title, body: items[i].body, badge: i + 1, sound: 'default' },
          trigger: {
            type: N.SchedulableTriggerInputTypes?.DATE ?? 'date',
            date: new Date(items[i].at),
            ...(android && channelId ? { channelId } : {}),
          },
        });
      } catch {
        // 권한이 중간에 꺼지거나 예약 한도에 걸리면 그 건만 넘어간다
      }
    }

    return items;
  }

  return {
    async init() {
      if (inited) return;
      inited = true;
      const N = mod();
      if (!N) return;

      // 앱이 켜져 있을 때 도착한 알림도 배너로 보여 준다
      try {
        N.setNotificationHandler({
          handleNotification: async () => ({
            shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: true,
          }),
        });
      } catch { /* 구 버전에서 모양이 다르면 기본 동작 */ }

      if (!isAndroid()) return;
      let ch: NotifyConfig['channel'] = null;
      try {
        ch = (await deps.config())?.channel ?? null;
      } catch {
        return;   // 설정을 못 읽으면 채널도 안 만든다 — 다음 실행에 다시 해 본다
      }
      if (!ch?.id) return;
      await N.setNotificationChannelAsync(ch.id, {
        name: ch.name || ch.id,
        importance: N.AndroidImportance?.DEFAULT ?? 3,
        // 주머니 안에서도 알아채게. iOS 는 앱이 진동을 정할 수 없어 기기 설정을 따른다
        enableVibrate: ch.vibrate !== false,
        ...(ch.vibrate === false ? {} : { vibrationPattern: [0, 300, 150, 300] }),
      }).catch(() => {});
    },

    ask() {
      // 한 번 실행에 한 번만 — 가입 끝·로그인 뒤가 겹쳐 불러도 권한 창은 하나여야 한다
      if (!asking) {
        asking = (async () => {
          const N = mod();
          if (!N) return false;
          try {
            const cur = await N.getPermissionsAsync();
            if (cur?.granted) return true;
            // 이미 거부한 사람에게는 여기서 다시 못 묻는다(기기 설정 앱에서만)
            if (cur && cur.canAskAgain === false) return false;

            return !!(await N.requestPermissionsAsync())?.granted;
          } catch {
            return false;
          }
        })();
      }

      return asking;
    },

    async clear() {
      const N = mod();
      if (!N) return;
      await N.cancelAllScheduledNotificationsAsync().catch(() => {});
      await N.setBadgeCountAsync(0).catch(() => {});
    },

    schedule(bases, vars) {
      queue = queue.then(() => doSchedule(bases, vars)).catch(() => []);

      return queue;
    },

    preview: read,
  };
}
