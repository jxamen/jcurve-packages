import { describe, expect, it } from 'vitest';
import { localizeSection } from './hook';
import { hubInitial, hubReduce, hubView, readStoredHub, saveStoredHub } from './store';

describe('cached section language compatibility', () => {
  it('retains the source language in storage and translates only the displayed section', async () => {
    let saved: string | null = null;
    const storage = { get: async () => saved, set: async (_key: string, value: string) => { saved = value; } };
    const hub = { items: [], section: { on: false, title: '추천 앱 둘러보기', desc: null } };
    await saveStoredHub(storage, hub);
    const stored = await readStoredHub(storage);
    const view = hubView(hubReduce(hubInitial(true), { type: 'stored', hub: stored }));
    expect(view.visible).toBe(false);
    expect(localizeSection(view.section, 'en').title).toBe('Explore Featured Apps');
    expect(localizeSection(view.section, 'ko').title).toBe('추천 앱 둘러보기');
    expect((await readStoredHub(storage))?.section.title).toBe('추천 앱 둘러보기');
  });
});
