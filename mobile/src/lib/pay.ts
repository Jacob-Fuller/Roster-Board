// Pay estimate, ported from the web app (index.html, "pay estimate").
// Everything about pay lives in settings.pay (synced with the rest of the
// settings). Older versions stored hourlyRate / otMultiplier /
// excessMultiplier / payLeave directly on settings; those are still read as
// defaults and kept up to date so an older copy of the app keeps working.
// The numbers must match the web app exactly (see pay.test.ts).
import {
  EXCESS_ID, OVERTIME_ID, addDays, effectiveHours, entryExcessHours, entryOTHours, parseYmd, ymd,
  type Rec, type ShiftType, type Snapshot,
} from "./model.ts";

export type PayCycle = "weekly" | "fortnightly" | "monthly";
export type PayPenalties = { sat: number; sun: number; ph: number; night: number };
export type PayTypeRule = { penalties?: boolean; night?: boolean; allowanceKind?: "none" | "pct" | "flat"; allowance?: number };
// An allowance paid on days tagged with it ("hours" = that many hours at the base rate, otherwise a flat $ amount).
export type PayAllowance = { id: string; name: string; kind?: string; amount?: number; [k: string]: any };
export type PayRise = { from?: string; rate?: number };
export type PayConfig = {
  savedAt: number;
  baseRate: number; rises: PayRise[];
  cycle: PayCycle; periodStart: string; paydayOffset: number;
  otMult: number; otTiered: boolean; otTierHours: number; otMult2: number; exMult: number;
  pen: PayPenalties;
  typeRules: { [typeId: string]: PayTypeRule };
  allowances: PayAllowance[];
  payLeave: boolean; leaveLoading: number;
  superPct: number; showTax: boolean; taxFree: boolean;
  [k: string]: any;
};
// Pay tags live in data.payTags: date -> [{id,kind:'holiday'} | {id,kind:'allowance',allowanceId}]
export type PayTag = Rec & { kind: "holiday" | "allowance" | string; allowanceId?: string };

export const PAY_DEFAULTS = {
  baseRate: 0, rises: [] as PayRise[],
  cycle: "fortnightly" as PayCycle, periodStart: "", paydayOffset: 0,
  otMult: 1.5, otTiered: false, otTierHours: 3, otMult2: 2, exMult: 1,
  pen: { sat: 0, sun: 0, ph: 0, night: 0 } as PayPenalties,
  typeRules: {} as { [typeId: string]: PayTypeRule },
  allowances: [] as PayAllowance[],
  payLeave: true, leaveLoading: 0,
  superPct: 12, showTax: true, taxFree: true,
};
type DefaultKey = keyof typeof PAY_DEFAULTS;
const DEFAULT_KEYS = Object.keys(PAY_DEFAULTS) as DefaultKey[];

export function num(v: unknown, d: number): number {
  const n = parseFloat(v as string);
  return isFinite(n) ? n : d;
}

type Settings = Snapshot["settings"];

export function payConfig(settings: Settings | null | undefined, today: Date = new Date()): PayConfig {
  const st: { [k: string]: any } = settings || {};
  const p: { [k: string]: any } = st.pay || {};
  const c: { [k: string]: any } = {};
  c.savedAt = p.savedAt || 0;
  DEFAULT_KEYS.forEach((k) => {
    c[k] = p[k] != null ? p[k] : JSON.parse(JSON.stringify(PAY_DEFAULTS[k]));
  });
  if (st.pay && st.hourlyRate != null && num(st.hourlyRate, 0) !== num(p.baseRate, 0) && (st.updatedAt || 0) > (p.savedAt || 0)) {
    // an older version of the app changed the simple pay fields since this setup was saved
    c.baseRate = num(st.hourlyRate, c.baseRate);
    if (st.otMultiplier != null) c.otMult = num(st.otMultiplier, c.otMult);
    if (st.excessMultiplier != null) c.exMult = num(st.excessMultiplier, c.exMult);
  }
  if (!st.pay) {
    c.baseRate = num(st.hourlyRate, 0);
    if (st.otMultiplier != null) c.otMult = num(st.otMultiplier, 1.5);
    if (st.excessMultiplier != null) c.exMult = num(st.excessMultiplier, 1);
    if (st.payLeave != null) c.payLeave = st.payLeave !== false;
    c.cycle = "monthly";
  }
  c.pen = Object.assign({ sat: 0, sun: 0, ph: 0, night: 0 }, c.pen || {});
  // Pay rises were removed: fold any saved ones into the base rate so the
  // current rate is simply the one in force today.
  const todayKey = ymd(today);
  ((c.rises || []) as PayRise[]).filter((r) => r && r.from && num(r.rate, 0) > 0 && r.from <= todayKey)
    .sort((a, b) => ((a.from as string) < (b.from as string) ? -1 : (a.from as string) > (b.from as string) ? 1 : 0))
    .forEach((r) => { c.baseRate = num(r.rate, c.baseRate); });
  c.rises = [];
  c.typeRules = c.typeRules || {};
  c.allowances = c.allowances || [];
  return c as PayConfig;
}

