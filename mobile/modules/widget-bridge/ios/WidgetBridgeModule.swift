import ExpoModulesCore
import Security
#if canImport(WidgetKit)
import WidgetKit
#endif

// Saves the widget's data where the widget can read it (a keychain group shared
// by the app and the widget), then asks iOS to redraw the widget.
public class WidgetBridgeModule: Module {
  public func definition() -> ModuleDefinition {
    Name("WidgetBridge")

    AsyncFunction("setData") { (json: String) -> Bool in
      guard let group = Bundle.main.object(forInfoDictionaryKey: "RBKeychainGroup") as? String,
            let data = json.data(using: .utf8) else { return false }
      let base: [String: Any] = [
        kSecClass as String: kSecClassGenericPassword,
        kSecAttrService as String: "net.rosterboard.widget",
        kSecAttrAccount as String: "data",
        kSecAttrAccessGroup as String: group,
      ]
      let attrs: [String: Any] = [
        kSecValueData as String: data,
        kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
      ]
      var status = SecItemUpdate(base as CFDictionary, attrs as CFDictionary)
      if status == errSecItemNotFound {
        var add = base; attrs.forEach { add[$0.key] = $0.value }
        status = SecItemAdd(add as CFDictionary, nil)
      }
      #if canImport(WidgetKit)
      if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
      #endif
      return status == errSecSuccess
    }
  }
}
