// Data model shared with the Roster Board web app (index.html in the repo root).
// The native app reads and writes exactly the same record shapes, so the same
// account can be used on the web, iPhone and Android side by side. Records may
// carry fields this app doesn't know about yet; edits always copy the whole
// record so those fields are kept.

export type Rec = { id: string; updatedAt?: number; [k: string]: any };

export type ShiftType = Rec & {
  name: string;
  icon?: string | null;
  color: string;
  ink: string;
  kind?: "work" | "personal";
  startTime?: string | null;
  endTime?: string | null;
  hours?: number;
  overtimeEligible?: boolean;
  excessEligible?: boolean;
  time?: string | null;
  allDay?: boolean;
  notes?: string | null;
  order?: number;
  isBuiltin?: boolean;
};
export type ShiftEntry = Rec & { typeId: string; hours?: number; baseTypeId?: string; tag?: string };
export type LeaveEntry = Rec & { kind: string; hours?: number };
export type EventEntry = Rec & { text: string; category?: string; time?: string; allDay?: boolean; remind?: boolean; notified?: boolean };
export type Birthday = Rec & { name: string; day: number; month: number; year?: number | null };
export type Buckets<T> = { [dateKey: string]: T[] };

export type Snapshot = {
  types: ShiftType[];
  shifts: Buckets<ShiftEntry>;
  notes: Buckets<EventEntry>;
  leave: Buckets<LeaveEntry>;
  swaps: Buckets<Rec>;
  payTags: Buckets<Rec>;
  birthdays: Birthday[];
  roster: { weeks: number; pattern: string[][][]; updatedAt: number; [k: string]: any };
  settings: { hourlyRate: number; updatedAt?: number; [k: string]: any };
  tombstones: { [id: string]: number };
};

export const BUCKET_KEYS = ["shifts", "notes", "leave", "swaps", "payTags"] as const;

export function emptySnapshot(): Snapshot {
  return {
    types: [], shifts: {}, notes: {}, leave: {}, swaps: {}, payTags: {}, birthdays: [],
    roster: { weeks: 1, pattern: [[[], [], [], [], [], [], []]], updatedAt: 0 },
    settings: { hourlyRate: 0 }, tombstones: {},
  };
}

export function normaliseSnapshot(d: any): Snapshot {
  const e = emptySnapshot();
  if (!d || typeof d !== "object") return e;
  return {
    types: Array.isArray(d.types) ? d.types : [],
    shifts: d.shifts || {}, notes: d.notes || {}, leave: d.leave || {}, swaps: d.swaps || {}, payTags: d.payTags || {},
    birthdays: Array.isArray(d.birthdays) ? d.birthdays : [],
    roster: d.roster && d.roster.pattern ? { ...d.roster, updatedAt: d.roster.updatedAt || 0 } : e.roster,
    settings: d.settings || e.settings,
    tombstones: d.tombstones || {},
  };
}

export const OVERTIME_ID = "overtime";
export const EXCESS_ID = "excess_hours";
export const OVERTIME_TYPE: ShiftType = { id: OVERTIME_ID, name: "Overtime", color: "#F0679E", ink: "#FFFFFF", isBuiltin: true };
export const EXCESS_TYPE: ShiftType = { id: EXCESS_ID, name: "Excess Hours", color: "#F0679E", ink: "#FFFFFF", isBuiltin: true };

export const PALETTE = [
  { hex: "#E5484D", ink: "#FFFFFF" }, { hex: "#E8B339", ink: "#241900" }, { hex: "#4C8DFF", ink: "#FFFFFF" },
  { hex: "#A76BF0", ink: "#FFFFFF" }, { hex: "#3FC5C0", ink: "#062523" }, { hex: "#3ECF8E", ink: "#04241A" },
  { hex: "#F0679E", ink: "#FFFFFF" }, { hex: "#7E8B99", ink: "#FFFFFF" },
  { hex: "#FF8C42", ink: "#2A1300" }, { hex: "#A3D65C", ink: "#1A2A05" }, { hex: "#7CC7F5", ink: "#062234" },
  { hex: "#C9A7F5", ink: "#24113D" }, { hex: "#1F4E9C", ink: "#FFFFFF" }, { hex: "#8E2C48", ink: "#FFFFFF" },
  { hex: "#9B6B43", ink: "#FFFFFF" }, { hex: "#3A3F47", ink: "#FFFFFF" },
];
// Icons a shift type can show instead of its first letter (Ionicons names).
export const TYPE_ICONS = [
  "sunny", "moon", "partly-sunny", "alarm", "briefcase", "medkit", "call", "home",
  "bed", "school", "airplane", "barbell", "people", "restaurant", "construct", "checkmark-circle",
] as const;
export const LEAVE_KINDS: { [k: string]: { color: string; ink: string; label: string } } = {
  annual: { color: "#7E8B99", ink: "#FFFFFF", label: "Annual Leave" },
  sick: { color: "#C24444", ink: "#FFFFFF", label: "Sick Leave" },
  excess: { color: "#F0679E", ink: "#FFFFFF", label: "Excess Hours" },
};
export const EVENT_CATS: { [k: string]: { color: string; ink: string; label: string } } = {
  appointment: { color: "#3FC5C0", ink: "#062523", label: "Appointment" },
  family: { color: "#F0679E", ink: "#FFFFFF", label: "Social" },
  reminder: { color: "#E8B339", ink: "#241900", label: "Reminder" },
  other: { color: "#9C9585", ink: "#FFFFFF", label: "Other" },
};
export const EVENT_CAT_ORDER = ["appointment", "family", "reminder", "other"];
export const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WEEKDAYS_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const WEEKDAYS_FULL = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

