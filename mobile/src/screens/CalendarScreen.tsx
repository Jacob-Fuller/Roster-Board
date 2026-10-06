import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { H1, useTheme } from "../components/ui";
import { useStore } from "../lib/store";
import {
  EVENT_CATS, EXCESS_TYPE, LEAVE_KINDS, MONTHS, OVERTIME_TYPE, WEEKDAYS_SHORT, addMonths, birthdaysOnDate, buildMonthCells,
  fmtHours, isSameDay, startOfMonth, ymd, type ShiftType,
} from "../lib/model";
import { DaySheet } from "./DaySheet";

export function useTypesById() {
  const { data } = useStore();
  return useMemo(() => {
    const m: { [id: string]: ShiftType } = { [OVERTIME_TYPE.id]: OVERTIME_TYPE, [EXCESS_TYPE.id]: EXCESS_TYPE };
    data.types.forEach((t) => { m[t.id] = t; });
    return m;
  }, [data.types]);
}

export function CalendarScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data, prefs } = useStore();
  const typesById = useTypesById();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);
  const cells = useMemo(() => buildMonthCells(month), [month]);
  const today = new Date();
  const rows = cells.length / 7;

  // Month totals for the header line.
  const totals = useMemo(() => {
    let hours = 0, shifts = 0;
    cells.forEach((c) => {
      if (!c.inMonth) return;
      (data.shifts[ymd(c.date)] || []).forEach((s) => {
        const ty = typesById[s.typeId];
        if (!ty || ty.kind === "personal") return;
        hours += s.hours != null ? s.hours : ty.hours || 0;
        if (!ty.isBuiltin) shifts++;
      });
    });
    return { hours, shifts };
  }, [cells, data.shifts, typesById]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <H1>{MONTHS[month.getMonth()]} <Text style={{ color: t.textDim, fontWeight: "400" }}>{month.getFullYear()}</Text></H1>
          <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
            {totals.shifts} shift{totals.shifts === 1 ? "" : "s"} · {fmtHours(totals.hours)}h
          </Text>
        </View>
        <NavBtn label="‹" a11y="Previous month" onPress={() => setMonth(addMonths(month, -1))} />
        <Pressable accessibilityRole="button" onPress={() => setMonth(startOfMonth(new Date()))}
          style={{ paddingHorizontal: 12, height: 36, borderRadius: 18, backgroundColor: t.surface2, justifyContent: "center" }}>
          <Text style={{ color: t.text, fontWeight: "700", fontSize: 13 }}>Today</Text>
        </Pressable>
        <NavBtn label="›" a11y="Next month" onPress={() => setMonth(addMonths(month, 1))} />
      </View>

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
              const dayShifts = data.shifts[key] || [];
              const leave = data.leave[key] || [];
              const events = prefs.hideEvents ? [] : data.notes[key] || [];
              const bdays = prefs.hideBirthdays ? [] : birthdaysOnDate(data.birthdays, c.date);
              const isToday = isSameDay(c.date, today);
              const items: React.ReactNode[] = [];
              dayShifts.forEach((s) => {
                const ty = typesById[s.typeId];
                if (!ty) return;
                const label = ty.isBuiltin ? (ty.id === "overtime" ? "OT" : "XS") + (s.hours != null ? " " + fmtHours(s.hours) : "") : ty.name;
                items.push(<Pill key={s.id} label={label} bg={ty.color} fg={ty.ink} />);
              });
              leave.forEach((l) => {
                const k = LEAVE_KINDS[l.kind] || LEAVE_KINDS.annual;
                items.push(<Pill key={l.id} label={k.label.replace(" Leave", "")} bg={k.color} fg={k.ink} />);
              });
              events.forEach((n) => {
                const cat = EVENT_CATS[n.category || "other"] || EVENT_CATS.other;
                items.push(<Pill key={n.id} label={n.text} bg={cat.color + "40"} fg={t.text} bar={cat.color} />);
              });
              bdays.forEach((b) => items.push(<Pill key={"b" + b.id} label={"🎂 " + (b.name || "").trim().split(/\s+/)[0]} bg={t.surface2} fg={t.text} />));
              const max = rows > 5 ? 2 : 3;
              return (
                <Pressable key={key} onPress={() => setOpenDay(key)}
                  accessibilityRole="button" accessibilityLabel={c.date.toDateString()}
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
      <DaySheet dateKey={openDay} onClose={() => setOpenDay(null)} />
    </View>
  );
}

function NavBtn({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "600", marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}

function Pill({ label, bg, fg, bar }: { label: string; bg: string; fg: string; bar?: string }) {
  return (
    <View style={{ backgroundColor: bg, borderRadius: 4, paddingHorizontal: 3, paddingVertical: 1, borderLeftWidth: bar ? 3 : 0, borderLeftColor: bar }}>
      <Text numberOfLines={1} style={{ color: fg, fontSize: 9.5, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}
