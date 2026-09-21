"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useTestAdUnit = exports.ssvRequestOptions = exports.readUpdateChannel = exports.isTestAds = exports.createRewarded = void 0;
/**
 * `@jcurve/ads` — 리워드 앱 공용 **AdMob 보상형 광고**(꼬꼬농장 방식).
 *
 * 광고를 안전하게 띄우고 **끝까지 봤는지** 알려 준다. 보상을 무엇으로 줄지·하루 몇 번인지·광고를 기다리는
 * 화면이 어떻게 생겼는지는 앱의 일이다(이 패키지는 화면이 없다). 보상은 서버가 SSV 로 확정한다 —
 * 앱의 `onEarned` 는 화면 연출용이다.
 *
 * ## 왜 이렇게 생겼나 — 전부 꼬꼬농장 실기기에서 한 번씩 밟은 것
 *
 *  ① **앱 시작에 SDK 를 초기화하지 않는다.** 광고를 한 번도 안 봐도 SDK 가 계속 돌아 기기가 더워졌다(2026-08-26).
 *     첫 광고 직전에 초기화한다. 미리 받기(`warm`)도 앱 시작이 아니라 **안내 팝업이 뜰 때** 부른다.
 *  ② **광고 인스턴스는 한 번 쓰고 버린다.** 재사용하면 두 번째부터 안 열렸다.
 *  ③ **닫힌 뒤에 오는 보상을 기다린다(1.2초).** 끝까지 봤는데 「끝까지 보지 않았어요」가 뜨고 보상이 안 들어왔다 —
 *     마지막 순간에 X 를 누르면 보상 이벤트가 닫힘 **뒤에** 오는 기기가 있다(2026-09-08).
 *  ④ **세 번 잇달아 광고가 안 채워지면 30분 접는다**(`mutedMs`). 눌러도 안 열리는 버튼은 사용자가 앱을 못 믿게
 *     만든다. 한 번이라도 열리면 곧바로 되살린다. 보상형 전면의 실패는 세지 않는다 — 멀쩡한 보상형까지 접혔다(09-14).
 *  ⑤ **15초 안에 안 열리면 실패로 끝낸다**(미리 받은 것은 12초). 25초를 기다리게 했더니 화면이 덮인 채 멈춘 줄
 *     알았다(09-10). 대기 화면에는 「그만두기」(`cancel`)를 둔다.
 *  ⑥ **걸린 표시를 푼다.** 닫힘 이벤트를 못 받으면 다음 광고가 영영 안 열린다 — 12초 넘게 멈췄거나, 앱이
 *     뒤로 갔다 돌아왔는데 안 끝났으면 새로 시작한다.
 *  ⑦ **스토어 production 채널만 실광고.** 심사 전 신규 앱은 실광고 재고가 없어 늘 no-fill 이다(`isTestAds`).
 *  ⑧ **테스트 광고에는 SSV 를 붙이지 않는다** — 붙이면 로드가 실패했다. 둘러보기(회원 번호 없음)도 붙이지 않는다.
 *  ⑨ **iOS 추적 허용(ATT)은 한 번만 묻는다** — 첫 광고 때. 미션 제출 중간에 뜨지 않게 앱이 미리 불러도 된다.
 *
 * ## 쓰는 법
 *
 * 앱에 `react-native-google-mobile-ads`·`expo-tracking-transparency`·`expo-updates` 가 설치돼 있어야 한다
 * (Metro 는 require 를 빌드 때 찾는다 — 없으면 번들이 깨진다).
 *
 * ```ts
 * import { createRewarded, isTestAds } from '@jcurve/ads';
 *
 * export const ads = createRewarded({
 *   units: {
 *     rewarded: { android: 'ca-app-pub-…/…', ios: 'ca-app-pub-…/…' },
 *     rewardedInterstitial: { android: 'ca-app-pub-…/…', ios: 'ca-app-pub-…/…' },   // 없으면 빼도 된다
 *   },
 *   test: isTestAds(process.env.EXPO_PUBLIC_ADMOB_TEST),   // 환경변수는 앱이 넘긴다(빌드 때 채워지는 곳이 앱 코드)
 * });
 *
 * // 안내 팝업이 뜰 때 — 확인을 누르면 바로 열리게
 * ads.warm(memberId, JSON.stringify({ kind: 'feed' }));
 * // 확인을 누르면
 * await ads.show({
 *   userId: memberId, customData: JSON.stringify({ kind: 'feed' }),
 *   onEarned: () => { earned = true; },          // 광고가 아직 전체화면일 때 온다
 *   onClosed: () => { if (earned) celebrate(); },  // 연출은 닫힌 뒤에
 *   onFail: (msg) => toast(msg),                   // 보상을 주지 말고 횟수도 깎지 않는다
 * });
 * ```
 *
 * `available` 이 거짓이면(Expo Go·웹) 앱이 목업 광고로 넘어간다. `interstitialAvailable` 이 거짓이면 보상형으로 띄운다.
 */
var ads_1 = require("./ads");
Object.defineProperty(exports, "createRewarded", { enumerable: true, get: function () { return ads_1.createRewarded; } });
var mode_1 = require("./mode");
Object.defineProperty(exports, "isTestAds", { enumerable: true, get: function () { return mode_1.isTestAds; } });
Object.defineProperty(exports, "readUpdateChannel", { enumerable: true, get: function () { return mode_1.readUpdateChannel; } });
Object.defineProperty(exports, "ssvRequestOptions", { enumerable: true, get: function () { return mode_1.ssvRequestOptions; } });
Object.defineProperty(exports, "useTestAdUnit", { enumerable: true, get: function () { return mode_1.useTestAdUnit; } });
