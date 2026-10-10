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
// a shift swapped with a workmate: the first Dayshift after the overtime days moves to a free day
const swapFrom = (() => { for (let n = (trainDay || 15) + 1; n <= last; n++) { const l = shifts[day(n)] || []; if (l.length === 1 && l[0].typeId === "t-day") return n; } return null; })();
const swapTo = take((n) => n > (swapFrom || 0) + 1 && dow(n) < 5);
const swaps = {};
if (swapFrom && swapTo) {
  const orig = shifts[day(swapFrom)][0];
  delete shifts[day(swapFrom)];
  const ne = { id: "sw-new", typeId: "t-day" };
  add(swapTo, ne);
  swaps[day(swapFrom)] = [{ id: "sw-off", kind: "off", partner: "Chris", note: "Family wedding", linkedDate: day(swapTo), linkedSwapId: "sw-on", typeId: "t-day", baseTypeId: null, hours: null, shiftEntryId: orig.id }];
  swaps[day(swapTo)] = [{ id: "sw-on", kind: "on", partner: "Chris", note: "Family wedding", linkedDate: day(swapFrom), linkedSwapId: "sw-off", typeId: "t-day", baseTypeId: null, hours: null, shiftEntryId: "sw-new" }];
}
const DETAIL_DAY = swapTo || splitDay || otDay || 6;
const data = {
  types, shifts, notes,
  leave: {},
  swaps,
  payTags: Object.assign(ph ? { [day(ph)]: [{ id: "ph1", kind: "holiday" }] } : {}, otDay ? { [day(otDay)]: [{ id: "al1", kind: "allowance", allowanceId: "a-meal" }] } : {}),
  birthdays: [
    ...(bday ? [{ id: "b1", name: "Sam Taylor", day: bday, month: M + 1, year: 1990, source: "contacts", contactKey: "sam taylor|" + bday + "|" + (M + 1) }] : []),
    { id: "b2", name: "Jordan Lee", day: 3, month: ((M + 1) % 12) + 1, source: "contacts", contactKey: "jordan lee|3" },
    { id: "b3", name: "Riley Brooks", day: 21, month: ((M + 2) % 12) + 1, year: 1987, source: "contacts", contactKey: "riley brooks|21" },
    { id: "b4", name: "Mum", day: 9, month: ((M + 3) % 12) + 1 },
    { id: "b5", name: "Casey Nguyen", day: 27, month: ((M + 5) % 12) + 1, source: "contacts", contactKey: "casey nguyen|27" },
  ],
  roster: { weeks: 2, pattern, updatedAt: 1 },
  settings: {
    employment: "part",
    pay: {
      savedAt: 1, baseRate: 38.5, cycle: "fortnightly", periodStart: "2026-01-05",
      otMult: 1.5, otTiered: true, otTierHours: 2, otMult2: 2, exMult: 1,
      pen: { sat: 50, sun: 75, ph: 150, night: 15 },
      typeRules: { "t-day": { penalties: true }, "t-night": { penalties: true, night: true }, "t-train": { penalties: false } },
      allowances: [{ id: "a-meal", name: "Meal allowance", kind: "flat", amount: 16.8 }],
      payLeave: true, leaveLoading: 17.5, superPct: 12, showTax: true, taxFree: true,
    },
    updatedAt: 1,
  },
  tombstones: {},
};

// A friend's roster for the sharing screen (their own shift types and colours).
const friendTypes = [
  { id: "f-am", name: "Early", color: "#3ECF8E", ink: "#04241A", kind: "work", startTime: "06:00", endTime: "14:30", hours: 8.5 },
  { id: "f-pm", name: "Late", color: "#A76BF0", ink: "#FFFFFF", kind: "work", startTime: "14:00", endTime: "22:30", hours: 8.5 },
  { id: "f-nt", name: "Night", color: "#E5484D", ink: "#FFFFFF", kind: "work", startTime: "22:00", endTime: "06:30", hours: 8.5 },
];
const friendShifts = {};
const fcycle = ["f-am", "f-am", "f-am", null, null, "f-pm", "f-pm", "f-pm", null, "f-nt", "f-nt", null, null, null];
for (let n = 1; n <= last; n++) { const id = fcycle[(n + 3) % fcycle.length]; if (id) friendShifts[day(n)] = [{ id: "f" + n, typeId: id }]; }
const friendData = { types: friendTypes, shifts: friendShifts, leave: {} };

