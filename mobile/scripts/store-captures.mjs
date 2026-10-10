// Raw captures of the native app (web preview) with realistic sample data for October 2026,
// used to build the designed App Store screenshots. Writes PNGs, the roster PDF pages as HTML,
// and the positions of key labels to screens/store/.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

const OUT = "screens/store";
mkdirSync(OUT, { recursive: true });
const URL = "http://localhost:8090/";
const NOW = new Date(2026, 9, 10, 9, 0, 0);
const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");

const types = [
  { id: "t_day", name: "Dayshift", color: "#E8B339", ink: "#241900", kind: "work", startTime: "07:00", endTime: "19:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 0 },
  { id: "t_night", name: "Nightshift", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "19:00", endTime: "07:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 1 },
  { id: "t_train", name: "Training", color: "#3FC5C0", ink: "#062523", kind: "work", startTime: "08:00", endTime: "16:00", hours: 8, overtimeEligible: false, excessEligible: false, order: 2 },
];
// 4-week rotation: 2 days then 2 nights, at least two days off after nights.
function rotation(starts) {
  const P = starts.map((s) => { const w = [[], [], [], [], [], [], []]; w[s] = ["t_day"]; w[s + 1] = ["t_day"]; w[s + 2] = ["t_night"]; w[s + 3] = ["t_night"]; return w; });
  const shifts = {};
  for (let d = new Date(2026, 0, 5), i = 0; d <= new Date(2026, 11, 31); d.setDate(d.getDate() + 1), i++) {
    const ids = P[Math.floor(i / 7) % 4][i % 7];
    if (ids.length) shifts[key(d)] = ids.map((typeId, j) => ({ id: "s" + key(d) + j, typeId }));
  }
  return { P, shifts };
}
const { P: pattern, shifts } = rotation([0, 2, 1, 1]);
const leave = {};
const lv = (k, kind) => { delete shifts[k]; (leave[k] = leave[k] || []).push({ id: "l" + k, kind, hours: 12 }); };
for (const k of ["2026-02-18", "2026-05-13", "2026-08-19", "2026-10-19"]) if (!shifts[k]) shifts[k] = [{ id: "tr" + k, typeId: "t_train" }];
for (const [k, h] of [["2026-03-07", 8], ["2026-04-25", 12], ["2026-06-13", 8], ["2026-07-18", 6], ["2026-09-20", 12], ["2026-10-17", 8], ["2026-11-14", 10]])
  if (!shifts[k]) shifts[k] = [{ id: "ot" + k, typeId: "overtime", hours: h, baseTypeId: "t_day" }];
for (const k of ["2026-07-01", "2026-07-02", "2026-07-03", "2026-09-14", "2026-09-15", "2026-09-16"]) lv(k, "annual");
lv("2026-03-19", "sick"); lv("2026-10-07", "sick");
const swaps = {};
{
  const off = "2026-10-12", on = "2026-10-20";
  const orig = shifts[off][0];
  delete shifts[off];
  shifts[on] = [{ id: "sw-new", typeId: "t_day" }];
  swaps[off] = [{ id: "sw-off", kind: "off", partner: "Sam", note: null, linkedDate: on, linkedSwapId: "sw-on", typeId: "t_day", baseTypeId: null, hours: null, shiftEntryId: orig.id }];
  swaps[on] = [{ id: "sw-on", kind: "on", partner: "Sam", note: null, linkedDate: off, linkedSwapId: "sw-off", typeId: "t_day", baseTypeId: null, hours: null, shiftEntryId: "sw-new" }];
}
const notes = {
  "2026-10-05": [{ id: "n1", text: "Dentist", category: "appointment", time: "09:30" }],
  "2026-10-18": [{ id: "n2", text: "Team BBQ", category: "family", time: "12:00" }],
  "2026-10-24": [{ id: "n3", text: "Gym", category: "reminder", time: "06:00" }],
  "2026-10-27": [{ id: "n4", text: "Car service", category: "appointment", allDay: true }],
};
const contact = (name, d, mo) => ({ id: "c-" + name, name, day: d, month: mo, source: "contacts", contactKey: name.toLowerCase() + "|" + d + "|" + mo });
const birthdays = [
  { id: "b1", name: "Mia", day: 9, month: 10 }, { id: "b2", name: "Dad", day: 21, month: 10 },
  contact("Grace Walker", 27, 10), contact("Liam Carter", 3, 11), contact("Ava Thompson", 12, 11),
  contact("Jack Morrison", 19, 11), contact("Ruby Adams", 15, 12), contact("Ethan Clarke", 8, 1),
];
const data = {
  types, shifts, notes, leave, swaps, payTags: {}, birthdays,
  roster: { weeks: 4, pattern, updatedAt: 1 },
  settings: {
    employment: "full",
    pay: { savedAt: 1, baseRate: 42.5, cycle: "fortnightly", periodStart: "2026-09-28", otMult: 1.5, exMult: 1,
      pen: { sat: 25, sun: 50, ph: 0, night: 15 }, typeRules: {}, allowances: [], payLeave: true, leaveLoading: 17.5, superPct: 12, showTax: true, taxFree: true },
    updatedAt: 1,
  },
  tombstones: {},
};
// A workmate's roster for the sharing screen: own rotation, work shifts only.
const friendData = { types: types.slice(0, 2), shifts: rotation([2, 0, 3, 1]).shifts, leave: {} };

const UID = "00000000-0000-4000-8000-000000000001";
const user = { id: UID, aud: "authenticated", role: "authenticated", email: "you@example.com", user_metadata: {}, app_metadata: { provider: "email" }, created_at: "2026-01-01T00:00:00Z" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const token = b64({ alg: "HS256", typ: "JWT" }) + "." + b64({ sub: UID, role: "authenticated", exp: 4102444800 }) + ".sig";
const session = { access_token: token, refresh_token: "r", token_type: "bearer", expires_in: 3600, expires_at: 4102444800, user };
const conns = [{ id: "c1", requester_id: UID, target_id: "u2", requester_email: user.email, target_email: "sam@example.com", status: "accepted" }];

const ANCHORS = ["Roster pattern", "Rotation length", "Stamp onto calendar", "By shift type", "Weekdays vs weekends", "Estimated pay",
  "Compared with", "Previous", "Swaps", "Shifts", "Leave", "Birthdays", "Personal events", "Shift alarm", "Appearance", "Account", "October 2026"];

const browser = await chromium.launch();
async function capture(name, theme, steps, extra) {
  const ctx = await browser.newContext({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 3, colorScheme: theme });
  const p = await ctx.newPage();
  await p.clock.setFixedTime(NOW);
  await p.route(/supabase\.co\//, async (route) => {
    const u = route.request().url(), m = route.request().method();
    const json = (body) => route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    if (u.includes("/auth/v1/user")) return json(user);
    if (u.includes("/auth/v1/")) return json(session);
    if (u.includes("/rest/v1/app_data")) return m === "GET" ? json({ data, updated_at: new Date().toISOString() }) : json([{ user_id: UID }]);
    if (u.includes("/rest/v1/connections")) return json(conns);
    if (u.includes("/rpc/get_shared_roster")) return json(friendData);
    return json([]);
  });
  await p.addInitScript(([d, theme, sess]) => {
    localStorage.setItem("rosterBoard.v2", d);
    localStorage.setItem("rosterBoard.owner", JSON.parse(sess).user.id);
    localStorage.setItem("rosterBoard.onboardingSeen", "1");
    localStorage.setItem("rosterBoard.prefs", JSON.stringify({ theme, hideEvents: false, hideBirthdays: false }));
    localStorage.setItem("sb-ebwfzcbynbsucrjnlumg-auth-token", sess);
  }, [JSON.stringify(data), theme, JSON.stringify(session)]);
  try {
    await p.goto(URL);
    await p.waitForTimeout(3000);
    await steps(p);
    await p.waitForTimeout(900);
    await p.screenshot({ path: `${OUT}/${name}.png` });
    const rects = await p.evaluate((anchors) => {
      const out = {};
      const all = [...document.querySelectorAll("div,span")];
      for (const a of anchors) {
        const el = all.find((e) => e.childElementCount === 0 && e.textContent.trim() === a && e.getBoundingClientRect().height > 0);
        if (el) { const r = el.getBoundingClientRect(); out[a] = [r.x, r.y, r.width, r.height]; }
      }
      return out;
    }, ANCHORS);
    writeFileSync(`${OUT}/${name}.json`, JSON.stringify(rects, null, 1));
    if (extra) await extra(p);
    console.log("ok " + name);
  } catch (e) {
    console.log("FAILED " + name + ": " + e.message);
    await p.screenshot({ path: `${OUT}/${name}-failed.png` }).catch(() => {});
  }
  await ctx.close();
}
const tab = async (p, name) => { await p.getByRole("tab", { name }).click(); await p.waitForTimeout(700); };
const click = (p, loc) => loc.first().click().then(() => p.waitForTimeout(900));
const scrollTo = (p, text, block = "start") => p.getByText(text, { exact: true }).first().evaluate((el, b) => el.scrollIntoView({ block: b }), block).then(() => p.waitForTimeout(600));
const dayCell = (p, n) => p.getByLabel(new Date(2026, 9, n).toDateString(), { exact: true });
const savePdf = (file) => async (p) => {
  await click(p, p.getByText("PDF roster", { exact: true }));
  await p.waitForTimeout(1200);
  const html = await p.evaluate(() => { const f = document.querySelector("iframe"); return f ? f.srcdoc || f.getAttribute("srcdoc") : ""; });
  writeFileSync(`${OUT}/${file}`, html || "");
};

await capture("light-calendar", "light", async () => {});
await capture("dark-calendar", "dark", async () => {});
await capture("dark-stats", "dark", async (p) => { await tab(p, /Reports/); await scrollTo(p, "By shift type"); });
await capture("light-roster", "light", async (p) => { await tab(p, /Roster/); });
await capture("light-reports", "light", async (p) => { await tab(p, /Reports/); });
await capture("light-stats", "light", async (p) => { await tab(p, /Reports/); await scrollTo(p, "By shift type"); });
await capture("light-weekdays", "light", async (p) => { await tab(p, /Reports/); await scrollTo(p, "Weekdays vs weekends"); });
await capture("light-reports-end", "light", async (p) => { await tab(p, /Reports/); await p.mouse.move(215, 500); await p.mouse.wheel(0, 6000); await p.waitForTimeout(700); },
  savePdf("pdf-oct.html"));
await capture("light-reports-sep", "light", async (p) => {
  await tab(p, /Reports/);
  await click(p, p.getByLabel(/Previous/i));
  await p.mouse.move(215, 500); await p.mouse.wheel(0, 6000); await p.waitForTimeout(700);
}, savePdf("pdf-sep.html"));
await capture("light-day12", "light", async (p) => { await click(p, dayCell(p, 12)); });
await capture("light-day20", "light", async (p) => { await click(p, dayCell(p, 20)); });
await capture("light-shared", "light", async (p) => {
  await tab(p, /Account/);
  await click(p, p.getByText("Shared rosters", { exact: true }));
  await click(p, p.getByText("sam@example.com", { exact: true }));
});
await capture("light-birthdays", "light", async (p) => { await tab(p, /Account/); await click(p, p.getByRole("button", { name: /^Birthdays/ })); });
await capture("light-account", "light", async (p) => { await tab(p, /Account/); });
await browser.close();
console.log("Store captures written to " + OUT);
