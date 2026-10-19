import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  EVENT_CATS, LEAVE_KINDS, LEAVE_STRIP, WEEKDAYS_SHORT, birthdaysOnDate, buildMonthCells, entryColor, entryName, isCombo, isSameDay, isSplitEntry, ymd,
  type Birthday, type Buckets, type EventEntry, type LeaveEntry, type Rec, type ShiftEntry, type ShiftType,
} from "../lib/model";
import { payConfig, payIsSetUp, payPeriodIsAlt } from "../lib/pay";
import { BannerBorder } from "./BannerBorder";
import { useTheme } from "./ui";

export type GridData = {
  shifts: Buckets<ShiftEntry>; leave: Buckets<LeaveEntry>; notes?: Buckets<EventEntry>; birthdays?: Birthday[];
  swaps?: Buckets<Rec>; payTags?: Buckets<Rec>; settings?: any;
};

// Month calendar used for your own roster and, read-only, for a shared one.
export function MonthGrid({ month, data, typesById, onDayPress, selected }: {
  month: Date; data: GridData; typesById: { [id: string]: ShiftType }; onDayPress?: (dateKey: string) => void;
  selected?: { [dateKey: string]: unknown };
}) {
  const t = useTheme();
  const [gridW, setGridW] = useState(0);
  const [gridH, setGridH] = useState(0);
  // widths of the sample words at size 100, measured on this phone's font
  const [w100, setW100] = useState<{ [k in keyof typeof SAMPLES]?: number }>({});
  const ts = useMemo(() => bannerSizes(gridW, w100), [gridW, w100]);
  const cells = useMemo(() => buildMonthCells(month, { nextWeek: true }), [month]);
  // alternate pay periods are shaded, like the web app (only once pay is set up)
  const shade = useMemo(() => (data.settings && payIsSetUp(data.settings) ? payConfig(data.settings) : null), [data.settings]);
  const rows = cells.length / 7;
  const today = new Date();
  return (
    <View style={{ flex: 1 }}>
      <View pointerEvents="none" style={{ position: "absolute", left: 0, top: 0, width: 4000, opacity: 0 }}>
        {(Object.keys(SAMPLES) as (keyof typeof SAMPLES)[]).map((k) => (
          <Text key={k} onLayout={(e) => { const w = e.nativeEvent.layout.width; setW100((m) => (m[k] === w ? m : { ...m, [k]: w })); }}
            style={{ alignSelf: "flex-start", fontSize: 100, fontWeight: SAMPLES[k].weight }}>{SAMPLES[k].text}</Text>
        ))}
      </View>
      <View style={{ flexDirection: "row", paddingHorizontal: 6 }}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: t.textFaint, letterSpacing: 0.5, paddingBottom: 6 }}>{d.toUpperCase()}</Text>
        ))}
      </View>
      <View onLayout={(e) => { setGridW(e.nativeEvent.layout.width); setGridH(e.nativeEvent.layout.height); }} style={{ flex: 1, paddingHorizontal: 6, paddingBottom: 6 }}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map((c) => {
              const key = ymd(c.date);
              const isToday = isSameDay(c.date, today);
              const items: React.ReactNode[] = [];
              const daySwaps = (data.swaps && data.swaps[key]) || [];
              const swappedIn: { [id: string]: true } = {};
              daySwaps.forEach((r) => { if (r.kind === "on" && r.shiftEntryId) swappedIn[r.shiftEntryId] = true; });
              daySwaps.forEach((r) => {
                const col = entryColor(r, typesById);
                items.push(<Pill ts={ts} key={r.id} strip={r.kind === "off" ? "Swap off" : "Swap on"} stripBg={r.kind === "off" ? SWAP_OFF : SWAP_ON} stripFg="#FFFFFF"
                  label={entryName(r, typesById)} bg={col.bg} fg={col.ink} />);
              });
              (data.shifts[key] || []).forEach((s) => {
                if (swappedIn[s.id]) return;
                const ty = typesById[s.typeId];
                if (!ty) return;
                const col = entryColor(s, typesById);
                if (isCombo(s.typeId)) {
                  const bt = s.baseTypeId ? typesById[s.baseTypeId] : null;
                  items.push(<Pill ts={ts} key={s.id} strip={isSplitEntry(s) ? COMBO : ty.id === "overtime" ? "Overtime" : "Excess"} stripBg={ty.color} stripFg={ty.ink}
                    label={bt ? bt.name : ty.name} bg={col.bg} fg={col.ink} border={bt ? bt.border : null} />);
                } else {
                  items.push(<Pill ts={ts} key={s.id} label={ty.name + (s.tag ? " · " + s.tag : "")} bg={col.bg} fg={col.ink} border={ty.border} />);
                }
              });
              (data.leave[key] || []).forEach((l) => {
                const k = LEAVE_KINDS[l.kind] || LEAVE_KINDS.annual;
                const bt = l.baseTypeId ? typesById[l.baseTypeId] : null;
                if (bt) items.push(<Pill ts={ts} key={l.id} strip={LEAVE_STRIP[l.kind] || k.label} stripBg={k.color} stripFg={k.ink}
                  label={bt.name} bg={bt.color} fg={bt.ink} border={bt.border} />);
                else items.push(<Pill ts={ts} key={l.id} label={k.label.replace(" Leave", "")} bg={k.color} fg={k.ink} />);
              });
              ((data.notes && data.notes[key]) || []).forEach((n) => {
                const cat = EVENT_CATS[n.category || "other"] || EVENT_CATS.other;
                items.push(<Pill ts={ts} key={n.id} strip={cat.label} stripBg={cat.color} stripFg={cat.ink} label={n.text} bg={cat.color + "38"} fg={t.text} fixed />);
              });
              if (data.birthdays) birthdaysOnDate(data.birthdays, c.date).forEach((b) =>
                items.push(<Pill ts={ts} key={"b" + b.id} strip="Birthday" stripBg={BIRTHDAY.color} stripFg={BIRTHDAY.ink}
                  label={(b.name || "").trim().split(/\s+/)[0]} bg={BIRTHDAY.color + "38"} fg={t.text} party />));
              // as many banners as fit in the day (short days on a wide screen show fewer, with "+ more")
              const cellH = gridH ? (gridH - 6) / rows - 4 - 6 - 20 : 0;
              const fits = cellH > 0 ? Math.max(1, Math.floor((cellH + 3) / (ts.h + 3))) : 3;
              const max = Math.min(rows > 5 ? 2 : 3, items.length > fits ? Math.max(1, fits - 1) : fits);
              const ph = ((data.payTags && data.payTags[key]) || []).some((x) => x.kind === "holiday");
              const alt = !!shade && c.inMonth && payPeriodIsAlt(shade, c.date);
              const sel = !!(selected && selected[key]);
              return (
                <Pressable key={key} disabled={!onDayPress} onPress={() => onDayPress && onDayPress(key)}
                  accessibilityRole={onDayPress ? "button" : undefined} accessibilityLabel={c.date.toDateString()}
                  style={({ pressed }) => ({
                    flex: 1, margin: 2, borderRadius: 10, padding: 3, overflow: "hidden",
                    backgroundColor: !c.inMonth ? "transparent" : alt ? t.surface2 : t.surface, opacity: pressed ? 0.7 : c.inMonth ? 1 : 0.45,
                    borderWidth: isToday || sel ? 2 : t.dark ? StyleSheet.hairlineWidth : 0, borderColor: sel ? t.accent : isToday ? t.todayRing : t.border,
                    shadowColor: t.shadow, shadowOpacity: c.inMonth && !t.dark ? 0.04 : 0, shadowRadius: 3, shadowOffset: { width: 0, height: 1 },
                  })}>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 2, marginLeft: 1 }}>
                    <View style={{ minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 3, alignItems: "center", justifyContent: "center", backgroundColor: isToday ? t.accent : "transparent" }}>
                      <Text style={{ fontSize: 12, fontWeight: isToday ? "800" : "600", color: isToday ? t.accentInk : t.text, fontVariant: ["tabular-nums"] }}>{c.date.getDate()}</Text>
                    </View>
                    {ph ? <Text accessibilityLabel="Public holiday" style={{ fontSize: 8, fontWeight: "800", color: t.accentInk, backgroundColor: t.accent, borderRadius: 3, paddingHorizontal: 2, overflow: "hidden" }}>PH</Text> : null}
                  </View>
                  <View style={{ gap: 3 }}>
                    {items.slice(0, max)}
                    {items.length > max ? <Text style={{ fontSize: 9, color: t.textDim, textAlign: "center" }}>+{items.length - max} more</Text> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        ))}
      </View>
    </View>
  );
}

