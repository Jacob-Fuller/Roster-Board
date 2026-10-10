// Shift alarms (iPhone, iOS 26+): real alarms a set time before each work shift,
// same rules as the web app's iPhone version. Off unless the user picks a time.
// The setting is per device, since the alarms live on this phone. The next 30
// days are scheduled and refreshed whenever the roster changes or the app opens.
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import { ShiftAlarm, type ShiftAlarmItem } from "../../modules/shift-alarm";
import { addDays, EXCESS_ID, OVERTIME_ID, parseYmd, ymd, type Snapshot, type ShiftType } from "./model";

const KEY = "rosterBoard.shiftAlarmMinutes";

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

export async function shiftAlarmsAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios" || !ShiftAlarm) return false;
  try { return await ShiftAlarm.isAvailable(); } catch { return false; }
}

export async function getShiftAlarmMinutes(): Promise<number> {
  try { return parseInt((await AsyncStorage.getItem(KEY)) || "0", 10) || 0; } catch { return 0; }
}

export async function setShiftAlarmMinutes(mins: number): Promise<boolean> {
  if (mins > 0 && ShiftAlarm) {
    let ok = false;
    try { ok = await ShiftAlarm.requestPermission(); } catch { ok = false; }
    if (!ok) return false;
  }
  try { await AsyncStorage.setItem(KEY, String(mins)); } catch {}
  lastSent = null;
  return true;
}

export function buildShiftAlarms(data: Snapshot, mins: number, now = Date.now()): ShiftAlarmItem[] {
  if (mins <= 0) return [];
  const typesById: { [id: string]: ShiftType } = {};
  (data.types || []).forEach((t) => { typesById[t.id] = t; });
  const list: ShiftAlarmItem[] = [];
  const today = new Date(now);
  for (let i = 0; i <= 30; i++) {
    const k = ymd(addDays(today, i));
    if ((data.leave[k] || []).length) continue;
    (data.shifts[k] || []).forEach((sh) => {
      if (sh.typeId === OVERTIME_ID || sh.typeId === EXCESS_ID) return;
      const t = typesById[sh.typeId];
      if (!t || t.kind === "personal" || !t.startTime) return;
      const [h, m] = t.startTime.split(":").map((x) => +x);
      const d = parseYmd(k); d.setHours(h, m, 0, 0);
      const at = d.getTime() - mins * 60000;
      if (at > now) list.push({ at, title: t.name + " at " + t.startTime });
    });
  }
  list.sort((a, b) => a.at - b.at);
  return list.slice(0, 40);
}

let lastSent: string | null = null;
export async function syncShiftAlarms(data: Snapshot, locked: boolean) {
  if (Platform.OS !== "ios" || !ShiftAlarm) return;
  const mins = locked ? 0 : await getShiftAlarmMinutes();
  const list = buildShiftAlarms(data, mins);
  const key = JSON.stringify(list);
  if (key === lastSent) return;
  lastSent = key;
  try { await ShiftAlarm.setAlarms(list); } catch { lastSent = null; }
}
