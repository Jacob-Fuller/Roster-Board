import Foundation
import Capacitor
import SwiftUI
#if canImport(AlarmKit)
import AlarmKit
#endif

// Real alarms before shifts, using Apple's AlarmKit (iOS 26 and later).
// They ring like the Clock app, even on silent or in a Focus mode.
// The web app sends the full list of upcoming alarms each time the roster
// changes; this replaces every alarm Roster Board has set.
@objc(RBShiftAlarmPlugin)
public class RBShiftAlarmPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "RBShiftAlarmPlugin"
    public let jsName = "ShiftAlarm"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermission", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "setAlarms", returnType: CAPPluginReturnPromise)
    ]

    @objc func isAvailable(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            call.resolve(["available": true])
            return
        }
        #endif
        call.resolve(["available": false])
    }

    @objc func requestPermission(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            Task {
                do {
                    let state = try await AlarmManager.shared.requestAuthorization()
                    call.resolve(["granted": state == .authorized])
                } catch {
                    call.resolve(["granted": false])
                }
            }
            return
        }
        #endif
        call.resolve(["granted": false])
    }

    @objc func setAlarms(_ call: CAPPluginCall) {
        #if canImport(AlarmKit)
        if #available(iOS 26.0, *) {
            let items = call.getArray("alarms", JSObject.self) ?? []
            Task {
                let count = await ShiftAlarmScheduler.replaceAll(with: items)
                call.resolve(["scheduled": count])
            }
            return
        }
        #endif
        call.resolve(["scheduled": 0])
    }
}

#if canImport(AlarmKit)
@available(iOS 26.0, *)
struct ShiftAlarmData: AlarmMetadata {}

@available(iOS 26.0, *)
enum ShiftAlarmScheduler {
    static func replaceAll(with items: [JSObject]) async -> Int {
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
            guard let ms = (item["at"] as? NSNumber)?.doubleValue else { continue }
            let date = Date(timeIntervalSince1970: ms / 1000)
            if date <= now { continue }
            let title = (item["title"] as? String) ?? "Shift"

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
