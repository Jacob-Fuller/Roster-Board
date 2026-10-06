// Checks the native pay engine and pay setup saving against the web app's own
// code (../index.html) on random settings and shifts. Run: npm test
import { readFileSync } from "node:fs";
import {
  annualTaxEstimate, computePay, fmtMoney, fmtMoneyShort, payConfig, payFormFromConfig, payIsSetUp, payPeriodFor,
  payPeriodIsAlt, paySetupDraft, paySummaries, savePaySetup, shiftPayPeriod, workTypes, type PayForm,
} from "./pay.ts";
import { EXCESS_TYPE, OVERTIME_TYPE, addDays, ymd, type ShiftType } from "./model.ts";

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const cut = (a: string, b: string) => {
  const i = html.indexOf(a), j = html.indexOf(b, i);
  if (i < 0 || j < 0) throw new Error("could not find " + a);
  return html.slice(i, j);
};
const engineSrc = cut("  /* ---------------- pay estimate ---------------- */", "  /* ---- reports: compact pay card");
const setupSrc = cut("  /* ---- Pay setup screen ---- */", "  document.getElementById(\"payRatesBtn\")");

// A tiny fake DOM, enough for the web's pay setup screen.
function fakeEl(): any {
  const el: any = {
    checked: false, textContent: "", style: {}, children: [] as any[], listeners: {} as any,
    classList: { toggle() {}, add() {}, remove() {}, contains: () => false },
    addEventListener(ev: string, fn: any) { el.listeners[ev] = fn; },
    appendChild(c: any) { el.children.push(c); return c; },
    focus() {}, getAttribute: () => null,
  };
  Object.defineProperty(el, "innerHTML", { set() { el.children = []; }, get() { return ""; } });
  let value = ""; // inputs keep their value as a string, like the real DOM
  Object.defineProperty(el, "value", { set(v: unknown) { value = String(v); }, get() { return value; } });
  return el;
}
const makeWeb = new Function("state", "document", "toast", `
  var OVERTIME_ID = "overtime", EXCESS_ID = "excess_hours";
  function pad2(n){ return n < 10 ? "0"+n : ""+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
  function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); }
  function parseYmd(s){ var p = s.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  function fmtHours(h){ return (Math.round(h*10)/10).toString(); }
  function hintEl(t){ var d = document.createElement("div"); d.textContent = t; return d; }
  function entryOTHours(entry){ return entry.typeId === OVERTIME_ID ? (entry.hours || 0) : 0; }
  function entryExcessHours(entry){
    if (entry.typeId === EXCESS_ID) return entry.hours || 0;
    if (entry.typeId === OVERTIME_ID) return entry.excessHours || 0;
    return 0;
  }
  function effectiveHours(entry){
    if (entry.typeId === OVERTIME_ID && entry.excessHours > 0) return (entry.hours || 0) + entry.excessHours;
    if (entry.hours != null) return entry.hours;
    var t = state.typesById[entry.typeId];
    return t ? (t.hours || 0) : 0;
  }
  function saveStore(){} function renderAll(){} function renderPayScreen(){}
  ${engineSrc}
  ${setupSrc}
  return { payConfig: payConfig, payIsSetUp: payIsSetUp, computePay: computePay, fmtMoney: fmtMoney, fmtMoneyShort: fmtMoneyShort,
    payPeriodFor: payPeriodFor, payPeriodIsAlt: payPeriodIsAlt, shiftPayPeriod: shiftPayPeriod, annualTaxEstimate: annualTaxEstimate,
    openPaySetup: openPaySetup, updatePaySummaries: updatePaySummaries,
    draft: function(){ return paySetupDraft; }, setCycle: function(c){ paySetupDraft.cycle = c; } };`);

let seed = 11;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const maybe = <T,>(p: number, v: () => T): T | undefined => (rnd() < p ? v() : undefined);
const money = () => Math.round(rnd() * 6000) / 100;
const fail = (what: string, i: number, a: unknown, b: unknown) => {
  console.error("pay MISMATCH (" + what + ") case " + i + "\n mine: " + JSON.stringify(a) + "\n web:  " + JSON.stringify(b));
  process.exit(1);
};
const today = new Date();
const dayKey = (n: number) => ymd(addDays(new Date(2026, 0, 1), n));

