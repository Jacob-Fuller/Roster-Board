Pod::Spec.new do |s|
  s.name = 'RbShiftAlarm'
  s.version = '1.0.0'
  s.summary = 'Roster Board shift alarms (AlarmKit, iOS 26+).'
  s.license = 'Proprietary'
  s.homepage = 'https://www.rosterboard.net'
  s.author = 'Roster Board'
  s.source = { :git => 'https://github.com/Jacob-Fuller/Roster-Board.git', :tag => s.version.to_s }
  s.source_files = 'ios/Sources/**/*.swift'
  s.ios.deployment_target = '16.0'
  s.weak_frameworks = 'AlarmKit'
  s.dependency 'Capacitor'
  s.swift_version = '5.9'
end
