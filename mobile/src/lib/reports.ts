// Report totals, ported from the web app's collectPeriodStats (index.html).
import {
  EXCESS_ID, OVERTIME_ID, OVERTIME_TYPE, effectiveHours, entryExcessHours, entryOTHours, isCombo, parseYmd,
  type ShiftType, type Snapshot,
} from "./model.ts";

export type TypeRow = { name: string; color: string; count: number; hours: number; rank: number };
export type PeriodStats = {
  byType: { [id: string]: TypeRow }; daysWorked: number; totalHours: number; otHours: number; excessHours: number;
  weekdayHours: number; weekendHours: number; weekdayCount: number; weekendCount: number;
  leaveDays: number; leaveHours: number; monthTotals: { [ym: string]: number };
};

export function collectPeriodStats(d: Snapshot, typesById: { [id: string]: ShiftType }, start: Date, end: Date): PeriodStats {
  const byType: { [id: string]: TypeRow } = {};
  const days: { [k: string]: true } = {};
  const monthTotals: { [k: string]: number } = {};
  let totalHours = 0, otHours = 0, excessHours = 0, weekdayHours = 0, weekendHours = 0, weekdayCount = 0, weekendCount = 0;
  const exRow = () => (byType[EXCESS_ID] = byType[EXCESS_ID] || { name: "Excess", color: "#F7B3CE", count: 0, hours: 0, rank: 1 });
  const otRow = () => (byType[OVERTIME_ID] = byType[OVERTIME_ID] || { name: OVERTIME_TYPE.name, color: OVERTIME_TYPE.color, count: 0, hours: 0, rank: 2 });

  Object.keys(d.shifts).forEach((key) => {
    const date = parseYmd(key);
    if (date < start || date >= end) return;
    (d.shifts[key] || []).forEach((s) => {
      const t = typesById[s.typeId];
      if (!t || t.kind === "personal") return;
      const h = effectiveHours(s, typesById);
      if (isCombo(s.typeId)) {
        let exH = entryExcessHours(s), otH = entryOTHours(s);
        if (!exH && !otH) { if (s.typeId === EXCESS_ID) exH = h; else otH = h; }
        if (exH) { const r = exRow(); r.count++; r.hours += exH; }
        if (otH) { const r = otRow(); r.count++; r.hours += otH; }
      } else {
        const r = (byType[s.typeId] = byType[s.typeId] || { name: t.name, color: t.color, count: 0, hours: 0, rank: 0 });
        r.count++; r.hours += h;
      }
      totalHours += h;
      otHours += entryOTHours(s);
      excessHours += entryExcessHours(s);
      days[key] = true;
      const wd = date.getDay();
      if (wd === 0 || wd === 6) { weekendHours += h; weekendCount++; } else { weekdayHours += h; weekdayCount++; }
      const mk = key.slice(0, 7);
      monthTotals[mk] = (monthTotals[mk] || 0) + h;
    });
  });

  let leaveDays = 0, leaveHours = 0, oldExcess = 0;
  Object.keys(d.leave).forEach((key) => {
    const date = parseYmd(key);
    if (date < start || date >= end) return;
    if ((d.leave[key] || []).length) leaveDays++;
    (d.leave[key] || []).forEach((l) => {
      const h = l.hours != null ? l.hours : 0;
      leaveHours += h;
      if (l.kind === "excess") oldExcess += h;
    });
  });
  if (oldExcess > 0) exRow().hours += oldExcess; // older excess entries saved as leave

  return { byType, daysWorked: Object.keys(days).length, totalHours, otHours, excessHours, weekdayHours, weekendHours,
    weekdayCount, weekendCount, leaveDays, leaveHours, monthTotals };
}
