/**
 * 공용 로그인이 **지켜야 하는 것들**.
 *
 * 두 갈래로 확인한다.
 *  - **동작** — 취소 판별, 자리표시자 키, 폴백 갈래, 다시 보내기
 *  - **소스 글자** — 네이티브를 초기화 전에 부르지 않는가. 네이티브 모듈은 테스트 환경에서
 *    못 불러오므로 동작으로는 막을 수 없는데, 이 규칙은 **어기면 안드로이드가 그 자리에서
 *    죽는** 종류라 무른 방식으로라도 지킨다.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { isCancel, PLACEHOLDER } from './auth';

describe('isCancel — 그만둔 것과 실패를 가른다', () => {
  /*
   | 그만둔 사람에게 오류창을 띄우면 앱이 고장 난 줄 안다. 그리고 퍼널에서 이탈이
   | **실패로 부풀어** 보여 고칠 것이 없는 자리를 들여다보게 된다.
   */
  it('취소를 알아본다', () => {
    for (const c of [
      'user_cancel', 'USER_CANCELLED', 'SIGN_IN_CANCELLED', 'ERR_REQUEST_CANCELED',
      '사용자가 취소했어요', '1001', '12501',
    ]) {
      expect(isCancel(c), c).toBe(true);
    }
  });

  /*
   | **카카오는 동의 화면 취소를 `AccessDenied` 로 준다.** 글자에 `cancel` 이 없어서
   | 빠뜨리기 쉽다 — 꿀꿀캐시가 2026-09-18 실기기에서 이것 때문에 **취소한 사람에게
   | 오류창**을 띄웠다. 그쪽이 제보해 주지 않았으면 이 패키지도 그대로 나갈 뻔했다.
   */
  it('카카오 AccessDenied 도 취소다', () => {
    for (const c of ['AccessDenied', 'access_denied', 'KakaoTalk AccessDenied']) {
      expect(isCancel(c), c).toBe(true);
    }
  });

  it('진짜 실패는 취소가 아니다', () => {
    for (const c of ['kakao_no_token', 'network', 'invalid_token', 'http_500', 'permission_denied']) {
      expect(isCancel(c), c).toBe(false);
    }
  });

  /*
   | 숫자는 **낱말 경계**로 본다. 안 그러면 `http_11001` 이나 `err_125010` 같은 엉뚱한 코드가
   | 취소로 읽혀, 진짜 실패가 조용히 묻힌다.
   */
  it('숫자가 다른 코드에 섞여 있으면 취소가 아니다', () => {
    for (const c of ['http_11001', 'err_125010', '100100']) {
      expect(isCancel(c), c).toBe(false);
    }
  });
});

describe('자리표시자 키는 안 채운 것으로 본다', () => {
  /* 눌러도 안 되는 버튼은 고장으로 보인다 — 아예 안 띄운다 */
  it('빈 값·예시 값을 걸러낸다', () => {
    for (const v of ['', '   ', '여기에_카카오_네이티브_키', 'YOUR_CLIENT_ID', 'xxxx']) {
      expect(PLACEHOLDER.test(v.trim()), v).toBe(true);
    }
  });

  it('진짜 키는 통과한다', () => {
    for (const v of ['a1b2c3d4e5f6', '1234567890-abc.apps.googleusercontent.com']) {
      expect(PLACEHOLDER.test(v), v).toBe(false);
    }
  });
});

/* ── 소스 글자로 지키는 것 ── */

const RAW = readFileSync(join(__dirname, 'auth.ts'), 'utf8');

/**
 * 주석을 **같은 길이의 공백으로** 지운다.
 *
 * 이 파일 주석에는 왜 그렇게 고쳤는지를 적으며 `login()` 같은 **예시 코드가 글로** 들어 있다.
 * 그걸 실제 호출로 세면 규칙이 엉뚱한 곳에서 깨진다. 길이를 유지하는 이유는
 * **자리(index)를 비교**하기 때문이다.
 */