const types: ShiftType[] = [
  { id: "a", name: "Day", color: "#E5484D", ink: "#FFF", hours: 8 },
  { id: "b", name: "Night", color: "#4C8DFF", ink: "#FFF", hours: 10.5 },
  { id: "c", name: "Long", color: "#3ECF8E", ink: "#000", hours: 12 },
  { id: "p", name: "Gym", color: "#7E8B99", ink: "#FFF", kind: "personal" },
];
const typesById: { [id: string]: ShiftType } = { overtime: OVERTIME_TYPE, excess_hours: EXCESS_TYPE };
types.forEach((t) => { typesById[t.id] = t; });

function randomSettings(): any {
  const allowances = Array.from({ length: Math.floor(rnd() * 3) }, (_, i) => ({
    id: "al" + i, name: pick(["Meal", "Laundry", "Travel", "On call"]), kind: pick(["hours", "flat", undefined]),
    amount: pick([money(), "3.5", "x", undefined]),
  }));
  const pay: any = rnd() < 0.15 ? undefined : {
    baseRate: maybe(0.9, () => pick([money(), String(money()), 0])),
    rises: maybe(0.3, () => [{ from: dayKey(Math.floor(rnd() * 400) - 100), rate: money() }, { from: ymd(addDays(today, 30)), rate: 99 }, { from: "", rate: 5 }]),
    cycle: maybe(0.9, () => pick(["weekly", "fortnightly", "monthly"])),
    periodStart: maybe(0.6, () => pick(["", dayKey(Math.floor(rnd() * 500) - 200), "2025-01-31", "2026-03-30"])),
    otMult: maybe(0.7, () => pick([1.5, 2, "1.75", "abc"])), otTiered: maybe(0.6, () => rnd() < 0.5),
    otTierHours: maybe(0.6, () => pick([0, 2, 3, "4", -1])), otMult2: maybe(0.6, () => pick([2, 2.5, "x"])),
    exMult: maybe(0.6, () => pick([1, 1.25, "0"])),
    pen: maybe(0.8, () => ({ sat: maybe(0.7, () => pick([0, 25, 50, "50"])), sun: maybe(0.7, () => pick([0, 75, 100])),
      ph: maybe(0.7, () => pick([0, 150, 250])), night: maybe(0.7, () => pick([0, 15, "30"])) })),
    typeRules: maybe(0.8, () => {
      const r: any = {};
      ["a", "b", "c"].forEach((id) => { if (rnd() < 0.7) r[id] = {
        penalties: maybe(0.6, () => rnd() < 0.5), night: maybe(0.6, () => rnd() < 0.5),
        allowanceKind: maybe(0.7, () => pick(["none", "pct", "flat"])), allowance: maybe(0.7, () => pick([10, 31.5, "12", 0])),
      }; });
      return r;
    }),
    allowances: maybe(0.8, () => allowances),
    payLeave: maybe(0.7, () => rnd() < 0.7), leaveLoading: maybe(0.6, () => pick([0, 17.5, "10"])),
    superPct: maybe(0.7, () => pick([0, 11.5, 12, "12"])), showTax: maybe(0.8, () => rnd() < 0.7), taxFree: maybe(0.8, () => rnd() < 0.6),
    savedAt: maybe(0.7, () => Math.floor(rnd() * 100)),
  };
  const st: any = { hourlyRate: maybe(0.8, () => pick([0, money(), String(money())])), updatedAt: maybe(0.8, () => Math.floor(rnd() * 100)) };
  if (rnd() < 0.5) st.otMultiplier = pick([1.5, 2, "1.25"]);
  if (rnd() < 0.5) st.excessMultiplier = pick([1, 1.5]);
  if (rnd() < 0.5) st.payLeave = rnd() < 0.5;
  if (pay) { Object.keys(pay).forEach((k) => pay[k] === undefined && delete pay[k]); st.pay = pay; }
  if (rnd() < 0.3 && st.pay) st.hourlyRate = st.pay.baseRate;
  return { st, allowances };
}

