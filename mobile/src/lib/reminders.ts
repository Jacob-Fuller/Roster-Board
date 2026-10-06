// Event reminders, scheduled with the phone so they arrive even when the app is
// closed (same rules as the web app's iPhone version: the 60 soonest upcoming
// events that have "Remind me" and a time).
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";
import { parseYmd, type Buckets, type EventEntry } from "./model";

if (Platform.OS !== "web") {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
  });
}

export async function askReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  const r = await Notifications.requestPermissionsAsync();
  return r.granted;
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function syncReminders(notes: Buckets<EventEntry>) {
  if (Platform.OS === "web") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) return;
      const now = Date.now();
      const upcoming: { at: Date; n: EventEntry }[] = [];
      Object.keys(notes || {}).forEach((k) => (notes[k] || []).forEach((n) => {
        if (!n.remind || !n.time || n.allDay) return;
        const [h, m] = n.time.split(":").map((x) => +x);
        const d = parseYmd(k); d.setHours(h, m, 0, 0);
        if (d.getTime() > now) upcoming.push({ at: d, n });
      }));
      upcoming.sort((a, b) => a.at.getTime() - b.at.getTime());
      await Notifications.cancelAllScheduledNotificationsAsync();
      for (const u of upcoming.slice(0, 60)) {
        await Notifications.scheduleNotificationAsync({
          identifier: u.n.id,
          content: { title: u.n.text, body: u.n.time },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: u.at },
        });
      }
    } catch {}
  }, 800);
}
