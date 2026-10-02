/**
 * 틱톡 전환 규칙 — RN 에 기대지 않는 순수 함수만(노드 시험이 직접 읽는다). 보내는 쪽은 `tiktok.ts`.
 * 당근캐시 `src/tiktok.map.ts`(release/tiktok)에서 옮기며 **설정 그룹 이름을 앱이 넘기게** 바꿨다(1.7, 2026-10-02 대표님
 * 「TikTok까지 패키지로 … 광고는 다」). 앱마다 다른 것은 그룹 이름뿐이다.
 */
export type StandardKey = 'ad_impression' | 'registration' | 'login';

/** 앱이 쓰는 이름 → 틱톡에 보낼 것. null 이면 보내지 않는다 */
export type TikTokCall = { standard: StandardKey } | { custom: string };

/**
 * 어드민 「앱 설정」(custom)의 칸 이름 — `{그룹}.tiktok_…`. 이름이 `_secret`·`_token` 으로 끝나면 서버가 앱에
 * 안 내려준다(9/22 scrub) — 그래서 `_access` · `_id_*` 다.
 */
export function tiktokKeys(group: string): { access: string; androidAccess: string; idIos: string; idAndroid: string } {
  const g = group.trim();

  return {
    access: `${g}.tiktok_sdk_access`,
    androidAccess: `${g}.tiktok_android_sdk_access`,
    idIos: `${g}.tiktok_app_id_ios`,
    idAndroid: `${g}.tiktok_app_id_android`,
  };
}

/*
 | 틱톡 앱 ID 는 19자리라 숫자로 오면 이미 자릿수가 깨져 있다(2^53 초과) — 글자만 받는다. 어드민에는 글자로 넣는다.
 */
function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** 플랫폼에 맞는 App Secret — 안드로이드는 안드 전용 칸이 있으면 그것, 없으면 공용 칸. 비면 끈다 */
export function tiktokSecret(group: string, os: string, values: Record<string, unknown> | null | undefined): string {
  const k = tiktokKeys(group);
  if (os === 'android') return str(values?.[k.androidAccess]) || str(values?.[k.access]);

  return str(values?.[k.access]);
}

/**
 * 틱톡이 말하는 appId 는 플랫폼마다 다르다 — iOS 는 앱스토어 앱 번호, 안드로이드는 패키지 이름(공개 값, app.json extra).
 * tiktokAppId 는 이벤트 관리자의 앱 ID — 플랫폼마다 따로이고 **번들에 굽지 않고** 어드민 값에서 읽는다.
 * iOS 의 틱톡 앱 ID 를 안드로이드에 쓰지 않는다. 비면 그 플랫폼은 꺼져 있다.
 */
export function tiktokIds(
  group: string,
  os: string,
  store: { appleAppId?: unknown; androidPackage?: unknown } | null | undefined,
  values: Record<string, unknown> | null | undefined,
): { appId: string; tiktokAppId: string } | null {
  const k = tiktokKeys(group);
  const appId = os === 'ios' ? str(store?.appleAppId) : os === 'android' ? str(store?.androidPackage) : '';
  const tiktokAppId = os === 'ios' ? str(values?.[k.idIos]) : os === 'android' ? str(values?.[k.idAndroid]) : '';
  if (!appId || !tiktokAppId) return null;

  return { appId, tiktokAppId };
}

/**
 * 공용 이름 → 틱톡(10개 앱 공통 규약: 가입 · 로그인). 앱만의 이벤트(당근 「일주일 미션」 등)는 앱이
 * `events` 로 더한다 — 앱 것이 먼저다.
 */
export function tiktokEventFor(
  name: string,
  params?: Record<string, unknown>,
  extra?: (name: string, params?: Record<string, unknown>) => TikTokCall | null | undefined,
): TikTokCall | null {
  const own = extra?.(name, params);
  if (own) return own;
  if (name === 'signup_done') return { standard: 'registration' };
  if (name === 'login_done') return { standard: 'login' };

  return null;
}