function randomData(allowances: any[]) {
  const shifts: any = {}, leave: any = {}, payTags: any = {};
  for (let n = -40; n < 420; n++) {
    const k = dayKey(n), r = rnd();
    if (r < 0.45) shifts[k] = [{ id: "s" + n, typeId: pick(["a", "b", "c"]), hours: maybe(0.2, () => pick([4, 6.5, 0])) }];
    else if (r < 0.5) shifts[k] = [{ id: "p" + n, typeId: "p" }];
    if (rnd() < 0.08) (shifts[k] ||= []).push({ id: "o" + n, typeId: "overtime", hours: pick([1, 2.5, 4, 6]), excessHours: maybe(0.3, () => pick([1, 2])) });
    if (rnd() < 0.05) (shifts[k] ||= []).push({ id: "x" + n, typeId: "excess_hours", hours: maybe(0.7, () => pick([1, 3])) });
    if (rnd() < 0.02) (shifts[k] ||= []).push({ id: "d" + n, typeId: "deleted" });
    if (rnd() < 0.06) leave[k] = [{ id: "l" + n, kind: pick(["annual", "sick", "excess", "other"]), hours: maybe(0.8, () => pick([7.6, 8, "8", 4])) }];
    if (rnd() < 0.08) {
      const tags: any[] = [];
      if (rnd() < 0.5) tags.push({ id: "h" + n, kind: "holiday" });
      if (rnd() < 0.6) tags.push({ id: "t" + n, kind: "allowance", allowanceId: allowances.length && rnd() < 0.85 ? pick(allowances).id : "gone" });
      payTags[k] = tags;
    }
  }
  return { shifts, leave, payTags };
}

