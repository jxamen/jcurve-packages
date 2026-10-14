import { describe, expect, it } from 'vitest';
import { isBlocked, isWebUrl, resolveTarget, schemeOf } from './policy';

describe('policy', () => {
  it('막는 스킴 6개와 우회 시도', () => {
    for (const u of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'content://x', 'about:blank', 'blob:https://a/b', ' JavaScript:alert(1)', 'java\tscript:alert(1)', '']) expect(isBlocked(u), u).toBe(true);
    expect(isBlocked(undefined)).toBe(true);
    expect(isBlocked('/relative/path')).toBe(true);
  });
  it('앱 스킴 · https · intent 는 열 수 있다', () => {
    for (const u of ['https://a.com', 'http://a.com', 'naversearchapp://search?q=1', 'coupang://home', 'intent://x#Intent;scheme=a;end', 'market://details?id=a']) expect(isBlocked(u), u).toBe(false);
  });
  it('schemeOf / isWebUrl', () => {
    expect(schemeOf('HTTPS://a')).toBe('https');
    expect(schemeOf('nope')).toBeNull();
    expect(isWebUrl('https://a')).toBe(true);
    expect(isWebUrl('coupang://a')).toBe(false);
  });
  it('intent:// 를 앱 스킴으로 바꾸고 browser_fallback_url 을 폴백으로', () => {
    const r = resolveTarget('intent://search?q=a#Intent;scheme=naversearchapp;package=com.nhn.android.search;S.browser_fallback_url=https%3A%2F%2Fplay.google.com%2Fstore%2Fapps%2Fdetails%3Fid%3Dcom.nhn.android.search;end');
    expect(r).toEqual({ url: 'naversearchapp://search?q=a', fallbackUrl: 'https://play.google.com/store/apps/details?id=com.nhn.android.search' });
  });
  it('intent 인데 scheme 이 없으면 폴백만, 둘 다 없으면 null', () => {
    expect(resolveTarget('intent://x#Intent;S.browser_fallback_url=https%3A%2F%2Fa.com;end')).toEqual({ url: 'https://a.com' });
    expect(resolveTarget('intent://x#Intent;end')).toBeNull();
  });
  it('intent 의 scheme 으로 막힌 스킴을 끼워 넣어도 거절', () => {
    expect(resolveTarget('intent://x#Intent;scheme=javascript;end')).toBeNull();
    expect(resolveTarget('intent://x#Intent;scheme=file;end')).toBeNull();
  });
  it('market:// 은 플레이스토어 https 로', () => {
    expect(resolveTarget('market://details?id=a.b')).toEqual({ url: 'https://play.google.com/store/apps/details?id=a.b' });
  });
  it('폴백이 막힌 스킴이면 버린다', () => {
    expect(resolveTarget('coupang://a', 'javascript:alert(1)')).toEqual({ url: 'coupang://a' });
    expect(resolveTarget('javascript:1', 'https://a.com')).toBeNull();
  });
  it('폴백에 중첩 intent / 막힌 스킴을 넣어도 열지 않는다', () => {
    expect(resolveTarget('coupang://a', 'intent://x#Intent;scheme=javascript;end')).toEqual({ url: 'coupang://a' });
    expect(resolveTarget('coupang://a', 'javascript:alert(1)')).toEqual({ url: 'coupang://a' });
    // intent 의 browser_fallback_url 이 다시 intent 이거나 막힌 스킴이면 버린다
    expect(resolveTarget('intent://x#Intent;scheme=coupang;S.browser_fallback_url=intent%3A%2F%2Fy%23Intent%3Bscheme%3Djavascript%3Bend;end')).toEqual({ url: 'coupang://x' });
    expect(resolveTarget('intent://x#Intent;scheme=coupang;S.browser_fallback_url=javascript%3Aalert(1);end')).toEqual({ url: 'coupang://x' });
    // 주 주소가 막혀 폴백만 남는 경우에도 폴백이 intent 면 null
    expect(resolveTarget('intent://x#Intent;S.browser_fallback_url=intent%3A%2F%2Fy;end')).toBeNull();
    expect(resolveTarget('intent://x#Intent;scheme=intent;end')).toBeNull();
  });
  it('market 폴백은 플레이스토어 https 로', () => {
    expect(resolveTarget('coupang://a', 'market://details?id=a.b')).toEqual({ url: 'coupang://a', fallbackUrl: 'https://play.google.com/store/apps/details?id=a.b' });
  });
});