const BIRTHDAY = { color: "#A76BF0", ink: "#FFFFFF" };
// Swap tabs: orange for a shift given away, green for one picked up.
const SWAP_OFF = "#F2843A", SWAP_ON = "#22A06B";

// Every banner is the same height. All descriptions share one size: the largest
// that fits "Psychologist" in a day cell. All titles share one size: the largest
// that fits "APPOINTMENT"; "EXCESS + OVERTIME" and the leave titles are the
// exceptions and get the largest size that fits them. Sizes come from measuring the words on the phone.
const BANNER_H = 28, STRIP_H = 10;
// Every title strip sits this far in from the banner's top and sides, so a type's
// border (drawn within this margin) runs around the strip too. Same on all banners.
const STRIP_INSET = 3;
const COMBO = "Excess + Overtime";
const SAMPLES = {
  label: { text: "Psychologist", weight: "700" as const, est: 6.3 },
  title: { text: "APPOINTMENT", weight: "800" as const, est: 7.6 },
  combo: { text: COMBO.toUpperCase(), weight: "800" as const, est: 11.6 },
  leave: { text: "ANNUAL LEAVE", weight: "800" as const, est: 8.3 },
};
type Sizes = { label: number; title: number; combo: number; leave: number; h: number };
function bannerSizes(gridW: number, w100: { [k in keyof typeof SAMPLES]?: number }): Sizes {
  if (!gridW) return { label: 7, title: 5.5, combo: 4, leave: 5, h: BANNER_H };
  const content = (gridW - 12) / 7 - 3 - 6 - 4; // cell margin, padding, thickest border
  const fit = (k: keyof typeof SAMPLES, room: number, max: number) => {
    const em = w100[k] ? w100[k]! / 100 : SAMPLES[k].est;
    return Math.max(3.5, Math.min(max, Math.floor((room / em) * 10) / 10));
  };
  const strip = content - 2 * STRIP_INSET - 4 - 1;
  // "Annual leave" and "Sick leave" share one size, the largest that fits "ANNUAL LEAVE" (never bigger than other titles)
  const title = fit("title", strip, 8);
  const label = fit("label", content - 6 - 1, 12);
  // banners grow with their text on wide screens, so a title strip never pushes the name out of view
  const h = Math.max(BANNER_H, Math.ceil(STRIP_INSET + STRIP_H + label * 1.3 + 5));
  return { label, title, combo: fit("combo", strip, 8), leave: Math.min(title, fit("leave", strip, 8)), h };
}

