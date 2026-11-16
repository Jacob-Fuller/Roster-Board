import ExpoModulesCore
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
#endif

// Real alarms before shifts, using Apple's AlarmKit (iOS 26 and later).
// They ring like the Clock app, even on silent or in a Focus mode.
// The app sends the full list of upcoming alarms each time the roster changes;
// this replaces every alarm Roster Board has set.
struct ShiftAlarmItem: Record {
  @Field var at: Double = 0
  @Field var title: String = "Shift"
}

public class ShiftAlarmModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ShiftAlarm")

    AsyncFunction("isAvailable") { () -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) { return true }
      #endif
      return false
    }

    AsyncFunction("requestPermission") { () async -> Bool in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        do {
          let state = try await AlarmManager.shared.requestAuthorization()
          return state == .authorized
        } catch {
          return false
        }
      }
      #endif
      return false
    }

    AsyncFunction("setAlarms") { (alarms: [ShiftAlarmItem]) async -> Int in
      #if canImport(AlarmKit)
      if #available(iOS 26.0, *) {
        return await ShiftAlarmScheduler.replaceAll(with: alarms)
      }
      #endif
      return 0
    }
  }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct ShiftAlarmData: AlarmMetadata {}

@available(iOS 26.0, *)
enum ShiftAlarmScheduler {
  static func replaceAll(with items: [ShiftAlarmItem]) async -> Int {
    let manager = AlarmManager.shared

    // Clear everything this app has set, then add the new list.
    if let existing = try? manager.alarms {
      for alarm in existing {
        try? manager.cancel(id: alarm.id)
      }
    }
    if items.isEmpty { return 0 }
    if manager.authorizationState != .authorized { return 0 }

    let now = Date()
    var scheduled = 0
    for item in items {
      let date = Date(timeIntervalSince1970: item.at / 1000)
      if date <= now { continue }
      let title = item.title.isEmpty ? "Shift" : item.title

      let stop = AlarmButton(text: "Stop", textColor: .white, systemImageName: "stop.circle")
      let alert = AlarmPresentation.Alert(title: LocalizedStringResource(stringLiteral: title), stopButton: stop)
      let attributes = AlarmAttributes<ShiftAlarmData>(
        presentation: AlarmPresentation(alert: alert),
        tintColor: Color(red: 0.06, green: 0.13, blue: 0.27)
      )
      let config = AlarmManager.AlarmConfiguration<ShiftAlarmData>(
        schedule: .fixed(date),
        attributes: attributes
      )
      do {
        _ = try await manager.schedule(id: UUID(), configuration: config)
        scheduled += 1
      } catch {
        continue
      }
    }
    return scheduled
  }
}
#endif
