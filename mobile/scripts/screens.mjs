// Screenshots of the web preview of the native app with sample data, for review.
// Uses "use without an account" mode, so no real account is touched.
import { chromium } from "playwright";
import { mkdirSync, writeFileSync } from "node:fs";

mkdirSync("screens", { recursive: true });
const URL = "http://localhost:8090/";
const now = new Date();
const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const day = (n) => key(new Date(now.getFullYear(), now.getMonth(), n));

const types = [
  { id: "t-day", name: "Day", color: "#E5484D", ink: "#FFFFFF", kind: "work", startTime: "07:00", endTime: "19:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 0 },
  { id: "t-night", name: "Night", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "19:00", endTime: "07:00", hours: 12, overtimeEligible: true, excessEligible: true, order: 1 },
  { id: "t-gym", name: "Gym", color: "#3ECF8E", ink: "#04241A", kind: "personal", time: "06:00", startTime: "06:00", allDay: false, hours: 0, order: 2 },
];
const shifts = {};
[1, 2, 5, 6, 9, 10, 13, 14, 17, 18, 21, 22, 25, 26].forEach((n, i) => { shifts[day(n)] = [{ id: "s" + n, typeId: i % 4 < 2 ? "t-day" : "t-night" }]; });
shifts[day(6)].push({ id: "ot1", typeId: "overtime", hours: 2, baseTypeId: "t-night" });
shifts[day(9)].push({ id: "sp1", typeId: "overtime", hours: 4, excessHours: 8, baseTypeId: "t-day" });
shifts[day(3)] = [{ id: "g1", typeId: "t-gym" }];
const data = {
  types, shifts,
  notes: { [day(7)]: [{ id: "n1", text: "Dentist", category: "appointment", time: "10:30" }], [day(15)]: [{ id: "n2", text: "Hayley's recital", category: "family", allDay: true }] },
  leave: { [day(28)]: [{ id: "l1", kind: "annual", hours: 12 }] },
  swaps: {}, payTags: {},
  birthdays: [{ id: "b1", name: "Kathryn Smith", day: now.getDate(), month: now.getMonth() + 1 }],
  roster: { weeks: 2, pattern: [[["t-day"], ["t-day"], [], [], ["t-night"], ["t-night"], []], [[], [], ["t-day"], ["t-day"], [], [], ["t-night"]]], updatedAt: 1 }, settings: { hourlyRate: 0 }, tombstones: {},
};

const errors = [];
const browser = await chromium.launch();
async function page(theme, seed = true) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: theme === "dark" ? "dark" : "light" });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  p.on("console", (m) => { if (m.type() === "error") errors.push("console: " + m.text()); });
  await p.addInitScript(([d, seed, theme]) => {
    if (!seed) return;
    localStorage.setItem("rosterBoard.v2", d);
    localStorage.setItem("rosterBoard.localOnly", "1");
    if (theme !== "onboarding") localStorage.setItem("rosterBoard.onboardingSeen", "1");
    localStorage.setItem("rosterBoard.prefs", JSON.stringify({ theme: theme === "dark" ? "dark" : "light", hideEvents: false, hideBirthdays: false }));
  }, [JSON.stringify(data), seed, theme]);
  await p.goto(URL);
  await p.waitForTimeout(2500);
  return p;
}
const shot = (p, name) => p.screenshot({ path: "screens/" + name + ".png" });

try {
  let p = await page("light", false);
  await shot(p, "01-sign-in");
  await p.context().close();

  p = await page("onboarding");
  await shot(p, "01b-welcome");
  await p.context().close();

  p = await page("light");
  await shot(p, "02-calendar-light");
  await p.getByLabel(now.toDateString(), { exact: true }).first().click();
  await p.waitForTimeout(800);
  await shot(p, "03-day-sheet");
  await p.mouse.wheel(0, 1500);
  await p.waitForTimeout(400);
  await shot(p, "03b-day-sheet-lower");
  await p.getByLabel("Close").first().click();
  await p.waitForTimeout(500);
  await p.getByRole("tab", { name: /Types/ }).click();
  await p.waitForTimeout(500);
  await shot(p, "04-types");
  await p.getByText("+ New type").click();
  await p.waitForTimeout(800);
  await shot(p, "05-new-type");
  await p.getByLabel("Close").first().click();
  await p.waitForTimeout(500);
  await p.getByRole("tab", { name: /Roster/ }).click();
  await p.waitForTimeout(500);
  await shot(p, "09-roster");
  await p.getByRole("tab", { name: /Reports/ }).click();
  await p.waitForTimeout(500);
  await shot(p, "10-reports");
  await p.getByText("Year", { exact: true }).click();
  await p.waitForTimeout(400);
  await p.mouse.wheel(0, 2000);
  await p.waitForTimeout(400);
  await shot(p, "11-reports-year");
  await p.getByRole("tab", { name: /Account/ }).click();
  await p.waitForTimeout(500);
  await shot(p, "06-account");
  await p.mouse.wheel(0, 1400); await p.waitForTimeout(400);
  await shot(p, "06b-account-lower");
  await p.mouse.wheel(0, -3000); await p.waitForTimeout(300);
  await p.getByText("Not signed in").first().click(); await p.waitForTimeout(800);
  await shot(p, "06c-account-detail");
  await p.context().close();

  p = await page("dark");
  await shot(p, "07-calendar-dark");
  await p.getByLabel(now.toDateString(), { exact: true }).first().click();
  await p.waitForTimeout(800);
  await shot(p, "08-day-sheet-dark");
  await p.context().close();
} catch (e) {
  errors.push("script: " + (e && e.stack || e));
}
await browser.close();
writeFileSync("screens/errors.txt", errors.join("\n") || "no errors");
console.log(errors.join("\n") || "no errors");
