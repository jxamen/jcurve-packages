import { describe, expect, it } from 'vitest';
import * as phone from './index';
describe('phone display helpers', () => {
  it('formats and validates numbers without any authentication adapter', () => {
    expect(phone.format('01012345678')).toBe('010-1234-5678');
    expect(phone.digits('010-1234-5678')).toBe('01012345678');
    expect(phone.looksValid('01012345678')).toBe(true);
    expect(phone.looksValid('123')).toBe(false);
    expect(Object.keys(phone).sort()).toEqual(['digits', 'format', 'looksValid']);
  });
});
