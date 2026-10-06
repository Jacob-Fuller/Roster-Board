import React, { useState } from "react";
import { Linking, Pressable, ScrollView, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Dim, Divider, H1, MenuRow, SectionHead, Segmented, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import { MONTHS } from "../lib/model";
import { useStore } from "../lib/store";
import { sb, WEB_URL } from "../lib/supabase";
import { BirthdaysSheet } from "./BirthdaysSheet";
import { SharingSheet } from "./SharingSheet";

function ago(ms: number) {
  if (!ms) return "never";
  const s = Math.round((Date.now() - ms) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return Math.round(s / 60) + " min ago";
  if (s < 86400) return Math.round(s / 3600) + " h ago";
  return Math.round(s / 86400) + " days ago";
}

export function AccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sys = useColorScheme();
  const { auth, user, sync, syncNow, showSignIn, prefs, setPrefs, signOut, deleteAccount, restoreBackup } = useStore();
  const { dialog, toast } = useUi();
  const [history, setHistory] = useState<any[] | null>(null);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [bdaysOpen, setBdaysOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const { data } = useStore();
  const nB = data.birthdays.length;

  const themeValue = prefs.theme === "system" ? (sys === "dark" ? "dark" : "light") : prefs.theme;
  const statusText =
    sync.state === "syncing" ? "Backing up…" :
    sync.state === "authLost" ? "Signed out on this device. Sign in again to back up." :
    sync.state === "failed" || sync.dirty ? "Not backed up yet. Retrying when online." :
    "Backed up " + ago(sync.lastSync);
  const statusColor = sync.state === "authLost" || sync.state === "failed" ? t.danger : t.textDim;

  async function openHistory() {
    if (!user) return;
    setHistory(null); setHistoryOpen(true);
    const r = await sb.from("app_data").select("data").eq("user_id", user.id).maybeSingle();
    if (r.error) { setHistoryOpen(false); toast("Couldn't load backups"); return; }
    setHistory(((r.data as any)?.data?.history) || []);
  }
  function confirmSignOut() {
    dialog({
      title: "Sign out?",
      message: sync.dirty ? "Some recent changes haven't backed up yet. Signing out removes this phone's copy, so they'd be lost. Reconnect to the internet first so they can sync." : "Your roster stays safe in your account.",
      confirm: sync.dirty ? "Sign out anyway" : "Sign out", danger: sync.dirty,
      onConfirm: async () => { const r = await signOut(); if (!r.ok) toast("Couldn't sign out. Try again."); },
    });
  }
  function confirmDelete() {
    dialog({
      title: "Delete your account?",
      message: "This permanently deletes your account and everything in it on all devices. It can't be undone.",
      confirm: "Delete account", danger: true,
      onConfirm: async () => {
        const r = await deleteAccount();
        if (!r.ok) toast("Couldn't delete the account. Try again.");
      },
    });
  }

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
        <H1 style={{ marginBottom: 6 }}>Account</H1>

        {auth === "signedIn" && user ? (
          <Card>
            <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }}>{user.email}</Text>
            <Text style={{ color: statusColor, fontSize: 13, marginTop: 4 }}>{statusText}</Text>
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Button small kind="ghost" title="Sync now" onPress={() => { syncNow(); }} />
            </View>
          </Card>
        ) : (
          <Card>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>Not signed in</Text>
            <Dim style={{ marginTop: 4, marginBottom: 12 }}>Your roster is only on this phone. Sign in to back it up and use it on your other devices.</Dim>
            <Button title="Sign in or create account" onPress={showSignIn} />
          </Card>
        )}

        {auth === "signedIn" ? (
          <>
            <SectionHead title="Sharing" />
            <Card style={{ paddingVertical: 2 }}>
              <MenuRow title="Share your roster" sub="See each other's shifts. Personal events stay private." onPress={() => setShareOpen(true)} />
            </Card>
          </>
        ) : null}

        <SectionHead title="Birthdays" />
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow title="Birthdays" sub={nB ? nB + " birthday" + (nB === 1 ? "" : "s") + " added" : "None added"} onPress={() => setBdaysOpen(true)} />
        </Card>

        <SectionHead title="Appearance" />
        <Card>
          <Segmented options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} value={themeValue} onChange={(v) => setPrefs({ theme: v })} />
          <View style={{ height: 6 }} />
          <ToggleRow label="Hide personal events on the calendar" value={prefs.hideEvents} onChange={(v) => setPrefs({ hideEvents: v })} />
          <ToggleRow label="Hide birthdays on the calendar" value={prefs.hideBirthdays} onChange={(v) => setPrefs({ hideBirthdays: v })} />
        </Card>

        <SectionHead title="More" />
        <Card style={{ paddingVertical: 2 }}>
          {auth === "signedIn" ? (<><MenuRow title="Recover from an earlier backup" onPress={openHistory} /><Divider /></>) : null}
          <MenuRow title="Privacy policy" onPress={() => Linking.openURL(WEB_URL + "privacy.html")} />
          <Divider />
          <MenuRow title="Contact support" sub="contact@rosterboard.net" onPress={() => Linking.openURL("mailto:contact@rosterboard.net?subject=Roster%20Board")} />
          {auth === "signedIn" ? (
            <>
              <Divider />
              <MenuRow title="Sign out" onPress={confirmSignOut} />
              <Divider />
              <MenuRow title="Delete account" danger onPress={confirmDelete} />
            </>
          ) : null}
        </Card>
      </ScrollView>

      <BirthdaysSheet visible={bdaysOpen} onClose={() => setBdaysOpen(false)} />
      <SharingSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <Sheet visible={historyOpen} onClose={() => setHistoryOpen(false)} title="Earlier backups">
        <Dim style={{ marginBottom: 10 }}>Bringing a backup back adds its entries to your calendar. Nothing you have now is removed.</Dim>
        {history === null ? <Dim>Loading backups…</Dim> : !history.length ? <Dim>No earlier backups yet. They build up from now on.</Dim> : history.map((h, i) => {
          const d = new Date(h.at);
          let n = 0;
          Object.keys(h.data?.shifts || {}).forEach((k) => { n += (h.data.shifts[k] || []).length; });
          Object.keys(h.data?.notes || {}).forEach((k) => { n += (h.data.notes[k] || []).length; });
          const label = d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear() + ", " + String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");
          return (
            <View key={i}>
              <Pressable accessibilityRole="button" style={{ paddingVertical: 12 }}
                onPress={() => dialog({
                  title: "Recover from this backup?", message: "Entries from " + label + " that are missing now will come back.", confirm: "Recover",
                  onConfirm: () => { restoreBackup(h.data); setHistoryOpen(false); toast("Backup recovered"); },
                })}>
                <Text style={{ color: t.text, fontWeight: "700", fontSize: 15 }}>{label}</Text>
                <Dim>{n} {n === 1 ? "entry" : "entries"}</Dim>
              </Pressable>
              <Divider />
            </View>
          );
        })}
      </Sheet>
    </View>
  );
}
