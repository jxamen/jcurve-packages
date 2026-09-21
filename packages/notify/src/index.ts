/**
 * `@jcurve/notify` — 리워드 앱 공용 **로컬 알림**(기기가 스스로 띄우는 예약 알림).
 *
 * 서버도 토큰도 필요 없고, 비행기 모드에서도 뜨고, 보내는 비용이 0 이다.
 * 푸시(FCM·APNs)와 **다른 물건**이다 — 저쪽은 서버가 지금 보내는 것이고, 이쪽은
 * 기기가 「그때 되면」 띄우는 것이다.
 *
 * ## 누가 무엇을 정하나
 *
 * | | 정하는 곳 | 왜 |
 * |---|---|---|
 * | **언제** | 앱 | 사료가 떨어지는 시각은 게임 상태다 — 서버는 모른다 |
 * | **뭐라고** | 어드민 | 문구를 고치려고 앱을 배포하지 않게 |
 * | **켤까 말까** | 어드민 + 사용자 | 어드민이 끄면 전체, 사용자가 끄면 그 사람만 |
 *
 * 앱은 `{ 키: 시각 }` 만 주고, 나머지는 `content/config/notify` 가 내려 준다.
 *
 * ## 왜 이렇게 생겼나 — 전부 실기기에서 한 번씩 밟은 것
 *
 *  ① **`sound: 'default'` 를 빼면 iOS 는 소리도 진동도 없이 띄운다.** 배너만 뜨고
 *     주머니 안에서는 못 알아챈다. 안드로이드는 채널 설정이 우선이라 티가 안 나서,
 *     안드로이드로만 확인하면 못 찾는다.
 *
 *  ② **안드로이드 채널은 한 번 만들면 앱이 못 고친다.** 진동을 넣으려면 **id 를 새로**
 *     줘야 한다(꼬꼬농장이 `care` → `care2` 로 새로 만든 이유). 그래서 채널 id 가
 *     어드민 설정에 있다 — 배포 없이 바꾸려고.
 *
 *  ③ **예약을 한 줄로 세운다.** iOS 는 백그라운드로 갈 때 `inactive` → `background` 로
 *     **두 번** 알려 준다. 겹쳐 돌면 '전체 취소'와 '예약'이 엇갈려 **같은 알림이 두 개**
 *     남는다(2026-08-29 제보).
 *
 *  ④ **매번 전부 지우고 다시 건다.** 앱을 껐다 켜면 지난 실행이 건 예약 id 를 모른다.
 *     안 지우면 **옛 단계 문구가 계속 온다**(「알이 식어가요」가 닭이 된 뒤에도).
 *
 *  ⑤ **배지는 도착 순서대로 1,2,3.** iOS 배지는 '하나 더하기'가 아니라 '이 숫자로 맞춰라'
 *     라서, 늦게 오는 알림일수록 큰 수여야 한다.
 *
 *  ⑥ **놓친 것은 지금부터 다시 센다.** 「가득 차는 시각」에만 걸면 **이미 가득인 채로**
 *     앱을 나간 사람에게는 알림이 아예 없다(2026-09-12 제보).
 *
 *  ⑦ **권한은 앱을 켜자마자 묻지 않는다.** 가입 전 첫 화면에서 권한 창이 떠 버리면
 *     정작 가입을 마친 뒤에는 이미 답한 상태라 못 묻는다. `ask()` 를 **가입 직후·로그인
 *     뒤**에 부른다. 한 번 실행에 한 번만 묻는다.
 *
 * ## 쓰는 법
 *
 * ```ts
 * import { createNotify } from '@jcurve/notify';
 *
 * const notify = createNotify({
 *   config: () => cachedNotifyConfig(),          // content/config/notify 를 앱이 캐시
 *   prefs: () => readPrefs(),                    // 알림 설정 화면이 저장한 것
 *   allowed: () => notifyConsent() !== 'no',     // 앱 고유 게이트(없으면 생략)
 * });
 *
 * await notify.init();                           // 앱 시작에 한 번
 * await notify.ask();                            // 가입 직후·로그인 뒤
 *
 * AppState.addEventListener('change', (s) => {
 *   if (s === 'active') void notify.clear();      // 앱에서 직접 보게 된다
 *   else void notify.schedule({                   // 나가면 지금 상태로 다시 건다
 *     feed: Date.now() + careLeft * 1000,
 *     well: wellFullAt(),
 *   }, { water: 3 });                             // 문구의 {water} 자리
 * });
 * ```
 *
 * **`config()` 는 앱이 캐시해야 한다** — `schedule()` 이 불리는 자리가 앱이 백그라운드로
 * 넘어가는 순간이라 네트워크를 기다릴 시간이 없다.
 *
 * ## 어드민이 채우는 것
 *
 * 통합 어드민 → **환경설정 → 알림**. 항목의 `key` 는 **앱 코드와 맞춘 이름**이다 —
 * 어드민에서 키를 바꾸면 그 항목은 시각을 못 받아 **조용히 안 뜬다**(오류가 아니다).
 *
 * ## 1.1 — 원격 푸시 받기(`createPush`)
 *
 * 서버가 보내는 푸시를 **받는 쪽**만 한다 — 기기 토큰 등록·끄기, 알림을 눌렀을 때 열람 보고·링크 열기.
 * 토큰은 **기기 토큰**(안드로이드 FCM · 아이폰 APNs)이다. 서버가 Expo 중계 없이 직접 보낸다(2026-09-22 오너 결정).
 * **서버에 그 앱의 FCM 키가 먼저 있어야 한다** — 없는 채로 내면 안드로이드 푸시가 끊긴다(`push.ts` 머리말).
 *
 * ```ts
 * export const push = createPush({ base: API, appToken: APP_TOKEN, session: () => serverSessionToken(), consent: () => agreed });
 * push.init();                      // 앱 시작에 한 번
 * onSession(() => { void push.register(); push.flushOpen(); });
 * ```
 *
 * ## 이 패키지가 **안 하는** 것
 *
 *  - **푸시 보내기** — 서버가 한다(`PushSender` — 토큰 종류로 FCM·APNs 로 가른다)
 *  - **알림 설정 화면** — 생김새는 앱마다 다르다. 이 패키지는 `prefs` 를 **읽기만** 한다
 *  - **언제 다시 걸지** — `AppState` 리스너는 앱이 건다(게임형이 아닌 앱은 다르다)
 *  - **권한 안내 화면** — `ask()` 를 어디서 부를지는 앱의 가입 흐름이 정한다
 */
export {
  clampQuiet,
  createNotify,
  fillVars,
  planItems,
  type Bases,
  type Notify,
  type NotifyConfig,
  type NotifyDeps,
  type NotifyItem,
  type PlanOpts,
  type Planned,
  type Quiet,
} from './notify';
export { createPush, type Push, type PushDeps, type PushEnv } from './push';
