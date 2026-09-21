/**
 * 간편인증 본체 — 왜 이렇게 생겼는지는 `index.ts` 머리말에 있다.
 *
 * **이 파일은 앱을 모른다.** 스킴·세션·저장은 앱이 주입한다.
 */

/**
 * 앱이 주는 것.
 *
 * `ret` 는 **서버 화이트리스트와 같아야 한다.** 다르면 인증을 마치고 돌아올 곳이 없어
 * 브라우저가 열린 채 끝난다 — 사용자에게는 「아무 일도 안 일어남」으로 보인다.
 */
export type IdentityDeps = {
  /** 예: `https://api.j-curve.co.kr/v1/kkokkofarm` */
  base: string;
  /** 앱 공개 토큰(`X-App-Token`) */
  appToken: string;
  /** 지금 회원 세션 토큰. 없으면 `null` */
  token: () => string | null;
  /** 복귀 스킴. 예: `kkokkofarm://kiap` */
  ret: string;
  /** 인증이 끝나면 이름·번호를 앱이 간직한다(쿠폰 수신처 등) */
  keep?: (v: { name: string; phone: string; provider: string }) => void | Promise<void>;
  /** 이미 인증한 회원일 때 서버 회원 정보를 읽는다 — 기기를 바꾼 사람을 이어 준다 */
  me?: () => Promise<{ name?: string; phone?: string } | null>;
};

export type IdentityResult =
  | { ok: true; name: string; phone: string; provider: string }
  | { ok: false; reason: string };

const REASON: Record<string, string> = {
  CANCELED: '인증을 취소했어요.',
  NO_SESSION: '로그인한 뒤 다시 시도해 주세요.',
  NETWORK: '연결이 불안정해요. 잠시 후 다시 시도해 주세요.',
  KIAP_DISABLED: '간편인증 준비 중이에요. 잠시 후 다시 시도해 주세요.',
  CONFIG_MISSING: '간편인증 준비 중이에요. 잠시 후 다시 시도해 주세요.',
  ALREADY_VERIFIED: '이미 본인인증을 마친 계정이에요. 앱을 다시 열어 주세요.',
  SESSION_EXPIRED: '인증 시간이 지났어요. 다시 시도해 주세요.',
  RATE_LIMITED: '잠시 후 다시 시도해 주세요.',
  DUPLICATE_CI: '이미 다른 계정에서 인증된 사용자예요. 계정은 1인 1개만 쓸 수 있어요.',
  UID_CI_CONFLICT: '이 계정은 다른 사람 명의로 인증되어 있어요.',
  CI_MISSING: '인증 기관에서 정보를 받지 못했어요. 다시 시도해 주세요.',
  RESULT_LOST: '인증 결과를 받지 못했어요. 다시 시도해 주세요.',
  NEED_UPDATE: '앱을 최신 버전으로 업데이트해 주세요.',
};

/** 사유 → 사람이 읽는 말. 모르는 사유도 빈 문자열을 내지 않는다 */
export function identityMessage(reason: string): string {
  return REASON[reason] ?? `본인인증에 실패했어요. 다시 시도해 주세요. (${reason})`;
}

/**
 * 복귀 URL 의 쿼리를 읽는다 — **RN 의 `URLSearchParams` 폴리필을 믿지 않는다.**
 * 기기·판마다 있기도 없기도 해서, 없는 기기에서만 결과를 잃는다.
 */
export function parseQuery(url: string): Record<string, string> {
  const out: Record<string, string> = {};
  const q = url.split('?')[1] ?? '';
  for (const pair of q.split('&')) {
    const i = pair.indexOf('=');
    if (i > 0) out[decodeURIComponent(pair.slice(0, i))] = decodeURIComponent(pair.slice(i + 1));
  }

  return out;
}

export type Identity = {
  /** 서버에 자격증명이 등록됐는가 — 아니면 화면이 「준비 중」으로 안내한다 */
  enabled: () => Promise<boolean>;
  /** 인증 실행 — 브라우저를 열고 결과를 회수한다 */
  verify: () => Promise<IdentityResult>;
};

export function createIdentity(deps: IdentityDeps): Identity {
  const headers = (json = false): Record<string, string> => {
    const h: Record<string, string> = { Accept: 'application/json', 'X-App-Token': deps.appToken };
    const t = deps.token();
    if (t) h.Authorization = 'Bearer ' + t;
    if (json) h['Content-Type'] = 'application/json';

    return h;
  };

  return {
    async enabled() {
      try {
        // **앱 토큰을 빼먹으면 늘 「꺼짐」으로 읽힌다** — 공용 API 가 unauthorized 를 주는데
        // 그것을 「자격증명 없음」과 구분하지 않기 때문이다(꼬꼬농장 2026-09-14).
        const r = await fetch(deps.base + '/kiap/status', { headers: { Accept: 'application/json', 'X-App-Token': deps.appToken } });
        const j = await r.json().catch(() => null);

        return !!j?.enabled;
      } catch {
        return false;
      }
    },

    async verify() {
      const token = deps.token();
      if (!token) return { ok: false, reason: 'NO_SESSION' };

      // **지연 `require` 로만 집는다** — 이 네이티브 모듈이 없는 구 빌드에서 화면이
      // 열리는 것만으로 죽지 않게 한다. 모듈이 없으면 이 경로만 조용히 접는다.
      let WebBrowser: { openAuthSessionAsync: (url: string, ret: string) => Promise<{ type: string; url?: string }> };
      try {
        WebBrowser = require('expo-web-browser');
      } catch {
        return { ok: false, reason: 'NEED_UPDATE' };
      }

      let init: any = null;
      try {
        const res = await fetch(deps.base + '/kiap/init', {
          method: 'POST', headers: headers(true), body: JSON.stringify({ ret: deps.ret }),
        });
        init = await res.json().catch(() => null);
      } catch {
        return { ok: false, reason: 'NETWORK' };
      }

      if (!init?.ok || typeof init.url !== 'string') {
        const err = String(init?.error || 'init_failed');
        // 이미 인증한 회원 — 서버에 남은 번호로 이어 붙인다(기기를 바꿨거나 저장이 날아간 경우)
        if (err === 'already_verified' && deps.me) {
          try {
            const me = await deps.me();
            if (me?.phone) {
              const v = { name: me.name ?? '', phone: me.phone, provider: 'server' };
              await deps.keep?.(v);

              return { ok: true, ...v };
            }
          } catch { /* 아래 안내로 */ }
        }

        return { ok: false, reason: err.toUpperCase() };
      }

      const r = await WebBrowser.openAuthSessionAsync(init.url, deps.ret);
      if (r.type !== 'success' || !r.url) return { ok: false, reason: 'CANCELED' };

      const p = parseQuery(r.url);
      if (p.ok !== '1') return { ok: false, reason: p.reason || 'FAILED' };
      if (!p.sid || !p.t) return { ok: false, reason: 'RESULT_LOST' };

      try {
        const res = await fetch(
          `${deps.base}/kiap/result?sid=${encodeURIComponent(p.sid)}&t=${encodeURIComponent(p.t)}`,
          { headers: headers() },
        );
        const j = await res.json().catch(() => null);
        if (!j?.ok) return { ok: false, reason: 'RESULT_LOST' };
        const v = { name: String(j.name ?? ''), phone: String(j.phone ?? ''), provider: String(j.provider ?? '') };
        await deps.keep?.(v);

        return { ok: true, ...v };
      } catch {
        return { ok: false, reason: 'NETWORK' };
      }
    },
  };
}
