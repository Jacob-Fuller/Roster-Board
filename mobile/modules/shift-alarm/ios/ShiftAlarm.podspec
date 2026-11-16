Pod::Spec.new do |s|
  s.name           = 'ShiftAlarm'
  s.version        = '1.0.0'
  s.summary        = 'Roster Board shift alarms (AlarmKit)'
  s.author         = 'Roster Board'
  s.homepage       = 'https://www.rosterboard.net'
  s.license        = { :type => 'Proprietary' }
  s.platforms      = { :ios => '15.1' }
  s.source         = { :git => '' }
  s.static_framework = true
  s.swift_version  = '5.9'
  s.dependency 'ExpoModulesCore'
  # AlarmKit only exists on iOS 26+, so link it weakly to keep older iPhones working.
  s.weak_frameworks = 'AlarmKit'
  s.source_files   = '**/*.swift'
end
