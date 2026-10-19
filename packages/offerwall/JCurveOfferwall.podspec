require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))
Pod::Spec.new do |s|
  s.name = 'JCurveOfferwall'
  s.version = package['version']
  s.summary = package['description']
  s.homepage = 'https://github.com/jxamen/jcurve-packages'
  s.license = 'UNLICENSED'
  s.author = 'JCurve'
  s.source = { :git => 'https://github.com/jxamen/jcurve-packages.git' }
  s.platform = :ios, '15.1'
  s.source_files = 'ios/**/*.{h,m,mm}'
  s.dependency 'React-Core'
  s.dependency 'AdPopcornOfferwall', '5.2.3'
end
