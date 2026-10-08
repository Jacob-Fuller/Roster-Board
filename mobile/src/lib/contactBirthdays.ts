// Birthdays from the phone's contacts, kept as a mirror: every time the app
// opens, contacts that have a birthday are added, changed ones are updated and
// ones that are gone are removed. Only birthdays marked source "contacts" are
// ever touched; ones typed in by hand are never changed.
// Only names and birthdays are read.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Contacts from "expo-contacts";
import { Platform } from "react-native";
import { mkId, type Birthday } from "./model";

const ASKED_KEY = "rosterBoard.contactsAsked";

export type ContactBirthday = { key: string; name: string; day: number; month: number; year: number | null };

// The same person gives the same key on every phone (contact ids differ between
// devices), so two phones sharing contacts never double up.
const keyOf = (name: string, day: number, month: number) => name.trim().toLowerCase().replace(/\s+/g, " ") + "|" + day + "|" + month;

export const isFromContacts = (b: Birthday) => b && b.source === "contacts";

export async function readContactBirthdays(): Promise<ContactBirthday[] | null> {
  if (Platform.OS === "web") return null;
  try {
    let perm = await Contacts.getPermissionsAsync();
    if (!perm.granted) {
      // ask once; if they say no, manual birthdays carry on as normal
      const asked = await AsyncStorage.getItem(ASKED_KEY).catch(() => null);
      if (asked || !perm.canAskAgain) return null;
      await AsyncStorage.setItem(ASKED_KEY, "1").catch(() => {});
      perm = await Contacts.requestPermissionsAsync();
      if (!perm.granted) return null;
    }
    const { data } = await Contacts.getContactsAsync({ fields: [Contacts.Fields.Name, Contacts.Fields.FirstName, Contacts.Fields.LastName, Contacts.Fields.Birthday] });
    const out: { [key: string]: ContactBirthday } = {};
    (data || []).forEach((c) => {
      const b = c.birthday;
      if (!b || b.day == null || b.month == null) return;
      const day = Number(b.day), month = Number(b.month) + 1; // expo-contacts months start at 0
      if (!(day >= 1 && day <= 31 && month >= 1 && month <= 12)) return;
      const name = ((c.name || [c.firstName, c.lastName].filter(Boolean).join(" ")) || "").trim().slice(0, 40);
      if (!name) return;
      const y = b.year != null ? Number(b.year) : NaN;
      const year = y >= 1900 && y <= 2100 ? y : null; // iOS uses 1604 for "no year"
      const key = keyOf(name, day, month);
      out[key] = { key, name, day, month, year };
    });
    return Object.values(out);
  } catch {
    return null;
  }
}

type Plan = { add: Birthday[]; change: { id: string; rec: Partial<Birthday> }[]; remove: string[] };

// Works out what has to change so the contact birthdays match the phone.
export function planContactSync(current: Birthday[], contacts: ContactBirthday[]): Plan {
  const plan: Plan = { add: [], change: [], remove: [] };
  const wanted: { [key: string]: ContactBirthday } = {};
  contacts.forEach((c) => { wanted[c.key] = c; });
  const seen: { [key: string]: true } = {};
  (current || []).forEach((b) => {
    if (!isFromContacts(b)) return;
    const k = b.contactKey as string;
    const c = k ? wanted[k] : undefined;
    if (!c || seen[k]) { plan.remove.push(b.id); return; } // contact gone, or a duplicate from another phone
    seen[k] = true;
    if (b.name !== c.name || b.day !== c.day || b.month !== c.month || (b.year || null) !== c.year) {
      plan.change.push({ id: b.id, rec: { name: c.name, day: c.day, month: c.month, year: c.year } });
    }
  });
  contacts.forEach((c) => {
    if (seen[c.key]) return;
    const rec: Birthday = { id: mkId(), name: c.name, day: c.day, month: c.month, source: "contacts", contactKey: c.key };
    if (c.year) rec.year = c.year;
    plan.add.push(rec);
  });
  return plan;
}
