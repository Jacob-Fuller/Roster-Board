// Australian public holidays by state, worked out from each state's rules so
// they're right for any year. Statewide holidays, plus the local show days and
// regional holidays for the areas below. Part-day holidays (e.g. Christmas Eve
// evening) aren't included.
import { ymd } from "./model.ts";

export type AuState = "QLD" | "NSW" | "VIC" | "ACT" | "SA" | "WA" | "TAS" | "NT";
export const AU_STATES: { value: AuState; label: string }[] = [
  { value: "QLD", label: "Queensland" }, { value: "NSW", label: "New South Wales" }, { value: "VIC", label: "Victoria" },
  { value: "ACT", label: "Australian Capital Territory" }, { value: "SA", label: "South Australia" },
  { value: "WA", label: "Western Australia" }, { value: "TAS", label: "Tasmania" }, { value: "NT", label: "Northern Territory" },
];
export const stateOf = (settings: any): AuState | null =>
  settings && AU_STATES.some((s) => s.value === settings.state) ? settings.state : null;
// Areas with their own holidays that follow a fixed rule each year.
export const AU_AREAS: { [k in AuState]?: { value: string; label: string }[] } = {
  QLD: [{ value: "brisbane", label: "Brisbane" }],
  TAS: [{ value: "hobart", label: "Hobart and the south" }, { value: "launceston", label: "Launceston and the north" }],
  NT: [{ value: "darwin", label: "Darwin" }, { value: "katherine", label: "Katherine" }, { value: "tennant", label: "Tennant Creek" }, { value: "alice", label: "Alice Springs" }],
};
export type Place = { state: AuState; area: string };
// The state and area chosen in Employment, or null with no state.
export function placeOf(settings: any): Place | null {
  const state = stateOf(settings);
  if (!state) return null;
  const area = (AU_AREAS[state] || []).some((a) => a.value === settings.area) ? settings.area : "";
  return { state, area };
}
export const stateLabel = (s: AuState | null) => (s ? AU_STATES.find((x) => x.value === s)!.label : "");

const D = (y: number, m: number, d: number) => new Date(y, m - 1, d);
const plus = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
// nth weekday (0 = Sunday) of a month; n = -1 for the last one
function nth(y: number, m: number, wd: number, n: number) {
  if (n > 0) { const f = D(y, m, 1); return plus(f, ((wd - f.getDay() + 7) % 7) + (n - 1) * 7); }
  const l = D(y, m + 1, 0); return plus(l, -((l.getDay() - wd + 7) % 7));
}
const onOrAfter = (d: Date, wd: number) => plus(d, (wd - d.getDay() + 7) % 7);
function easter(y: number) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return D(y, month, day);
}

