require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'JCurveBuzzvil'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/jxamen/jcurve-packages'
  s.license = { :type => 'UNLICENSED' }
  s.author = 'JCurve'
  s.platforms = { :ios => '15.1' }
  s.source = { :git => 'https://github.com/jxamen/jcurve-packages.git', :tag => s.version }
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.dependency 'React-Core'
  s.dependency 'BuzzvilSDK', '6.8.0'
end
