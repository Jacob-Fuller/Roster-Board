// App Store screenshots (6.9" iPhone, 1290x2796) of the native app with sample
// data, set in decorative charcoal-and-gold scenes that match the crest icon.
// The first two screenshots are one panorama: a tilted phone spans the join.
import { chromium } from "playwright";
import { mkdirSync, readFileSync } from "node:fs";

const OUT = "screens/appstore";
const CREST = readFileSync("assets/icon.png").toString("base64");
const SERIF = readFileSync("node_modules/@expo-google-fonts/fraunces/700Bold/Fraunces_700Bold.ttf").toString("base64");
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
{ // a little overtime and training last month too
  const pk = (n) => key(new Date(Y, M - 1, n));
  for (const [n, e] of [[6, { id: "pot1", typeId: "overtime", hours: 4, baseTypeId: "t-day" }], [20, { id: "ptr", typeId: "t-train" }], [24, { id: "pot2", typeId: "overtime", hours: 6, baseTypeId: "t-day" }]]) {
    if (!shifts[pk(n)]) (shifts[pk(n)] = []).push(e);
  }
}
const DETAIL_DAY = swapTo || splitDay || otDay || 6;
const data = {
  types, shifts, notes,
  leave: {},
  swaps,
  payTags: Object.assign({}, otDay ? { [day(otDay)]: [{ id: "al1", kind: "allowance", allowanceId: "a-meal" }] } : {}),
  birthdays: [
    ...(bday ? [{ id: "b1", name: "Sam Taylor", day: bday, month: M + 1, year: 1990, source: "contacts", contactKey: "sam taylor|" + bday + "|" + (M + 1) }] : []),
    ...[
      ["Mum", 9, 1, null, false], ["Jordan Lee", 3, 2, null, true], ["Riley Brooks", 21, 2, 1987, true], ["Casey Nguyen", 14, 3, null, true],
      ["Dad", 27, 3, null, false], ["Morgan Hayes", 2, 4, 1992, true], ["Jamie Clarke", 18, 5, null, true], ["Ash Patel", 30, 5, null, true],
      ["Charlie Evans", 7, 6, 1995, true], ["Nan", 15, 7, null, false], ["Drew Mitchell", 23, 8, null, true], ["Taylor Brown", 11, 9, 1989, true],
      ["Kim Walker", 5, 11, null, true], ["Lee Harris", 19, 11, 1991, true], ["Pat O'Neill", 28, 12, null, true],
    ].map(([name, d, mo, year, fromContacts], i) => Object.assign(
      { id: "bb" + i, name, day: d, month: mo },
      year ? { year } : {},
      fromContacts ? { source: "contacts", contactKey: String(name).toLowerCase() + "|" + d + "|" + mo } : {},
    )),
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
  { id: "f-day", name: "Dayshift", icon: "sunny", color: "#E8B339", ink: "#241900", kind: "work", startTime: "07:00", endTime: "17:00", hours: 10 },
  { id: "f-night", name: "Nightshift", icon: "moon", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "20:00", endTime: "06:00", hours: 10 },
];
// their rotation: 2 days, 2 nights, 4 off
const friendShifts = {};
const fcycle = ["f-day", "f-day", "f-night", "f-night", null, null, null, null];
for (let n = -6; n <= last + 8; n++) { const id = fcycle[((n + 5) % 8 + 8) % 8]; if (id) friendShifts[key(new Date(Y, M, n))] = [{ id: "f" + n, typeId: id }]; }
const friendData = { types: friendTypes, shifts: friendShifts, leave: {} };

const UID = "00000000-0000-4000-8000-000000000001";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "you@rosterboard.net", user_metadata: { name: "Taylor" }, app_metadata: { provider: "email" }, created_at: "2026-01-01T00:00:00Z" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: UID, role: "authenticated", exp: 4102444800 }) + ".sig";
const session = { access_token: token, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
const conns = [{ id: "c1", requester_id: UID, target_id: "u2", requester_email: user.email, target_email: "alex@rosterboard.net", status: "accepted" }];

const browser = await chromium.launch(process.env.CHROME ? { executablePath: process.env.CHROME } : {});
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
  { eyebrow: "SHIFTS, EVENTS, BIRTHDAYS", title: "The only shift app you'll ever need", img: await capture("light", async () => {}) },
  { eyebrow: "ROSTER SHARING", title: "See your family and friends' rosters", img: await capture("light", async (p) => {
    await tab(/Account/)(p);
    await click(p, p.getByText("Shared Rosters", { exact: true }));
    await click(p, p.getByText("alex@rosterboard.net", { exact: true }));
  }) },
  { eyebrow: "SHIFT SWAPS", title: "Swap shifts and keep track", img: await capture("light", async (p) => {
    await click(p, p.getByLabel(new Date(Y, M, DETAIL_DAY).toDateString(), { exact: true }));
  }) },
  { eyebrow: "FULL REPORTS", title: "Every hour tracked and compared", img: await capture("light", async (p) => {
    await tab(/Reports/)(p);
    await scrollTo(p, "By Shift Type");
  }) },
  { eyebrow: "ESTIMATED PAY", title: "Know your pay before payday", img: await capture("light", async (p) => {
    await tab(/Reports/)(p);
    await click(p, p.getByText(/^Breakdown/));
  }) },
  { eyebrow: "BIRTHDAYS", title: "Birthdays straight from your contacts", img: await capture("light", async (p) => {
    await tab(/Account/)(p);
    await click(p, p.getByText("Birthdays", { exact: true }));
  }) },
  { eyebrow: "MAKE IT YOURS", title: "Full or part time, light or dark", img: await capture("dark", async (p) => {
    await tab(/Account/)(p);
    await p.getByText("Appearance", { exact: true }).first().evaluate((el) => el.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(500);
  }) },
  { eyebrow: "ROSTER PATTERNS", title: "Fill a whole year in one tap", img: await capture("light", tab(/Roster/)) },
  { eyebrow: "YOUR SHIFTS", title: "Your shifts, your colours", img: await capture("light", tab(/Types/)) },
];


const GOLD = "#D4A946";
const css = `
  @font-face{font-family:Crest;src:url(data:font/ttf;base64,${SERIF}) format("truetype")}
  *{margin:0;box-sizing:border-box}
  body{overflow:hidden;font-family:Inter,"Segoe UI",Helvetica,Arial,sans-serif;background:#0B0B0D}
  .bg{position:absolute;inset:0;background:radial-gradient(90% 45% at 50% 6%, #3A352C 0%, #1C1B19 45%, #0B0B0D 100%)}
  .rays{position:absolute;inset:0;background:repeating-conic-gradient(from 0deg at 50% -6%, rgba(212,169,70,.075) 0deg 3deg, transparent 3deg 11deg);
    -webkit-mask-image:radial-gradient(70% 55% at 50% 0%, #000 0%, transparent 100%)}
  .frame{position:absolute;inset:44px;border:2px solid rgba(212,169,70,.35);border-radius:64px}
  .frame:after{content:"";position:absolute;inset:14px;border:1px solid rgba(212,169,70,.16);border-radius:52px}
  .eb{color:${GOLD};letter-spacing:.3em;font-size:50px;font-weight:700}
  h1{font-family:Crest,Georgia,serif;color:#F3EFE6;font-size:112px;line-height:1.06;font-weight:700}
  .rule{width:150px;height:4px;margin:44px auto 0;background:linear-gradient(90deg,transparent,${GOLD},transparent)}
  .phone{position:absolute;border-radius:150px;background:linear-gradient(145deg,#4A4640,#141312);padding:24px;
    box-shadow:0 60px 140px rgba(0,0,0,.65),0 0 0 3px rgba(212,169,70,.55),0 0 160px rgba(212,169,70,.18)}
  .phone img{display:block;width:100%;border-radius:128px}
  .glow{position:absolute;border-radius:50%;background:radial-gradient(closest-side, rgba(212,169,70,.28), transparent)}
  .crest{border-radius:22.4%;box-shadow:0 30px 80px rgba(0,0,0,.6),0 0 0 2px rgba(212,169,70,.5)}
  .star{position:absolute;width:46px;height:46px;background:${GOLD};clip-path:polygon(50% 0,60% 40%,100% 50%,60% 60%,50% 100%,40% 60%,0 50%,40% 40%)}
`;
const img = (b64) => `<img src="data:image/png;base64,${b64}">`;
async function render(w, html, files) {
  const ctx = await browser.newContext({ viewport: { width: w, height: 2796 }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><head><style>${css}</style></head><body style="width:${w}px;height:2796px">${html}</body></html>`);
  await p.waitForTimeout(1200);
  for (const [x, name] of files) await p.screenshot({ path: `${OUT}/${name}`, clip: { x, y: 0, width: 1290, height: 2796 } });
  await ctx.close();
}

// 1 + 2: panorama, one tilted phone across the join
const [hero, ...rest] = shots;
await render(2580, `
  <div class="bg" style="width:2580px"></div><div class="rays" style="width:2580px"></div>
  <div class="frame" style="right:auto;width:1202px"></div><div class="frame" style="left:1334px;width:1202px"></div>
  <div style="position:absolute;left:0;width:1290px;top:190px;text-align:center">
    <img class="crest" src="data:image/png;base64,${CREST}" style="width:300px;height:300px">
    <div class="eb" style="margin-top:70px">ROSTER BOARD</div>
    <h1 style="margin:40px 110px 0">${hero.title}</h1><div class="rule"></div>
  </div>
  <div class="glow" style="left:590px;top:1200px;width:1600px;height:1600px"></div>
  <div class="phone" style="left:800px;top:1020px;width:1080px;transform:rotate(-9deg)">${img(hero.img)}</div>
  <div style="position:absolute;left:1290px;width:1290px;top:250px;text-align:center">
    <div class="eb">${hero.eyebrow}</div><h1 style="margin:40px 120px 0">All on one calendar</h1><div class="rule"></div>
  </div>
  <div class="star" style="left:250px;top:2350px"></div><div class="star" style="left:2290px;top:1180px;width:34px;height:34px"></div>
`, [[0, "iphone-6.9-1.png"], [1290, "iphone-6.9-2.png"]]);

// 3 onward: one scene each, the phone tilting left and right in turn
for (let i = 0; i < rest.length; i++) {
  const s = rest[i], tilt = i % 2 ? 4 : -4;
  await render(1290, `
    <div class="bg"></div><div class="rays"></div><div class="frame"></div>
    <div style="position:absolute;left:0;right:0;top:220px;text-align:center">
      <div class="eb">${s.eyebrow}</div><h1 style="margin:40px 110px 0">${s.title}</h1><div class="rule"></div>
    </div>
    <div class="glow" style="left:-100px;top:1100px;width:1490px;height:1490px"></div>
    <div class="phone" style="left:130px;top:880px;width:1030px;transform:rotate(${tilt}deg)">${img(s.img)}</div>
    <div class="star" style="left:${tilt < 0 ? 1110 : 150}px;top:760px;width:36px;height:36px"></div>
  `, [[0, `iphone-6.9-${i + 3}.png`]]);
}
await browser.close();
console.log("App Store screenshots written to " + OUT);
