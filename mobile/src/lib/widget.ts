// Data for the home screen widget: the next three weeks of shifts and leave, and
// this pay period's estimate (Premium only). Sent whenever it changes or the app reopens.
import { Platform } from "react-native";
import { WidgetBridge } from "../../modules/widget-bridge";
import { LEAVE_KINDS, MONTHS, addDays, isCombo, isSplitEntry, ymd, type ShiftType, type Snapshot } from "./model";
import { computePay, fmtMoney, payConfig, payIsSetUp, payPeriodFor, periodsPerYear } from "./pay";

const short = (d: Date) => d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);

export function widgetData(d: Snapshot, typesById: { [id: string]: ShiftType }, showPay: boolean, now = new Date()) {
  const from = ymd(now), to = ymd(addDays(now, 21));
  const shifts: { d: string; name: string; start: string | null; end: string | null; color: string; ink: string; tag?: string }[] = [];
  Object.keys(d.shifts || {}).filter((k) => k >= ymd(addDays(now, -1)) && k < to).sort().forEach((k) => {
    (d.shifts[k] || []).forEach((e) => {
      const t = typesById[e.typeId];
      if (!t || t.kind === "personal") return;
      const base = e.baseTypeId ? typesById[e.baseTypeId] : null;
      const shown = isCombo(e.typeId) ? base || t : t;
      const tag = isCombo(e.typeId) ? (isSplitEntry(e) ? "Excess + OT" : e.typeId === "overtime" ? "Overtime" : "Excess") : undefined;
      shifts.push({ d: k, name: shown.name, start: shown.startTime || null, end: shown.endTime || null, color: shown.color, ink: shown.ink, ...(tag ? { tag } : {}) });
    });
  });
  Object.keys(d.leave || {}).filter((k) => k >= from && k < to).forEach((k) => {
    (d.leave[k] || []).forEach((l) => {
      const def = LEAVE_KINDS[l.kind];
      if (!def) return;
      const bt = l.baseTypeId ? typesById[l.baseTypeId] : null;
      shifts.push({ d: k, name: bt ? bt.name : def.label, start: null, end: null, color: bt ? bt.color : def.color, ink: bt ? bt.ink : def.ink, tag: l.kind === "sick" ? "Sick leave" : "Annual leave" });
    });
  });
  let pay: { label: string; gross: string } | null = null;
  if (showPay && payIsSetUp(d.settings)) {
    const cfg = payConfig(d.settings);
    const p = payPeriodFor(cfg, now);
    const r = computePay(d, typesById, p.start, p.end, periodsPerYear(cfg));
    pay = { label: "Pay " + short(p.start) + " – " + short(addDays(p.end, -1)), gross: fmtMoney(r.gross) };
  }
  return { shifts, pay };
}

let last = "";
export function syncWidget(d: Snapshot, typesById: { [id: string]: ShiftType }, showPay: boolean) {
  if (Platform.OS !== "ios" || !WidgetBridge) return;
  const json = JSON.stringify(widgetData(d, typesById, showPay));
  if (json === last) return;
  last = json;
  WidgetBridge.setData(json).catch(() => { last = ""; });
}
