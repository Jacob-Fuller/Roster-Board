import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Card, Dim, Divider, H1, SectionHead, Segmented, useTheme } from "../components/ui";
import { EXCESS_ID, MONTHS, OVERTIME_ID, OVERTIME_TYPE, addMonths, fmtHours, startOfMonth } from "../lib/model";
import { collectPeriodStats, type TypeRow } from "../lib/reports";
import { useStore } from "../lib/store";
import { useTypesById } from "./CalendarScreen";

type Mode = "month" | "year";

export function ReportsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data } = useStore();
  const typesById = useTypesById();
  const [mode, setMode] = useState<Mode>("month");
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());

  const { label, stats, prev } = useMemo(() => {
    const range = mode === "month"
      ? { start: month, end: addMonths(month, 1), label: MONTHS[month.getMonth()] + " " + month.getFullYear() }
      : { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1), label: String(year) };
    const prevRange = mode === "month"
      ? { start: addMonths(month, -1), end: month }
      : { start: new Date(year - 1, 0, 1), end: new Date(year, 0, 1) };
    return {
      label: range.label,
      stats: collectPeriodStats(data, typesById, range.start, range.end),
      prev: collectPeriodStats(data, typesById, prevRange.start, prevRange.end),
    };
  }, [data, typesById, mode, month, year]);

  const step = (n: number) => { if (mode === "month") setMonth(addMonths(month, n)); else setYear(year + n); };

  const byType = { ...stats.byType };
  if (!byType[EXCESS_ID]) byType[EXCESS_ID] = { name: "Excess", color: "#F7B3CE", count: 0, hours: 0, rank: 1 };
  if (!byType[OVERTIME_ID]) byType[OVERTIME_ID] = { name: OVERTIME_TYPE.name, color: OVERTIME_TYPE.color, count: 0, hours: 0, rank: 2 };
  const rows: TypeRow[] = Object.values(byType).sort((a, b) => b.hours - a.hours || a.rank - b.rank);
  const maxType = Math.max(1, ...rows.map((r) => r.hours));
  const wwTotal = stats.weekdayHours + stats.weekendHours;
  const pct = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 100) : 0);
  const delta = stats.totalHours - prev.totalHours;
  const deltaPct = prev.totalHours > 0 ? Math.round((delta / prev.totalHours) * 100) : stats.totalHours > 0 ? 100 : 0;

  let busiest: string | null = null, busiestVal = 0;
  Object.keys(stats.monthTotals).forEach((k) => { if (stats.monthTotals[k] > busiestVal) { busiestVal = stats.monthTotals[k]; busiest = k; } });

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
        <H1 style={{ marginBottom: 12 }}>Reports</H1>
        <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 14 }}>
          <Nav label="‹" a11y="Previous" onPress={() => step(-1)} />
          <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{label}</Text>
          <Nav label="›" a11y="Next" onPress={() => step(1)} />
        </View>

        <View style={{ flexDirection: "row", gap: 8 }}>
          <Stat label="Hours" value={fmtHours(stats.totalHours)} />
          <Stat label="Overtime" value={fmtHours(stats.otHours)} />
          <Stat label="Excess" value={fmtHours(stats.excessHours)} />
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          <Stat label="Days worked" value={String(stats.daysWorked)} />
          <Stat label="Leave days" value={String(stats.leaveDays)} />
        </View>

        <SectionHead title="By shift type" />
        <Card>
          {stats.totalHours ? rows.map((r, i) => (
            <Bar key={i} name={r.name} color={r.color} value={r.hours} max={maxType}
              text={fmtHours(r.hours) + "h · " + pct(r.hours, stats.totalHours) + "% · " + r.count + "x"} />
          )) : <Dim>No shifts logged this period.</Dim>}
        </Card>

        <SectionHead title="Weekdays vs weekends" />
        <Card>
          <Bar name="Weekdays" color={t.accent} value={stats.weekdayHours} max={Math.max(1, stats.weekdayHours, stats.weekendHours)}
            text={fmtHours(stats.weekdayHours) + "h · " + pct(stats.weekdayHours, wwTotal) + "% · " + stats.weekdayCount + "x"} />
          <Bar name="Weekends" color={t.accent} value={stats.weekendHours} max={Math.max(1, stats.weekdayHours, stats.weekendHours)}
            text={fmtHours(stats.weekendHours) + "h · " + pct(stats.weekendHours, wwTotal) + "% · " + stats.weekendCount + "x"} />
        </Card>

        <SectionHead title={mode === "month" ? "Compared with last month" : "Compared with last year"} />
        <Card>
          <Bar name="This period" color={t.accent} value={stats.totalHours} max={Math.max(1, stats.totalHours, prev.totalHours)} text={fmtHours(stats.totalHours) + "h"} />
          <Bar name="Previous" color={t.textFaint} value={prev.totalHours} max={Math.max(1, stats.totalHours, prev.totalHours)} text={fmtHours(prev.totalHours) + "h"} />
          <Text style={{ marginTop: 6, fontWeight: "700", color: delta >= 0 ? t.good : t.danger }}>
            {(delta >= 0 ? "+" : "") + fmtHours(delta) + "h (" + (deltaPct >= 0 ? "+" : "") + deltaPct + "%) vs previous period"}
          </Text>
        </Card>

        {mode === "year" ? (
          <>
            <SectionHead title="Year in review" />
            <Card style={{ paddingVertical: 4 }}>
              {[
                ["Total hours worked", fmtHours(stats.totalHours) + " h"],
                ["Total overtime", fmtHours(stats.otHours) + " h"],
                ["Total excess hours", fmtHours(stats.excessHours) + " h"],
                ["Busiest month", busiest ? MONTHS[+String(busiest).split("-")[1] - 1] + " (" + fmtHours(busiestVal) + " h)" : "—"],
                ["Leave days taken", String(stats.leaveDays)],
              ].map((r, i) => (
                <View key={r[0]}>
                  {i ? <Divider /> : null}
                  <View style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 11 }}>
                    <Text style={{ color: t.textDim, fontSize: 14 }}>{r[0]}</Text>
                    <Text style={{ color: t.text, fontSize: 14, fontWeight: "700" }}>{r[1]}</Text>
                  </View>
                </View>
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  const t = useTheme();
  return (
    <Card style={{ flex: 1, paddingVertical: 12, alignItems: "center" }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{value}</Text>
      <Text style={{ color: t.textDim, fontSize: 12, fontWeight: "600", marginTop: 2 }}>{label}</Text>
    </Card>
  );
}

function Bar({ name, color, value, max, text }: { name: string; color: string; value: number; max: number; text: string }) {
  const t = useTheme();
  return (
    <View style={{ paddingVertical: 7 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 5, gap: 8 }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 7, flexShrink: 1 }}>
          <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color }} />
          <Text numberOfLines={1} style={{ color: t.text, fontSize: 14, fontWeight: "600", flexShrink: 1 }}>{name}</Text>
        </View>
        <Text style={{ color: t.textDim, fontSize: 13, fontVariant: ["tabular-nums"] }}>{text}</Text>
      </View>
      <View style={{ height: 8, borderRadius: 4, backgroundColor: t.surface2, overflow: "hidden" }}>
        <View style={{ width: `${value > 0 ? Math.max(4, (value / max) * 100) : 0}%`, height: "100%", backgroundColor: color, borderRadius: 4 }} />
      </View>
    </View>
  );
}

function Nav({ label, onPress, a11y }: { label: string; onPress: () => void; a11y: string }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 22, fontWeight: "600", marginTop: -2 }}>{label}</Text>
    </Pressable>
  );
}
