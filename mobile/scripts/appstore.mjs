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
  { id: "t-day", name: "Dayshift", color: "#E8B339", ink: "#241900", kind: "work", startTime: "07:00", endTime: "19:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 0 },
  { id: "t-night", name: "Nightshift", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "19:00", endTime: "07:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 1 },
  { id: "t-train", name: "Training", color: "#3FC5C0", ink: "#062523", kind: "work", startTime: "08:00", endTime: "16:00", hours: 8, overtimeEligible: false, excessEligible: false, order: 2 },
  { id: "t-gym", name: "Gym", color: "#3ECF8E", ink: "#04241A", kind: "personal", time: "06:00", startTime: "06:00", allDay: false, hours: 0, order: 3 },
];
// a 4-week rotation stamped over the whole year
const pattern = [
  [["t-day"], ["t-day"], [], [], ["t-night"], ["t-night"], []],
  [[], ["t-day"], ["t-day"], ["t-night"], ["t-night"], [], []],
  [["t-day"], [], ["t-day"], ["t-day"], [], ["t-night"], ["t-night"]],
  [[], [], ["t-night"], ["t-night"], ["t-day"], [], ["t-train"]],
];
const shifts = {};
const start = new Date(Y, 0, 1);
const lead = (start.getDay() + 6) % 7;
for (let d = new Date(start); d.getFullYear() === Y; d.setDate(d.getDate() + 1)) {
  const idx = Math.floor((Math.round((d - start) / 86400000) + lead) / 7) % 4;
  const ids = pattern[idx][(d.getDay() + 6) % 7];
  if (ids.length) shifts[key(d)] = ids.map((typeId, i) => ({ id: "s" + key(d) + i, typeId }));
}
const day = (n) => key(new Date(Y, M, n));
const add = (n, e) => (shifts[day(n)] = shifts[day(n)] || []).push(e);
add(6, { id: "ot1", typeId: "overtime", hours: 3, baseTypeId: "t-day" });
add(14, { id: "sp1", typeId: "overtime", hours: 4, excessHours: 8, baseTypeId: "t-day" });
add(3, { id: "g1", typeId: "t-gym" }); add(17, { id: "g2", typeId: "t-gym" });
const data = {
  types, shifts,
  notes: {
    [day(now.getDate())]: [{ id: "n0", text: "Pick up Hayley", category: "family", time: "15:30", remind: true }],
    [day(5)]: [{ id: "n1", text: "Dentist", category: "appointment", time: "10:30" }],
    [day(18)]: [{ id: "n2", text: "Team BBQ", category: "family", allDay: true }],
  },
  leave: { [day(29)]: [{ id: "l1", kind: "annual", hours: 12 }], [day(30)]: [{ id: "l2", kind: "annual", hours: 12 }] },
  swaps: {}, payTags: { [day(26)]: [{ id: "ph1", kind: "holiday" }] },
  birthdays: [{ id: "b1", name: "Sam Taylor", day: 12, month: M + 1, year: 1990 }],
  roster: { weeks: 4, pattern, updatedAt: 1 },
  settings: { hourlyRate: 46.5, otMultiplier: 1.5, excessMultiplier: 1, payLeave: true, updatedAt: 1 },
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
  { eyebrow: "EVERY DETAIL", title: "Overtime, swaps and leave", img: await capture("light", async (p) => {
    await p.getByLabel(new Date(Y, M, 6).toDateString(), { exact: true }).first().click(); await p.waitForTimeout(800);
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
