// Port of the web app's merge rules (index.html, "merge helpers"). Both apps must
// merge identically, or a phone and a browser syncing the same account could
// disagree about what's current. Records are unioned by id; a record is only
// dropped when a tombstone says it was deliberately deleted.
import type { Snapshot, Rec, Buckets } from "./model.ts";

type Tombs = { [id: string]: number };

export function mergeTombstones(a?: Tombs, b?: Tombs): Tombs {
  const out: Tombs = {};
  Object.keys(a || {}).forEach((id) => { out[id] = a![id]; });
  Object.keys(b || {}).forEach((id) => { if (!out[id] || b![id] > out[id]) out[id] = b![id]; });
  return out;
}

// A record beats a deletion only if it was saved after the deletion.
function survives(item: Rec, tombs: Tombs) {
  const t = tombs[item.id];
  return !t || (item.updatedAt || 0) > t;
}

export function mergeBucketed<T extends Rec>(local?: Buckets<T>, remote?: Buckets<T>, tombs: Tombs = {}): Buckets<T> {
  const picked: { [id: string]: { dateKey: string; item: T } } = {};
  const order: string[] = [];
  const addFrom = (buckets: Buckets<T> | undefined, isLocal: boolean) => {
    Object.keys(buckets || {}).forEach((dateKey) => {
      (buckets![dateKey] || []).forEach((item) => {
        if (!item || !item.id) return;
        const cur = picked[item.id];
        if (!cur) { picked[item.id] = { dateKey, item }; order.push(item.id); return; }
        if (!isLocal && (item.updatedAt || 0) > (cur.item.updatedAt || 0)) picked[item.id] = { dateKey, item };
      });
    });
  };
  addFrom(local, true);
  addFrom(remote, false);
  const result: Buckets<T> = {};
  order.forEach((id) => {
    const p = picked[id];
    if (!survives(p.item, tombs)) return;
    if (tombs[id]) delete tombs[id];
    (result[p.dateKey] = result[p.dateKey] || []).push(p.item);
  });
  return result;
}

export function mergeArrayById<T extends Rec>(local?: T[], remote?: T[], tombs: Tombs = {}): T[] {
  const picked: { [id: string]: T } = {};
  const order: string[] = [];
  (local || []).forEach((item) => {
    if (!item || !item.id || picked[item.id]) return;
    picked[item.id] = item; order.push(item.id);
  });
  (remote || []).forEach((item) => {
    if (!item || !item.id) return;
    const cur = picked[item.id];
    if (!cur) { picked[item.id] = item; order.push(item.id); return; }
    if ((item.updatedAt || 0) > (cur.updatedAt || 0)) picked[item.id] = item;
  });
  const out: T[] = [];
  order.forEach((id) => {
    const item = picked[id];
    if (!survives(item, tombs)) return;
    if (tombs[id]) delete tombs[id];
    out.push(item);
  });
  return out;
}

function rosterHasContent(r: any) {
  return !!(r && r.pattern && r.pattern.some((w: any[]) => w.some((d: any[]) => d && d.length)));
}
function mergeRoster(local: any, remote: any) {
  if (!remote || !remote.pattern) return local;
  if (!local || !local.pattern) return remote;
  const lu = local.updatedAt || 0, ru = remote.updatedAt || 0;
  if (ru !== lu) return ru > lu ? remote : local;
  if (!rosterHasContent(local) && rosterHasContent(remote)) return remote;
  return local;
}
function settingsHaveContent(st: any) {
  return !!(st && (st.hourlyRate || st.otMultiplier || st.excessMultiplier || st.payLeave));
}
function mergeSettings(local: any, remote: any) {
  if (!remote) return local || { hourlyRate: 0 };
  if (!local) return remote;
  const lu = local.updatedAt || 0, ru = remote.updatedAt || 0;
  if (ru !== lu) return ru > lu ? remote : local;
  if (!settingsHaveContent(local) && settingsHaveContent(remote)) return remote;
  return local;
}

export function mergeSnapshots(local: Snapshot, remote: any): Snapshot {
  const r = remote || null;
  const tombs = mergeTombstones(local.tombstones, r && r.tombstones);
  return {
    types: mergeArrayById(local.types, r && r.types, tombs),
    shifts: mergeBucketed(local.shifts, r && r.shifts, tombs),
    notes: mergeBucketed(local.notes, r && r.notes, tombs),
    leave: mergeBucketed(local.leave, r && r.leave, tombs),
    swaps: mergeBucketed(local.swaps, r && r.swaps, tombs),
    payTags: mergeBucketed(local.payTags, r && r.payTags, tombs),
    birthdays: mergeArrayById(local.birthdays, r && r.birthdays, tombs),
    roster: mergeRoster(local.roster, r && r.roster),
    settings: mergeSettings(local.settings, r && r.settings),
    tombstones: tombs,
  };
}

/* ---------- comparing snapshots ---------- */
function canonical(snap: any) {
  const out: any = {};
  const byId = (x: any, y: any) => { const a = (x && x.id) || "", b = (y && y.id) || ""; return a < b ? -1 : a > b ? 1 : 0; };
  Object.keys(snap || {}).forEach((k) => {
    const v = snap[k];
    if (k === "shifts" || k === "notes" || k === "leave" || k === "swaps" || k === "payTags") {
      const days: any = {};
      Object.keys(v || {}).forEach((d) => { if ((v[d] || []).length) days[d] = (v[d] || []).slice().sort(byId); });
      out[k] = days;
    } else if (k === "types" || k === "birthdays") {
      out[k] = (v || []).slice().sort(byId);
    } else out[k] = v;
  });
  return out;
}
export function stableStringify(v: any): string {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map((x) => (x === undefined ? "null" : stableStringify(x))).join(",") + "]";
  return "{" + Object.keys(v).filter((k) => v[k] !== undefined).sort().map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
export function sameSnapshot(a: any, b: any) {
  return stableStringify(canonical(a)) === stableStringify(canonical(b));
}

/* ---------- backup history (same rules as the web app) ---------- */
export const HISTORY_MAX = 10;
const HISTORY_GAP = 6 * 3600000;
export function stripHistory(d: any) {
  const out: any = {};
  Object.keys(d || {}).forEach((k) => { if (k !== "history") out[k] = d[k]; });
  return out;
}
export function snapshotHasData(d: any) {
  return !!d && !!(Object.keys(d.shifts || {}).length || Object.keys(d.notes || {}).length || (d.types || []).length ||
    Object.keys(d.leave || {}).length || Object.keys(d.swaps || {}).length || (d.birthdays || []).length ||
    Object.keys(d.payTags || {}).length);
}
export function buildHistory(remote: any, force: boolean, now = Date.now()) {
  const h = ((remote && remote.history) || []).slice(0, HISTORY_MAX);
  if (snapshotHasData(remote) && (force || !h.length || now - (h[0].at || 0) > HISTORY_GAP)) {
    h.unshift({ at: now, data: stripHistory(remote) });
  }
  return h.slice(0, HISTORY_MAX);
}

export function pruneTombstones(tombs: Tombs, now = Date.now()) {
  const cutoff = now - 400 * 24 * 60 * 60 * 1000;
  Object.keys(tombs).forEach((id) => { if (tombs[id] < cutoff) delete tombs[id]; });
  return tombs;
}
