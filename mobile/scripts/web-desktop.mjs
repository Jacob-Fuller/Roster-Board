// Desktop-size screenshots of the website build (sample data, no account), so the
// computer layout can be checked before and after publishing.
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const out = process.argv[2] || "web-check";
mkdirSync(out, { recursive: true });
const URL = "http://localhost:8091/";
const now = new Date();
const key = (d) => d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
const day = (n) => key(new Date(now.getFullYear(), now.getMonth(), n));
const types = [
  { id: "t-day", name: "Day", color: "#E5484D", ink: "#FFFFFF", kind: "work", startTime: "07:00", endTime: "17:00", hours: 10, order: 0 },
  { id: "t-night", name: "Night", color: "#4C8DFF", ink: "#FFFFFF", kind: "work", startTime: "17:00", endTime: "03:00", hours: 10, order: 1 },
];
const shifts = {};
[1, 2, 5, 6, 9, 13, 14, 17, 21, 22, 25].forEach((n, i) => { shifts[day(n)] = [{ id: "s" + n, typeId: i % 4 < 2 ? "t-day" : "t-night" }]; });
shifts[day(9)].push({ id: "ex1", typeId: "excess_hours", hours: 10, baseTypeId: "t-day" });
shifts[day(16)] = [{ id: "sp1", typeId: "overtime", hours: 2, excessHours: 8, baseTypeId: "t-day" }];
const data = {
  types, shifts,
  notes: { [day(14)]: [{ id: "n1", text: "Dentist", category: "appointment", time: "10:30" }], [day(24)]: [{ id: "n2", text: "Dinner", category: "family", allDay: true }] },
  leave: { [day(24)]: [{ id: "l1", kind: "sick", hours: 10, baseTypeId: "t-day" }] }, swaps: {}, payTags: { [day(5)]: [{ id: "a1", kind: "allowance", allowanceId: "mm" }] }, birthdays: [],
  roster: { weeks: 1, pattern: [[[], [], [], [], [], [], []]], updatedAt: 1 },
  settings: { hourlyRate: 39, employment: "part", partTime: { rostered: 4, excessCap: 28 }, updatedAt: 1,
    pay: { baseRate: 39, cycle: "fortnightly", savedAt: 1, allowances: [{ id: "mm", name: "Missed meal", kind: "flat", amount: 18.7, max: 2 }] } },
  tombstones: {},
};
const errors = [];
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, colorScheme: theme });
  const p = await ctx.newPage();
  p.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await p.addInitScript(([d, theme]) => {
    localStorage.setItem("rosterBoard.v2", d);
    localStorage.setItem("rosterBoard.localOnly", "1");
    localStorage.setItem("rosterBoard.onboardingSeen", "1");
    localStorage.setItem("rosterBoard.prefs", JSON.stringify({ theme, hideEvents: false, hideBirthdays: false }));
  }, [JSON.stringify(data), theme]);
  await p.goto(URL);
  await p.waitForTimeout(2500);
  await p.screenshot({ path: out + "/" + theme + "-calendar.png" });
  if (theme === "light") {
    await p.getByLabel(now.toDateString(), { exact: true }).first().click().catch(() => {});
    await p.waitForTimeout(900);
    await p.screenshot({ path: out + "/light-day.png" });
    await p.getByLabel("Close").first().click().catch(() => {});
    await p.waitForTimeout(500);
    await p.getByRole("tab", { name: /Reports/ }).click();
    await p.waitForTimeout(700);
    await p.screenshot({ path: out + "/light-reports.png" });
  }
  await ctx.close();
}
await browser.close();
console.log(errors.length ? errors.join("\n") : "no errors");
