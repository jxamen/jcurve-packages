/**
 * 사용 기록 — **같은 이름**으로 GA4(Firebase)와 우리 서버 퍼널에 함께 남긴다.
 *
 * GA4 는 구글 애즈 전환을 가져오는 곳이고, 서버 퍼널은 조회 권한 없이 바로 보는 곳이다.
 * 둘이 다른 이름을 쓰면 「GA4 는 가입 30, 서버는 가입 20」을 맞대어 볼 수가 없다.
 *
 * GA4 설정 파일(`google-services.json`·`GoogleService-Info.plist`)은 **네이티브 빌드에 들어가서
 * 패키지로 옮길 수 없다** — 앱마다 둔다. 여기서 같게 만드는 것은 **이벤트 이름과 보내는 방법**이다.
 *
 * **개인정보는 넣지 않는다** — 회원번호·이름·이메일·전화번호 금지.
 * 이벤트 이름은 GA4 규칙을 따른다: 소문자·숫자·밑줄, 40자 이내.
 */
import type { TrackParams } from './auth';
import { type Funnel } from './funnel';
type Ga = {
    getAnalytics: () => unknown;
    logEvent: (a: unknown, name: string, params?: Record<string, string | number | boolean>) => unknown;
};
export type TrackEnv = {
    /** GA4 모듈 — 이 빌드에 없으면 null */
    ga: () => Ga | null;
};
export declare function standardEvent(name: string, params?: TrackParams): [string, Record<string, string> | undefined] | null;
/**
 * 서버 퍼널에 같이 보낼 꼬리표 한 토막 — **어느 소셜을 눌렀는지·왜 떨어졌는지**.
 *
 * 서버는 이름만 받으면 「로그인 버튼 9번 눌렀는데 가입은 3명」까지만 보이고, 어느 소셜에서
 * 잃는지를 볼 수 없었다(꼬꼬농장 2026-09-18). `provider` 와 `code`(없으면 `reason`)를 잇는다.
 */
export declare function propOf(params?: TrackParams): string | undefined;
/**
 * 기록기를 만든다 — 로그인(`createAuth({ track })`)과 앱 화면이 같은 것을 쓴다.
 *
 * `funnel` 을 주면 퍼널 이벤트는 서버에도 남는다. GA4 모듈이 없는 빌드에서는 GA4 만 조용히 건너뛴다.
 */
export declare function createTrack(opts?: {
    funnel?: Funnel;
}, env?: TrackEnv): (name: string, params?: TrackParams) => void;
export {};
