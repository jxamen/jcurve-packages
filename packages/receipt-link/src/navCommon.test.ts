import { describe, expect, it } from 'vitest';
import { hrefByTextScript, isOpenableUrl, NEUTRALIZE_NEW_WINDOW_SCRIPT, QUIET_DIALOGS_SCRIPT, setQuietScript } from './navCommon';

const BANNED = [/\beval\b/, /new Function/, /document\.cookie/, /localStorage/, /sessionStorage/, /\bfetch\(/, /XMLHttpRequest/];

describe('navCommon', () => {
  it('새 창 처리 스크립트: window.open 을 같은 창 이동으로, a[target] 을 _self 로, 금지 API 없음, true; 로 끝', () => {
    expect(NEUTRALIZE_NEW_WINDOW_SCRIPT).toContain('window.open');
    expect(NEUTRALIZE_NEW_WINDOW_SCRIPT).toContain("'_self'");
    expect(NEUTRALIZE_NEW_WINDOW_SCRIPT.trim().endsWith('true;')).toBe(true);
    for (const re of BANNED) expect(NEUTRALIZE_NEW_WINDOW_SCRIPT).not.toMatch(re);
  });

  it('새 창 처리 스크립트는 가짜 window 에서 window.open 이 location.assign 이 된다', () => {
    const assigned: string[] = [];
    const win: Record<string, unknown> = {};
    const doc = { addEventListener: () => undefined };
    const loc = { assign: (u: string) => assigned.push(u) };
    new Function('window', 'document', 'location', NEUTRALIZE_NEW_WINDOW_SCRIPT)(win, doc, loc);
    (win.open as (u: string) => unknown)('https://pay.musinsapayments.com/mps/receipt/1');
    expect(assigned).toEqual(['https://pay.musinsapayments.com/mps/receipt/1']);
    // 두 번 적용해도 한 번만
    new Function('window', 'document', 'location', NEUTRALIZE_NEW_WINDOW_SCRIPT)(win, doc, loc);
    expect(win.__ytNW).toBe(1);
  });

  it('hrefByTextScript: 글자 목록은 따옴표 등을 걸러 넣고 순번을 정수로, 금지 API 없음', () => {
    const s = hrefByTextScript(["영수증'보기", '영수증 조회'], 2.7);
    expect(s).toContain('"영수증보기"');
    expect(s).toContain('"영수증 조회"');
    expect(s).toContain(', 2);');
    expect(s).toContain("step: 'href'");
    expect(s.trim().endsWith('true;')).toBe(true);
    for (const re of BANNED) expect(s).not.toMatch(re);
  });

  it('isOpenableUrl: https · 허용 도메인(하위 포함)만, 로그아웃·삭제·취소 주소는 거절', () => {
    const hosts = ['kurlypay.co.kr', 'musinsapayments.com'];
    expect(isOpenableUrl('https://pg.kurlypay.co.kr/api/payments/receipt/request/card?encreq=abc', hosts)).toBe(true);
    expect(isOpenableUrl('https://pay.musinsapayments.com/mps/receipt/202610200000000001?paymentKey=k&merchantCode=STORE&tid=t', hosts)).toBe(true);
    expect(isOpenableUrl('http://pg.kurlypay.co.kr/x', hosts)).toBe(false);
    expect(isOpenableUrl('https://evil.example.com/kurlypay.co.kr', hosts)).toBe(false);
    expect(isOpenableUrl('https://pay.musinsapayments.com/mps/order/cancel?id=1', hosts)).toBe(false);
    expect(isOpenableUrl('javascript:alert(1)', hosts)).toBe(false);
  });
});

describe('QUIET_DIALOGS_SCRIPT — 숨김 웹뷰의 alert · confirm · prompt 삼키기', () => {
  type FakeWin = Record<string, any>;
  const MSG = '영수증 조회에 실패하였습니다. 새로고침 또는 재로그인 후 다시 시도해주세요.';

  /** 가짜 window: 원래 함수가 불렸는지 · 앱으로 간 메시지를 모은다 */
  function setup() {
    const calls: string[] = [];
    const posted: string[] = [];
    const win: FakeWin = {
      alert: (m: unknown) => { calls.push('alert:' + String(m)); },
      confirm: (m: unknown) => { calls.push('confirm:' + String(m)); return true; },
      prompt: (m: unknown) => { calls.push('prompt:' + String(m)); return 'typed'; },
      ReactNativeWebView: { postMessage: (s: string) => { posted.push(s); } },
    };
    const apply = () => new Function('window', QUIET_DIALOGS_SCRIPT)(win);
    apply();
    return { win, calls, posted, apply };
  }

  it('금지 API 가 없고 true; 로 끝난다(eval · 저장소 · 쿠키 · 네트워크 없음)', () => {
    expect(QUIET_DIALOGS_SCRIPT.trim().endsWith('true;')).toBe(true);
    for (const re of BANNED) expect(QUIET_DIALOGS_SCRIPT).not.toMatch(re);
    expect(QUIET_DIALOGS_SCRIPT).not.toMatch(/indexedDB|navigator\.sendBeacon|WebSocket/);
  });

  it('기본은 조용히: alert 는 아무것도 안 하고 confirm 은 false, prompt 는 null — 원래 함수는 불리지 않는다', () => {
    const { win, calls } = setup();
    expect(win.alert(MSG)).toBeUndefined();
    expect(win.confirm(MSG)).toBe(false);
    expect(win.prompt(MSG, 'x')).toBeNull();
    expect(calls).toEqual([]);
    expect(win.__ytQuiet).toBe(1);
  });

  it('가로챌 때마다 {type:"dialog", kind, len, fail} 만 앱에 보낸다 — 메시지 글자는 없다', () => {
    const { win, posted } = setup();
    win.alert(MSG);
    win.confirm('Error: 확인할까요?');
    win.prompt('코드를 입력하세요');
    expect(posted.map((p) => JSON.parse(p))).toEqual([
      { type: 'dialog', kind: 'alert', len: MSG.length, fail: true },
      { type: 'dialog', kind: 'confirm', len: 'Error: 확인할까요?'.length, fail: true },
      { type: 'dialog', kind: 'prompt', len: '코드를 입력하세요'.length, fail: false },
    ]);
    for (const p of posted) {
      expect(Object.keys(JSON.parse(p)).sort()).toEqual(['fail', 'kind', 'len', 'type']);
      expect(p).not.toContain('영수증');
      expect(p).not.toContain('코드');
    }
  });

  it('fail 은 실패 · 오류 · error · fail 글자(대소문자 무관)에만 true', () => {
    const { win, posted } = setup();
    for (const m of ['요청이 실패했어요', '알 수 없는 오류', 'Network ERROR', 'Failed to load', '로그인이 필요합니다', '', undefined, null]) win.alert(m);
    expect(posted.map((p) => JSON.parse(p).fail)).toEqual([true, true, true, true, false, false, false, false]);
    expect(JSON.parse(posted[5]).len).toBe(0);
  });

  it('__ytQuiet 가 0 이면 원래 함수로 통과시킨다(보이는 로그인 화면의 알림) — 메시지는 그래도 센다, 다시 1 이면 조용히', () => {
    const { win, calls, posted } = setup();
    win.__ytQuiet = 0;
    win.alert(MSG);
    expect(win.confirm('확인?')).toBe(true);
    expect(win.prompt('입력?')).toBe('typed');
    expect(calls).toEqual(['alert:' + MSG, 'confirm:확인?', 'prompt:입력?']);
    expect(posted).toHaveLength(3);
    win.__ytQuiet = 1;
    expect(win.confirm('또?')).toBe(false);
    expect(calls).toHaveLength(3);
  });

  const LOGIN_NEEDED = [
    '로그인하셔야 본 서비스를 이용하실 수 있습니다.',
    '로그인 하셔야 합니다',
    '로그인을 하셔야 이용 가능합니다',
    '로그인해야 볼 수 있어요',
    '로그인이 필요합니다.',
    '로그인 필요',
    '로그인 후 이용해 주세요',
    'Login required',
    'LOGIN  REQUIRED to continue',
  ];

  it('보이는 동안(__ytQuiet=0)에도 「로그인이 필요하다」는 alert 만은 삼킨다 — 원래 alert 는 부르지 않고 undefined, 글자 없는 알림만 보낸다', () => {
    for (const msg of LOGIN_NEEDED) {
      const { win, calls, posted } = setup();
      win.__ytQuiet = 0;
      expect(win.alert(msg)).toBeUndefined();
      expect(calls, msg).toEqual([]);
      expect(posted.map((p) => JSON.parse(p)), msg).toEqual([{ type: 'dialog', kind: 'alert', len: msg.length, fail: false, login: true }]);
      // 메시지 글자는 없다 — 칸은 type · kind · len · fail · login 뿐이고 값은 글자 수와 true/false
      expect(Object.keys(JSON.parse(posted[0])).sort()).toEqual(['fail', 'kind', 'len', 'login', 'type']);
      expect(posted[0]).not.toContain('로그인');
      expect(posted[0]).not.toContain('필요');
      expect(posted[0]).not.toContain('required');
    }
  });

  it('보이는 동안 다른 알림은 그대로 통과한다 — 비밀번호 오류 · 로그인 정보 불일치 · 로그인 글자가 있어도 필요하다는 뜻이 아닌 것', () => {
    for (const msg of ['비밀번호가 일치하지 않습니다.', '아이디 또는 비밀번호 오류입니다', '로그인 정보가 올바르지 않습니다.', '로그인에 실패했어요', '5회 이상 틀려 계정이 잠겼습니다', MSG]) {
      const { win, calls, posted } = setup();
      win.__ytQuiet = 0;
      win.alert(msg);
      expect(calls, msg).toEqual(['alert:' + msg]);
      const sent = JSON.parse(posted[0]);
      expect(sent.login, msg).toBeUndefined();
      expect(Object.keys(sent).sort()).toEqual(['fail', 'kind', 'len', 'type']);
    }
  });

  it('보이는 동안에도 confirm · prompt 는 건드리지 않는다(로그인 문구여도 원래 함수로 통과)', () => {
    const { win, calls } = setup();
    win.__ytQuiet = 0;
    expect(win.confirm('로그인이 필요합니다. 이동할까요?')).toBe(true);
    expect(win.prompt('로그인하셔야 합니다')).toBe('typed');
    expect(calls).toEqual(['confirm:로그인이 필요합니다. 이동할까요?', 'prompt:로그인하셔야 합니다']);
  });

  it('숨김(조용히)에서는 로그인 문구도 다른 알림도 전부 삼킨다 — 원래 함수는 불리지 않는다', () => {
    const { win, calls, posted } = setup();
    for (const msg of [...LOGIN_NEEDED, '비밀번호 오류', MSG]) expect(win.alert(msg)).toBeUndefined();
    expect(win.confirm('로그인이 필요합니다')).toBe(false);
    expect(win.prompt('로그인하셔야 합니다')).toBeNull();
    expect(calls).toEqual([]);
    expect(posted.length).toBe(LOGIN_NEEDED.length + 2 + 2);
    for (const p of posted) {
      expect(Object.keys(JSON.parse(p)).sort()).toEqual(['fail', 'kind', 'len', 'type']);
      expect(p).not.toContain('로그인');
    }
  });

  it('두 번 적용해도 한 번만 감싼다 · 이미 0 으로 정해 둔 값은 건드리지 않는다', () => {
    const { win, calls, posted, apply } = setup();
    const wrapped = win.alert;
    apply();
    expect(win.alert).toBe(wrapped);
    win.__ytQuiet = 0;
    win.alert('한 번');
    expect(calls).toEqual(['alert:한 번']);
    expect(posted).toHaveLength(1);
    // 먼저 0 으로 정해진 새 문서에서는 기본값 1 로 덮지 않는다
    const w2: FakeWin = { __ytQuiet: 0, alert: () => undefined, confirm: () => true, prompt: () => 'x', ReactNativeWebView: { postMessage: () => undefined } };
    new Function('window', QUIET_DIALOGS_SCRIPT)(w2);
    expect(w2.__ytQuiet).toBe(0);
  });

  it('앱으로 보내는 통로가 없어도 터지지 않고, 원래 함수가 없어도 조용하다', () => {
    const win: FakeWin = {};
    new Function('window', QUIET_DIALOGS_SCRIPT)(win);
    expect(() => win.alert('x')).not.toThrow();
    expect(win.confirm('x')).toBe(false);
    expect(win.prompt('x')).toBeNull();
    win.__ytQuiet = 0;
    expect(() => win.alert('x')).not.toThrow();
    expect(win.confirm('x')).toBe(false);
  });

  it('setQuietScript: 보이면 0 을, 숨기면 1 을 넣는 한 줄', () => {
    expect(setQuietScript(false)).toBe('window.__ytQuiet=0;true;');
    expect(setQuietScript(true)).toBe('window.__ytQuiet=1;true;');
    const win: FakeWin = {};
    new Function('window', setQuietScript(false))(win);
    expect(win.__ytQuiet).toBe(0);
  });
});
