const { withProjectBuildGradle, withInfoPlist } = require('expo/config-plugins');
const repos = ['https://dl.buzzvil.com/public/maven', 'https://devrepo.kakao.com/nexus/content/groups/public/', 'https://cauly.github.io/cauly-sdk-android-maven/maven-repo', 'https://artifact.bytedance.com/repository/pangle'];
module.exports = function withBuzzvil(config) {
  config = withInfoPlist(config, mod => {
    mod.modResults.NSUserTrackingUsageDescription ||= '맞춤형 광고와 참여 보상 확인을 위해 광고 식별자를 사용합니다.';
    return mod;
  });
  return withProjectBuildGradle(config, mod => {
    if (mod.modResults.language !== 'groovy') throw new Error('Buzzvil plugin requires Groovy project build.gradle');
    if (!mod.modResults.contents.includes('// @jcurve/offerwall-buzzvil')) {
      mod.modResults.contents += '\n// @jcurve/offerwall-buzzvil\nallprojects { repositories {\n' + repos.map(url => `  maven { url "${url}" }`).join('\n') + '\n} }\n';
    }
    return mod;
  });
};
