# @jcurve/overlay — iOS 엔 「다른 앱 위에 표시」가 없어 모듈은 빈 동작(hasPermission false). 자동 연결을 위해 podspec 만 둔다.
require 'json'
package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'JcurveOverlay'
  s.version        = package['version']
  s.summary        = 'Overlay (display over other apps) bridge for @jcurve/overlay — no-op on iOS'
  s.author         = 'jcurve'
  s.homepage       = 'https://github.com/jxamen/jcurve-packages'
  s.license        = 'UNLICENSED'
  s.platforms      = { :ios => '15.1' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
  s.source_files = '**/*.{h,m,swift}'
end
