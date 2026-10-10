// App Store screenshots (6.9" iPhone, 1290x2796) of the native app with sample
// data, framed and captioned in the same navy/gold style as the earlier set.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const OUT = "screens/appstore";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:8090/";
const now = new Date();
const Y = now.getFullYear(), M = now.getMonth();
const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const types = [
  { id: "t-day", name: "Dayshift", icon: "sunny", color: "#E8B339", ink: "#241900", kind: "work", startTime: "07:00", endTime: "17:00", hours: 10, overtimeEligible: true, excessEligible: true, order: 0 },
  { id: "t-night", name: "Nightshift", icon: "moon", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "20:00", endTime: "06:00", hours: 10, overtimeEligible: true, excessEligible: true, order: 1 },
  { id: "t-train", name: "Training", icon: "school", color: "#3FC5C0", ink: "#062523", kind: "work", startTime: "08:00", endTime: "16:00", hours: 8, overtimeEligible: false, excessEligible: false, order: 2 },
];
// A realistic 2-week rotation of 10-hour shifts (about 36 hours a week, never a night straight into a day).
const pattern = [
  [["t-day"], ["t-day"], ["t-night"], ["t-night"], [], [], []],
  [[], [], [], ["t-day"], ["t-day"], [], []],
];
const shifts = {};
const start = new Date(Y, 0, 1);
const lead = (start.getDay() + 6) % 7;
const weekOf = (d) => Math.floor((Math.round((d - new Date(Y, 0, 1)) / 86400000) + lead) / 7) % 2;
for (let d = new Date(start); d.getFullYear() === Y; d.setDate(d.getDate() + 1)) {
  const ids = pattern[weekOf(d)][(d.getDay() + 6) % 7];
  if (ids.length) shifts[key(d)] = ids.map((typeId, i) => ({ id: "s" + key(d) + i, typeId }));
}
const day = (n) => key(new Date(Y, M, n));
const last = new Date(Y, M + 1, 0).getDate();
// free days this month: no shift that day, and not the morning a night shift finishes
const used = {};
const free = [];
for (let n = 2; n <= last; n++) {
  const k = day(n), prev = shifts[key(new Date(Y, M, n - 1))] || [];
  if (!shifts[k] && !prev.some((e) => e.typeId === "t-night")) free.push(n);
}
const take = (pred) => { const n = free.find((x) => !used[x] && pred(x)); if (n) used[n] = true; return n; };
const dow = (n) => (new Date(Y, M, n).getDay() + 6) % 7; // 0 = Monday
const add = (n, e) => { if (n) (shifts[day(n)] = shifts[day(n)] || []).push(e); };
const otDay = take((n) => n > 3);
const splitDay = take((n) => n > (otDay || 0) + 4);
const trainDay = take((n) => n > (splitDay || 0) + 2);
add(otDay, { id: "ot1", typeId: "overtime", hours: 4, baseTypeId: "t-day" });
add(splitDay, { id: "sp1", typeId: "overtime", hours: 2, excessHours: 4, baseTypeId: "t-day" });
add(trainDay, { id: "tr1", typeId: "t-train" });
const dentist = take(() => true), bbq = take((n) => dow(n) >= 5), physio = take(() => true), bday = take(() => true), ph = take(() => true);
const notes = {};
if (dentist) notes[day(dentist)] = [{ id: "n1", text: "Dentist", category: "appointment", time: "10:30" }];
if (physio) notes[day(physio)] = [{ id: "n2", text: "Physio", category: "appointment", time: "14:00" }];
if (bbq) notes[day(bbq)] = [{ id: "n3", text: "Team BBQ", category: "family", allDay: true }];
const DETAIL_DAY = splitDay || otDay || 6;
const data = {
  types, shifts, notes,
  leave: {},
  swaps: {}, payTags: ph ? { [day(ph)]: [{ id: "ph1", kind: "holiday" }] } : {},
  birthdays: bday ? [{ id: "b1", name: "Sam Taylor", day: bday, month: M + 1, year: 1990 }] : [],
  roster: { weeks: 2, pattern, updatedAt: 1 },
  settings: { pay: { savedAt: 1, baseRate: 38.5, cycle: "fortnightly", periodStart: "2026-01-05", otMult: 1.5, otTiered: true, otTierHours: 2, otMult2: 2, exMult: 1, superPct: 12, showTax: true, taxFree: true }, updatedAt: 1 },
  tombstones: {},
};

