/**
 * 테스트 광고를 쓸지·SSV 를 붙일지 — 기기 없이 판단하는 순수 함수(꼬꼬농장 `adMode.ts` 에서 옮김).
 */

/** Metro 가 expo-updates 를 CJS/ESM 어느 쪽으로 주든 채널 이름을 꺼낸다 */
export function readUpdateChannel(mod: unknown): string {
  const m = mod as { channel?: unknown; default?: { channel?: unknown } } | null | undefined;

  return String(m?.channel ?? m?.default?.channel ?? '');
}

/**
 * 구글 테스트 광고 단위를 쓸지 — **스토어 production 채널만 실광고.**
 *
 * 심사 전 신규 앱은 실광고 재고가 없어 늘 no-fill 이라, TestFlight·프리뷰·개발·채널 미확인은 테스트 광고를 쓴다.
 * ⚠ OTA 를 `--environment production` 으로 만들면 `EXPO_PUBLIC_ADMOB_TEST` 가 빠지고, 채널은 Metro interop 때문에
 * `default` 아래에 있을 수 있다 — 둘 다 놓치면 실광고로 뒤집혀 광고가 안 뜬다(꼬꼬농장 2026-08-24·08-26 실사고).
 */
export function useTestAdUnit(envFlag: string | undefined, channel: string, testDevice = false): boolean {
  if (envFlag === '1') return true;
  // 테스트 기기를 등록했으면 실단위 — 그 기기에는 구글이 테스트 광고를 주고, SSV 도 온다(1.1, 당근캐시)
  if (testDevice) return false;
  if (channel === 'production') return false;

  return true;
}

/**
 * 테스트 광고를 쓸지 — 앱이 `EXPO_PUBLIC_ADMOB_TEST` 를 넘기면 채널은 여기서 읽는다.
 *
 * 환경변수는 **앱이** 넘긴다 — `process.env.EXPO_PUBLIC_*` 를 빌드 때 채워 넣는 것은 앱 코드에서만 확실하다.
 */
export function isTestAds(envFlag?: string, testDevice = false): boolean {
  let ch = '';
  try { ch = readUpdateChannel(require('expo-updates')); } catch { /* 모듈 없음 — 채널 미확인은 테스트 광고 */ }

  return useTestAdUnit(envFlag, ch, testDevice);
}

/**
 * SSV(서버 보상 확인)에 실을 값 — **실광고 + 로그인한 사람만.**
 *
 * 테스트 광고에 SSV 를 붙이면 로드가 실패해, 둘러보기만 광고가 열렸다(꼬꼬농장). 둘러보기(userId 없음)는 서버가
 * 보상을 적을 곳이 없으니 붙이지 않는다.
 */
export function ssvRequestOptions(
  useTestAds: boolean,
  userId?: string,
  customData?: string,
): { serverSideVerificationOptions?: { userId: string; customData: string } } {
  if (useTestAds) return {};
  const id = String(userId ?? '').trim().slice(0, 150);
  if (!id) return {};

  return {
    serverSideVerificationOptions: {
      userId: id,
      customData: String(customData ?? '').slice(0, 1000),
    },
  };
}
