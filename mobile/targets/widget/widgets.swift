import WidgetKit
import SwiftUI
import Security

// ---------- data shared by the app (keychain, group net.rosterboard.shared) ----------
struct WShift: Codable { let d: String; let name: String; let start: String?; let end: String?; let color: String; let ink: String; let tag: String? }
struct WPay: Codable { let label: String; let gross: String; let net: String? }
struct WData: Codable { let shifts: [WShift]; let pay: WPay? }

enum SharedStore {
  static func load() -> WData? {
    guard let group = Bundle.main.object(forInfoDictionaryKey: "RBKeychainGroup") as? String else { return nil }
    let q: [String: Any] = [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "net.rosterboard.widget",
      kSecAttrAccount as String: "data",
      kSecAttrAccessGroup as String: group,
      kSecReturnData as String: true,
      kSecMatchLimit as String: kSecMatchLimitOne,
    ]
    var out: AnyObject?
    guard SecItemCopyMatching(q as CFDictionary, &out) == errSecSuccess, let data = out as? Data else { return nil }
    return try? JSONDecoder().decode(WData.self, from: data)
  }
}

// ---------- timeline ----------
struct ShiftAt { let s: WShift; let start: Date; let end: Date }
struct RBEntry: TimelineEntry { let date: Date; let upcoming: [ShiftAt]; let pay: WPay?; let empty: Bool }

func parse(_ s: WShift) -> ShiftAt? {
  let f = DateFormatter(); f.calendar = Calendar.current; f.timeZone = .current; f.dateFormat = "yyyy-MM-dd"
  guard let day = f.date(from: s.d) else { return nil }
  func at(_ hhmm: String?) -> Date? {
    guard let hhmm, hhmm.count >= 4 else { return nil }
    let p = hhmm.split(separator: ":").compactMap { Int($0) }
    guard p.count == 2 else { return nil }
    return Calendar.current.date(bySettingHour: p[0], minute: p[1], second: 0, of: day)
  }
  if let st = at(s.start), var en = at(s.end) {
    if en <= st { en = Calendar.current.date(byAdding: .day, value: 1, to: en)! }
    return ShiftAt(s: s, start: st, end: en)
  }
  return ShiftAt(s: s, start: day, end: Calendar.current.date(byAdding: .day, value: 1, to: day)!)
}

struct Provider: TimelineProvider {
  func entry(at now: Date, _ data: WData?) -> RBEntry {
    let all = (data?.shifts ?? []).compactMap(parse).sorted { $0.start < $1.start }
    return RBEntry(date: now, upcoming: all.filter { $0.end > now }, pay: data?.pay, empty: data == nil)
  }
  func placeholder(in context: Context) -> RBEntry {
    let s = WShift(d: "2026-10-20", name: "Day shift", start: "07:00", end: "17:00", color: "#E8B339", ink: "#241900", tag: nil)
    return RBEntry(date: Date(), upcoming: [parse(s)].compactMap { $0 }, pay: WPay(label: "12 – 25 Oct", gross: "$2,840", net: nil), empty: false)
  }
  func getSnapshot(in context: Context, completion: @escaping (RBEntry) -> Void) {
    completion(context.isPreview ? placeholder(in: context) : entry(at: Date(), SharedStore.load()))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<RBEntry>) -> Void) {
    let data = SharedStore.load()
    let now = Date()
    // a new entry each time a shift finishes, so "next shift" moves on by itself
    var dates = [now]
    for x in (data?.shifts ?? []).compactMap(parse) where x.end > now && dates.count < 12 { dates.append(x.end) }
    let midnight = Calendar.current.startOfDay(for: Calendar.current.date(byAdding: .day, value: 1, to: now)!)
    dates.append(midnight)
    let entries = Array(Set(dates)).sorted().map { entry(at: $0, data) }
    completion(Timeline(entries: entries, policy: .after(Calendar.current.date(byAdding: .hour, value: 6, to: now)!)))
  }
}

// ---------- look ----------
extension Color {
  init(hex: String) {
    var h = hex.trimmingCharacters(in: .whitespaces).replacingOccurrences(of: "#", with: "")
    if h.count == 3 { h = h.map { "\($0)\($0)" }.joined() }
    let v = UInt64(h.prefix(6), radix: 16) ?? 0x888888
    self.init(red: Double((v >> 16) & 255) / 255, green: Double((v >> 8) & 255) / 255, blue: Double(v & 255) / 255)
  }
}
let navyTop = Color(hex: "#1E3D69"), navyBottom = Color(hex: "#0D1D36"), brass = Color(hex: "#E7A75C")
let dim = Color.white.opacity(0.68)