const browser = await chromium.launch();
async function capture(theme, steps) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: theme });
  const p = await ctx.newPage();
  await p.addInitScript(([d, theme]) => {
    localStorage.setItem("rosterBoard.v2", d);
    localStorage.setItem("rosterBoard.localOnly", "1");
    localStorage.setItem("rosterBoard.onboardingSeen", "1");
    localStorage.setItem("rosterBoard.prefs", JSON.stringify({ theme, hideEvents: false, hideBirthdays: false }));
  }, [JSON.stringify(data), theme]);
  await p.goto(URL);
  await p.waitForTimeout(2500);
  await steps(p);
  await p.waitForTimeout(700);
  const buf = await p.screenshot();
  await ctx.close();
  return buf.toString("base64");
}
const tab = (name) => async (p) => { await p.getByRole("tab", { name }).click(); await p.waitForTimeout(600); };

const shots = [
  { eyebrow: "YOUR ROSTER", title: "Every shift at a glance", img: await capture("light", async () => {}) },
  { eyebrow: "ROSTER PATTERNS", title: "Fill a whole year in one tap", img: await capture("light", tab(/Roster/)) },
  { eyebrow: "ESTIMATED PAY", title: "Know your pay before payday", img: await capture("light", tab(/Reports/)) },
  { eyebrow: "EVERY DETAIL", title: "Log overtime and excess", img: await capture("light", async (p) => {
    await p.getByLabel(new Date(Y, M, DETAIL_DAY).toDateString(), { exact: true }).first().click(); await p.waitForTimeout(800);
  }) },
  { eyebrow: "DARK MODE", title: "Easy on the eyes after a night shift", img: await capture("dark", async () => {}) },
  { eyebrow: "YOUR SHIFTS", title: "Your shifts, your colours", img: await capture("light", tab(/Types/)) },
];

const fonts = `<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=IBM+Plex+Sans:wght@600&display=block" rel="stylesheet">`;
for (let i = 0; i < shots.length; i++) {
  const s = shots[i];
  const ctx = await browser.newContext({ viewport: { width: 1290, height: 2796 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><head>${fonts}<style>
    *{margin:0;box-sizing:border-box} body{width:1290px;height:2796px;overflow:hidden;
    background:radial-gradient(120% 60% at 50% 0%, #3E5F8F 0%, #1F3A5F 45%, #0B1830 100%);font-family:'IBM Plex Sans',sans-serif;text-align:center}
    .eb{color:#E8B339;letter-spacing:.32em;font-size:56px;font-weight:600;margin-top:170px}
    h1{font-family:Fraunces,Georgia,serif;color:#F7F3EC;font-size:118px;line-height:1.08;margin:44px 90px 0;font-weight:700}
    .phone{position:absolute;left:105px;top:${shots[i].title.length > 26 ? 760 : 640}px;width:1080px;border-radius:150px;background:#1B1E24;padding:26px;
      box-shadow:0 40px 120px rgba(0,0,0,.55), inset 0 0 0 4px #3A3F48}
    .phone img{display:block;width:100%;border-radius:126px}
  </style></head><body><div class="eb">${s.eyebrow}</div><h1>${s.title}</h1>
  <div class="phone"><img src="data:image/png;base64,${s.img}"></div></body></html>`);
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `${OUT}/iphone-6.9-${i + 1}.png` });
  await ctx.close();
}
await browser.close();
console.log("App Store screenshots written to " + OUT);
