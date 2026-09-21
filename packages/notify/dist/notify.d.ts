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
    channel?: {
        id: string;
        name: string;
        vibrate?: boolean;
    } | null;
    items?: NotifyItem[];
};
/** 앱이 주는 시각 — `key` → 밀리초. 배열이면 그 시각마다 하나씩 */
export type Bases = Record<string, number | number[] | null | undefined>;
export type Planned = {
    key: string;
    at: number;
    title: string;
    body: string;
};
/**
 * 안 울리는 시간대에 걸렸으면 아침으로 미룬다.
 *
 * `from > to` 면 자정을 넘는 창이다(21시~8시). 밤 쪽에 걸린 것은 **다음 날** 아침으로 간다.
 * 한 번만 옮긴다 — 미룬 시각이 또 창 안이면(설정이 잘못된 경우) 그대로 둔다.
 * 그래야 영원히 도는 일이 없다. 그 조합은 어드민 입력에서 막는다.
 */
export declare function clampQuiet(at: number, quiet?: Quiet | null): number;
/** `{이름}` 을 값으로 바꾼다 — 없는 이름은 그대로 둔다(빈칸보다 낫다) */
export declare function fillVars(text: string, vars?: Record<string, string | number>): string;
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
export declare function planItems(config: NotifyConfig | null | undefined, bases: Bases, opts?: PlanOpts): Planned[];
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
export declare function createNotify(deps: NotifyDeps): Notify;
