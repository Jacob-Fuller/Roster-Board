import React, { useMemo, useState } from "react";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MonthGrid, MonthNav } from "../components/MonthGrid";
import { H1, useTheme } from "../components/ui";
import { useStore } from "../lib/store";
import { EXCESS_TYPE, MONTHS, OVERTIME_TYPE, addMonths, effectiveHours, fmtHours, parseYmd, startOfMonth, type ShiftType } from "../lib/model";
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

  // Month totals for the header line.
  const totals = useMemo(() => {
    let hours = 0, shifts = 0;
    const end = addMonths(month, 1);
    Object.keys(data.shifts).forEach((k) => {
      const d = parseYmd(k);
      if (d < month || d >= end) return;
      (data.shifts[k] || []).forEach((s) => {
        const ty = typesById[s.typeId];
        if (!ty || ty.kind === "personal") return;
        hours += effectiveHours(s, typesById);
        if (!ty.isBuiltin) shifts++;
      });
    });
    return { hours, shifts };
  }, [month, data.shifts, typesById]);

  const gridData = useMemo(() => ({
    shifts: data.shifts, leave: data.leave,
    notes: prefs.hideEvents ? {} : data.notes,
    birthdays: prefs.hideBirthdays ? [] : data.birthdays,
  }), [data, prefs.hideEvents, prefs.hideBirthdays]);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8, flexDirection: "row", alignItems: "center", gap: 8 }}>
        <View style={{ flex: 1 }}>
          <H1>{MONTHS[month.getMonth()]} <Text style={{ color: t.textDim, fontWeight: "400" }}>{month.getFullYear()}</Text></H1>
          <Text style={{ color: t.textDim, fontSize: 13, marginTop: 2 }}>
            {totals.shifts} shift{totals.shifts === 1 ? "" : "s"} · {fmtHours(totals.hours)}h
          </Text>
        </View>
        <MonthNav month={month} onChange={setMonth} />
      </View>
      <MonthGrid month={month} data={gridData} typesById={typesById} onDayPress={setOpenDay} />
      <DaySheet dateKey={openDay} onClose={() => setOpenDay(null)} />
    </View>
  );
}
