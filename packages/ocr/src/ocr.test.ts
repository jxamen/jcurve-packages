import { describe, expect, it, vi } from 'vitest';
import { createOcr, ocrMessage, OcrError, verdictMessage, type OcrResult } from './ocr';

const RESULT: OcrResult = {
  verdict: 'confirmed',
  fields: { store: 'CU', paidAt: '2026-08-16 12:10:17', date: '2026-08-16', time: '12:10:17',
    total: 4300, businessNumber: '1248100998', approval: '51024699', items: [] },
  checks: [],
  contentKey: 'k'.repeat(64),
};

/** 서버를 흉내 낸다 — 몇 번 물은 뒤에 끝나는지 정할 수 있다 */
function server(opts: { pendingTimes?: number; final?: 'done' | 'failed'; id?: unknown } = {}) {
  let asked = 0;
  const post = vi.fn(async () => ({ ok: true, id: opts.id ?? 'job-1' }));
  const get = vi.fn(async () => {
    asked += 1;
    if (asked <= (opts.pendingTimes ?? 0)) return { ok: true, status: 'pending' };
    return opts.final === 'failed'
      ? { ok: true, status: 'failed', error: 'ocr_failed' }
      : { ok: true, status: 'done', result: RESULT, sha256: 'f'.repeat(64) };
  });
  return { post, get };
}

const noWait = { sleep: async () => {} };

describe('맡기고 받기', () => {
  it('끝날 때까지 물어서 결과를 준다', async () => {
    const s = server({ pendingTimes: 2 });
    const got = await createOcr({ ...s, ...noWait }).read({ uri: 'file:///r.jpg' });
    expect(got.verdict).toBe('confirmed');
    expect(got.fields.total).toBe(4300);
    expect(s.get).toHaveBeenCalledTimes(3);
  });

  it('파일 해시를 결과에 같이 붙인다 — 앱이 중복을 가르는 데 쓴다', async () => {
    const got = await createOcr({ ...server(), ...noWait }).read({ uri: 'file:///r.jpg' });
    expect(got.sha256).toBe('f'.repeat(64));
  });

  it('앱 주소 뒤에 붙일 경로로 부른다', async () => {
    const s = server();
    await createOcr({ ...s, ...noWait }).read({ uri: 'file:///r.jpg' });
    expect(s.post.mock.calls[0][0]).toBe('ocr/jobs');
    expect(s.get.mock.calls[0][0]).toBe('ocr/jobs/job-1');
  });

  it('번호에 섞인 글자는 경로를 깨지 않게 감싼다', async () => {
    const s = server({ id: 'a/b' });
    await createOcr({ ...s, ...noWait }).read({ uri: 'file:///r.jpg' });
    expect(s.get.mock.calls[0][0]).toBe('ocr/jobs/a%2Fb');
  });

  it('영수증 종류를 같이 보낸다', async () => {
    const s = server();
    await createOcr({ ...s, ...noWait }).submit({ uri: 'file:///r.jpg' });
    const form = s.post.mock.calls[0][1] as FormData;
    expect(form.get('kind')).toBe('receipt');
  });
});

describe('못 끝나는 경우', () => {
  it('서버가 못 읽었으면 ocr_failed 로 던진다', async () => {
    const run = createOcr({ ...server({ final: 'failed' }), ...noWait }).read({ uri: 'file:///r.jpg' });
    await expect(run).rejects.toMatchObject({ code: 'ocr_failed' });
  });

  it('시간이 지나면 timeout 으로 던진다 — 서버에서는 계속 돈다', async () => {
    let t = 0;
    const run = createOcr({ ...server({ pendingTimes: 999 }), sleep: async () => { t += 2_000; }, now: () => t })
      .read({ uri: 'file:///r.jpg' }, { timeoutMs: 5_000 });
    await expect(run).rejects.toMatchObject({ code: 'timeout' });
  });

  it('번호를 안 주면 믿지 않는다', async () => {
    const run = createOcr({ ...server({ id: '' }), ...noWait }).submit({ uri: 'file:///r.jpg' });
    await expect(run).rejects.toBeInstanceOf(OcrError);
  });

  it('done 이라면서 판정이 없으면 성공으로 넘기지 않는다', async () => {
    const get = vi.fn(async () => ({ ok: true, status: 'done', result: {} }));
    const run = createOcr({ post: async () => ({ id: 'j' }), get, ...noWait }).read({ uri: 'file:///r.jpg' });
    await expect(run).rejects.toMatchObject({ code: 'bad_response' });
  });

  it('서버가 던진 오류는 그대로 올라간다 — 앱의 오류 모양을 바꾸지 않는다', async () => {
    const refused = Object.assign(new Error('forbidden'), { code: 'ocr_disabled' });
    const run = createOcr({ post: async () => { throw refused; }, get: async () => ({}), ...noWait })
      .read({ uri: 'file:///r.jpg' });
    await expect(run).rejects.toBe(refused);
  });
});

describe('사용자에게 보일 문장', () => {
  const rejected = (name: string): OcrResult => ({
    ...RESULT, verdict: 'rejected',
    checks: [{ name, passed: false, blocking: true, detail: '' }],
  });

  it('영수증이 아닌 사진에는 돌리라고 하지 않는다', () => {
    expect(verdictMessage(rejected('is_receipt'))).toBe('영수증으로 확인되지 않았어요');
  });

  it('돌아간 사진에는 돌려서 다시라고 한다', () => {
    expect(verdictMessage(rejected('upright'))).toContain('바로 세워서');
  });

  it('못 읽은 사진에는 밝은 곳에서 다시라고 한다', () => {
    expect(verdictMessage(rejected('evidence_present'))).toContain('밝은 곳');
    expect(verdictMessage(rejected('total_present'))).toContain('밝은 곳');
  });

  it('스위치가 꺼진 앱은 사용자에게 고칠 수 없는 말을 하지 않는다', () => {
    expect(ocrMessage('ocr_disabled')).not.toContain('앱 관리');
  });
});
