import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useRef, useState } from "react";
import { PanResponder, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MonthGrid, MonthNav } from "../components/MonthGrid";
import { Chip, H1, useTheme, useUi } from "../components/ui";
import { useStore } from "../lib/store";
import { EXCESS_TYPE, MONTHS, OVERTIME_TYPE, addMonths, effectiveHours, fmtHours, mkId, parseYmd, startOfMonth, type ShiftType } from "../lib/model";
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
  const { data, prefs, update } = useStore();
  const { toast } = useUi();
  const typesById = useTypesById();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [openDay, setOpenDay] = useState<string | null>(null);
  // Mass-edit: pick a type, then tap days to add or remove it (same as the web app).
  const [bulk, setBulk] = useState(false);
  const [bulkType, setBulkType] = useState<string | null>(null);
  const [bulkSel, setBulkSel] = useState<{ [dateKey: string]: string }>({});

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
    shifts: data.shifts, leave: data.leave, swaps: data.swaps, payTags: data.payTags, settings: data.settings,
    notes: prefs.hideEvents ? {} : data.notes,
    birthdays: prefs.hideBirthdays ? [] : data.birthdays,
  }), [data, prefs.hideEvents, prefs.hideBirthdays]);

  // swipe left/right to change month
  const monthRef = useRef(month); monthRef.current = month;
  const bulkRef = useRef(bulk); bulkRef.current = bulk;
  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => !bulkRef.current && Math.abs(g.dx) > 30 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => {
      if (Math.abs(g.dx) < 60 || Math.abs(g.dx) < Math.abs(g.dy) * 1.5) return;
      setMonth(addMonths(monthRef.current, g.dx < 0 ? 1 : -1));
    },
  }), []);

  function startBulk() {
    if (!data.types.length) { toast("Add a shift type first"); return; }
    setBulk(true); setBulkType(null); setBulkSel({});
  }
  function endBulk() {
    const n = Object.keys(bulkSel).length;
    setBulk(false); setBulkType(null); setBulkSel({});
    if (n > 0) toast("Added " + n + " shift" + (n === 1 ? "" : "s"));
  }
  function bulkToggle(key: string) {
    if (!bulkType) { toast("Pick a shift type first"); return; }
    const existing = bulkSel[key];
    if (existing) {
      update((d, tomb) => {
        d.shifts[key] = (d.shifts[key] || []).filter((s) => s.id !== existing);
        if (!d.shifts[key].length) delete d.shifts[key];
        tomb(existing);
      });
      const next = { ...bulkSel }; delete next[key]; setBulkSel(next);
    } else {
      const id = mkId();
      update((d) => { (d.shifts[key] = d.shifts[key] || []).push({ id, typeId: bulkType }); });
      setBulkSel({ ...bulkSel, [key]: id });
    }
  }

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
      <View style={{ flex: 1 }} {...pan.panHandlers}>
        <MonthGrid month={month} data={gridData} typesById={typesById} selected={bulk ? bulkSel : undefined}
          onDayPress={(k) => (bulk ? bulkToggle(k) : setOpenDay(k))} />
      </View>

      {bulk ? (
        <View style={{ backgroundColor: t.surface, borderTopWidth: 0.5, borderTopColor: t.border, paddingTop: 10, paddingBottom: 10 }}>
          <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 16, marginBottom: 8 }}>
            <Text style={{ flex: 1, color: t.textDim, fontSize: 13 }}>
              {bulkType ? "Tap days to add or remove this shift" : "Choose a shift type, then tap days on the calendar"}
            </Text>
            <Pressable accessibilityRole="button" onPress={endBulk} hitSlop={8}><Text style={{ color: t.accent, fontWeight: "800" }}>Done</Text></Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}>
            {data.types.map((ty) => (
              <Chip key={ty.id} label={ty.name} color={bulkType === ty.id ? ty.color : t.surface2} ink={bulkType === ty.id ? ty.ink : t.text} onPress={() => setBulkType(ty.id)} />
            ))}
          </ScrollView>
        </View>
      ) : (
        <Pressable accessibilityRole="button" accessibilityLabel="Mass-edit shifts" onPress={startBulk}
          style={({ pressed }) => ({ position: "absolute", right: 16, bottom: 16, width: 52, height: 52, borderRadius: 26, backgroundColor: t.accent,
            alignItems: "center", justifyContent: "center", opacity: pressed ? 0.85 : 1, shadowColor: "#000", shadowOpacity: 0.25, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 5 })}>
          <Ionicons name="color-wand-outline" size={24} color={t.accentInk} />
        </Pressable>
      )}
      <DaySheet dateKey={openDay} onClose={() => setOpenDay(null)} />
    </View>
  );
}