func dayLabel(_ d: Date, now: Date) -> String {
  let cal = Calendar.current
  if cal.isDate(d, inSameDayAs: now) { return "Today" }
  if let t = cal.date(byAdding: .day, value: 1, to: now), cal.isDate(d, inSameDayAs: t) { return "Tomorrow" }
  let f = DateFormatter(); f.dateFormat = "EEE d MMM"
  return f.string(from: d)
}
func timeLabel(_ x: ShiftAt) -> String {
  if let s = x.s.start, let e = x.s.end { return s + " – " + e }
  return "All day"
}

struct ShiftChip: View {
  let x: ShiftAt
  var big = false
  var body: some View {
    HStack(spacing: 6) {
      Text(x.s.name).font(.system(size: big ? 17 : 13, weight: .bold)).lineLimit(1).minimumScaleFactor(0.7)
      if let tag = x.s.tag { Text(tag).font(.system(size: big ? 11 : 9, weight: .heavy)).opacity(0.85).lineLimit(1) }
    }
    .foregroundColor(Color(hex: x.s.ink))
    .padding(.horizontal, big ? 10 : 8).padding(.vertical, big ? 7 : 4)
    .frame(maxWidth: big ? .infinity : nil, alignment: .leading)
    .background(RoundedRectangle(cornerRadius: big ? 10 : 7).fill(Color(hex: x.s.color)))
  }
}

struct NextShift: View {
  let entry: RBEntry
  var body: some View {
    VStack(alignment: .leading, spacing: 6) {
      Text("Next shift").font(.system(size: 12, weight: .semibold)).foregroundColor(dim)
      if let x = entry.upcoming.first {
        Text(dayLabel(x.start, now: entry.date)).font(.system(size: 20, weight: .bold, design: .serif)).foregroundColor(.white).lineLimit(1).minimumScaleFactor(0.7)
        ShiftChip(x: x, big: true)
        Text(timeLabel(x)).font(.system(size: 13, weight: .semibold)).foregroundColor(dim)
      } else {
        Text(entry.empty ? "Open Tempus Board" : "No shifts coming up").font(.system(size: 15, weight: .semibold)).foregroundColor(.white)
      }
      Spacer(minLength: 0)
    }
  }
}

struct RosterWidgetView: View {
  @Environment(\.widgetFamily) var family
  let entry: RBEntry
  var body: some View {
    Group {
      if family == .systemSmall {
        NextShift(entry: entry)
      } else {
        HStack(alignment: .top, spacing: 14) {
          NextShift(entry: entry).frame(maxWidth: .infinity, alignment: .leading)
          VStack(alignment: .leading, spacing: 7) {
            Text("Coming up").font(.system(size: 12, weight: .semibold)).foregroundColor(dim)
            ForEach(Array(entry.upcoming.dropFirst().prefix(3).enumerated()), id: \.offset) { _, x in
              HStack(spacing: 6) {
                Text(dayLabel(x.start, now: entry.date)).font(.system(size: 12, weight: .semibold)).foregroundColor(.white).frame(width: 66, alignment: .leading).lineLimit(1).minimumScaleFactor(0.7)
                ShiftChip(x: x)
              }
            }
            Spacer(minLength: 0)
            if let p = entry.pay {
              VStack(alignment: .leading, spacing: 1) {
                Text(p.label).font(.system(size: 11, weight: .semibold)).foregroundColor(dim)
                Text(p.gross).font(.system(size: 17, weight: .bold, design: .serif)).foregroundColor(brass)
              }
            }
          }.frame(maxWidth: .infinity, alignment: .leading)
        }
      }
    }
    .containerBackground(for: .widget) {
      ZStack {
        LinearGradient(colors: [navyTop, navyBottom], startPoint: .topLeading, endPoint: .bottomTrailing)
        LinearGradient(colors: [brass.opacity(0), brass.opacity(0.22)], startPoint: UnitPoint(x: 0.6, y: 0.5), endPoint: .bottomTrailing)
      }
    }
  }
}

struct RosterBoardWidget: Widget {
  let kind = "RosterBoardWidget"
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: kind, provider: Provider()) { entry in RosterWidgetView(entry: entry) }
      .configurationDisplayName("Next shift")
      .description("Your next shift, what's coming up and this pay period's estimate.")
      .supportedFamilies([.systemSmall, .systemMedium])
  }
}

@main
struct RosterBoardWidgets: WidgetBundle {
  var body: some Widget { RosterBoardWidget() }
}
