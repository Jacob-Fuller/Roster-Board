Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = '1.0.0'
  s.summary        = 'Tempus Board home screen widget data'
  s.author         = 'Tempus Board'
  s.homepage       = 'https://www.rosterboard.net'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  s.weak_frameworks = 'WidgetKit'
  s.source_files   = '**/*.swift'
end
