/**
 * `@jcurve/phone` — 리워드 앱 공용 **휴대폰 번호 인증**(문자 6자리).
 *
 * **화면은 들어 있지 않다.** 번호 인증은 앱마다 그 앱답게 생겨야 하고(2026-09-21 오너:
 * 「디자인은 앱마다 달라서 똑같은 디자인을 원하는 건 아니야」), 실제로 앱마다 다르게 그려
 * 두고도 아무 문제가 없었다. 앱마다 달라서는 **안 되는 것**만 여기 둔다.
 *
 * ## 무엇을 묶었나
 *
 *  ① **서버 호출** — `phone/send` · `phone/verify` · `me/profile`. 경로도 규칙도 서버가 하나다.
 *  ② **번호 검증** — 화면이 서버보다 느슨하면 `bad_phone` 으로 거절당하고, 빡빡하면 멀쩡한
 *     번호를 못 넣는다. 둘 다 「왜 안 되지」가 되고 그때 사람은 자기 번호를 의심한다.
 *  ③ **오류 문구** — 앱마다 다시 쓰면 같은 `phone_taken` 이 앱마다 다른 말로 나온다.
 *     문의가 오면 어느 앱인지부터 물어야 한다.
 *  ④ **다시 받아야 하는가** — 시간이 지났거나 다섯 번 틀리면 서버가 그 코드를 버린다.
 *     화면이 모르면 **이미 없는 코드에 계속 숫자를 넣게 된다.**
 *
 * ## 왜 묶었나
 *
 * 2026-09-21 에 서버가 「초대는 번호를 확인한 사람만」으로 바뀌었는데, 그 하나를 맞추려고
 * **앱 다섯 곳**(영테크·당근캐시·캐시팡·꾹테크·꼬꼬농장)을 따로 고쳐야 했다. 그중 셋이
 * 그날 안에 못 나갔다. 규칙이 서버에 하나면 앱에도 하나여야 한다.
 *
 * ## 쓰는 법
 *
 * ```ts
 * import { createPhone, format, looksValid, message, needsResend, CODE_LEN } from '@jcurve/phone';
 *
 * const phone = createPhone({
 *   base: 'https://api.j-curve.co.kr/v1/kkokkofarm',
 *   headers: () => {
 *     const t = session?.token;
 *     if (!t) return null;                       // 로그인 전 — 부르지 않는다
 *     // Accept · Content-Type 은 패키지가 붙인다(1.1)
 *     return { 'X-App-Token': APP_TOKEN, Authorization: 'Bearer ' + t };
 *   },
 * });
 *
 * const st = await phone.status();
 * if (st && !st.smsReady) return;                // 문자를 못 보내는 상태면 화면을 열지 않는다
 *
 * const r = await phone.send(input);
 * if (!r.ok) setError(message(r.error, { waitMs: r.waitMs }));
 * ```
 *
 * 화면이 들고 있어야 하는 것은 **남은 시간과 재전송 대기**뿐이다. 값은 `send()` 가
 * `ttlMs` 로 주고, 재전송 대기는 60초다(`too_soon` 이면 `waitMs` 가 온다).
 */
export { CODE_LEN, codeLooksValid, createPhone, digits, format, looksValid, message, needsResend, type Phone, type PhoneDeps, type PhoneError, type PhoneStatus, type SendResult, type VerifyResult, } from './phone';
