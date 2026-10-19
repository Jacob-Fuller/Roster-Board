import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useEffect, useMemo, useState } from "react";
import { PanResponder, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { Button, Card, Dim, Divider, MastButton, Masthead, MenuRow, HeroCard, SERIF, SectionHead, Segmented, Sheet, useTheme } from "../components/ui";
import { EXCESS_ID, MONTHS, WEEKDAYS_FULL, parseYmd, employmentOf, OVERTIME_ID, OVERTIME_TYPE, addDays, addMonths, fmtHours, startOfMonth, ymd, type ShiftType } from "../lib/model";
import {
  allowanceClaims, computePay, fmtMoney, fmtMoneyShort, payCardRangeAt, payConfig, payIsSetUp, payPeriodFor, periodsPerYear, rateOn, shiftPayPeriod,
  type PayResult, type PayTag,
} from "../lib/pay";
import { lastDay, partTimeOf, partTimeProgress } from "../lib/partTime";
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
  const chooseView = (v: CardView) => { setSavedView(v); setCardOffset(0); AsyncStorage.setItem(PAY_CARD_VIEW_KEY, v).catch(() => {}); };
  // Periods stepped away from the current one with the ‹ › arrows. Not saved,
  // so the card always opens on the current week/fortnight.
  const [cardOffset, setCardOffset] = useState(0);
  useEffect(() => { setCardOffset(0); }, [month, mode]);

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
  // excess always sits directly ahead of overtime
  const exRow = byType[EXCESS_ID], otRow = byType[OVERTIME_ID];
  if (exRow && otRow && rows.indexOf(otRow) < rows.indexOf(exRow)) { rows.splice(rows.indexOf(exRow), 1); rows.splice(rows.indexOf(otRow), 0, exRow); }
  const maxType = Math.max(1, ...rows.map((r) => r.hours));
  const wwTotal = stats.weekdayHours + stats.weekendHours;
  const pct = (v: number, of: number) => (of > 0 ? Math.round((v / of) * 100) : 0);
  const delta = stats.totalHours - prev.totalHours;
  const deltaPct = prev.totalHours > 0 ? Math.round((delta / prev.totalHours) * 100) : stats.totalHours > 0 ? 100 : 0;

  let busiest: string | null = null, busiestVal = 0;
  Object.keys(stats.monthTotals).forEach((k) => { if (stats.monthTotals[k] > busiestVal) { busiestVal = stats.monthTotals[k]; busiest = k; } });

  // Estimated pay card: Weekly / Fortnightly / Monthly, stepped through with ‹ › or a swipe.
  const paySetUp = payIsSetUp(data.settings);
  const payCard = useMemo(() => {
    if (!paySetUp) return null;
    const cfg = payConfig(data.settings);
    const view: CardView = savedView === "weekly" || savedView === "fortnightly" || savedView === "monthly" ? savedView : (cfg.cycle || "fortnightly");
    const now = new Date();
    const span = mode === "month" ? { start: month, end: addMonths(month, 1) } : { start: new Date(year, 0, 1), end: new Date(year + 1, 0, 1) };
    const ref = now >= span.start && now < span.end ? now : span.start;
    const r = payCardRangeAt(cfg, view, ref, cardOffset);
    const rangeLabel = r.calendarMonth ? MONTHS[r.start.getMonth()] + " " + r.start.getFullYear() : shortDate(r.start) + " – " + shortDate(addDays(r.end, -1));
    const factor = view === "weekly" ? 52 : view === "fortnightly" ? 26 : 12;
    return { view, range: r, rangeLabel, p: computePay(data, typesById, r.start, r.end, factor) };
  }, [paySetUp, data, typesById, mode, month, year, savedView, cardOffset]);
  const cardPan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 24 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
    onPanResponderRelease: (_, g) => { if (Math.abs(g.dx) >= 50) setCardOffset((o) => o + (g.dx < 0 ? 1 : -1)); },
  }), []);

  // Part time: this pay period's rostered shifts, excess hours and overtime.
  const ptProgress = useMemo(() => {
    if (fullTime) return null;
    const pt = partTimeOf(data.settings);
    if (!pt.rostered && !pt.excessCap) return null;
    return partTimeProgress(data, typesById, new Date());
  }, [fullTime, data, typesById]);

  const openBreakdown = () => {
    if (!payCard) return;
    if (payCard.range.calendarMonth) setPayScreen({ mode: "month", anchor: payCard.range.start });
    else setPayScreen({ mode: "period", anchor: payCard.range.start });
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
    ...(fullTime && !stats.excessHours ? [] : [["Total excess hours", fmtHours(stats.excessHours) + " h"] as [string, string]]),
    ["Total overtime", fmtHours(stats.otHours) + " h"],
    ["Busiest month", busiest ? MONTHS[+String(busiest).split("-")[1] - 1] + " (" + fmtHours(busiestVal) + " h)" : "—"],
    ["Leave days taken", String(stats.leaveDays)],
  ];
  if (yearPay) {
    reviewRows.push(["Estimated gross pay", fmtMoney(yearPay.gross)]);
    if (yearPay.bestM >= 0) reviewRows.push(["Best paid month", MONTHS[yearPay.bestM] + " (" + fmtMoneyShort(yearPay.bestG) + ")"]);
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Masthead title="Reports" sub={label} right={
          <View style={{ flexDirection: "row", gap: 8 }}>
            <MastButton icon="chevron-back" a11y="Previous" onPress={() => step(-1)} />
            <MastButton icon="chevron-forward" a11y="Next" onPress={() => step(1)} />
          </View>
        } />
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        <Segmented<Mode> value={mode} onChange={setMode} options={[{ value: "month", label: "Month" }, { value: "year", label: "Year" }]} />

        <Card style={{ marginTop: 14, paddingVertical: 4, paddingHorizontal: 4 }}>
          <View style={{ flexDirection: "row" }}>
            <Figure label="Hours" value={fmtHours(stats.totalHours)} color="#4C8DFF" />
            <VLine />
            {fullTime ? null : <><Figure label="Excess" value={fmtHours(stats.excessHours)} color="#F7B3CE" /><VLine /></>}
            <Figure label="Overtime" value={fmtHours(stats.otHours)} color={OVERTIME_TYPE.color} />
            {fullTime ? <><VLine /><Figure label="Days worked" value={String(stats.daysWorked)} color="#3FC5C0" /></> : null}
          </View>
          <Divider />
          <View style={{ flexDirection: "row" }}>
            {fullTime ? null : <><Figure label="Days worked" value={String(stats.daysWorked)} color="#3FC5C0" /><VLine /></>}
            <Figure label="Leave days" value={String(stats.leaveDays)} color="#7E8B99" />
            <VLine />
            <Figure label="Est. pay" value={payCard && !locked ? fmtMoneyShort(payCard.p.gross) : "—"} color="#2FA36B" />
          </View>
        </Card>

        {ptProgress ? (
          <>
            <SectionHead title="This Pay Period" right={<Dim>{shortDate(ptProgress.period.start) + " – " + shortDate(lastDay(ptProgress.period))}</Dim>} />
            <Card style={{ gap: 12 }}>
              {ptProgress.rostered ? <Meter name="Rostered shifts" color={t.accent} value={ptProgress.rosteredDone} max={ptProgress.rostered}
                text={ptProgress.rosteredDone + " of " + ptProgress.rostered} /> : null}
              {ptProgress.excessCap ? <Meter name="Excess hours" color="#F7B3CE" value={ptProgress.excessHours} max={ptProgress.excessCap}
                text={fmtHours(ptProgress.excessHours) + " of " + fmtHours(ptProgress.excessCap) + "h"} /> : null}
              <Meter name="Overtime" color={OVERTIME_TYPE.color} value={ptProgress.otHours} max={Math.max(1, ptProgress.otHours)} text={fmtHours(ptProgress.otHours) + "h"} />
            </Card>
          </>
        ) : null}

        <SectionHead title="Estimated Pay" right={<HeadLink title="Pay Setup" onPress={() => setSetupOpen(true)} />} />
        {locked ? <LockCard text="See your estimated pay for every week, fortnight, month and year." /> : !payCard ? (
          <Card><Button small title="Set My Hourly Rate" onPress={() => setSetupOpen(true)} /></Card>
        ) : (
          <>
            <View style={{ marginBottom: 10 }}>
              <Segmented<CardView> value={payCard.view} onChange={chooseView}
                options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly" }]} />
            </View>
            <HeroCard>
              <View {...cardPan.panHandlers}>
                <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <Nav dir={-1} onHero a11y="Previous period" onPress={() => setCardOffset((o) => o - 1)} />
                  <Pressable accessibilityRole="button" accessibilityLabel="Back to current period" disabled={!cardOffset} onPress={() => setCardOffset(0)} style={{ alignItems: "center" }}>
                    <Text style={{ color: t.heroInk, fontSize: 15, fontWeight: "700" }}>{payCard.rangeLabel}</Text>
                    {cardOffset ? <Text style={{ color: t.heroDim, fontSize: 12, fontWeight: "600", marginTop: 1 }}>Back to current</Text> : null}
                  </Pressable>
                  <Nav dir={1} onHero a11y="Next period" onPress={() => setCardOffset((o) => o + 1)} />
                </View>
                <Pressable accessibilityRole="button" accessibilityLabel="Pay breakdown" onPress={openBreakdown}
                  style={({ pressed }) => ({ alignItems: "center", paddingTop: 18, paddingBottom: 4, opacity: pressed ? 0.75 : 1 })}>
                  <Text style={{ fontFamily: SERIF, color: t.heroInk, fontSize: 42, letterSpacing: -0.8, fontVariant: ["tabular-nums"] }}>{fmtMoney(payCard.p.gross)}</Text>
                  <Text style={{ color: t.heroDim, fontSize: 14, marginTop: 2 }}>{payCard.p.showTax ? "Gross · about " + fmtMoney(payCard.p.net) + " take-home" : "Gross"}</Text>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 4, marginTop: 14, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: "rgba(255,255,255,0.12)" }}>
                    <Text style={{ color: t.heroInk, fontWeight: "700", fontSize: 13 }}>Breakdown</Text>
                    <Ionicons name="chevron-forward" size={14} color={t.heroInk} />
                  </View>
                </Pressable>
              </View>
            </HeroCard>
          </>
        )}

        {locked ? (
          <>
            <SectionHead title="By Shift Type" />
            <LockCard text="Full reports are part of Premium: hours by shift type, weekday vs weekend, comparisons and year in review." />
          </>
        ) : <>
        <SectionHead title="By Shift Type" />
        <Card style={{ gap: 12 }}>
          {stats.totalHours ? rows.filter((r) => r.hours > 0).map((r, i) => (
            <Meter key={i} name={r.name} color={r.color} value={r.hours} max={maxType}
              text={fmtHours(r.hours) + "h"} sub={pct(r.hours, stats.totalHours) + "% · " + r.count + (r.count === 1 ? " shift" : " shifts")} />
          )) : <Dim>No shifts logged this period.</Dim>}
        </Card>

        <SectionHead title="Weekdays vs Weekends" />
        <Card>
          <View style={{ flexDirection: "row", height: 10, borderRadius: 5, overflow: "hidden", backgroundColor: t.surface2 }}>
            {wwTotal ? <>
              <View style={{ flex: stats.weekdayHours || 0.0001, backgroundColor: t.accent }} />
              <View style={{ width: 2, backgroundColor: t.surface }} />
              <View style={{ flex: stats.weekendHours || 0.0001, backgroundColor: "#C8975F" }} />
            </> : null}
          </View>
          <View style={{ flexDirection: "row", marginTop: 12 }}>
            <Split color={t.accent} name="Weekdays" value={fmtHours(stats.weekdayHours) + "h"} sub={pct(stats.weekdayHours, wwTotal) + "% · " + stats.weekdayCount + " shifts"} />
            <Split color="#C8975F" name="Weekends" value={fmtHours(stats.weekendHours) + "h"} sub={pct(stats.weekendHours, wwTotal) + "% · " + stats.weekendCount + " shifts"} right />
          </View>
        </Card>

        <SectionHead title={mode === "month" ? "Compared with Last Month" : "Compared with Last Year"} />
        <Card>
          <View style={{ flexDirection: "row", alignItems: "flex-end" }}>
            <Split color={t.accent} name={mode === "month" ? "This month" : "This year"} value={fmtHours(stats.totalHours) + "h"} />
            <Split color={t.textFaint} name={mode === "month" ? "Last month" : "Last year"} value={fmtHours(prev.totalHours) + "h"} right />
          </View>
          <View style={{ alignSelf: "flex-start", marginTop: 12, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, backgroundColor: (delta >= 0 ? t.good : t.danger) + "1F" }}>
            <Text style={{ fontWeight: "700", fontSize: 13, color: delta >= 0 ? t.good : t.danger }}>
              {(delta >= 0 ? "+" : "") + fmtHours(delta) + "h (" + (deltaPct >= 0 ? "+" : "") + deltaPct + "%)"}
            </Text>
          </View>
        </Card>

        {mode === "year" ? (
          <>
            <SectionHead title="Year in Review" />
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
        <Card style={{ marginTop: 24, paddingVertical: 2 }}>
          <MenuRow icon="document-text" iconColor="#5B6B82" title="PDF Roster" onPress={() => (locked ? openPaywall("PDF export is part of Premium.") : setExportOpen(true))} />
        </Card>
        </View>
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
  const { data, update } = useStore();
  const [setupOpen, setSetupOpen] = useState(false);
  const setPaid = (dateKey: string, ids: string[], paid: boolean) => update((d) => {
    ((d.payTags[dateKey] || []) as PayTag[]).forEach((x) => {
      if (ids.indexOf(x.id) === -1) return;
      if (paid) x.paid = true; else delete x.paid;
      x.updatedAt = Date.now();
    });
  });
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
    const claims = allowanceClaims(data, r.start, r.end);
    return { cfg, r, p, rate, y, months, yearTotal, max, claims };
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
    <Sheet visible={!!state} onClose={close} title="Estimated Pay">
      {state && view ? (
        <>
          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginBottom: 10 }}>
            <Button small kind="ghost" title="Pay Setup" onPress={() => setSetupOpen(true)} />
          </View>
          <Segmented<PayMode> value={state.mode} onChange={(m) => onChange({ mode: m, anchor: state.anchor })}
            options={[{ value: "period", label: "Pay period" }, { value: "month", label: "Month" }, { value: "year", label: "Year" }]} />
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginVertical: 14 }}>
            <Nav dir={-1} a11y="Previous" onPress={() => step(-1)} />
            <View style={{ alignItems: "center" }}>
              <Text style={{ color: t.text, fontSize: 17, fontWeight: "700" }}>{view.r.label}</Text>
              <Dim>{view.r.sub}</Dim>
            </View>
            <Nav dir={1} a11y="Next" onPress={() => step(1)} />
          </View>
          <HeroCard style={{ alignItems: "center", paddingVertical: 22 }}>
            <Text style={{ color: t.heroDim, fontSize: 13, fontWeight: "600" }}>Estimated gross pay</Text>
            <Text style={{ fontFamily: SERIF, color: t.heroInk, fontSize: 40, letterSpacing: -0.8, fontVariant: ["tabular-nums"], marginTop: 4 }}>{fmtMoney(view.p.gross)}</Text>
            {view.p.showTax ? <Text style={{ color: t.heroDim, fontSize: 14, marginTop: 2 }}>{"About " + fmtMoney(view.p.net) + " take-home"}</Text> : null}
          </HeroCard>

          <SectionHead title="Breakdown" />
          <Card style={{ paddingVertical: 4 }}>
            <PayLines p={view.p} superPct={view.cfg.superPct} />
          </Card>
          <Dim style={{ marginTop: 8 }}>{"Base rate " + fmtMoney(view.rate) + "/h"}</Dim>

          {view.claims.length ? (() => {
            const all = view.claims.reduce((n, c) => n + c.tags.length, 0);
            const paid = view.claims.reduce((n, c) => n + c.tags.filter((x) => x.paid).length, 0);
            return (
              <>
                <SectionHead title="Allowances" right={<Dim>{paid + " of " + all + " paid"}</Dim>} />
                <Card style={{ paddingVertical: 4 }}>
                  {view.claims.map((c, i) => {
                    const done = c.tags.every((x) => x.paid);
                    const dt = parseYmd(c.dateKey);
                    return (
                      <View key={c.dateKey + c.allowance.id}>
                        {i ? <Divider /> : null}
                        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: done }}
                          onPress={() => setPaid(c.dateKey, c.tags.map((x) => x.id), !done)}
                          style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
                          <Ionicons name={done ? "checkmark-circle" : "ellipse-outline"} size={24} color={done ? t.good : t.textFaint} />
                          <View style={{ flex: 1 }}>
                            <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{c.allowance.name + (c.tags.length > 1 ? " ×" + c.tags.length : "")}</Text>
                            <Dim>{WEEKDAYS_FULL[dt.getDay()].slice(0, 3) + " " + shortDate(dt)}</Dim>
                          </View>
                          <Text style={{ color: done ? t.textDim : t.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{fmtMoney(c.amount)}</Text>
                        </Pressable>
                      </View>
                    );
                  })}
                </Card>
              </>
            );
          })() : null}

          <SectionHead title={"By Month · " + view.y} />
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
  if (p.excess) add("Excess hours", p.excess, undefined, fmtHours(p.excessHours) + "h");
  if (p.overtime) add("Overtime", p.overtime, undefined, fmtHours(p.otHours) + "h");
  if (p.penalties) {
    add("Penalty Rates", p.penalties);
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

// One figure in the summary card.
function Figure({ label, value, color }: { label: string; value: string; color: string }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, paddingVertical: 14, paddingHorizontal: 12 }}>
      <Text numberOfLines={1} adjustsFontSizeToFit style={{ fontFamily: SERIF, color: t.text, fontSize: 24, fontVariant: ["tabular-nums"] }}>{value}</Text>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 3 }}>
        <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: color }} />
        <Text numberOfLines={1} style={{ color: t.textDim, fontSize: 12, fontWeight: "600", flexShrink: 1 }}>{label}</Text>
      </View>
    </View>
  );
}
function VLine() {
  const t = useTheme();
  return <View style={{ width: StyleSheet.hairlineWidth, backgroundColor: t.border, marginVertical: 12 }} />;
}
// A labelled row with a slim bar under it.
function Meter({ name, color, value, max, text, sub }: { name: string; color: string; value: number; max: number; text: string; sub?: string }) {
  const t = useTheme();
  return (
    <View>
      <View style={{ flexDirection: "row", alignItems: "baseline", gap: 8, marginBottom: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color, alignSelf: "center" }} />
        <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }}>{name}</Text>
        {sub ? <Text style={{ color: t.textFaint, fontSize: 12 }}>{sub}</Text> : null}
        <Text style={{ color: t.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"], minWidth: 44, textAlign: "right" }}>{text}</Text>
      </View>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.surface2, overflow: "hidden" }}>
        <View style={{ width: `${value > 0 ? Math.max(3, Math.min(100, (value / max) * 100)) : 0}%`, height: "100%", backgroundColor: color, borderRadius: 3 }} />
      </View>
    </View>
  );
}
// Half of a two-sided figure (weekdays/weekends, this/last period).
function Split({ color, name, value, sub, right }: { color: string; name: string; value: string; sub?: string; right?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ flex: 1, alignItems: right ? "flex-end" : "flex-start" }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: color }} />
        <Text style={{ color: t.textDim, fontSize: 13, fontWeight: "600" }}>{name}</Text>
      </View>
      <Text style={{ fontFamily: SERIF, color: t.text, fontSize: 24, marginTop: 2, fontVariant: ["tabular-nums"] }}>{value}</Text>
      {sub ? <Text style={{ color: t.textFaint, fontSize: 12 }}>{sub}</Text> : null}
    </View>
  );
}
function HeadLink({ title, onPress }: { title: string; onPress: () => void }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={8} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 2, opacity: pressed ? 0.6 : 1 })}>
      <Text style={{ color: t.accent, fontWeight: "700", fontSize: 14 }}>{title}</Text>
      <Ionicons name="chevron-forward" size={14} color={t.accent} />
    </Pressable>
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
      <View style={{ height: 10, borderRadius: 5, backgroundColor: t.surface2, overflow: "hidden" }}>
        <View style={{ width: `${value > 0 ? Math.max(4, Math.min(100, (value / max) * 100)) : 0}%`, height: "100%", backgroundColor: color, borderRadius: 5 }} />
      </View>
    </View>
  );
}

function Nav({ dir, onPress, a11y, onHero }: { dir: -1 | 1; onPress: () => void; a11y: string; onHero?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} hitSlop={6}
      style={({ pressed }) => ({ width: 36, height: 36, borderRadius: 18, backgroundColor: onHero ? "rgba(255,255,255,0.12)" : t.surface2, alignItems: "center", justifyContent: "center", opacity: pressed ? 0.7 : 1 })}>
      <Ionicons name={dir < 0 ? "chevron-back" : "chevron-forward"} size={18} color={onHero ? t.heroInk : t.text} />
    </Pressable>
  );
}