function build({ state, area }: Place, y: number): { [date: string]: string } {
  const out: { [date: string]: string } = {};
  const add = (d: Date, name: string) => { const k = ymd(d); if (!out[k]) out[k] = name; };
  // a weekend holiday moves to the Monday after
  const withMonday = (d: Date, name: string) => { add(d, name); if (d.getDay() === 6) add(plus(d, 2), name); if (d.getDay() === 0) add(plus(d, 1), name); };

  withMonday(D(y, 1, 1), "New Year's Day");
  withMonday(D(y, 1, 26), "Australia Day");
  const e = easter(y);
  add(plus(e, -2), "Good Friday");
  if (state !== "TAS" && state !== "WA") add(plus(e, -1), "Easter Saturday");
  if (state !== "TAS") add(e, "Easter Sunday");
  add(plus(e, 1), "Easter Monday");
  // Anzac Day on a weekend: WA adds the Monday; ACT moves it to Monday; NSW adds Monday
  // for a Sunday; QLD and NT move a Sunday to Monday; SA, VIC and TAS have no extra day
  const anzac = D(y, 4, 25), aw = anzac.getDay(), anzacMon = plus(anzac, aw === 6 ? 2 : 1);
  if (state === "WA") withMonday(anzac, "Anzac Day");
  else if (state === "ACT" && (aw === 6 || aw === 0)) add(anzacMon, "Anzac Day");
  else if ((state === "QLD" || state === "NT") && aw === 0) add(anzacMon, "Anzac Day");
  else { add(anzac, "Anzac Day"); if (state === "NSW" && aw === 0) add(anzacMon, "Anzac Day"); }

  // Labour Day
  if (state === "QLD") add(nth(y, 5, 1, 1), "Labour Day");
  else if (state === "NT") add(nth(y, 5, 1, 1), "May Day");
  else if (state === "NSW" || state === "ACT" || state === "SA") add(nth(y, 10, 1, 1), "Labour Day");
  else if (state === "VIC") add(nth(y, 3, 1, 2), "Labour Day");
  else if (state === "TAS") add(nth(y, 3, 1, 2), "Eight Hours Day");
  else if (state === "WA") add(nth(y, 3, 1, 1), "Labour Day");

  // King's Birthday
  if (state === "QLD") add(nth(y, 10, 1, 1), "King's Birthday");
  else if (state === "WA") add(nth(y, 9, 1, -1), "King's Birthday");
  else add(nth(y, 6, 1, 2), "King's Birthday");

  if (state === "ACT") { add(nth(y, 3, 1, 2), "Canberra Day"); add(onOrAfter(D(y, 5, 27), 1), "Reconciliation Day"); }
  if (state === "SA") add(nth(y, 3, 1, 2), "Adelaide Cup Day");
  if (state === "WA") add(nth(y, 6, 1, 1), "Western Australia Day");
  if (state === "NT") add(nth(y, 8, 1, 1), "Picnic Day");
  if (state === "VIC") { add(plus(nth(y, 9, 6, -1), -1), "AFL Grand Final Friday"); add(nth(y, 11, 2, 1), "Melbourne Cup Day"); }

  // local holidays
  if (area === "brisbane") {
    // Ekka: the Wednesday of the show, which starts on the first Friday in August
    // (the second Friday when the first falls before the 5th)
    let f = nth(y, 8, 5, 1); if (f.getDate() < 5) f = plus(f, 7);
    add(plus(f, 5), "Royal Queensland Show");
  }
  if (area === "hobart") { add(nth(y, 2, 1, 2), "Royal Hobart Regatta"); add(plus(nth(y, 10, 6, 4), -2), "Royal Hobart Show"); }
  if (area === "launceston") { add(plus(nth(y, 10, 6, 2), -2), "Royal Launceston Show"); add(nth(y, 11, 1, 1), "Recreation Day"); }
  if (area === "alice") add(nth(y, 7, 5, 1), "Alice Springs Show Day");
  if (area === "tennant") add(nth(y, 7, 5, 2), "Tennant Creek Show Day");
  if (area === "katherine") add(nth(y, 7, 5, 3), "Katherine Show Day");
  if (area === "darwin") add(nth(y, 7, 5, 4), "Darwin Show Day");

  // Christmas and Boxing Day, with extra days when they fall on a weekend
  const xmas = D(y, 12, 25), wd = xmas.getDay(), boxing = state === "SA" ? "Proclamation Day" : "Boxing Day";
  add(xmas, "Christmas Day");
  // Tasmania moves a Sunday Boxing Day to the Tuesday rather than adding a day
  if (!(state === "TAS" && wd === 6)) add(D(y, 12, 26), boxing);
  if (wd === 6) { add(D(y, 12, 27), "Christmas Day"); add(D(y, 12, 28), boxing); }
  else if (wd === 5) add(D(y, 12, 28), boxing);
  else if (wd === 0) add(D(y, 12, 27), "Christmas Day");
  return out;
}

const cache: { [k: string]: { [date: string]: string } } = {};
export function holidaysFor(place: Place, year: number) {
  const k = place.state + place.area + year;
  return cache[k] || (cache[k] = build(place, year));
}
// The holiday's name on that date, or null.
export function holidayName(place: Place | null, dateKey: string): string | null {
  if (!place) return null;
  return holidaysFor(place, +dateKey.slice(0, 4))[dateKey] || null;
}
