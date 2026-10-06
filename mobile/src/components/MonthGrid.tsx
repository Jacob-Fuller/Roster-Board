import React, { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  EVENT_CATS, LEAVE_KINDS, WEEKDAYS_SHORT, birthdaysOnDate, buildMonthCells, effectiveHours, fmtHours, isSameDay, ymd,
  type Birthday, type Buckets, type EventEntry, type LeaveEntry, type ShiftEntry, type ShiftType,
} from "../lib/model";
import { useTheme } from "./ui";

export type GridData = {
  shifts: Buckets<ShiftEntry>; leave: Buckets<LeaveEntry>; notes?: Buckets<EventEntry>; birthdays?: Birthday[];
};

// Month calendar used for your own roster and, read-only, for a shared one.
export function MonthGrid({ month, data, typesById, onDayPress }: {
  month: Date; data: GridData; typesById: { [id: string]: ShiftType }; onDayPress?: (dateKey: string) => void;
}) {
  const t = useTheme();
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const rows = cells.length / 7;
  const today = new Date();
  return (
    <View style={{ flex: 1 }}>
      <View style={{ flexDirection: "row", paddingHorizontal: 6 }}>
        {WEEKDAYS_SHORT.map((d) => (
          <Text key={d} style={{ flex: 1, textAlign: "center", fontSize: 11, fontWeight: "700", color: t.textFaint, letterSpacing: 0.5, paddingBottom: 6 }}>{d.toUpperCase()}</Text>
        ))}
      </View>
      <View style={{ flex: 1, paddingHorizontal: 6, paddingBottom: 6 }}>
        {Array.from({ length: rows }, (_, r) => (
          <View key={r} style={{ flex: 1, flexDirection: "row" }}>
            {cells.slice(r * 7, r * 7 + 7).map((c) => {
              const key = ymd(c.date);
              const isToday = isSameDay(c.date, today);
              const items: React.ReactNode[] = [];
              (data.shifts[key] || []).forEach((s) => {
                const ty = typesById[s.typeId];
                if (!ty) return;
                const label = ty.isBuiltin
                  ? (ty.id === "overtime" ? (s.excessHours > 0 ? "XS+OT" : "OT") : "XS") + " " + fmtHours(effectiveHours(s, typesById))
                  : ty.name;
                items.push(<Pill key={s.id} label={label} bg={ty.color} fg={ty.ink} />);
              });
              (data.leave[key] || []).forEach((l) => {
                const k = LEAVE_KINDS[l.kind] || LEAVE_KINDS.annual;
                items.push(<Pill key={l.id} label={k.label.replace(" Leave", "")} bg={k.color} fg={k.ink} />);
              });
              ((data.notes && data.notes[key]) || []).forEach((n) => {
                const cat = EVENT_CATS[n.category || "other"] || EVENT_CATS.other;
                items.push(<Pill key={n.id} label={n.text} bg={cat.color + "40"} fg={t.text} bar={cat.color} />);
              });
              if (data.birthdays) birthdaysOnDate(data.birthdays, c.date).forEach((b) =>
                items.push(<Pill key={"b" + b.id} label={"🎂 " + (b.name || "").trim().split(/\s+/)[0]} bg={t.surface2} fg={t.text} />));
              const max = rows > 5 ? 2 : 3;
              return (
                <Pressable key={key} disabled={!onDayPress} onPress={() => onDayPress && onDayPress(key)}
                  accessibilityRole={onDayPress ? "button" : undefined} accessibilityLabel={c.date.toDateString()}
                  style={({ pressed }) => ({
                    flex: 1, margin: 1.5, borderRadius: 8, padding: 3, overflow: "hidden",
                    backgroundColor: c.inMonth ? t.surface : "transparent", opacity: pressed ? 0.7 : c.inMonth ? 1 : 0.45,
                    borderWidth: isToday ? 2 : StyleSheet.hairlineWidth, borderColor: isToday ? t.todayRing : t.border,
                  })}>
                  <Text style={{ fontSize: 12, fontWeight: isToday ? "800" : "600", color: isToday ? t.accent : t.text, marginBottom: 2, marginLeft: 2 }}>{c.date.getDate()}</Text>
                  <View style={{ gap: 2 }}>
                    {items.slice(0, max)}
                    {items.length > max ? <Text style={{ fontSize: 9, color: t.textDim, marginLeft: 2 }}>+{items.length - max} more</Text> : null}
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

function Pill({ label, bg, fg, bar }: { label: string; bg: string; fg: string; bar?: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, borderLeftWidth: bar ? 3 : 0, borderLeftColor: bar }}>
      <Text numberOfLines={1} style={{ color: fg, fontSize: 9.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function MonthNav({ month, onChange }: { month: Date; onChange: (d: Date) => void }) {
  const t = useTheme();
  const btn = (label: string, a11y: string, n: number) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} hitSlop={6}
      onPress={() => onChange(new Date(month.getFullYear(), month.getMonth() + n, 1))}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "600", marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
      {btn("‹", "Previous month", -1)}
      <Pressable accessibilityRole="button" onPress={() => { const n = new Date(); onChange(new Date(n.getFullYear(), n.getMonth(), 1)); }}
        style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: t.surface2, justifyContent: "center" }}>
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>Today</Text>
      </Pressable>
      {btn("›", "Next month", 1)}
    </View>
  );
}
