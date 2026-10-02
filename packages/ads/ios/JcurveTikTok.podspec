# @jcurve/ads 1.7 — 틱톡 비즈니스 SDK(공식 CocoaPods 판)를 JS 에 잇는다. 앱 안 로컬 모듈(TikTokBusiness)을 대신한다 —
# 이름이 달라서(JcurveTikTok) 옛 로컬 모듈이 남은 앱에서도 겹치지 않는다. 옮긴 앱은 로컬 모듈을 지운다.
require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'JcurveTikTok'
  s.version        = package['version']
  s.summary        = 'TikTok Business SDK bridge for @jcurve/ads'
  s.author         = 'jcurve'
  s.homepage       = 'https://github.com/jxamen/jcurve-packages'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.dependency 'TikTokBusinessSDK', '1.7.2'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
