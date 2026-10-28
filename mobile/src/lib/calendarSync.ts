// Shifts and leave copied into a "Tempus Board" calendar in the phone's Calendar
// app, from a month ago to a year ahead. The calendar is rebuilt whenever your
// shifts change, so swaps and edits show there too. Turning it off removes it.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import {
  LEAVE_KINDS, addDays, entryName, parseYmd, ymd,
  type ShiftType, type Snapshot,
} from "./model";

const CAL_TITLE = "Tempus Board";
const OLD_TITLES = ["Roster Board"]; // renamed app: pick up and rename the old calendar
const KEY_ID = "rosterBoard.calendarId";
const KEY_HASH = "rosterBoard.calendarHash";

export async function askCalendarPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const cur = await Calendar.getCalendarPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  return (await Calendar.requestCalendarPermissionsAsync()).granted;
}

async function findCalendar(): Promise<string | null> {
  const saved = await AsyncStorage.getItem(KEY_ID).catch(() => null);
  const cals = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  const hit = cals.find((c) => c.id === saved)
    || cals.find((c) => c.title === CAL_TITLE && c.allowsModifications)
    || cals.find((c) => OLD_TITLES.includes(c.title) && c.allowsModifications);
  if (hit && hit.title !== CAL_TITLE) await Calendar.updateCalendarAsync(hit.id, { title: CAL_TITLE }).catch(() => {});
  return hit ? hit.id : null;
}

async function ensureCalendar(): Promise<string> {
  const have = await findCalendar();
  if (have) return have;
  let sourceId: string | undefined, source: any;
  if (Platform.OS === "ios") {
    const def = await Calendar.getDefaultCalendarAsync();
    sourceId = def.source.id; source = def.source;
  } else {
    source = { isLocalAccount: true, name: CAL_TITLE, type: Calendar.SourceType.LOCAL };
  }
  const id = await Calendar.createCalendarAsync({
    title: CAL_TITLE, color: "#1F3A5F", entityType: Calendar.EntityTypes.EVENT,
    sourceId, source, name: CAL_TITLE, ownerAccount: "personal", accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });
  await AsyncStorage.setItem(KEY_ID, id).catch(() => {});
  return id;
}

type Ev = { title: string; start: Date; end: Date; allDay: boolean };
function buildEvents(d: Snapshot, typesById: { [id: string]: ShiftType }, from: Date, to: Date): Ev[] {
  const out: Ev[] = [];
  const fromK = ymd(from), toK = ymd(to);
  const at = (k: string, hhmm: string) => { const [h, m] = hhmm.split(":").map((x) => +x); const x = parseYmd(k); x.setHours(h, m, 0, 0); return x; };
  Object.keys(d.shifts || {}).forEach((k) => {
    if (k < fromK || k >= toK) return;
    (d.shifts[k] || []).forEach((e) => {
      const t = typesById[e.typeId];
      if (!t || t.kind === "personal") return;
      const base = e.baseTypeId ? typesById[e.baseTypeId] : null;
      const timed = base || (!t.isBuiltin ? t : null);
      const title = entryName(e, typesById);
      if (timed && timed.startTime && timed.endTime) {
        const start = at(k, timed.startTime);
        let end = at(k, timed.endTime);
        if (end <= start) end = addDays(end, 1);
        out.push({ title, start, end, allDay: false });
      } else out.push({ title, start: parseYmd(k), end: addDays(parseYmd(k), 1), allDay: true });
    });
  });
  Object.keys(d.leave || {}).forEach((k) => {
    if (k < fromK || k >= toK) return;
    (d.leave[k] || []).forEach((l) => {
      const def = LEAVE_KINDS[l.kind];
      if (!def) return;
      const bt = l.baseTypeId ? typesById[l.baseTypeId] : null;
      out.push({ title: def.label + (bt ? " – " + bt.name : ""), start: parseYmd(k), end: addDays(parseYmd(k), 1), allDay: true });
    });
  });
  return out;
}

let running = false, again: (() => void) | null = null;
// Brings the phone's Tempus Board calendar up to date (only when something changed).
export async function syncCalendar(d: Snapshot, typesById: { [id: string]: ShiftType }, on: boolean) {
  if (Platform.OS === "web") return;
  if (running) { again = () => syncCalendar(d, typesById, on); return; }
  running = true;
  try {
    if (!on) {
      const id = await findCalendar().catch(() => null);
      if (id) await Calendar.deleteCalendarAsync(id).catch(() => {});
      await AsyncStorage.multiRemove([KEY_ID, KEY_HASH]).catch(() => {});
      return;
    }
    const perm = await Calendar.getCalendarPermissionsAsync();
    if (!perm.granted) return;
    const now = new Date();
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear() + 1, now.getMonth(), 1);
    const events = buildEvents(d, typesById, from, to);
    const hash = ymd(from) + "|" + JSON.stringify(events.map((e) => [e.title, e.start.getTime(), e.end.getTime(), e.allDay]));
    const id = await ensureCalendar();
    if ((await AsyncStorage.getItem(KEY_HASH).catch(() => null)) === hash) return;
    const old = await Calendar.getEventsAsync([id], addDays(from, -400), addDays(to, 400));
    for (const ev of old) await Calendar.deleteEventAsync(ev.id).catch(() => {});
    for (const ev of events) {
      await Calendar.createEventAsync(id, { title: ev.title, startDate: ev.start, endDate: ev.end, allDay: ev.allDay, timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone });
    }
    await AsyncStorage.setItem(KEY_HASH, hash).catch(() => {});
  } catch {
  } finally {
    running = false;
    const next = again; again = null;
    if (next) next();
  }
}