const CASES = 400;
const realNow = Date.now;
for (let i = 0; i < CASES; i++) {
  const { st, allowances } = randomSettings();
  const data = randomData(allowances);
  const snap: any = { ...data, settings: structuredClone(st) };
  const webState: any = { ...structuredClone(data), settings: structuredClone(st), types, typesById };
  const els: { [id: string]: any } = {};
  const doc = { getElementById: (id: string) => (els[id] ||= fakeEl()), createElement: () => fakeEl(), querySelectorAll: () => [] as any[] };
  let toasted = "";
  const web = makeWeb(webState, doc, (m: string) => { toasted = m; });

  // settings reading
  const mineCfg = payConfig(snap.settings), webCfg = web.payConfig();
  if (JSON.stringify(mineCfg) !== JSON.stringify(webCfg)) fail("payConfig", i, mineCfg, webCfg);
  if (payIsSetUp(snap.settings) !== web.payIsSetUp()) fail("payIsSetUp", i, payIsSetUp(snap.settings), web.payIsSetUp());

  // periods
  for (let j = 0; j < 20; j++) {
    const d = addDays(new Date(2025, 6, 1), Math.floor(rnd() * 700));
    const a = payPeriodFor(mineCfg, d), b = web.payPeriodFor(webCfg, d);
    if (+a.start !== +b.start || +a.end !== +b.end) fail("payPeriodFor", i, a, b);
    if (payPeriodIsAlt(mineCfg, d) !== web.payPeriodIsAlt(webCfg, d)) fail("payPeriodIsAlt", i, ymd(d), null);
    const dir = rnd() < 0.5 ? 1 : -1;
    const sa = shiftPayPeriod(mineCfg, a, dir), sb = web.shiftPayPeriod(webCfg, b, dir);
    if (+sa.start !== +sb.start || +sa.end !== +sb.end) fail("shiftPayPeriod", i, sa, sb);
  }

  // computePay over months, years, pay periods and odd ranges
  const ranges: [Date, Date, number | undefined][] = [
    [new Date(2026, 0, 1), new Date(2027, 0, 1), 1],
    [new Date(2025, 11, 1), new Date(2026, 11, 1), undefined],
  ];
  for (let m = 0; m < 12; m++) ranges.push([new Date(2026, m, 1), new Date(2026, m + 1, 1), 12]);
  for (let j = 0; j < 6; j++) {
    const s = addDays(new Date(2026, 0, 1), Math.floor(rnd() * 380) - 20);
    ranges.push([s, addDays(s, pick([7, 14, 30])), pick([52, 26, 12, 1, undefined])]);
  }
  for (const [s, e, f] of ranges) {
    const a = computePay(snap, typesById, s, e, f), b = web.computePay(s, e, f);
    if (JSON.stringify(a) !== JSON.stringify(b)) fail("computePay " + ymd(s) + ".." + ymd(e), i, a, b);
    if (fmtMoney(a.gross) !== web.fmtMoney(b.gross) || fmtMoney(a.net) !== web.fmtMoney(b.net)) fail("fmtMoney", i, a.gross, b.gross);
    if (fmtMoneyShort(a.gross) !== web.fmtMoneyShort(b.gross)) fail("fmtMoneyShort", i, a.gross, b.gross);
  }
  for (let j = 0; j < 10; j++) {
    const inc = rnd() * 260000, tf = rnd() < 0.5;
    if (annualTaxEstimate(inc, tf) !== web.annualTaxEstimate(inc, tf)) fail("annualTaxEstimate", i, inc, tf);
    const v = rnd() < 0.5 ? rnd() * 50000 : -rnd() * 100;
    if (fmtMoney(v) !== web.fmtMoney(v) || fmtMoneyShort(v) !== web.fmtMoneyShort(v)) fail("fmtMoney value", i, v, null);
  }

  // pay setup: open, fill in, summaries, save
  web.openPaySetup();
  const draft = paySetupDraft(snap.settings, types);
  if (JSON.stringify(draft) !== JSON.stringify(web.draft())) fail("setup draft", i, draft, web.draft());
  const form: PayForm = payFormFromConfig(draft);
  const ids: [keyof PayForm, string][] = [
    ["baseRate", "psBaseRate"], ["periodStart", "psPeriodStart"], ["otMult", "psOtMult"], ["otTiered", "psOtTiered"],
    ["otTierHours", "psOtTierHours"], ["otMult2", "psOtMult2"], ["exMult", "psExMult"], ["penSat", "psPenSat"],
    ["penSun", "psPenSun"], ["penNight", "psPenNight"], ["payLeave", "psPayLeave"], ["leaveLoading", "psLeaveLoading"],
    ["superPct", "psSuper"], ["showTax", "psShowTax"], ["taxFree", "psTaxFree"],
  ];
  const webForm = () => {
    const o: any = {};
    ids.forEach(([k, id]) => { o[k] = typeof form[k] === "boolean" ? els[id].checked : String(els[id].value); });
    return o;
  };
  if (JSON.stringify(form) !== JSON.stringify(webForm())) fail("setup form", i, form, webForm());
  // the person edits some fields
  ids.forEach(([k, id]) => {
    if (rnd() < 0.3) {
      if (typeof form[k] === "boolean") { const v = rnd() < 0.5; (form as any)[k] = v; els[id].checked = v; }
      else { const v = pick(["", "0", "-3", "abc", "1.5", "17.5", "42.25", "2026-02-14"]); (form as any)[k] = v; els[id].value = v; }
    }
  });
  if (rnd() < 0.5) { const c = pick(["weekly", "fortnightly", "monthly"]) as any; draft.cycle = c; web.setCycle(c); }
  web.updatePaySummaries();
  const sums = paySummaries(form, draft.cycle, workTypes(types).length);
  const webSums = { rate: els.psSumRate.textContent, cycle: els.psSumCycle.textContent, ot: els.psSumOt.textContent, pen: els.psSumPen.textContent,
    types: els.psSumTypes.textContent, leave: els.psSumLeave.textContent, tax: els.psSumTax.textContent };
  if (JSON.stringify(sums) !== JSON.stringify(webSums)) fail("summaries", i, sums, webSums);

  Date.now = () => 1234567890;
  const err = savePaySetup(snap.settings, draft, form, Date.now());
  els.paySetupSave.listeners.click();
  Date.now = realNow;
  if ((err || "") !== toasted.replace("Pay setup saved", "")) fail("save error", i, err, toasted);
  if (JSON.stringify(snap.settings) !== JSON.stringify(webState.settings)) fail("saved settings", i, snap.settings, webState.settings);
  const a = computePay(snap, typesById, new Date(2026, 0, 1), new Date(2027, 0, 1), 1);
  const b = web.computePay(new Date(2026, 0, 1), new Date(2027, 0, 1), 1);
  if (JSON.stringify(a) !== JSON.stringify(b)) fail("computePay after save", i, a, b);
}
console.log("pay matches the web app on " + CASES + " random cases");
