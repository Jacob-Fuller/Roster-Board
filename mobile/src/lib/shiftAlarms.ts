// Alarms (iPhone, iOS 26+): real alarms that ring like the Clock app.
//   Shift: one alarm a set time before each work shift.
//   Personal: an alert and an optional second alert before each personal event that has a time.
// Settings are per device, since the alarms live on this phone. Alarms for the
// next 30 days are scheduled and refreshed whenever the calendar changes or the app opens.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ShiftAlarm, type ShiftAlarmItem } from "../../modules/shift-alarm";
import { addDays, EXCESS_ID, OVERTIME_ID, parseYmd, ymd, type Snapshot, type ShiftType } from "./model";

const SHIFT_KEY = "rosterBoard.shiftAlarmMinutes";
const PERSONAL_KEY = "rosterBoard.personalAlarms";
const HORIZON_DAYS = 30;
const MAX_ALARMS = 60;

export const SHIFT_ALARM_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "Off" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 45, label: "45 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 90, label: "1.5 hours before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
];
export const shiftAlarmLabel = (m: number) => (SHIFT_ALARM_OPTIONS.find((o) => o.value === m) || SHIFT_ALARM_OPTIONS[0]).label;

// Personal event alerts: minutes before the event, -1 = none.
export const PERSONAL_ALARM_OPTIONS: { value: number; label: string }[] = [
  { value: -1, label: "None" },
  { value: 0, label: "At time of event" },
  { value: 5, label: "5 minutes before" },
  { value: 10, label: "10 minutes before" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
  { value: 2880, label: "2 days before" },
  { value: 10080, label: "1 week before" },
];
export const personalAlarmLabel = (m: number) => (PERSONAL_ALARM_OPTIONS.find((o) => o.value === m) || PERSONAL_ALARM_OPTIONS[0]).label;
export type PersonalAlarms = { first: number; second: number };
export function personalAlarmsSummary(a: PersonalAlarms) {
  if (a.first < 0) return "Off";
  return a.second < 0 ? personalAlarmLabel(a.first) : "2 alerts";
}

export async function shiftAlarmsAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !ShiftAlarm) return false;
  try { return await ShiftAlarm.isAvailable(); } catch { return false; }
}

export async function getShiftAlarmMinutes(): Promise<number> {
  try { return parseInt((await AsyncStorage.getItem(SHIFT_KEY)) || "0", 10) || 0; } catch { return 0; }
}
export async function getPersonalAlarms(): Promise<PersonalAlarms> {
  try {
    const v = JSON.parse((await AsyncStorage.getItem(PERSONAL_KEY)) || "null");
    if (v && typeof v.first === "number") return { first: v.first, second: typeof v.second === "number" ? v.second : -1 };
  } catch {}
  return { first: -1, second: -1 };
}

async function allowed(turningOn: boolean): Promise<boolean> {
  if (!turningOn || !ShiftAlarm) return true;
  try { return await ShiftAlarm.requestPermission(); } catch { return false; }
}
export async function setShiftAlarmMinutes(mins: number): Promise<boolean> {
  if (!(await allowed(mins > 0))) return false;
  try { await AsyncStorage.setItem(SHIFT_KEY, String(mins)); } catch {}
  lastSent = null;
  return true;
}
export async function setPersonalAlarms(a: PersonalAlarms): Promise<boolean> {
  const next = a.first < 0 ? { first: -1, second: -1 } : a;
  if (!(await allowed(next.first >= 0))) return false;
  try { await AsyncStorage.setItem(PERSONAL_KEY, JSON.stringify(next)); } catch {}
  lastSent = null;
  return true;
}

export function buildAlarms(data: Snapshot, shiftMins: number, personal: PersonalAlarms, now = Date.now()): ShiftAlarmItem[] {
  const list: ShiftAlarmItem[] = [];
  const until = now + HORIZON_DAYS * 86400000;
  const today = new Date(now);
  if (shiftMins > 0) {
    const typesById: { [id: string]: ShiftType } = {};
    (data.types || []).forEach((t) => { typesById[t.id] = t; });
    for (let i = 0; i <= HORIZON_DAYS; i++) {
      const k = ymd(addDays(today, i));
      if ((data.leave[k] || []).length) continue;
      (data.shifts[k] || []).forEach((sh) => {
        if (sh.typeId === OVERTIME_ID || sh.typeId === EXCESS_ID) return;
        const t = typesById[sh.typeId];
        if (!t || t.kind === "personal" || !t.startTime) return;
        const [h, m] = t.startTime.split(":").map((x) => +x);
        const d = parseYmd(k); d.setHours(h, m, 0, 0);
        const at = d.getTime() - shiftMins * 60000;
        if (at > now && at <= until) list.push({ at, title: t.name + " at " + t.startTime });
      });
    }
  }
  const offsets = [personal.first, personal.second].filter((m, i, a) => m >= 0 && a.indexOf(m) === i);
  if (offsets.length) {
    const maxOffset = Math.max(...offsets);
    for (let i = 0; i <= HORIZON_DAYS + Math.ceil(maxOffset / 1440); i++) {
      const k = ymd(addDays(today, i));
      (data.notes[k] || []).forEach((n) => {
        if (n.allDay || !n.time) return;
        const [h, m] = n.time.split(":").map((x) => +x);
        if (!isFinite(h) || !isFinite(m)) return;
        const d = parseYmd(k); d.setHours(h, m, 0, 0);
        offsets.forEach((off) => {
          const at = d.getTime() - off * 60000;
          if (at > now && at <= until) list.push({ at, title: n.text + " at " + n.time });
        });
      });
    }
  }
  list.sort((a, b) => a.at - b.at);
  return list.slice(0, MAX_ALARMS);
}

let lastSent: string | null = null;
export async function syncShiftAlarms(data: Snapshot, locked: boolean) {
  if (Platform.OS !== "ios" || !ShiftAlarm) return;
  const shiftMins = locked ? 0 : await getShiftAlarmMinutes();
  const personal = locked ? { first: -1, second: -1 } : await getPersonalAlarms();
  const list = buildAlarms(data, shiftMins, personal);
  const key = JSON.stringify(list);
  if (key === lastSent) return;
  lastSent = key;
  try { await ShiftAlarm.setAlarms(list); } catch { lastSent = null; }
}
