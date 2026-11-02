/**
 * 응답 JSON 의 키 구조를 「경로 : 종류」 줄로 만든다 — 값은 한 글자도 담지 않는다(종류는 string · number · boolean · null · object · array).
 * 서버 구조 기록(receipt-link/probe)이 받는 dom.outline 줄 모양에 맞춘다: 한 줄 200자 이하, 7자리 이상 숫자 · 허용 밖 글자(한글 · 이모지 등)가 든 키 이름은 「~」 로 바꾼다.
 * 배열은 첫 칸만 따라 내려가고 칸 수를 적는다(arrayN). react-native 를 import 하지 않는다.
 */

const MAX_DEPTH = 8;
const KEY_OK = /^[A-Za-z0-9_$\-]{1,40}$/;

const kind = (v: unknown): string => (v === null ? 'null' : Array.isArray(v) ? 'array' : typeof v === 'object' ? 'object' : typeof v);

/** 키 이름 하나를 서버가 받는 글자로 — 긴 숫자 · 허용 밖 글자가 있으면 ~ */
export const safeKey = (k: string): string => (KEY_OK.test(k) && !/\d{7,}/.test(k) ? k : '~');

/**
 * value → 줄 목록(최대 maxLines). 같은 이름의 객체 키는 한 번씩만 센다.
 * 예) { orders: [{ orderId: 1, items: [] }] } → ['orders : array1', 'orders[0].orderId : number', 'orders[0].items : array0']
 */
export function structureLines(value: unknown, maxLines = 300): string[] {
  const out: string[] = [];
  const walk = (v: unknown, path: string, depth: number): void => {
    if (out.length >= maxLines || depth > MAX_DEPTH) return;
    if (Array.isArray(v)) {
      if (path) out.push(`${path} : array${v.length}`.slice(0, 200));
      if (v.length > 0 && v[0] !== null && typeof v[0] === 'object') walk(v[0], `${path}[0]`, depth + 1);
      return;
    }
    if (v !== null && typeof v === 'object') {
      if (path) out.push(`${path} : object`.slice(0, 200));
      for (const k of Object.keys(v as Record<string, unknown>)) {
        if (out.length >= maxLines) return;
        const child = (v as Record<string, unknown>)[k];
        const p = path ? `${path}.${safeKey(k)}` : safeKey(k);
        if (child !== null && typeof child === 'object') walk(child, p, depth + 1);
        else out.push(`${p} : ${kind(child)}`.slice(0, 200));
      }
      return;
    }
    if (!path) out.push(`value : ${kind(v)}`);
  };
  walk(value, '', 0);
  return out;
}

/** 어떤 JSON 안에서 이름이 re 에 맞는 키의 경로만(찾아 쓴 칸을 구조 기록에 함께 남길 때) */
export function pathsMatching(value: unknown, re: RegExp, max = 40): string[] {
  const hit: string[] = [];
  const walk = (v: unknown, path: string, depth: number): void => {
    if (hit.length >= max || depth > MAX_DEPTH) return;
    if (Array.isArray(v)) { if (v.length > 0) walk(v[0], `${path}[0]`, depth + 1); return; }
    if (v === null || typeof v !== 'object') return;
    for (const k of Object.keys(v as Record<string, unknown>)) {
      const p = path ? `${path}.${safeKey(k)}` : safeKey(k);
      if (re.test(k)) hit.push(p);
      walk((v as Record<string, unknown>)[k], p, depth + 1);
      if (hit.length >= max) return;
    }
  };
  walk(value, '', 0);
  return hit;
}
