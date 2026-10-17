// Part-time hours: rostered shifts per pay period, then additional shifts.
// Additional shifts count as excess hours until the pay period's excess limit
// is reached (e.g. 28h a fortnight); anything after that is overtime.
//
// An additional shift is stored like any excess/overtime entry, plus `addl`
// (its total hours). Whenever shifts or the setup change, every additional
// shift in the pay period is re-split in date order, so the calendar, reports
// and pay estimate always show the right excess/overtime split.
import {
  EXCESS_ID, OVERTIME_ID, addDays, entryExcessHours, entryOTHours, parseYmd, ymd,
  type ShiftEntry, type ShiftType, type Snapshot,
} from "./model.ts";
import { num, payConfig, payPeriodFor, type DateRange } from "./pay.ts";

export type PartTime = { rostered: number; excessCap: number };
type Settings = Snapshot["settings"];

export function partTimeOf(settings: Settings | null | undefined): PartTime {
  const p: { [k: string]: any } = (settings && settings.partTime) || {};
  return { rostered: Math.max(0, Math.round(num(p.rostered, 0))), excessCap: Math.max(0, num(p.excessCap, 0)) };
}
export const autoSplitOn = (settings: Settings | null | undefined) =>
  !!settings && settings.employment !== "full" && partTimeOf(settings).excessCap > 0;

// Same split rule as the day sheet: overtime keeps any excess on the same entry.
export function applySplit(e: any, ot: number, ex: number) {
  if (ot > 0) { e.typeId = OVERTIME_ID; e.hours = ot; if (ex > 0) e.excessHours = ex; else delete e.excessHours; }
  else { e.typeId = EXCESS_ID; e.hours = ex; delete e.excessHours; }
  e.updatedAt = Date.now();
}

const round2 = (v: number) => Math.round(v * 100) / 100;

// Re-split the additional shifts in one pay period. Returns true if anything changed.
function rebalancePeriod(d: Snapshot, period: DateRange, cap: number): boolean {
  const sKey = ymd(period.start), eKey = ymd(period.end);
  let used = 0, changed = false;
  Object.keys(d.shifts || {}).filter((k) => k >= sKey && k < eKey).sort().forEach((k) => {
    (d.shifts[k] || []).forEach((e: any) => {
      if (e.addl > 0) {
        const total = num(e.addl, 0);
        const ex = round2(Math.min(total, Math.max(0, cap - used)));
        const ot = round2(total - ex);
        used += ex;
        if (round2(entryExcessHours(e)) !== ex || round2(entryOTHours(e)) !== ot) { applySplit(e, ot, ex); changed = true; }
      } else used += entryExcessHours(e);
    });
  });
  return changed;
}

// The pay periods holding these dates are re-split. With autoSplit off, additional
// shifts go back to being all excess hours.
export function rebalanceExtras(d: Snapshot, dateKeys: string[]) {
  const cfg = payConfig(d.settings);
  const cap = autoSplitOn(d.settings) ? partTimeOf(d.settings).excessCap : Infinity;
  const seen: { [k: string]: true } = {};
  dateKeys.filter(Boolean).forEach((k) => {
    const p = payPeriodFor(cfg, parseYmd(k));
    const id = ymd(p.start);
    if (seen[id]) return;
    seen[id] = true;
    rebalancePeriod(d, p, cap);
  });
}
// After the setup changes: every pay period with an additional shift.
export function rebalanceAllExtras(d: Snapshot) {
  const keys = Object.keys(d.shifts || {}).filter((k) => (d.shifts[k] || []).some((e: any) => e.addl > 0));
  rebalanceExtras(d, keys);
}

/* ---------- this pay period at a glance ---------- */
export type PartTimeProgress = {
  period: DateRange; rosteredDone: number; rostered: number; excessHours: number; excessCap: number; otHours: number;
};
export function partTimeProgress(d: Pick<Snapshot, "shifts" | "settings">, typesById: { [id: string]: ShiftType }, ref: Date): PartTimeProgress {
  const cfg = payConfig(d.settings);
  const pt = partTimeOf(d.settings);
  const period = payPeriodFor(cfg, ref);
  const sKey = ymd(period.start), eKey = ymd(period.end);
  let rosteredDone = 0, excessHours = 0, otHours = 0;
  Object.keys(d.shifts || {}).forEach((k) => {
    if (k < sKey || k >= eKey) return;
    (d.shifts[k] || []).forEach((e: ShiftEntry) => {
      const t = typesById[e.typeId];
      if (!t || t.kind === "personal") return;
      if (e.typeId === OVERTIME_ID || e.typeId === EXCESS_ID) { excessHours += entryExcessHours(e); otHours += entryOTHours(e); return; }
      rosteredDone++;
    });
  });
  return { period, rosteredDone, rostered: pt.rostered, excessHours, excessCap: pt.excessCap, otHours };
}
export const lastDay = (r: DateRange) => addDays(r.end, -1);
