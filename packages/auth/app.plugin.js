/**
 * @jcurve/auth 설정 플러그인(2.9) — app.json plugins 에 "@jcurve/auth" 한 줄(네이버 SDK 를 안 쓰면 ["@jcurve/auth", { "naver": false }]).
 *
 * withNaverReturn: 네이버 앱 로그인에서 돌아오는 주소를 **스킴과 상관없이** 네이버 SDK 로 넘긴다.
 * 네이버 앱은 Info.plist 의 첫 스킴으로 돌아와(팩트투자 대표님 아이폰 10-03) @react-native-seoul/naver-login 플러그인의
 * 「지정 스킴만」 처리기를 지나쳐 expo-router 「Unmatched Route」가 됐다. AppDelegate 의 open url 맨 앞에
 * host == "thirdPartyLoginResult"(네이버 앱) 또는 네이버 스킴(앱 안 웹 로그인 — 옵션 naverUrlScheme 또는 app.json extra.naverUrlScheme) 처리를 넣는다.
 * 앱총괄 plugins/withNaverReturn.js(팩트투자 7e94fd7 · 괜찮아 8023032)를 옮긴 것.
 */
const MARK = 'url.host == "thirdPartyLoginResult"';

/** 순수 함수(시험 가능) — 이미 들어 있으면 그대로 */
function patchNaverReturn(src, scheme) {
  if (src.includes(MARK)) return src;
  let out = src.includes('import NaverThirdPartyLogin') ? src : src.replace('import Expo', 'import Expo\nimport NaverThirdPartyLogin');
  out = out.replace(/(open url: URL,[\s\S]*?\)\s*->\s*Bool\s*\{)/, `$1\n    if ${MARK}${scheme ? ` || url.scheme == "${scheme}"` : ''} {\n      return NaverThirdPartyLoginConnection.getSharedInstance().application(app, open: url, options: options)\n    }`);
  if (!out.includes(MARK)) throw new Error('@jcurve/auth withNaverReturn: AppDelegate.swift 에서 open url 함수를 못 찾음');
  return out;
}

function withJcurveAuth(config, props = {}) {
  if (props && props.naver === false) return config;
  // expo 는 앱이 가진 것을 쓴다(패키지는 의존하지 않는다)
  const { withAppDelegate } = require('expo/config-plugins');
  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('@jcurve/auth withNaverReturn: Swift AppDelegate 만 지원');
    c.modResults.contents = patchNaverReturn(c.modResults.contents, (props && props.naverUrlScheme) || (c.extra && c.extra.naverUrlScheme));
    return c;
  });
}

module.exports = withJcurveAuth;
module.exports.patchNaverReturn = patchNaverReturn;
