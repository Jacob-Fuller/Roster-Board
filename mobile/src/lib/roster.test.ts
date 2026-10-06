// Checks the native roster fill against the web app's own applyRosterPattern.
import { readFileSync } from "node:fs";
import { applyRosterPattern } from "./roster.ts";

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const src = html.slice(html.indexOf("  function applyRosterPattern("), html.indexOf("  /* ---------------- reports ----"));
const makeWeb = new Function("state", "tomb", `
  var COMBO_TYPES = {overtime:1, excess_hours:1};
  function pad2(n){ return n < 10 ? "0"+n : ""+n; }
  function ymd(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
  function addDays(d, n){ return new Date(d.getFullYear(), d.getMonth(), d.getDate()+n); }
  function mondayIndex(j){ return (j + 6) % 7; }
  function parseYmd(s){ var p = s.split("-"); return new Date(+p[0], +p[1]-1, +p[2]); }
  var n = 0; function mkId(){ return "x" + (n++); }
  function saveStore(){} function renderAll(){} function toast(){}
  ${src}
  return applyRosterPattern;`);

const strip = (shifts: any) => JSON.stringify(Object.keys(shifts).sort().map((k) => [k, shifts[k].map((e: any) => e.id.startsWith("x") || e.id.length > 20 ? e.typeId : e.id)]));
const typesById: any = { a: { id: "a", hours: 12 }, b: { id: "b", hours: 8 }, p: { id: "p", kind: "personal" }, overtime: { id: "overtime", isBuiltin: true } };
let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
for (let i = 0; i < 300; i++) {
  const weeks = 1 + Math.floor(rnd() * 5);
  const pattern = Array.from({ length: weeks }, () => Array.from({ length: 7 }, () => ["a", "b", "zz"].filter(() => rnd() < 0.3)));
  const shifts: any = {}, leave: any = {}, swaps: any = {};
  for (let d = 1; d < 60; d++) {
    const k = "2026-" + String(10 + Math.floor(d / 31)).padStart(2, "0") + "-" + String((d % 28) + 1).padStart(2, "0");
    const r = rnd();
    if (r < 0.2) shifts[k] = [{ id: "e" + d, typeId: "a" }];
    else if (r < 0.25) shifts[k] = [{ id: "p" + d, typeId: "p" }];
    else if (r < 0.28) shifts[k] = [{ id: "o" + d, typeId: "overtime", hours: 2 }];
    else if (r < 0.3) leave[k] = [{ id: "l" + d, kind: "annual" }];
  }
  const start = "2026-10-" + String(1 + Math.floor(rnd() * 28)).padStart(2, "0");
  const months = [3, 6, 12][Math.floor(rnd() * 3)];
  const base = { types: [], shifts, notes: {}, leave, swaps, payTags: {}, birthdays: [], roster: { weeks, pattern, updatedAt: 0 }, settings: { hourlyRate: 0 }, tombstones: {} };
  const a = structuredClone(base), b = structuredClone(base);
  const ta: string[] = [], tb: string[] = [];
  applyRosterPattern(a as any, typesById, start, months, (id) => ta.push(id));
  makeWeb({ ...b, typesById, roster: b.roster }, (id: string) => tb.push(id))(start, months);
  if (strip(a.shifts) !== strip(b.shifts) || ta.join() !== tb.join()) { console.error("roster MISMATCH", i); process.exit(1); }
}
console.log("roster fill matches the web app on 300 random cases");
