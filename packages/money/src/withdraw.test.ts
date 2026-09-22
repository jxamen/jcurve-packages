/**
 * 현금 인출 금액 검증.
 *
 * 여기서 고정하는 것은 "얼마가 나갈 수 있는가"다 — 이게 흔들리면 사용자 돈이 흔들린다.
 * 서버가 한 번 더 막지만, 앱이 먼저 막아야 사람이 고칠 수 있다.
 */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_CASH, accountLooksOk, amountChoices, cashFormReady, checkCash, cleanAccount, cleanName,
  cleanPhone, phoneLooksOk, sayCashProblem,
} from './withdraw';

const BAL = 100000;

describe('checkCash — 나갈 수 있는 금액인가', () => {
  it('1,000원 단위면 통과한다', () => {
    expect(checkCash('1000', BAL)).toEqual({ ok: true, amount: 1000 });
    expect(checkCash('50000', BAL)).toEqual({ ok: true, amount: 50000 });
    expect(checkCash('23000', BAL)).toEqual({ ok: true, amount: 23000 });
  });

  it('쉼표·공백·「원」이 섞여도 읽는다 — 사람은 그렇게 적는다', () => {
    expect(checkCash('10,000', BAL)).toEqual({ ok: true, amount: 10000 });
    expect(checkCash(' 5000 원 ', BAL)).toEqual({ ok: true, amount: 5000 });
  });

  it('1,000원 단위가 아니면 막는다', () => {
    expect(checkCash('1500', BAL)).toEqual({ ok: false, problem: 'unit' });
    expect(checkCash('999', BAL)).toEqual({ ok: false, problem: 'unit' });
  });

  it('5만 원을 넘으면 막는다', () => {
    expect(checkCash('51000', BAL)).toEqual({ ok: false, problem: 'max' });
    expect(checkCash('100000', BAL)).toEqual({ ok: false, problem: 'max' });
  });

  it('가진 포인트보다 많으면 막는다', () => {
    expect(checkCash('5000', 3000)).toEqual({ ok: false, problem: 'balance' });
    expect(checkCash('3000', 3000)).toEqual({ ok: true, amount: 3000 });
  });

  it('단위를 먼저 말한다 — 한도부터 말하면 줄였다가 또 걸린다', () => {
    // 50,500 은 단위도 틀리고 한도도 넘는다
    expect(checkCash('50500', BAL)).toEqual({ ok: false, problem: 'unit' });
  });

  it('안 적었거나 숫자가 아니면 막는다', () => {
    expect(checkCash('', BAL)).toEqual({ ok: false, problem: 'empty' });
    expect(checkCash('만원', BAL)).toEqual({ ok: false, problem: 'not_number' });
    expect(checkCash('-1000', BAL)).toEqual({ ok: false, problem: 'not_number' });
  });

  it('0 은 최소 금액에 걸린다 — 단위로는 통과해 버린다', () => {
    expect(checkCash('0', BAL)).toEqual({ ok: false, problem: 'min' });
  });

  it('어드민이 규칙을 바꾸면 그대로 따른다', () => {
    const r = { min: 5000, max: 30000, unit: 5000 };
    expect(checkCash('5000', BAL, r)).toEqual({ ok: true, amount: 5000 });
    expect(checkCash('1000', BAL, r)).toEqual({ ok: false, problem: 'unit' });
    expect(checkCash('35000', BAL, r)).toEqual({ ok: false, problem: 'max' });
  });
});