export const payIsSetUp = (settings: Settings | null | undefined) => payConfig(settings).baseRate > 0;
export const rateOn = (cfg: PayConfig, _dateKey: string) => num(cfg.baseRate, 0);

/* ---------- pay periods ---------- */
export const cycleDays = (cfg: PayConfig) => (cfg.cycle === "weekly" ? 7 : 14);
export const periodsPerYear = (cfg: PayConfig) => (cfg.cycle === "weekly" ? 52 : cfg.cycle === "monthly" ? 12 : 26);
export function payAnchor(cfg: PayConfig): Date {
  if (cfg.periodStart) return parseYmd(cfg.periodStart);
  // no start date set: weeks run Monday–Sunday from 5 Jan 2026; months from the 1st
  return cfg.cycle === "monthly" ? new Date(2026, 0, 1) : new Date(2026, 0, 5);
}
const monthDayClamped = (y: number, m: number, d: number) => new Date(y, m, Math.min(d, new Date(y, m + 1, 0).getDate()));
const dayDiff = (date: Date, a: Date) =>
  Math.round((new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime() - a.getTime()) / 86400000);

export type DateRange = { start: Date; end: Date };
export function payPeriodFor(cfg: PayConfig, date: Date): DateRange {
  const a = payAnchor(cfg);
  let start: Date, end: Date;
  if (cfg.cycle === "monthly") {
    const d0 = a.getDate();
    start = monthDayClamped(date.getFullYear(), date.getMonth(), d0);
    if (start > date) start = monthDayClamped(date.getFullYear(), date.getMonth() - 1, d0);
    end = monthDayClamped(start.getFullYear(), start.getMonth() + 1, d0);
  } else {
    const len = cycleDays(cfg);
    const n = Math.floor(dayDiff(date, a) / len);
    start = addDays(a, n * len);
    end = addDays(start, len);
  }
  return { start, end };
}
// True for every second pay period, counted from the period start date.
// Shading snaps to whole Monday–Sunday rows: each week follows the period
// its Thursday falls in (the period holding most of that week).
export function payPeriodIsAlt(cfg: PayConfig, date: Date): boolean {
  let n: number;
  date = addDays(date, 3 - (date.getDay() + 6) % 7);
  if (cfg.cycle === "monthly") {
    const st = payPeriodFor(cfg, date).start;
    n = st.getFullYear() * 12 + st.getMonth();
  } else {
    n = Math.floor(dayDiff(date, payAnchor(cfg)) / cycleDays(cfg));
  }
  return ((n % 2) + 2) % 2 === 1;
}
export const shiftPayPeriod = (cfg: PayConfig, period: DateRange, dir: number) =>
  payPeriodFor(cfg, dir > 0 ? period.end : addDays(period.start, -1));

// The Weekly / Fortnightly range on the Reports pay card: the week (or
// fortnight) lined up with the pay period start date that holds `ref`.
export function payCardRange(cfg: PayConfig, view: "weekly" | "fortnightly", ref: Date): DateRange {
  const len = view === "weekly" ? 7 : 14, a = payAnchor(cfg);
  const st = addDays(a, Math.floor(dayDiff(ref, a) / len) * len);
  return { start: st, end: addDays(st, len) };
}

