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

// Android groups notifications into channels that people can control in Settings.
const CHANNEL = "reminders";
let channelReady: Promise<unknown> | null = null;
function ensureChannel() {
  if (Platform.OS !== "android") return Promise.resolve();
  if (!channelReady) channelReady = Notifications.setNotificationChannelAsync(CHANNEL, {
    name: "Event reminders", importance: Notifications.AndroidImportance.HIGH,
  }).catch(() => {});
  return channelReady;
}

export async function askReminderPermission(): Promise<boolean> {
  if (Platform.OS === "web") return false;
  await ensureChannel();
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  if (!cur.canAskAgain) return false;
  const r = await Notifications.requestPermissionsAsync({ ios: { allowAlert: true, allowSound: true, allowBadge: false } });
  return r.granted;
}

// Reminders can also be set on the website, so when there are upcoming ones
// and the phone has never been asked, ask once so they can be delivered here.
export async function askIfRemindersNeedIt(notes: Buckets<EventEntry>) {
  if (Platform.OS === "web") return;
  const now = Date.now();
  const any = Object.keys(notes || {}).some((k) => (notes[k] || []).some((n) => {
    if (!n.remind || !n.time || n.allDay) return false;
    const [h, m] = n.time.split(":").map((x) => +x);
    const d = parseYmd(k); d.setHours(h, m, 0, 0);
    return d.getTime() > now;
  }));
  if (!any) return;
  const cur = await Notifications.getPermissionsAsync().catch(() => null);
  if (cur && !cur.granted && cur.canAskAgain) await askReminderPermission().catch(() => false);
}

let timer: ReturnType<typeof setTimeout> | null = null;
export function syncReminders(notes: Buckets<EventEntry>) {
  if (Platform.OS === "web") return;
  if (timer) clearTimeout(timer);
  timer = setTimeout(async () => {
    try {
      const perm = await Notifications.getPermissionsAsync();
      if (!perm.granted) return;
      await ensureChannel();
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
          // sound "default" so it actually rings; without it iOS delivers it silently
          content: { title: u.n.text, body: u.n.time, sound: "default", interruptionLevel: "active" },
          trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: u.at, channelId: CHANNEL },
        });
      }
    } catch {}
  }, 800);
}
