/**
 * 원격 푸시 — 기기 토큰 등록·끄기, 알림을 눌렀을 때 열람 보고·링크 열기(1.1, 꼬꼬농장 방식).
 *
 * 로그인 세션이 생기면 **기기 토큰**(`getDevicePushTokenAsync` — 안드로이드는 FCM, 아이폰은 APNs)을
 * 서버(`POST {app}/push/register`)에 올린다. **서버가 FCM·APNs 로 직접 보낸다** — Expo 중계를 거치지
 * 않는다(2026-09-22 오너 결정: 한 단계 덜 거치고, 우리 키를 Expo 에 올리지 않고, 규모가 커져도 Expo 의
 * 초당 600건 제한에 막히지 않게). 옛 판이 올린 Expo 토큰은 기기 토큰이 들어오는 순간 서버가 끈다.
 *
 * ⚠ **서버에 그 앱의 FCM 키가 먼저 있어야 한다**(`/www/jcurve/secrets/<슬러그>-fcm.json`). 없는 채로
 * 이 판을 내면 안드로이드 푸시가 끊긴다 — 옛 Expo 토큰은 꺼지고 기기 토큰으로는 보낼 수 없어서.
 *
 * 어드민이 캠페인을 쏘면 알림 data 에 `campaignId`·`url` 이 실려 오고, 알림을 누르면 열람을 보고
 * (`/push/open` — 어드민 열람 수)하고 링크를 연다.
 *
 * 앱이 켜져 있을 때 온 알림을 배너로 보여 주는 것은 `createNotify().init()` 이 한다 — 둘 다 부른다.
 * 네이티브 모듈은 지연 `require` 로만 집는다 — 옛 빌드에서 OTA 가 죽지 않게.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

type Response = { notification?: { request?: { content?: { data?: unknown } } } } | null | undefined;

/** 기기와 닿는 것 — **시험에서만** 갈아 끼운다 */
export type PushEnv = {
  notifications: () => any | null;
  platform: () => string;
  fetch: (url: string, init: { method: string; headers: Record<string, string>; body: string }) => Promise<unknown>;
  openUrl: (url: string) => void;
};

/*
 | **`require` 안의 이름은 반드시 글자 그대로 쓴다.** Metro 는 require 를 빌드 때 찾는데, `require(name)` 처럼
 | 변수로 주면 찾지 못하고 그 자리를 「실행하면 던지는 코드」로 바꾼다. try/catch 가 그걸 삼키면 모듈이
 | **늘 없는 것처럼** 돈다 — 1.1.0 이 그랬다: 등록도, 알림을 눌렀을 때 열람 보고·링크 열기도 조용히 안 됐다
 | (꼬꼬농장 2026-09-22 OTA, 번들에서 "Dynamic require … not supported by Metro" 로 확인).
 */
const notificationsModule = (): any | null => {
  try { return require('expo-notifications'); } catch { return null; }
};
const reactNative = (): any | null => {
  try { return require('react-native'); } catch { return null; }
};

const defaultEnv = (): PushEnv => ({
  notifications: notificationsModule,
  platform: () => String(reactNative()?.Platform?.OS ?? ''),
  fetch: (url, init) => fetch(url, init),
  openUrl: (url) => { void reactNative()?.Linking?.openURL(url)?.catch?.(() => undefined); },
});

export type PushDeps = {
  /** API 주소 — `https://api.j-curve.co.kr/v1/{앱}`. 순환 import 가 있는 앱은 getter 로 준다 */
  base: string;
  /** 앱 토큰(`X-App-Token`) */
  appToken: string;
  /**
   * 서버 세션 토큰 — **서버에 있는 세션만** 준다. 없거나 데모 세션이면 비워 둔다
   * (그때는 서버에 아무것도 보내지 않는다).
   */
  session: () => string | null | undefined;
  /**
   * 이 계정이 알림 받기에 동의했는가. 기기 권한은 폰에 붙어 있어서, 한 폰으로 계정을 바꾸면
   * 권한만으로는 새 계정의 뜻을 알 수 없다(꼬꼬농장 2026-09-14 — 계정마다 따로 묻는다).
   */
  consent?: () => boolean | Promise<boolean>;
  /**
   * 권한은 있는데 토큰이 서버에 못 올라갔을 때(1.2) — 왜인지 계측에 남기는 자리. 이것이 없으면
   * 「알림을 켰는데 안 온다」의 원인이 아무 데도 안 남는다(영테크가 push_register_failed 로 남기던 것).
   * `token` = 기기 토큰을 못 받음, `register` = 서버에 못 올림(네트워크 · HTTP 오류). 던져도 앱은 멈추지 않는다.
   */
  onError?: (e: { stage: 'token' | 'register'; message: string }) => void;
};