/* ---------- tax (rough, Australian resident, 2026–27) ---------- */
export function annualTaxEstimate(income: number, taxFree: boolean): number {
  if (!(income > 0)) return 0;
  const b: [number, number][] = taxFree
    ? [[18200, 0], [45000, .15], [135000, .30], [190000, .37], [Infinity, .45]]
    : [[45000, .15], [135000, .30], [190000, .37], [Infinity, .45]];
  let tax = 0, prev = 0;
  b.forEach((x) => {
    if (income > prev) tax += (Math.min(income, x[0]) - prev) * x[1];
    prev = x[0];
  });
  if (taxFree) {
    // low income tax offset
    const lito = income <= 37500 ? 700 : income <= 45000 ? 700 - (income - 37500) * .05 : income <= 66667 ? 325 - (income - 45000) * .015 : 0;
    tax = Math.max(0, tax - Math.max(0, lito));
  }
  // Medicare levy 2% (not charged on low incomes)
  if (income > 27222) tax += Math.min(income * .02, (income - 27222) * .1);
  return tax;
}

/* ---------- pay tags (public holiday / allowance per day) ---------- */
export const payTagsOn = (d: Pick<Snapshot, "payTags">, dateKey: string): PayTag[] =>
  ((d.payTags && d.payTags[dateKey]) || []) as PayTag[];
export const isPublicHoliday = (d: Pick<Snapshot, "payTags">, dateKey: string) =>
  payTagsOn(d, dateKey).some((t) => t.kind === "holiday");
// The allowances set up in pay settings (what a day can be tagged with).
export const payAllowances = (settings: Settings | null | undefined): PayAllowance[] => payConfig(settings).allowances;
export const PUBLIC_HOLIDAY_LABEL = "Public holiday";
// Label for a tag; null for an allowance tag whose allowance no longer exists (it isn't paid).
export function payTagLabel(tag: PayTag, allowances: PayAllowance[]): string | null {
  if (tag.kind === "holiday") return PUBLIC_HOLIDAY_LABEL;
  if (tag.kind === "allowance") { const a = allowances.find((x) => x.id === tag.allowanceId); return a ? a.name : null; }
  return null;
}

/* ---------- the calculation ---------- */
export type PayResult = {
  ordinaryHours: number; otHours: number; excessHours: number; leaveHours: number;
  ordinary: number; overtime: number; excess: number; penalties: number; shiftAllowance: number; allowances: number;
  leave: number; leaveLoading: number;
  allowanceLines: { [name: string]: number }; penaltyLines: { [name: string]: number };
  gross: number; superAmt: number; tax: number; net: number; configured: boolean; showTax?: boolean;
};

