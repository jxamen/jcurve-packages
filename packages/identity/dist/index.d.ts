/**
 * `@jcurve/identity` — 리워드 앱 공용 **간편인증(KICA/KIAP) 본인확인**.
 *
 * 서버(`/kiap/*`)가 인증 페이지·검증·CI 대조를 전부 맡고, **앱은 브라우저를 열었다가
 * 1회용 토큰으로 결과(이름·휴대폰)만 회수한다.** 앱 번들에는 어떤 인증 자격증명도 없다.
 *
 * ## 왜 묶었나
 *
 * 문자 인증(`@jcurve/phone`)과 **하는 일이 다르다.** 문자는 「이 번호가 그 사람 것인가」만
 * 보고, 이쪽은 **본인확인 기관을 거쳐 CI(연계정보)로 1인 1계정을 보장**한다.
 * 선물 교환·현금 인출처럼 사람을 특정해야 하는 자리에 쓴다.
 *
 * 앱마다 다시 쓰면 **사유 문구와 스킴 규칙이 갈린다.** 특히 복귀 스킴이 서버
 * 화이트리스트와 어긋나면 인증을 마치고 돌아올 곳이 없어 **브라우저가 열린 채 끝난다** —
 * 사용자에게는 「아무 일도 안 일어남」으로 보여서 원인을 못 찾는다.
 *
 * ## 담은 교훈
 *
 *  - **`X-App-Token` 을 빼먹으면 늘 「꺼짐」으로 읽힌다.** 공용 API 가 unauthorized 를 주는데
 *    그것을 「자격증명 없음」과 구분하지 않아서다(꼬꼬농장 2026-09-14).
 *  - **`expo-web-browser` 는 지연 `require`.** 없는 구 빌드에서 화면이 열리는 것만으로 죽지 않게.
 *  - **`URLSearchParams` 를 믿지 않는다.** RN 폴리필이 기기·판마다 있기도 없기도 해서,
 *    없는 기기에서만 결과를 잃는다.
 *  - **이미 인증한 회원은 서버 번호로 이어 준다.** 기기를 바꾸거나 저장이 날아간 사람이
 *    다시 인증하려 하면 `already_verified` 로 막히는데, 그때 할 수 있는 일이 없다.
 *
 * ## 쓰는 법
 *
 * ```ts
 * import { createIdentity, identityMessage } from '@jcurve/identity';
 *
 * const identity = createIdentity({
 *   base: API_BASE,
 *   appToken: APP_TOKEN,
 *   token: () => session?.token ?? null,
 *   ret: 'kkokkofarm://kiap',        // 서버 화이트리스트와 같아야 한다
 *   keep: (v) => saveLocally(v),
 *   me: () => fetchMe(),             // already_verified 를 이어 주는 데 쓴다
 * });
 *
 * if (!(await identity.enabled())) return say('준비 중이에요');
 * const r = await identity.verify();
 * if (!r.ok) return say(identityMessage(r.reason));
 * ```
 *
 * **화면은 없다.** 본인인증 화면은 앱마다 그 앱답게 생겨야 한다.
 */
export { createIdentity, identityMessage, parseQuery, type Identity, type IdentityDeps, type IdentityResult, } from './identity';
