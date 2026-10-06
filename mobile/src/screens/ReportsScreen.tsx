import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Dim, Divider, H1, SectionHead, Segmented, Sheet, useTheme } from "../components/ui";
import { EXCESS_ID, MONTHS, employmentOf, OVERTIME_ID, OVERTIME_TYPE, addDays, addMonths, fmtHours, startOfMonth, ymd, type ShiftType } from "../lib/model";
import {
  computePay, fmtMoney, fmtMoneyShort, payCardRange, payConfig, payIsSetUp, payPeriodFor, periodsPerYear, rateOn, shiftPayPeriod,
  type PayResult,
} from "../lib/pay";
import { collectPeriodStats, type TypeRow } from "../lib/reports";
import { useStore } from "../lib/store";
import { useTypesById } from "./CalendarScreen";
import { ExportSheet } from "./ExportSheet";
import { LockCard } from "./Paywall";
import { usePremium } from "../lib/premium";
import { PaySetupSheet } from "./PaySetupSheet";

type CardView = "weekly" | "fortnightly" | "monthly";
type PayMode = "period" | "month" | "year";
const PAY_CARD_VIEW_KEY = "rosterBoard.payCardView";
const shortDate = (d: Date) => d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);

type Mode = "month" | "year";

export function ReportsScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data } = useStore();
  const typesById = useTypesById();
  const [mode, setMode] = useState<Mode>("month");
  const { locked, openPaywall } = usePremium();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const [year, setYear] = useState(new Date().getFullYear());
  const [exportOpen, setExportOpen] = useState(false);
  const [setupOpen, setSetupOpen] = useState(false);
  const [payScreen, setPayScreen] = useState<{ mode: PayMode; anchor: Date } | null>(null);
  // Weekly / Fortnightly / Monthly choice on the pay card, remembered on this device (like the web).
  const [savedView, setSavedView] = useState("");
  useEffect(() => { AsyncStorage.getItem(PAY_CARD_VIEW_KEY).then((v) => setSavedView(v || "")).catch(() => {}); }, []);
  const chooseView = (v: CardView) => { setSavedView(v); AsyncStorage.setItem(PAY_CARD_VIEW_KEY, v).catch(() => {}); };

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

  const fullTime = employmentOf(data.settings) === "full";
  const byType = { ...stats.byType };
  if (fullTime && byType[EXCESS_ID] && !byType[EXCESS_ID].hours) delete byType[EXCESS_ID];
  if (!fullTime && !byType[EXCESS_ID]) byType[EXCESS_ID] = { name: "Excess", color: "#F7B3CE", count: 0, hours: 0, rank: 1 };
  if (!byType[OVERTIME_ID]) byType[OVERTIME_ID] = { name: OVERTIME_TYPE.name, color: OVERTIME_TYPE.color, count: 0, hours: 0, rank: 2 };
  const rows: TypeRow[] = Object.values(byType).sort((a, b) => b.hours - a.hours || a.rank - b.rank);
  const maxType = Math.max(1, ...rows.map((r) => r.hours));
  const wwTotal = stats.weekdayHours + stats.weekendHours;
  const pct = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 100) : 0);
  const delta = stats.totalHours - prev.totalHours;
  const deltaPct = prev.totalHours > 0 ? Math.round((delta / prev.totalHours) * 100) : stats.totalHours > 0 ? 100 : 0;

  let busiest: string | null = null, busiestVal = 0;
  Object.keys(stats.monthTotals).forEach((k) => { if (stats.monthTotals[k] > busiestVal) { busiestVal = stats.monthTotals[k]; busiest = k; } });

  // Estimated pay card (same rules as the web's renderPayCard).
  const paySetUp = payIsSetUp(data.settings);
  const payCard = useMemo(() => {
    if (!paySetUp) return null;
    const cfg = payConfig(data.settings);
    let range = mode === "month"
      ? { start: month, end: addMonths(month, 1) }
      : { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
    let view: CardView | null = null, rangeLabel = "";
    if (mode !== "year") {
      view = savedView === "weekly" || savedView === "fortnightly" || savedView === "monthly" ? savedView : (cfg.cycle || "fortnightly");
      if (view !== "monthly") {
        const now = new Date();
        const ref = now >= month && now < addMonths(month, 1) ? now : month;
        range = payCardRange(cfg, view, ref);
        const last = addDays(range.end, -1);
        rangeLabel = shortDate(range.start) + " – " + shortDate(last);
      }
    }
    const factor = mode === "year" ? 1 : view === "weekly" ? 52 : view === "fortnightly" ? 26 : 12;
    return { view, range, rangeLabel, p: computePay(data, typesById, range.start, range.end, factor) };
  }, [paySetUp, data, typesById, mode, month, year, savedView]);

  const openBreakdown = () => {
    if (!payCard) return;
    if (payCard.view && payCard.view !== "monthly") { setPayScreen({ mode: "period", anchor: payCard.range.start }); return; }
    setPayScreen(mode === "year" ? { mode: "year", anchor: new Date(year, 0, 1) } : { mode: "month", anchor: month });
  };

  // Year in review pay rows.
  const yearPay = useMemo(() => {
    if (mode !== "year" || !paySetUp) return null;
    const yPay = computePay(data, typesById, new Date(year, 0, 1), new Date(year + 1, 0, 1), 1);
    let bestM = -1, bestG = 0;
    for (let pm = 0; pm < 12; pm++) {
      const gm = computePay(data, typesById, new Date(year, pm, 1), new Date(year, pm + 1, 1), 12).gross;
      if (gm > bestG) { bestG = gm; bestM = pm; }
    }
    return { gross: yPay.gross, bestM, bestG };
  }, [mode, paySetUp, data, typesById, year]);

  const reviewRows: [string, string][] = [
    ["Total hours worked", fmtHours(stats.totalHours) + " h"],
    ["Total overtime", fmtHours(stats.otHours) + " h"],
    ...(fullTime && !stats.excessHours ? [] : [["Total excess hours", fmtHours(stats.excessHours) + " h"] as [string, string]]),
    ["Busiest month", busiest ? MONTHS[+String(busiest).split("-")[1] - 1] + " (" + fmtHours(busiestVal) + " h)" : "—"],
    ["Leave days taken", String(stats.leaveDays)],
  ];
  if (yearPay) {
    reviewRows.push(["Estimated gross pay", fmtMoney(yearPay.gross)]);
    if (yearPay.bestM >= 0) reviewRows.push(["Best paid month", MONTHS[yearPay.bestM] + " (" + fmtMoneyShort(yearPay.bestG) + ")"]);
  }

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
          {fullTime ? <Stat label="Days worked" value={String(stats.daysWorked)} /> : <Stat label="Excess" value={fmtHours(stats.excessHours)} />}
        </View>
        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
          {fullTime ? null : <Stat label="Days worked" value={String(stats.daysWorked)} />}
          <Stat label="Leave days" value={String(stats.leaveDays)} />
          <Stat label="Est. pay" value={payCard && !locked ? fmtMoneyShort(payCard.p.gross) : "—"} />
        </View>

        <SectionHead title="Estimated pay" right={<Button small kind="ghost" title="Pay setup" onPress={() => setSetupOpen(true)} />} />
        {locked ? <LockCard text="See your estimated pay for every week, fortnight, month and year." /> : <Card>
          {!payCard ? (
            <>
              <Button small title="Set my hourly rate" onPress={() => setSetupOpen(true)} />
            </>
          ) : (
            <>
              {payCard.view ? (
                <View style={{ marginBottom: 12 }}>
                  <Segmented<CardView> value={payCard.view} onChange={chooseView}
                    options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly" }]} />
                </View>
              ) : null}
              <Pressable accessibilityRole="button" onPress={openBreakdown}
                style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 10, opacity: pressed ? 0.7 : 1 })}>
                <View style={{ flex: 1 }}>
                  <Text style={{ color: t.text, fontSize: 26, fontWeight: "800", fontVariant: ["tabular-nums"] }}>{fmtMoney(payCard.p.gross)}</Text>
                  <Dim>{(payCard.rangeLabel ? payCard.rangeLabel + " · " : "") + "Gross" + (payCard.p.showTax ? " · about " + fmtMoney(payCard.p.net) + " take-home" : "")}</Dim>
                </View>
                <Text style={{ color: t.accent, fontWeight: "700", fontSize: 14 }}>Breakdown ›</Text>
              </Pressable>
            </>
          )}
        </Card>}

        {locked ? (
          <>
            <SectionHead title="By shift type" />
            <LockCard text="Full reports are part of Premium: hours by shift type, weekday vs weekend, comparisons and year in review." />
          </>
        ) : <>
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
              {reviewRows.map((r, i) => (
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
        </>}
        <Button small kind="ghost" style={{ marginTop: 22 }} title="PDF roster" onPress={() => (locked ? openPaywall("PDF export is part of Premium.") : setExportOpen(true))} />
      </ScrollView>
      <ExportSheet visible={exportOpen} onClose={() => setExportOpen(false)} initialMode={mode} initialMonth={month} initialYear={year} />
      <PaySetupSheet visible={setupOpen && !payScreen} onClose={() => setSetupOpen(false)} />
      <PayScreenSheet state={payScreen} onChange={setPayScreen} typesById={typesById} />
    </View>
  );
}

/* ---------- Estimated pay: full breakdown (the web's pay screen) ---------- */
function payViewRange(settings: Parameters<typeof payConfig>[0], mode: PayMode, a: Date) {
  const cfg = payConfig(settings);
  if (mode === "year") {
    return { start: new Date(a.getFullYear(), 0, 1), end: new Date(a.getFullYear() + 1, 0, 1), factor: 1, label: "" + a.getFullYear(), sub: "Calendar year" };
  }
  if (mode === "month") {
    const ms = startOfMonth(a);
    return { start: ms, end: addMonths(ms, 1), factor: 12, label: MONTHS[ms.getMonth()] + " " + ms.getFullYear(), sub: "Calendar month" };
  }
  const per = payPeriodFor(cfg, a);
  const last = addDays(per.end, -1);
  const cycleName = cfg.cycle === "weekly" ? "Weekly" : cfg.cycle === "monthly" ? "Monthly" : "Fortnightly";
  return { start: per.start, end: per.end, factor: periodsPerYear(cfg), label: shortDate(per.start) + " – " + shortDate(last), sub: cycleName + " pay period" };
}

function PayScreenSheet({ state, onChange, typesById }: {
  state: { mode: PayMode; anchor: Date } | null; onChange: (s: { mode: PayMode; anchor: Date } | null) => void;
  typesById: { [id: string]: ShiftType };
}) {
  const t = useTheme();
  const { data } = useStore();
  const [setupOpen, setSetupOpen] = useState(false);
  const view = useMemo(() => {
    if (!state) return null;
    const cfg = payConfig(data.settings);
    const r = payViewRange(data.settings, state.mode, state.anchor);
    const p = computePay(data, typesById, r.start, r.end, r.factor);
    const rate = rateOn(cfg, ymd(addDays(r.end, -1)));
    const y = (state.mode === "year" ? state.anchor : r.start).getFullYear();
    const months: number[] = [];
    let yearTotal = 0, max = 0;
    for (let m = 0; m < 12; m++) {
      const g = computePay(data, typesById, new Date(y, m, 1), new Date(y, m + 1, 1), 12).gross;
      months.push(g); yearTotal += g; if (g > max) max = g;
    }
    return { cfg, r, p, rate, y, months, yearTotal, max };
  }, [state, data, typesById]);

  const step = (dir: number) => {
    if (!state || !view) return;
    const a = state.anchor;
    if (state.mode === "year") onChange({ mode: "year", anchor: new Date(a.getFullYear() + dir, 0, 1) });
    else if (state.mode === "month") onChange({ mode: "month", anchor: addMonths(startOfMonth(a), dir) });
    else onChange({ mode: "period", anchor: shiftPayPeriod(view.cfg, payPeriodFor(view.cfg, a), dir).start });
  };

  const close = () => { setSetupOpen(false); onChange(null); };
  return (
    <Sheet visible={!!state} onClose={close} title="Estimated pay">
      {state && view ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
            <Button small kind="ghost" title="Pay setup" onPress={() => setSetupOpen(true)} />
          </View>
          <Segmented<PayMode> value={state.mode} onChange={(m) => onChange({ mode: m, anchor: state.anchor })}
            options={[{ value: "period", label: "Pay period" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 14 }}>
            <Nav label="‹" a11y="Previous" onPress={() => step(-1)} />
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{view.r.label}</Text>
              <Dim>{view.r.sub}</Dim>
            </View>
            <Nav label="›" a11y="Next" onPress={() => step(1)} />
          </View>
          <Card style={{ alignItems: "center", paddingVertical: 18 }}>
            <Dim style={{ fontWeight: "600" }}>Estimated gross pay</Dim>
            <Text style={{ color: t.text, fontSize: 32, fontWeight: "800", fontVariant: ["tabular-nums"], marginTop: 4 }}>{fmtMoney(view.p.gross)}</Text>
            {view.p.showTax ? <Dim style={{ marginTop: 4 }}>{"About " + fmtMoney(view.p.net) + " take-home"}</Dim> : null}
          </Card>

          <SectionHead title="Breakdown" />
          <Card style={{ paddingVertical: 4 }}>
            <PayLines p={view.p} superPct={view.cfg.superPct} />
          </Card>
          <Dim style={{ marginTop: 8 }}>{"Base rate " + fmtMoney(view.rate) + "/h"}</Dim>

          <SectionHead title={"By month · " + view.y} />
          <Card>
            {view.months.map((g, m) => (
              <Bar key={m} name={MONTHS[m].slice(0, 3)} color={t.accent} value={g} max={view.max || 1} text={g ? fmtMoneyShort(g) : "—"} />
            ))}
            <PayLine label="Year total (gross)" amount={view.yearTotal} kind="total" />
          </Card>
          <Dim style={{ marginTop: 10 }}>Estimates only. Tax uses 2026–27 Australian resident rates. Your payslip may differ.</Dim>
          <PaySetupSheet visible={setupOpen} onClose={() => setSetupOpen(false)} />
        </>
      ) : null}
    </Sheet>
  );
}

function PayLines({ p, superPct }: { p: PayResult; superPct: number }) {
  const rows: React.ReactNode[] = [];
  const add = (label: string, amount: number | string, kind?: "sub" | "total" | "muted", detail?: string) =>
    rows.push(<PayLine key={rows.length} label={label} amount={amount} kind={kind} detail={detail} />);
  add("Ordinary", p.ordinary, undefined, fmtHours(p.ordinaryHours) + "h");
  if (p.overtime) add("Overtime", p.overtime, undefined, fmtHours(p.otHours) + "h");
  if (p.excess) add("Excess hours", p.excess, undefined, fmtHours(p.excessHours) + "h");
  if (p.penalties) {
    add("Penalty rates", p.penalties);
    Object.keys(p.penaltyLines).forEach((k) => add(k, p.penaltyLines[k], "sub"));
  }
  if (p.shiftAllowance) add("Shift allowance", p.shiftAllowance);
  if (p.allowances) {
    add("Allowances", p.allowances);
    Object.keys(p.allowanceLines).forEach((k) => add(k, p.allowanceLines[k], "sub"));
  }
  if (p.leave) add("Leave", p.leave, undefined, fmtHours(p.leaveHours) + "h");
  if (p.leaveLoading) add("Leave loading", p.leaveLoading);
  add("Gross", p.gross, "total");
  if (p.showTax) {
    add("Estimated tax", "−" + fmtMoney(p.tax), undefined, "incl. Medicare levy");
    add("Estimated take-home", p.net, "total");
  }
  if (superPct > 0) add("Super (paid by employer)", p.superAmt, "muted", fmtHours(superPct) + "%");
  return <>{rows}</>;
}

function PayLine({ label, amount, kind, detail }: { label: string; amount: number | string; kind?: "sub" | "total" | "muted"; detail?: string }) {
  const t = useTheme();
  const total = kind === "total", sub = kind === "sub", muted = kind === "muted";
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: 10, paddingVertical: 9,
      paddingLeft: sub ? 14 : 0, borderTopWidth: total ? 1 : 0, borderTopColor: t.border }}>
      <Text style={{ flex: 1, color: muted || sub ? t.textDim : t.text, fontSize: sub ? 13 : 14, fontWeight: total ? "700" : "400" }}>
        {label}{detail ? <Text style={{ color: t.textDim, fontSize: 12 }}>{"  " + detail}</Text> : null}
      </Text>
      <Text style={{ color: muted || sub ? t.textDim : t.text, fontSize: sub ? 13 : 14, fontWeight: total ? "800" : "700", fontVariant: ["tabular-nums"] }}>
        {typeof amount === "string" ? amount : fmtMoney(amount)}
      </Text>
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