const UID = "00000000-0000-4000-8000-000000000001";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "you@rosterboard.net", user_metadata: { name: "Taylor" }, app_metadata: { provider: "email" }, created_at: "2026-01-01T00:00:00Z" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: UID, role: "authenticated", exp: 4102444800 }) + ".sig";
const session = { access_token: token, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
const conns = [{ id: "c1", requester_id: UID, target_id: "u2", requester_email: user.email, target_email: "alex@rosterboard.net", status: "accepted" }];

const browser = await chromium.launch();
async function capture(theme, steps) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: theme });
  const p = await ctx.newPage();
  await p.route(/supabase\.co\//, async (route) => {
    const u = route.request().url(), m = route.request().method();
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("/auth/v1/")) return json(session);
    if (u.includes("/rest/v1/app_data")) return m === "GET" ? json({ data, updated_at: new Date().toISOString() }) : json([{ user_id: UID }]);
    if (u.includes("/rest/v1/connections")) return json(conns);
    if (u.includes("/rpc/get_shared_roster")) return json(friendData);
    if (u.includes("/rest/v1/complimentary_access")) return json([]);
    return json([]);
  });
  await p.addInitScript(([d, theme, sess]) => {
    localStorage.setItem("rosterBoard.v2", d);
    localStorage.setItem("rosterBoard.owner", JSON.parse(sess).user.id);
    localStorage.setItem("rosterBoard.onboardingSeen", "1");
    localStorage.setItem("rosterBoard.prefs", JSON.stringify({ theme, hideEvents: false, hideBirthdays: false }));
    localStorage.setItem("sb-ebwfzcbynbsucrjnlumg-auth-token", sess);
  }, [JSON.stringify(data), theme, JSON.stringify(session)]);
  await p.goto(URL);
  await p.waitForTimeout(3000);
  await steps(p);
  await p.waitForTimeout(800);
  const buf = await p.screenshot();
  await ctx.close();
  return buf.toString("base64");
}
const tab = (name) => async (p) => { await p.getByRole("tab", { name }).click(); await p.waitForTimeout(600); };

const click = (p, loc) => loc.first().click().then(() => p.waitForTimeout(900));
const scrollTo = (p, text) => p.getByText(text, { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "start" })).then(() => p.waitForTimeout(500));
const shots = [
  { eyebrow: "ONE APP FOR IT ALL", title: "Shifts, events and birthdays in one place", img: await capture("light", async () => {}) },
  { eyebrow: "ROSTER SHARING", title: "See your family and friends' rosters", img: await capture("light", async (p) => {
    await tab(/Account/)(p);
    await click(p, p.getByText("Shared rosters", { exact: true }));
    await click(p, p.getByText("alex@rosterboard.net", { exact: true }));
  }) },
  { eyebrow: "SHIFT SWAPS", title: "Swap shifts and keep track", img: await capture("light", async (p) => {
    await click(p, p.getByLabel(new Date(Y, M, DETAIL_DAY).toDateString(), { exact: true }));
  }) },
  { eyebrow: "FULL REPORTS", title: "Every hour tracked and compared", img: await capture("light", async (p) => {
    await tab(/Reports/)(p);
    await scrollTo(p, "By shift type");
  }) },
  { eyebrow: "YOUR PAY, YOUR RULES", title: "Set it up to match your payslip", img: await capture("light", async (p) => {
    await tab(/Reports/)(p);
    await click(p, p.getByText("Pay setup", { exact: true }));
  }) },
  { eyebrow: "ESTIMATED PAY", title: "Know your pay before payday", img: await capture("light", async (p) => {
    await tab(/Reports/)(p);
    await click(p, p.getByText("Breakdown ›", { exact: true }));
  }) },
  { eyebrow: "BIRTHDAYS", title: "Birthdays straight from your contacts", img: await capture("light", async (p) => {
    await tab(/Account/)(p);
    await click(p, p.getByRole("button", { name: /^Birthdays/ }));
  }) },
  { eyebrow: "MAKE IT YOURS", title: "Full or part time, light or dark", img: await capture("dark", async (p) => {
    await tab(/Account/)(p);
    await p.getByText("Appearance", { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(500);
  }) },
  { eyebrow: "ROSTER PATTERNS", title: "Fill a whole year in one tap", img: await capture("light", tab(/Roster/)) },
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
    h1{font-family:Fraunces,Georgia,serif;color:#F7F3EC;font-size:108px;line-height:1.08;margin:40px 80px 0;font-weight:700}
    .phone{position:relative;margin:90px auto 0;width:1080px;border-radius:150px;background:#1B1E24;padding:26px;
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
