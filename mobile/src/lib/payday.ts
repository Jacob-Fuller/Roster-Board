// Payday reminder: when a pay period ends, a notification gives the estimate for
// it and how many of its allowances haven't been ticked off as paid yet.
import { MONTHS, addDays, type ShiftType, type Snapshot } from "./model";
import { allowanceClaims, computePay, fmtMoney, payConfig, payIsSetUp, payPeriodFor, periodsPerYear, shiftPayPeriod } from "./pay";

export type ScheduledNote = { id: string; at: Date; title: string; body: string; data?: { [k: string]: string } };
const short = (d: Date) => d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3);

// The current pay period and the next two, each announced at 9am on the day after it ends.
export function paydayNotes(d: Snapshot, typesById: { [id: string]: ShiftType }, now = new Date()): ScheduledNote[] {
  if (!payIsSetUp(d.settings)) return [];
  const cfg = payConfig(d.settings);
  if (!cfg.paydayReminder) return [];
  const out: ScheduledNote[] = [];
  let p = payPeriodFor(cfg, now);
  for (let i = 0; i < 3; i++) {
    const at = new Date(p.end.getFullYear(), p.end.getMonth(), p.end.getDate(), 9, 0, 0);
    if (at.getTime() > now.getTime()) {
      const pay = computePay(d, typesById, p.start, p.end, periodsPerYear(cfg));
      const unpaid = allowanceClaims(d, p.start, p.end).reduce((n, c) => n + c.tags.filter((x) => !x.paid).length, 0);
      const bits = ["About " + fmtMoney(pay.gross) + " gross" + (pay.showTax ? ", " + fmtMoney(pay.net) + " take-home" : "")];
      if (unpaid) bits.push(unpaid + (unpaid === 1 ? " allowance" : " allowances") + " to check on your payslip");
      out.push({ id: "payday-" + at.getTime(), at, title: "Pay period " + short(p.start) + " – " + short(addDays(p.end, -1)), body: bits.join(". ") + ".", data: { open: "owed" } });
    }
    p = shiftPayPeriod(cfg, p, 1);
  }
  return out;
}
