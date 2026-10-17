// Additional shifts: excess until the pay period's limit, then overtime.
import { rebalanceExtras, rebalanceAllExtras, partTimeProgress } from "./partTime.ts";
import { computePay, allowanceClaims, payCardRangeAt, payConfig } from "./pay.ts";
import { emptySnapshot, OVERTIME_TYPE, EXCESS_TYPE, EXCESS_ID, OVERTIME_ID, entryExcessHours, entryOTHours, ymd } from "./model.ts";

let fails = 0;
const eq = (a: any, b: any, m: string) => { if (JSON.stringify(a) !== JSON.stringify(b)) { fails++; console.log("FAIL", m, JSON.stringify(a), "!=", JSON.stringify(b)); } };

const d: any = emptySnapshot();
d.types = [{ id: "day", name: "Day", color: "#000", ink: "#fff", hours: 10 }];
d.settings = { hourlyRate: 0, employment: "part", partTime: { rostered: 4, excessCap: 28 },
  pay: { baseRate: 40, cycle: "fortnightly", periodStart: "2026-10-05", savedAt: 1, allowances: [{ id: "mm", name: "Missed meal", kind: "flat", amount: 20, max: 2 }] }, updatedAt: 1 };
const add = (k: string, e: any) => { (d.shifts[k] = d.shifts[k] || []).push(e); rebalanceExtras(d, [k]); };
["2026-10-05", "2026-10-06", "2026-10-12", "2026-10-13"].forEach((k, i) => add(k, { id: "r" + i, typeId: "day" }));
add("2026-10-08", { id: "a", typeId: EXCESS_ID, hours: 10, addl: 10, baseTypeId: "day" });
add("2026-10-09", { id: "b", typeId: EXCESS_ID, hours: 10, addl: 10, baseTypeId: "day" });
add("2026-10-15", { id: "c", typeId: EXCESS_ID, hours: 12, addl: 12, baseTypeId: "day" });
const c = d.shifts["2026-10-15"][0];
eq([c.typeId, entryExcessHours(c), entryOTHours(c)], [OVERTIME_ID, 8, 4], "third shift splits 8 excess + 4 OT");
// an earlier extra added later pushes the later one further into overtime
add("2026-10-07", { id: "z", typeId: EXCESS_ID, hours: 5, addl: 5, baseTypeId: "day" });
eq([entryExcessHours(c), entryOTHours(c)], [3, 9], "reflows in date order");
// next fortnight starts fresh
add("2026-10-20", { id: "n", typeId: EXCESS_ID, hours: 10, addl: 10, baseTypeId: "day" });
eq(d.shifts["2026-10-20"][0].typeId, EXCESS_ID, "new period is excess");
const typesById: any = { day: d.types[0], [OVERTIME_ID]: OVERTIME_TYPE, [EXCESS_ID]: EXCESS_TYPE };
const pr = partTimeProgress(d, typesById, new Date(2026, 9, 10));
eq([pr.rosteredDone, pr.excessHours, pr.otHours], [4, 28, 9], "progress");
// switching to full time puts additional shifts back to excess
d.settings.employment = "full"; rebalanceAllExtras(d);
eq([entryExcessHours(c), entryOTHours(c)], [12, 0], "cap off");
d.settings.employment = "part"; rebalanceAllExtras(d);
// allowances
d.payTags["2026-10-05"] = [{ id: "t1", kind: "allowance", allowanceId: "mm" }, { id: "t2", kind: "allowance", allowanceId: "mm", paid: true }];
const p = computePay(d, typesById, new Date(2026, 9, 5), new Date(2026, 9, 19), 26);
eq(p.allowances, 40, "allowances in pay");
const cl = allowanceClaims(d, new Date(2026, 9, 5), new Date(2026, 9, 19));
eq([cl.length, cl[0].amount, cl[0].tags.length], [1, 40, 2], "claims");
eq(p.excessHours, 28, "pay excess hours"); eq(p.otHours, 9, "pay ot hours");
// card ranges
const cfg = payConfig(d.settings);
const r = payCardRangeAt(cfg, "fortnightly", new Date(2026, 9, 10), 1);
eq([ymd(r.start), ymd(r.end)], ["2026-10-19", "2026-11-02"], "next fortnight");
const m = payCardRangeAt(cfg, "monthly", new Date(2026, 9, 10), -1);
eq([ymd(m.start), m.calendarMonth], ["2026-09-01", true], "previous month");
console.log(fails ? fails + " part-time checks failed" : "part-time, allowances and pay card ranges: all checks pass");
if (fails) process.exit(1);
