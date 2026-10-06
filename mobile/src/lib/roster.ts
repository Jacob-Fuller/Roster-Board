// Roster pattern rules, ported from the web app (index.html, "roster").
import { addDays, isCombo, mkId, mondayIndex, parseYmd, ymd, type ShiftType, type Snapshot } from "./model.ts";

export function ensurePatternShape(d: Snapshot) {
  const weeks = Math.max(1, Math.min(52, d.roster.weeks || 1));
  const pattern = d.roster.pattern || [];
  while (pattern.length < weeks) pattern.push([[], [], [], [], [], [], []]);
  pattern.length = weeks;
  pattern.forEach((w) => { while (w.length < 7) w.push([]); });
  d.roster.weeks = weeks;
  d.roster.pattern = pattern;
}

export const patternHasContent = (d: Snapshot) => d.roster.pattern.some((w) => w.some((day) => day && day.length));

// One-time stamp of the repeating pattern onto the calendar. Days changed by
// hand (overtime/excess, shift notes, swaps, leave) are left alone, and
// personal entries are kept. Returns how many days were filled.
export function applyRosterPattern(d: Snapshot, typesById: { [id: string]: ShiftType }, startVal: string, months: number, tomb: (id: string) => void) {
  ensurePatternShape(d);
  const start = parseYmd(startVal);
  const lastDayOfEndMonth = new Date(start.getFullYear(), start.getMonth() + months + 1, 0).getDate();
  const end = new Date(start.getFullYear(), start.getMonth() + months, Math.min(start.getDate(), lastDayOfEndMonth));
  const weeks = d.roster.weeks;
  const patternStart = addDays(start, -mondayIndex(start.getDay()));
  let filled = 0;
  let cur = new Date(start);
  while (cur < end) {
    const diffDays = Math.round((cur.getTime() - patternStart.getTime()) / 86400000);
    const total = ((diffDays % (weeks * 7)) + weeks * 7) % (weeks * 7);
    const wi = Math.floor(total / 7), di = mondayIndex(cur.getDay());
    const typeIds = ((d.roster.pattern[wi] && d.roster.pattern[wi][di]) || []).filter((tid) => typesById[tid]);
    const key = ymd(cur);
    const existing = d.shifts[key] || [];
    const handEdited = (d.swaps[key] && d.swaps[key].length) || (d.leave[key] && d.leave[key].length) ||
      existing.some((e) => isCombo(e.typeId) || e.tag);
    if (!handEdited) {
      const keep = existing.filter((e) => {
        const et = typesById[e.typeId];
        if (et && et.kind === "personal") return true;
        tomb(e.id);
        return false;
      });
      const next = typeIds.map((tid) => ({ id: mkId(), typeId: tid })).concat(keep);
      if (next.length) d.shifts[key] = next; else delete d.shifts[key];
      filled++;
    }
    cur = addDays(cur, 1);
  }
  return filled;
}