/* ---------- dates ---------- */
const pad2 = (n: number) => (n < 10 ? "0" + n : "" + n);
export const ymd = (d: Date) => d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
export const parseYmd = (s: string) => { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); };
export const startOfMonth = (d: Date) => new Date(d.getFullYear(), d.getMonth(), 1);
export const addMonths = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth() + n, 1);
export const isSameDay = (a: Date, b: Date) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
export const fmtHours = (h: number) => (Math.round(h * 10) / 10).toString();

export function calcDuration(start: string, end: string) {
  const sp = start.split(":"), ep = end.split(":");
  let diff = (+ep[0] * 60 + +ep[1]) - (+sp[0] * 60 + +sp[1]);
  if (diff <= 0) diff += 24 * 60;
  return Math.round((diff / 60) * 100) / 100;
}

// Monday-first month grid; drops a sixth row that's entirely next month.
export function buildMonthCells(month: Date) {
  const first = startOfMonth(month);
  const lead = (first.getDay() + 6) % 7;
  const cells: { date: Date; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(first.getFullYear(), first.getMonth(), 1 - lead + i);
    cells.push({ date: d, inMonth: d.getMonth() === month.getMonth() });
  }
  if (cells.slice(35).every((c) => !c.inMonth)) return cells.slice(0, 35);
  return cells;
}

export function birthdaysOnDate(list: Birthday[], date: Date) {
  const day = date.getDate(), month = date.getMonth() + 1, year = date.getFullYear();
  const leap = new Date(year, 1, 29).getMonth() === 1;
  return (list || [])
    .filter((b) => (b.day === day && b.month === month) || (!leap && b.month === 2 && b.day === 29 && month === 2 && day === 28))
    .map((b) => {
      const age = b.year ? year - b.year : null;
      return { id: b.id, name: b.name, age: age != null && age >= 0 ? age : null };
    });
}

export function mkId(): string {
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return "id" + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export function typeLabel(t: ShiftType) {
  if (t.kind === "personal") return t.allDay ? "All day" : t.time ? t.time : "Personal";
  if (t.startTime && t.endTime) return t.startTime + "–" + t.endTime + " · " + fmtHours(t.hours || 0) + "h";
  return fmtHours(t.hours || 0) + "h";
}

/* ---------- hours (same rules as the web app) ---------- */
// Overtime entries can also carry excess hours ("Excess + Overtime" split).
export const entryOTHours = (e: ShiftEntry) => (e.typeId === OVERTIME_ID ? e.hours || 0 : 0);
export function entryExcessHours(e: ShiftEntry) {
  if (e.typeId === EXCESS_ID) return e.hours || 0;
  if (e.typeId === OVERTIME_ID) return e.excessHours || 0;
  return 0;
}
export function effectiveHours(e: ShiftEntry, typesById: { [id: string]: ShiftType }) {
  if (e.typeId === OVERTIME_ID && e.excessHours > 0) return (e.hours || 0) + e.excessHours;
  if (e.hours != null) return e.hours;
  const t = typesById[e.typeId];
  return t ? t.hours || 0 : 0;
}
export function entryName(e: Rec, typesById: { [id: string]: ShiftType }) {
  const t = typesById[e.typeId];
  if (!t) return "Deleted type";
  if (!t.isBuiltin) return t.name;
  const split = e.typeId === OVERTIME_ID && e.excessHours > 0;
  const name = split ? "Excess + Overtime" : t.name;
  const base = e.baseTypeId && typesById[e.baseTypeId];
  return base ? name + " – " + base.name : name;
}
export const isCombo = (typeId: string) => typeId === OVERTIME_ID || typeId === EXCESS_ID;
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayIndex = (jsDay: number) => (jsDay + 6) % 7;
export const isSplitEntry = (e: Rec) => e.typeId === OVERTIME_ID && e.excessHours > 0;
// Overtime/excess entries take their base shift's colour.
export function entryColor(e: Rec, typesById: { [id: string]: ShiftType }) {
  if (isCombo(e.typeId) && e.baseTypeId) {
    const bt = typesById[e.baseTypeId];
    if (bt) return { bg: bt.color, ink: bt.ink };
  }
  const t = typesById[e.typeId];
  return t ? { bg: t.color, ink: t.ink } : { bg: "#9C9585", ink: "#FFFFFF" };
}

/* ---------- employment type ---------- */
// Full-time workers don't log excess hours, so excess options are hidden for them.
// Stored with the synced settings; unset means part time (everything shown).
export type Employment = "full" | "part";
export const employmentOf = (settings: any): Employment => (settings && settings.employment === "full" ? "full" : "part");