const SRC = RAW
  .replace(/\/\*[\s\S]*?\*\//g, (m) => ' '.repeat(m.length))
  // 주소의 `https://` 를 줄 주석으로 보면 그 줄이 통째로 지워진다 — 앞이 `:` 면 넘어간다
  .replace(/(?<!:)\/\/.*/g, (m) => ' '.repeat(m.length));

/** 부르면 네이티브로 내려가는 것들 — 읽기만 하는 것(`?.login`)은 여기 안 걸린다 */
const NATIVE_CALL = /\.(isKakaoTalkLoginAvailable|login|logout|unlink|me)\s*\(/g;

describe('카카오 네이티브는 초기화 뒤에만 부른다', () => {
  /*
   | **초기화 전에 부르면 안드로이드가 그 자리에서 죽는다**(2026-09-18 꿀꿀캐시, 갤럭시 A32):
   |
   |   lateinit property hosts has not been initialized
   |     at RNCKakaoUserModule.isKakaoTalkLoginAvailable$lambda$9
   |
   | 네이티브가 **메인 스레드에서** 던지므로 자바스크립트 `try/catch` 로는 안 잡힌다.
   | R8 과 무관하고 debug 빌드도 같다. iOS 는 버텨서 **안드로이드에서만** 드러난다.
   */
  it('네이티브를 만지는 길이 kakaoApi() 하나다', () => {
    // `kakaoUser()` 를 직접 집는 곳은 정의 한 번 + `kakaoApi` 안 한 번 + 버튼 목록의 필드 읽기 한 번
    const grabs = [...SRC.matchAll(/kakaoUser\(\)/g)];
    expect(grabs.length, '직접 집는 곳이 늘었다 — kakaoApi() 를 거치게 하라').toBeLessThanOrEqual(3);
  });

  it('네이티브를 부르는 줄은 모두 initKakao() 뒤에 있다', () => {
    const init = SRC.indexOf('initKakao();');
    expect(init, 'initKakao() 를 부르는 곳이 있어야 한다').toBeGreaterThan(-1);

    const calls = [...SRC.matchAll(NATIVE_CALL)];
    expect(calls.length, '네이티브를 부르는 줄이 하나는 있어야 한다').toBeGreaterThan(0);
    for (const m of calls) {
      expect(m.index, '초기화보다 앞에서 부른다: ' + m[0]).toBeGreaterThan(init);
    }
  });

  /*
   | `availableProviders` 는 로그인 화면이 버튼을 그리려고 **화면이 뜨는 순간** 부른다.
   | 여기서 네이티브를 건드리면 로그인 화면에서 바로 죽는다.
   | 모듈 객체의 필드를 읽는 것(`kakaoUser()?.login`)은 네이티브로 안 내려간다 — 그것만 한다.
   */
  it('버튼 목록을 만들 때는 네이티브를 부르지 않는다', () => {
    const at = SRC.indexOf('function availableProviders');
    expect(at).toBeGreaterThan(-1);
    const body = SRC.slice(at, SRC.indexOf('\n  }', at));

    expect(body.match(NATIVE_CALL), body).toBe(null);
  });
});

describe('구글 취소는 오류가 아니다', () => {
  it('취소를 가려내고, 그 말이 취소 판별에 걸린다', () => {
    expect(RAW).toContain("if (r?.type === 'cancelled') throw new Error('user_cancel');");
    expect(isCancel('user_cancel')).toBe(true);
  });

  /* 계정을 바꿀 수 없게 되는 자리 — 로그인 뒤 반드시 끊는다(함정 E-3) */
  it('로그인 뒤 구글 세션을 끊는다', () => {
    expect(SRC).toContain('GoogleSignin.signOut()');
  });
});

describe('카카오 폴백은 사유를 남긴다', () => {
  /*
   | `login()` 한 줄이면 조용히 웹으로 떨어져 **사유가 아무 데도 안 남는다.**
   | 카카오 가입이 0 명이어도 왜인지 알 수 없다 — 꼬꼬농장이 실제로 그랬다.
   */
  it('갈래마다 다른 사유를 남긴다', () => {
    for (const why of ['no_sdk', 'cannot_tell', 'no_talk', 'server_reject']) {
      expect(SRC, why).toContain("why: '" + why + "'");
    }
    expect(SRC).toContain("why: 'sdk_'");
  });

  /* 그만둔 사람에게 웹 창을 또 띄우면 놀란다 */
  it('사용자가 그만두면 웹으로 떨어지지 않는다', () => {
    expect(SRC).toContain('if (isCancel(code)) throw e;');
  });
});