export type Push = {
  /** 앱 시작에 한 번 — 알림을 눌렀을 때를 걸고, 알림으로 켜진 경우도 처리한다 */
  init: () => void;
  /** 세션이 생겼을 때·동의했을 때 — 권한이 있으면 기기 토큰을 서버에 올린다(권한 요청은 하지 않는다) */
  register: () => Promise<void>;
  /** 이 계정은 알림을 원하지 않는다 — 서버에 걸린 이 회원의 토큰을 끈다 */
  unregister: () => Promise<void>;
  /** 로그인이 복원된 뒤 한 번 — 알림으로 켜져 들고 있던 열람 보고를 보낸다 */
  flushOpen: () => void;
};

export function createPush(deps: PushDeps, env: PushEnv = defaultEnv()): Push {
  let registered = '';   // 이번 실행에서 올린 토큰 — 같은 값을 반복 등록하지 않는다
  let pendingOpen = 0;
  let inited = false;

  const headers = (): Record<string, string> | null => {
    const t = deps.session();
    if (!t) return null;

    return { Accept: 'application/json', 'Content-Type': 'application/json', 'X-App-Token': deps.appToken, Authorization: 'Bearer ' + t };
  };
  const post = (path: string, h: Record<string, string>, body: unknown): Promise<unknown> =>
    env.fetch(deps.base.replace(/\/+$/, '') + path, { method: 'POST', headers: h, body: JSON.stringify(body) });

  /*
   | 알림을 눌러 콜드 스타트하면 **아직 로그인 복원 전**이라 보낼 수가 없다 — 그냥 버리면 열람이 영영 0 이다.
   | 세션이 생길 때까지 들고 있다가 그때 보낸다(꼬꼬농장 2026-09-17 제보: 열람이 전부 0).
   */
  function sendOpen(cid: number): void {
    const h = headers();
    if (!h) { pendingOpen = cid; return; }
    void Promise.resolve(post('/push/open', h, { campaign_id: cid })).catch(() => undefined);
  }

  function handle(r: Response): void {
    const raw = r?.notification?.request?.content?.data;
    const d = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
    const cid = Number(d.campaignId) || 0;
    if (cid > 0) sendOpen(cid);
    const url = typeof d.url === 'string' ? d.url : '';
    if (url) { try { env.openUrl(url); } catch { /* 못 열면 그만 */ } }
  }

  return {
    init() {
      if (inited) return;
      inited = true;
      try {
        const N = env.notifications();
        if (!N) return;
        N.addNotificationResponseReceivedListener((r: Response) => handle(r));
        void Promise.resolve(N.getLastNotificationResponseAsync?.())
          .then((r: Response) => { if (r) handle(r); })
          .catch(() => undefined);
      } catch { /* 옛 빌드 */ }
    },

    async register() {
      const h = headers();
      if (!h) return;
      // 서버는 안드로이드(FCM)·아이폰(APNs)만 보낸다 — 웹 미리보기 등은 올리지 않는다
      const platform = env.platform();
      if (platform !== 'android' && platform !== 'ios') return;
      if (deps.consent && !(await deps.consent())) return;
      const fail = (stage: 'token' | 'register', e: unknown): void => {
        try { deps.onError?.({ stage, message: String((e as Error)?.message ?? e).slice(0, 120) }); } catch { /* 보고가 앱을 막으면 안 된다 */ }
      };
      let tok = '';
      try {
        const N = env.notifications();
        if (!N) return;                                 // 옛 빌드·웹 — 고장이 아니므로 알리지 않는다
        const perm = await N.getPermissionsAsync();
        if (!perm?.granted) return;                     // 허용 요청은 앱의 알림 안내가 따로 한다
        const got = await N.getDevicePushTokenAsync();
        tok = typeof got?.data === 'string' ? got.data : '';
        if (!tok) { fail('token', 'empty_token'); return; }
      } catch (e) { fail('token', e); return; }
      if (tok === registered) return;
      try {
        // platform 을 꼭 같이 — 서버가 이것으로 FCM·APNs 를 가른다
        const res: any = await post('/push/register', h, { token: tok, platform });
        // fetch 는 4xx·5xx 에도 던지지 않는다 — 응답의 ok 로 가른다(가짜 환경은 ok 칸이 없을 수 있다)
        if (res && typeof res.ok === 'boolean' && !res.ok) throw new Error('http_' + String(res.status ?? ''));
        /*
         | **올라간 뒤에** 기억한다(1.2). 전에는 보내기 전에 기억해서, 네트워크가 끊기거나 서버가 5xx 를
         | 주면 이번 실행 동안 다시 올리지 않았다 — 앱을 껐다 켜야 올라갔다.
         */
        registered = tok;
      } catch (e) { fail('register', e); }
    },

    async unregister() {
      registered = '';
      const h = headers();
      if (!h) return;
      try {
        await post('/push/unregister', h, {});
      } catch { /* 다음에 다시 — 토큰을 새로 등록하지 않으므로 새 기기로 퍼지지는 않는다 */ }
    },

    flushOpen() {
      if (pendingOpen <= 0) return;
      const cid = pendingOpen;
      pendingOpen = 0;
      sendOpen(cid);
    },
  };
}
