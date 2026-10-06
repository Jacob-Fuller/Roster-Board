// Checks the native merge rules against the web app's own code (../index.html)
// on random data. Run: npm test
import { readFileSync } from "node:fs";
import { mergeSnapshots, sameSnapshot } from "./merge.ts";

const html = readFileSync(new URL("../../../index.html", import.meta.url), "utf8");
const start = html.indexOf("  function mergeTombstones(");
const end = html.indexOf("  function localSnapshot(");
const web = new Function(html.slice(start, end) + "\nreturn { mergeSnapshots, sameSnapshot };")();

let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
const pick = <T,>(a: T[]) => a[Math.floor(rnd() * a.length)];
const ids = Array.from({ length: 12 }, (_, i) => "r" + i);
const days = ["2026-10-01", "2026-10-02", "2026-10-03"];
function buckets() {
  const b: any = {};
  ids.forEach((id) => { if (rnd() < 0.4) (b[pick(days)] ||= []).push({ id, typeId: "t", updatedAt: rnd() < 0.5 ? Math.floor(rnd() * 100) : undefined, v: rnd() }); });
  return b;
}
function snap() {
  const tomb: any = {}; ids.forEach((id) => { if (rnd() < 0.15) tomb[id] = Math.floor(rnd() * 100); });
  return {
    types: ids.filter(() => rnd() < 0.3).map((id) => ({ id, name: id, updatedAt: Math.floor(rnd() * 100) })),
    shifts: buckets(), notes: buckets(), leave: buckets(), swaps: buckets(), payTags: buckets(),
    birthdays: ids.filter(() => rnd() < 0.2).map((id) => ({ id, name: id, day: 1, month: 1 })),
    roster: { weeks: 1, pattern: [[[pick(["a", "b"])], [], [], [], [], [], []]], updatedAt: Math.floor(rnd() * 3) },
    settings: { hourlyRate: Math.floor(rnd() * 3), updatedAt: Math.floor(rnd() * 3) },
    tombstones: tomb,
  };
}
let n = 0;
for (let i = 0; i < 3000; i++) {
  const a = snap(), b = rnd() < 0.1 ? null : snap();
  const mine = mergeSnapshots(structuredClone(a) as any, structuredClone(b));
  const theirs = web.mergeSnapshots(structuredClone(a), structuredClone(b));
  if (JSON.stringify(mine) !== JSON.stringify(theirs)) { console.error("MISMATCH", i); process.exit(1); }
  if (sameSnapshot(mine, theirs) !== web.sameSnapshot(mine, theirs)) { console.error("sameSnapshot mismatch", i); process.exit(1); }
  n++;
}
console.log("merge matches the web app on " + n + " random cases");
