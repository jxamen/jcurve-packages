/**
 * 읽기 스크립트 시험 도구 — 시험 파일 맨 위에 `// @vitest-environment jsdom` 을 쓰고, 샘플 HTML 을 `document.body.innerHTML` 로 넣은 뒤 `runReader(script)` 로 돌린다.
 * 시계는 `setNow('2026-10-28 12:00')`(KST)로 고정한다 — 「최근 30일」 판단이 시험마다 같아진다.
 */
import { vi } from 'vitest';
import type { DetailMessage, OrdersMessage } from './common';

export function setNow(kst: string): void {
  const ms = Date.parse(kst.replace(' ', 'T') + ':00+09:00');
  vi.spyOn(Date, 'now').mockReturnValue(ms);
}
export function resetReaders(): void { delete (window as unknown as { __ytOrders?: unknown }).__ytOrders; }

/** 스크립트가 보낸 모든 메시지(hello 포함)를 마지막 `runReader` / `runDetail` 호출 동안 모은 것 */
export const allPosted: Array<Record<string, unknown>> = [];

async function run(script: string, timeoutMs: number, types: string[]): Promise<Record<string, unknown> | null> {
  const posted: Array<Record<string, unknown>> = allPosted;
  posted.length = 0;
  (window as unknown as { ReactNativeWebView: unknown }).ReactNativeWebView = { postMessage: (m: string) => posted.push(JSON.parse(m)) };
  new Function(script)();
  for (let i = 0; i < timeoutMs / 10 && !posted.some((m) => types.includes(String(m.type))); i++) await new Promise((r) => setTimeout(r, 10));
  return posted.find((m) => types.includes(String(m.type))) ?? null;
}

/** 목록 스크립트를 한 번 부르고 앱으로 간 첫 `orders` 메시지를 돌려준다(앱이 다시 부르는 것은 같은 함수를 또 부르면 된다). 없으면 null. `hello` 는 `allPosted` 에 있다. */
export async function runReader(script: string, timeoutMs = 3000): Promise<OrdersMessage | null> {
  return (await run(script, timeoutMs, ['orders'])) as OrdersMessage | null;
}
/** 상세 스크립트를 한 번 부르고 첫 `detail` 메시지를 돌려준다. */
export async function runDetail(script: string, timeoutMs = 3000): Promise<DetailMessage | null> {
  return (await run(script, timeoutMs, ['detail'])) as DetailMessage | null;
}
