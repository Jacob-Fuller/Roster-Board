// Alarms (iPhone, iOS 26+): real alarms that ring like the Clock app.
//   Work shift types: an optional alarm a set time before each shift of that type (type.alarm, minutes).
//   Personal events with a time: an alert and an optional second alert (event.alarms, minutes before).
// Alarms for the next 30 days are scheduled on this phone and refreshed whenever
// the calendar changes or the app opens.
import { useEffect, useState } from "react";
import { Platform } from "react-native";
import { ShiftAlarm, type ShiftAlarmItem } from "../../modules/shift-alarm";
import { addDays, EXCESS_ID, OVERTIME_ID, parseYmd, ymd, type Snapshot, type ShiftType } from "./model";

const HORIZON_DAYS = 30;
const MAX_ALARMS = 60;

export const SHIFT_ALARM_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: "None" },
  { value: 15, label: "15 minutes before" },
  { value: 30, label: "30 minutes before" },
  { value: 45, label: "45 minutes before" },
  { value: 60, label: "1 hour before" },
  { value: 90, label: "1.5 hours before" },
  { value: 120, label: "2 hours before" },
  { value: 180, label: "3 hours before" },
];

// Event alerts: minutes before the event, -1 = none.
export const EVENT_ALARM_OPTIONS: { value: number; label: string }[] = [
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

export async function alarmsAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !ShiftAlarm) return false;
  try { return await ShiftAlarm.isAvailable(); } catch { return false; }
}
// True on iPhones that can set alarms (iOS 26+), so the alarm options are only shown there.
export function useAlarmsAvailable() {
  const [ok, setOk] = useState(false);
  useEffect(() => { alarmsAvailable().then(setOk); }, []);
  return ok;
}
export async function requestAlarmPermission(): Promise<boolean> {
  if (!ShiftAlarm) return false;
  try { return await ShiftAlarm.requestPermission(); } catch { return false; }
}

export function buildAlarms(data: Snapshot, now = Date.now()): ShiftAlarmItem[] {
  const list: ShiftAlarmItem[] = [];
  const until = now + HORIZON_DAYS * 86400000;
  const today = new Date(now);
  const typesById: { [id: string]: ShiftType } = {};
  (data.types || []).forEach((t) => { typesById[t.id] = t; });
  for (let i = 0; i <= HORIZON_DAYS; i++) {
    const k = ymd(addDays(today, i));
    const onLeave = (data.leave[k] || []).length > 0;
    (data.shifts[k] || []).forEach((sh) => {
      if (sh.typeId === OVERTIME_ID || sh.typeId === EXCESS_ID) return;
      const t = typesById[sh.typeId];
      const mins = (t && t.alarm) || 0;
      if (!t || !(mins > 0)) return;
      const personal = t.kind === "personal";
      // work shifts don't ring on leave days; personal entries still do
      if (!personal && onLeave) return;
      const start = personal ? (t.allDay ? null : t.time || t.startTime) : t.startTime;
      if (!start) return;
      const [h, m] = start.split(":").map((x) => +x);
      const d = parseYmd(k); d.setHours(h, m, 0, 0);
      const at = d.getTime() - mins * 60000;
      if (at > now && at <= until) list.push({ at, title: t.name + " at " + start });
    });
  }
  // events can have an alert up to a week ahead, so look a week further out
  for (let i = 0; i <= HORIZON_DAYS + 7; i++) {
    const k = ymd(addDays(today, i));
    (data.notes[k] || []).forEach((n) => {
      const offsets = (n.alarms || []).filter((m: number, j: number, a: number[]) => typeof m === "number" && m >= 0 && a.indexOf(m) === j);
      if (n.allDay || !n.time || !offsets.length) return;
      const [h, m] = n.time.split(":").map((x) => +x);
      if (!isFinite(h) || !isFinite(m)) return;
      const d = parseYmd(k); d.setHours(h, m, 0, 0);
      offsets.forEach((off: number) => {
        const at = d.getTime() - off * 60000;
        if (at > now && at <= until) list.push({ at, title: n.text + " at " + n.time });
      });
    });
  }
  list.sort((a, b) => a.at - b.at);
  return list.slice(0, MAX_ALARMS);
}

let lastSent: string | null = null;
export async function syncShiftAlarms(data: Snapshot, locked: boolean) {
  if (Platform.OS !== "ios" || !ShiftAlarm) return;
  const list = locked ? [] : buildAlarms(data);
  const key = JSON.stringify(list);
  if (key === lastSent) return;
  lastSent = key;
  try { await ShiftAlarm.setAlarms(list); } catch { lastSent = null; }
}