// The whole calculation for [start, end). annualFactor turns the period's
// gross into a yearly figure for the tax estimate (52, 26, 12 or 1).
export function computePay(
  d: Pick<Snapshot, "shifts" | "leave" | "payTags" | "settings">, typesById: { [id: string]: ShiftType },
  start: Date, end: Date, annualFactor?: number, today?: Date,
): PayResult {
  const cfg = payConfig(d.settings, today);
  const r: PayResult = {
    ordinaryHours: 0, otHours: 0, excessHours: 0, leaveHours: 0,
    ordinary: 0, overtime: 0, excess: 0, penalties: 0, shiftAllowance: 0, allowances: 0, leave: 0, leaveLoading: 0,
    allowanceLines: {}, penaltyLines: {}, gross: 0, superAmt: 0, tax: 0, net: 0, configured: cfg.baseRate > 0,
  };
  if (!r.configured) return r;
  const sKey = ymd(start), eKey = ymd(end);
  const inRange = (k: string) => k >= sKey && k < eKey;
  const allowById: { [id: string]: PayAllowance } = {};
  cfg.allowances.forEach((a) => { allowById[a.id] = a; });

  Object.keys(d.shifts || {}).forEach((k) => {
    if (!inRange(k)) return;
    const rate = rateOn(cfg, k);
    const wd = parseYmd(k).getDay();
    (d.shifts[k] || []).forEach((s) => {
      const t = typesById[s.typeId];
      if (!t || t.kind === "personal") return;
      if (s.typeId === OVERTIME_ID) {
        const ot = entryOTHours(s);
        const first = cfg.otTiered ? Math.min(ot, Math.max(0, num(cfg.otTierHours, 0))) : ot;
        r.otHours += ot;
        r.overtime += rate * (first * num(cfg.otMult, 1.5) + (ot - first) * num(cfg.otMult2, 2));
        const exPart = entryExcessHours(s);
        r.excessHours += exPart;
        r.excess += exPart * rate * num(cfg.exMult, 1);
        return;
      }
      if (s.typeId === EXCESS_ID) {
        const ex = entryExcessHours(s) || effectiveHours(s, typesById);
        r.excessHours += ex;
        r.excess += ex * rate * num(cfg.exMult, 1);
        return;
      }
      const h = effectiveHours(s, typesById);
      r.ordinaryHours += h;
      r.ordinary += h * rate;
      const rule: PayTypeRule = cfg.typeRules[s.typeId] || {};
      // When more than one penalty applies, the highest one is paid.
      let best = 0, bestName = "";
      const consider = (pctIn: unknown, name: string) => { const pct = num(pctIn, 0); if (pct > best) { best = pct; bestName = name; } };
      if (rule.penalties !== false) {
        if (wd === 6) consider(cfg.pen.sat, "Saturday");
        if (wd === 0) consider(cfg.pen.sun, "Sunday");
        if (isPublicHoliday(d, k)) consider(cfg.pen.ph, PUBLIC_HOLIDAY_LABEL);
      }
      if (rule.night) consider(cfg.pen.night, "Night shift");
      if (best > 0) {
        const pAmt = h * rate * best / 100;
        r.penalties += pAmt;
        r.penaltyLines[bestName] = (r.penaltyLines[bestName] || 0) + pAmt;
      }
      if (rule.allowanceKind === "pct") r.shiftAllowance += h * rate * num(rule.allowance, 0) / 100;
      else if (rule.allowanceKind === "flat") r.shiftAllowance += num(rule.allowance, 0);
    });
  });

  Object.keys(d.leave || {}).forEach((k) => {
    if (!inRange(k)) return;
    const rate = rateOn(cfg, k);
    (d.leave[k] || []).forEach((l) => {
      const h = num(l.hours, 0);
      if (l.kind !== "annual" && l.kind !== "sick") return;
      r.leaveHours += h;
      if (!cfg.payLeave) return;
      r.leave += h * rate;
      if (l.kind === "annual") r.leaveLoading += h * rate * num(cfg.leaveLoading, 0) / 100;
    });
  });

  Object.keys(d.payTags || {}).forEach((k) => {
    if (!inRange(k)) return;
    const rate = rateOn(cfg, k);
    ((d.payTags[k] || []) as PayTag[]).forEach((tag) => {
      if (tag.kind !== "allowance") return;
      const a = allowById[tag.allowanceId as string];
      if (!a) return;
      const amt = a.kind === "hours" ? num(a.amount, 0) * rate : num(a.amount, 0);
      r.allowances += amt;
      r.allowanceLines[a.name] = (r.allowanceLines[a.name] || 0) + amt;
    });
  });

  r.gross = r.ordinary + r.overtime + r.excess + r.penalties + r.shiftAllowance + r.allowances + r.leave + r.leaveLoading;
  // Super is paid by the employer on ordinary-time earnings (not overtime).
  r.superAmt = (r.ordinary + r.penalties + r.shiftAllowance + r.leave + r.leaveLoading) * num(cfg.superPct, 0) / 100;
  const f = annualFactor || 1;
  r.tax = cfg.showTax ? annualTaxEstimate(r.gross * f, cfg.taxFree) / f : 0;
  r.net = r.gross - r.tax;
  r.showTax = !!cfg.showTax;
  return r;
}