describe('sayCashProblem — 사유마다 다르게 말한다', () => {
  it('규칙의 숫자를 그대로 읽어 준다', () => {
    expect(sayCashProblem('unit')).toContain('1,000원');
    expect(sayCashProblem('max')).toContain('50,000원');
    expect(sayCashProblem('min')).toContain('1,000원');
    expect(sayCashProblem('max', { min: 1000, max: 30000, unit: 1000 })).toContain('30,000원');
  });

  it('모든 사유에 문구가 있다 — 빈 말풍선이 뜨면 안 된다', () => {
    const all = ['empty', 'not_number', 'unit', 'min', 'max', 'balance'] as const;
    for (const p of all) expect(sayCashProblem(p).length).toBeGreaterThan(0);
  });

  it('(1.0.1) 금액을 안 골랐을 때 — 버튼으로 고르는 화면이라 「골라」', () => {
    expect(sayCashProblem('empty')).toBe('받을 금액을 골라 주세요');
  });
});

describe('계좌·이름·번호', () => {
  it('계좌번호는 숫자와 하이픈만 남는다', () => {
    expect(cleanAccount('110-234 567-89 abc')).toBe('110-234567-89');
  });

  it('숫자 10자리는 넘어야 계좌로 본다', () => {
    expect(accountLooksOk('1102345678')).toBe(true);
    expect(accountLooksOk('110-234-5678')).toBe(true);
    expect(accountLooksOk('123456789')).toBe(false);
  });

  it('이름은 앞뒤 공백만 걷어낸다', () => {
    expect(cleanName('  김당근  ')).toBe('김당근');
  });

  it('휴대폰은 숫자만 11자리까지', () => {
    expect(cleanPhone('010-1234-5678')).toBe('01012345678');
    expect(phoneLooksOk('010-1234-5678')).toBe(true);
    expect(phoneLooksOk('02-123-4567')).toBe(false);
    expect(phoneLooksOk('0101234')).toBe(false);
  });
});

describe('cashFormReady — 버튼을 켤지', () => {
  const ok = { name: '김당근', bank: '국민', account: '110-234-5678', amount: '10000' };

  it('다 차면 켜진다', () => {
    expect(cashFormReady(ok, BAL)).toBe(true);
  });

  it('하나라도 비면 꺼진다', () => {
    expect(cashFormReady({ ...ok, name: '김' }, BAL)).toBe(false);
    expect(cashFormReady({ ...ok, bank: '' }, BAL)).toBe(false);
    expect(cashFormReady({ ...ok, account: '123' }, BAL)).toBe(false);
    expect(cashFormReady({ ...ok, amount: '1500' }, BAL)).toBe(false);
  });

  it('잔액이 모자라면 꺼진다', () => {
    expect(cashFormReady(ok, 5000)).toBe(false);
  });
});

describe('기본 규칙', () => {
  it('1,000원 단위 · 최소 1,000원 · 최대 50,000원(지시)', () => {
    expect(DEFAULT_CASH).toEqual({ min: 1000, max: 50000, unit: 1000 });
  });
});

describe('고를 수 있는 금액 — 가진 포인트 안에서만', () => {
  it('포인트가 최소 금액에 못 미치면 고를 것이 없다', () => {
    // 화면에 찍힌 74P — 숫자판을 열어 줄 이유가 없다
    expect(amountChoices(74)).toEqual([]);
    expect(amountChoices(999)).toEqual([]);
  });

  it('가진 만큼만, 단위로 내려서 준다', () => {
    expect(amountChoices(3500)).toEqual([1000, 2000, 3000]);
    expect(amountChoices(1000)).toEqual([1000]);
  });

  it('많이 가졌어도 한 번 한도까지만', () => {
    const all = amountChoices(1000000);
    expect(all[0]).toBe(1000);
    expect(all[all.length - 1]).toBe(50000);
    expect(all).toHaveLength(50);
  });

  it('목록에 있는 금액은 전부 통과한다 — 고른 것이 걸리면 안 된다', () => {
    for (const v of amountChoices(12345)) {
      expect(checkCash(String(v), 12345).ok).toBe(true);
    }
  });

  it('어드민이 단위를 바꾸면 목록도 바뀐다', () => {
    const r = { min: 5000, max: 20000, unit: 5000 };
    expect(amountChoices(17000, r)).toEqual([5000, 10000, 15000]);
  });
});