// Party bunting and confetti for birthdays.
const PARTY = ["#FF6B9A", "#FFC93C", "#4CC9F0", "#7BD389", "#FF8C42", "#B983FF"];
function Bunting() {
  return (
    <View pointerEvents="none" style={{ position: "absolute", top: 0, left: 0, right: 0, flexDirection: "row", justifyContent: "space-evenly" }}>
      {PARTY.map((c) => (
        <View key={c} style={{ width: 0, height: 0, borderLeftWidth: 3, borderRightWidth: 3, borderTopWidth: 4, borderLeftColor: "transparent", borderRightColor: "transparent", borderTopColor: c }} />
      ))}
    </View>
  );
}
const CONFETTI: { l?: number; r?: number; b: number; c: string; rot: string }[] = [
  { l: 3, b: 3, c: PARTY[1], rot: "20deg" }, { l: 7, b: 6, c: PARTY[2], rot: "-30deg" },
  { r: 3, b: 3, c: PARTY[3], rot: "-20deg" }, { r: 7, b: 6, c: PARTY[0], rot: "35deg" },
];
function Confetti() {
  return (
    <>
      {CONFETTI.map((d, i) => (
        <View key={i} pointerEvents="none" style={{ position: "absolute", left: d.l, right: d.r, bottom: d.b, width: 3, height: 1.5, borderRadius: 1, backgroundColor: d.c, transform: [{ rotate: d.rot }] }} />
      ))}
    </>
  );
}

function Pill({ label, bg, fg, strip, stripBg, stripFg, ts, party, border }: { label: string; bg: string; fg: string; strip?: string; stripBg?: string; stripFg?: string; fixed?: boolean; party?: boolean; ts: Sizes; border?: string | null }) {
  return (
    <View style={{ height: ts.h, borderRadius: 5, overflow: "hidden", backgroundColor: bg }}>
      {strip ? (
        <View style={{ height: STRIP_H, marginTop: STRIP_INSET, marginHorizontal: STRIP_INSET, borderRadius: 3, overflow: "hidden", backgroundColor: stripBg, justifyContent: "center" }}>
          <Text numberOfLines={1} ellipsizeMode="clip"
            style={{ color: stripFg, fontSize: strip === COMBO ? ts.combo : / leave$/.test(strip) ? ts.leave : ts.title, lineHeight: STRIP_H, fontWeight: "800", textAlign: "center", paddingHorizontal: 2 }}>{strip.toUpperCase()}</Text>
        </View>
      ) : null}
      <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 3, paddingTop: party ? 3 : 0 }}>
        {party ? <><Bunting /><Confetti /></> : null}
        <Text numberOfLines={1} ellipsizeMode="tail"
          style={{ color: fg, fontSize: ts.label, fontWeight: "700", textAlign: "center" }}>{label}</Text>
      </View>
      <BannerBorder kind={border} bg={bg} ink={fg} radius={5} />
    </View>
  );
}


export function MonthNav({ month, onChange, onMast }: { month: Date; onChange: (d: Date) => void; onMast?: boolean }) {
  const t = useTheme();
  const bg = onMast ? t.mastBtn : t.surface2, fg = onMast ? t.mastInk : t.text;
  const btn = (label: string, a11y: string, n: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}
      onPress={() => onChange(new Date(month.getFullYear(), month.getMonth() + n, 1))}
      style={({ pressed }) => ({ width: 38, height: 38, borderRadius: 19, backgroundColor: bg, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={label === "‹" ? "chevron-back" : "chevron-forward"} size={18} color={fg} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {btn("‹", "Previous month", -1)}
      <Pressable accessibilityRole="button" onPress={() => { const n = new Date(); onChange(new Date(n.getFullYear(), n.getMonth(), 1)); }}
        style={({ pressed }) => ({ paddingHorizontal: 14, height: 38, borderRadius: 19, backgroundColor: bg, justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
        <Text style={{ color: fg, fontWeight: "700", fontSize: 13 }}>Today</Text>
      </Pressable>
      {btn("›", "Next month", 1)}
    </View>
  );
}