/* ---------- money ---------- */
export function fmtMoney(v: number): string {
  return "$" + (Math.round(v * 100) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
export const fmtMoneyShort = (v: number) => (v >= 10000 ? "$" + (v / 1000).toFixed(1) + "k" : "$" + Math.round(v).toLocaleString());

/* ---------- pay setup (same fields and saving as the web's pay setup screen) ---------- */
export const workTypes = (types: ShiftType[]) => types.filter((t) => t.kind !== "personal");

// The editable copy the setup screen works on. Like the web, every work type
// gets a (possibly empty) rule object.
export function paySetupDraft(settings: Settings | null | undefined, types: ShiftType[]): PayConfig {
  const c: PayConfig = JSON.parse(JSON.stringify(payConfig(settings)));
  workTypes(types).forEach((t) => { c.typeRules[t.id] = c.typeRules[t.id] || {}; });
  return c;
}

// The text fields / switches on the setup screen, as the web fills them in.
export type PayForm = {
  baseRate: string; periodStart: string;
  otMult: string; otTiered: boolean; otTierHours: string; otMult2: string; exMult: string;
  penSat: string; penSun: string; penNight: string;
  payLeave: boolean; leaveLoading: string;
  superPct: string; showTax: boolean; taxFree: boolean;
};
const sv = (v: unknown) => (v == null ? "" : String(v));
export function payFormFromConfig(c: PayConfig): PayForm {
  return {
    baseRate: sv(c.baseRate || ""),
    periodStart: sv(c.periodStart || ymd(payAnchor(c))),
    otMult: sv(c.otMult), otTiered: !!c.otTiered, otTierHours: sv(c.otTierHours), otMult2: sv(c.otMult2),
    exMult: sv(c.exMult),
    penSat: sv(c.pen.sat || ""), penSun: sv(c.pen.sun || ""), penNight: sv(c.pen.night || ""),
    payLeave: c.payLeave !== false, leaveLoading: sv(c.leaveLoading || ""),
    superPct: sv(c.superPct), showTax: !!c.showTax, taxFree: c.taxFree !== false,
  };
}

// One-line summaries shown on each pay setup section.
export function paySummaries(f: PayForm, cycle: string, workTypeCount: number) {
  const rate = parseFloat(f.baseRate);
  const cyc = cycle || "fortnightly";
  const ot = (f.otMult || "1.5") + "× OT · " + (f.exMult || "1") + "× excess";
  const pens = ([[f.penSat, "Sat"], [f.penSun, "Sun"], [f.penNight, "Night"]] as [string, string][])
    .filter((x) => parseFloat(x[0]) > 0)
    .map((x) => x[1] + " " + x[0] + "%");
  const n = workTypeCount;
  const ll = parseFloat(f.leaveLoading);
  return {
    rate: rate > 0 ? fmtMoney(rate) + "/h" : "Not set",
    cycle: cyc.charAt(0).toUpperCase() + cyc.slice(1),
    ot: f.otTiered ? ot + " · tiered" : ot,
    pen: pens.length ? pens.join(" · ") : "None",
    types: n ? n + (n === 1 ? " type" : " types") : "None",
    leave: f.payLeave ? (ll > 0 ? "Paid · " + ll + "% loading" : "Paid") : "Unpaid",
    tax: (f.superPct || "12") + "% super" + (f.showTax ? " · tax shown" : ""),
  };
}

// Saves the setup into settings exactly as the web does (settings.pay plus the
// older simple fields, and settings.updatedAt so it wins the sync merge).
// Returns an error message (nothing is saved) or null. Mutates `settings` and `draft`.
export function savePaySetup(settings: Settings, draft: PayConfig, f: PayForm, now: number = Date.now()): string | null {
  const c = draft;
  const rate = parseFloat(f.baseRate);
  if (!(rate > 0)) return "Enter your hourly rate";
  c.baseRate = rate;
  c.rises = [];
  c.periodStart = f.periodStart || "";
  c.otMult = Math.max(0, num(f.otMult, 1.5));
  c.otTiered = f.otTiered;
  c.otTierHours = Math.max(0, num(f.otTierHours, 3));
  c.otMult2 = Math.max(0, num(f.otMult2, 2));
  c.exMult = Math.max(0, num(f.exMult, 1));
  c.pen = {
    sat: Math.max(0, num(f.penSat, 0)),
    sun: Math.max(0, num(f.penSun, 0)),
    ph: 0,
    night: Math.max(0, num(f.penNight, 0)),
  };
  c.payLeave = f.payLeave;
  c.leaveLoading = Math.max(0, num(f.leaveLoading, 0));
  c.superPct = Math.max(0, num(f.superPct, 12));
  c.showTax = f.showTax;
  c.taxFree = f.taxFree;
  const st = settings;
  st.pay = c;
  // keep the older fields current for any device still on an older version
  st.hourlyRate = c.baseRate; st.otMultiplier = c.otMult; st.excessMultiplier = c.exMult; st.payLeave = c.payLeave;
  st.updatedAt = now;
  c.savedAt = st.updatedAt;
  return null;
}
