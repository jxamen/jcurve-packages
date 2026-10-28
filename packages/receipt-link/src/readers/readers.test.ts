// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ORDER_SITES } from './common';
import { ORDER_PAGES } from './readers';
import { resetReaders, runReader, setNow } from './testkit';

beforeEach(() => { vi.restoreAllMocks(); resetReaders(); setNow('2026-10-28 12:00'); });

describe('ORDER_PAGES — what the app harness receives', () => {
  it('has exactly the four sites, each with an https url and a self-invoking script that ends with true;', () => {
    expect(Object.keys(ORDER_PAGES).sort()).toEqual([...ORDER_SITES].sort());
    for (const site of ORDER_SITES) {
      const page = ORDER_PAGES[site];
      expect(page.url, site).toMatch(/^https:\/\/[a-z0-9.-]+\//);
      expect(page.script.startsWith('(function(){'), site).toBe(true);
      expect(page.script.trimEnd().endsWith('true;'), site).toBe(true);
      expect(() => new Function(page.script), `${site} script must parse`).not.toThrow();
    }
  });

  it('no script reads cookies, storage, tokens or form values (static guard — the frame also keeps only six fields)', () => {
    const banned = [/document\.cookie/, /localStorage/, /sessionStorage/, /indexedDB/, /getItem\s*\(/, /[Aa]uthorization/, /\.value\b/];   // a selector that only DETECTS a password field (login check) is fine; reading any input's value is not
    for (const site of ORDER_SITES) for (const pattern of banned) expect(ORDER_PAGES[site].script, `${site} ${pattern}`).not.toMatch(pattern);
  });

  it('on an empty page every script answers once with orders:[] and a code-shaped note (never silence, never a throw)', async () => {
    for (const site of ORDER_SITES) {
      resetReaders();
      document.body.innerHTML = '<div>nothing here</div>';
      (globalThis as { fetch?: unknown }).fetch = () => Promise.reject(new Error('offline'));
      const msg = await runReader(ORDER_PAGES[site].script, 8000);
      expect(msg, site).not.toBeNull();
      expect(msg!.type).toBe('orders');
      expect(msg!.site).toBe(site);
      expect(msg!.orders).toEqual([]);
      expect(msg!.done).toBe(true);
      expect(msg!.note, site).toMatch(/^[A-Za-z0-9_]{1,40}$/);
    }
  }, 60000);
});
