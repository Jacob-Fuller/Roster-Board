import React, { useEffect, useState } from "react";
import { Linking, Platform, ScrollView, Share, Text, View, useColorScheme } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Dim, Divider, Field, H1, MenuRow, SectionHead, Segmented, Sheet, useTheme, useUi } from "../components/ui";
import { employmentOf, type Employment } from "../lib/model";
import { usePremium } from "../lib/premium";
import { useStore } from "../lib/store";
import { sb, WEB_URL } from "../lib/supabase";
import { BirthdaysSheet } from "./BirthdaysSheet";
import { Onboarding } from "./Onboarding";
import { SharingSheet } from "./SharingSheet";

type ShowHide = "show" | "hide";
const SHOW_HIDE = [{ value: "show" as ShowHide, label: "Show" }, { value: "hide" as ShowHide, label: "Hide" }];

// Laid out like the website's Account tab.
export function AccountScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const sys = useColorScheme();
  const { auth, user, showSignIn, data, update, prefs, setPrefs } = useStore();
  const { dialog, toast } = useUi();
  const [acctOpen, setAcctOpen] = useState(false);
  const [bdaysOpen, setBdaysOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  const signedIn = auth === "signedIn" && !!user;
  const name = (user && user.user_metadata && (user.user_metadata as any).full_name) || "";
  const nB = data.birthdays.length;
  const themeValue = prefs.theme === "system" ? (sys === "dark" ? "dark" : "light") : prefs.theme;

  function feedback() {
    dialog({ title: "Send feedback", message: "Got a suggestion or found a problem? Write it below. This opens an email to us with your message filled in, ready to send.", input: { placeholder: "Your feedback..." }, confirm: "Continue", onConfirm: (v) => {
      const text = v.trim(); if (!text) { toast("Write your feedback first"); return; }
      Linking.openURL("mailto:contact@rosterboard.net?subject=" + encodeURIComponent("Roster Board feedback") + "&body=" + encodeURIComponent(text)).catch(() => toast("Couldn't open your email app"));
    } });
  }
  const shareInvite = () => Share.share({ message: "I'm using Roster Board to manage my shifts and roster — thought you might like it too. Check it out: " + WEB_URL }).catch(() => {});

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
        <H1 style={{ marginBottom: 6 }}>Account</H1>

        <SectionHead title="Account" />
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow title="Account" sub={signedIn ? name || user!.email || "" : "Not signed in"} onPress={() => setAcctOpen(true)} />
        </Card>

        <SectionHead title="Birthdays" />
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow title="Birthdays" sub={nB ? nB + " birthday" + (nB === 1 ? "" : "s") + " added" : "None added"} onPress={() => setBdaysOpen(true)} />
        </Card>

        <SectionHead title="Employment" />
        <Card>
          <Segmented<Employment> value={employmentOf(data.settings)}
            onChange={(v) => update((d) => { d.settings = { ...d.settings, employment: v, updatedAt: Date.now() }; })}
            options={[{ value: "full", label: "Full time" }, { value: "part", label: "Part time" }]} />
        </Card>

        <SectionHead title="Appearance" />
        <Card style={{ gap: 14 }}>
          <Segmented options={[{ value: "light", label: "Light" }, { value: "dark", label: "Dark" }]} value={themeValue} onChange={(v) => setPrefs({ theme: v })} />
          <View>
            <Text style={{ fontSize: 13, color: t.textDim, fontWeight: "600", marginBottom: 6 }}>Personal events on the calendar</Text>
            <Segmented<ShowHide> options={SHOW_HIDE} value={prefs.hideEvents ? "hide" : "show"} onChange={(v) => setPrefs({ hideEvents: v === "hide" })} />
          </View>
          <View>
            <Text style={{ fontSize: 13, color: t.textDim, fontWeight: "600", marginBottom: 6 }}>Birthdays on the calendar</Text>
            <Segmented<ShowHide> options={SHOW_HIDE} value={prefs.hideBirthdays ? "hide" : "show"} onChange={(v) => setPrefs({ hideBirthdays: v === "hide" })} />
          </View>
        </Card>

        {signedIn ? (
          <>
            <SectionHead title="Invite a friend" />
            <Card><Button title="Share invite" onPress={shareInvite} /></Card>
            <SectionHead title="Share your roster" />
            <Card style={{ paddingVertical: 2 }}>
              <MenuRow title="Shared rosters" onPress={() => setShareOpen(true)} />
            </Card>
          </>
        ) : (
          <>
            <SectionHead title="Share your roster" />
            <Card>
              <Button title="Sign in or create account" onPress={showSignIn} />
            </Card>
          </>
        )}

        <SectionHead title="About" />
        <Card style={{ paddingVertical: 2 }}>
          <MenuRow title="Help" onPress={() => setHelpOpen(true)} />
          <Divider />
          <MenuRow title="Send feedback" onPress={feedback} />
          <Divider />
          <MenuRow title="Contact us" sub="contact@rosterboard.net" onPress={() => Linking.openURL("mailto:contact@rosterboard.net?subject=Roster%20Board")} />
          <Divider />
          <MenuRow title="Privacy Policy" onPress={() => Linking.openURL(WEB_URL + "privacy.html")} />
        </Card>
      </ScrollView>

      <AccountDetail visible={acctOpen} onClose={() => setAcctOpen(false)} />
      <BirthdaysSheet visible={bdaysOpen} onClose={() => setBdaysOpen(false)} />
      <SharingSheet visible={shareOpen} onClose={() => setShareOpen(false)} />
      <Onboarding visible={helpOpen} onClose={() => setHelpOpen(false)} />
    </View>
  );
}

// The account page: change name, email and password, then sign out, format
// calendar and delete account (same as the website).
function AccountDetail({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { auth, user, sync, showSignIn, update, signOut, deleteAccount } = useStore();
  const { dialog, toast } = useUi();
  const signedIn = auth === "signedIn" && !!user;
  const currentName = (user && user.user_metadata && (user.user_metadata as any).full_name) || "";
  const [name, setName] = useState(currentName);
  const [email, setEmail] = useState("");
  const [pw1, setPw1] = useState(""); const [pw2, setPw2] = useState("");
  const [err, setErr] = useState<{ name?: string; email?: string; pw?: string }>({});
  useEffect(() => { if (visible) { setName(currentName); setEmail(""); setPw1(""); setPw2(""); setErr({}); } }, [visible, currentName]);

  async function saveName() {
    const n = name.trim(); if (!n) { setErr({ name: "Enter a name." }); return; }
    const r = await sb.auth.updateUser({ data: { full_name: n } });
    if (r.error) { setErr({ name: r.error.message }); return; }
    setErr({}); toast("Name updated");
  }
  async function saveEmail() {
    const e = email.trim(); if (!e) { setErr({ email: "Enter a new email." }); return; }
    const r = await sb.auth.updateUser({ email: e }, { emailRedirectTo: WEB_URL });
    if (r.error) { setErr({ email: r.error.message }); return; }
    setErr({}); setEmail(""); toast("Check your email (new address, and your old one if asked) to confirm");
  }
  async function savePassword() {
    if (!pw1 || pw1.length < 6) { setErr({ pw: "Password must be at least 6 characters." }); return; }
    if (pw1 !== pw2) { setErr({ pw: "Passwords don't match." }); return; }
    const r = await sb.auth.updateUser({ password: pw1 });
    if (r.error) { setErr({ pw: r.error.message }); return; }
    setErr({}); setPw1(""); setPw2(""); toast("Password updated");
  }
  function confirmSignOut() {
    dialog({
      title: "Sign out?",
      message: sync.dirty ? "Some recent changes haven't backed up yet. Signing out removes this phone's copy, so they'd be lost. Reconnect to the internet first so they can sync." : "Your roster stays safe in your account.",
      confirm: sync.dirty ? "Sign out anyway" : "Sign out", danger: sync.dirty,
      onConfirm: async () => { const r = await signOut(); if (!r.ok) toast("Couldn't sign out. Try again."); else onClose(); },
    });
  }
  function formatCalendar() {
    dialog({
      title: "Format calendar?",
      message: "This removes every shift, event, leave entry, swap and pay tag from your calendar" + (signedIn ? " on all your devices" : "") + ". Your shift types, roster pattern, birthdays and pay setup stay.\n\nThis can't be undone.\n\nType FORMAT to confirm.",
      input: { placeholder: "Type FORMAT to confirm" }, confirm: "Format", danger: true,
      onConfirm: (v) => {
        if (v.trim().toUpperCase() !== "FORMAT") { toast("Type FORMAT to confirm"); return; }
        update((d, tomb) => {
          (["shifts", "notes", "leave", "swaps", "payTags"] as const).forEach((k) => {
            Object.keys(d[k] || {}).forEach((day) => ((d[k] as any)[day] || []).forEach((it: any) => { if (it && it.id) tomb(it.id); }));
            (d as any)[k] = {};
          });
        }, { forceBackup: true });
        toast("Calendar formatted");
      },
    });
  }
  function confirmDelete() {
    dialog({
      title: "Delete your account?",
      message: "This permanently deletes your account and everything in it on all devices. It can't be undone.",
      confirm: "Delete account", danger: true,
      onConfirm: async () => {
        const r = await deleteAccount();
        if (!r.ok) toast("Couldn't delete the account. Try again."); else onClose();
      },
    });
  }

  return (
    <Sheet visible={visible} onClose={onClose} title="Account">
      {signedIn ? (
        <>
          <Card>
            <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 10 }}>
              <Text style={{ color: t.textDim, fontSize: 14 }}>Signed in as</Text>
              <Text style={{ color: t.text, fontSize: 14, fontWeight: "700", flexShrink: 1 }} numberOfLines={1}>{user!.email}</Text>
            </View>
          </Card>

          <SectionHead title="Change name" />
          <Card>
            <Field label="Display name" value={name} onChangeText={setName} placeholder="Your name" autoComplete="name" textContentType="name" />
            {err.name ? <Text style={{ color: t.danger, marginBottom: 8 }}>{err.name}</Text> : null}
            <Button small kind="outline" title="Update name" onPress={saveName} />
          </Card>

          <SectionHead title="Change email" />
          <Card>
            <Field label="New email" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
            {err.email ? <Text style={{ color: t.danger, marginBottom: 8 }}>{err.email}</Text> : null}
            <Button small kind="outline" title="Update email" onPress={saveEmail} />
          </Card>

          <SectionHead title="Change password" />
          <Card>
            <Field label="New password" value={pw1} onChangeText={setPw1} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
            <Field label="Confirm new password" value={pw2} onChangeText={setPw2} secureTextEntry textContentType="newPassword" autoComplete="new-password" />
            {err.pw ? <Text style={{ color: t.danger, marginBottom: 8 }}>{err.pw}</Text> : null}
            <Button small kind="outline" title="Update password" onPress={savePassword} />
          </Card>

          <PremiumSection />

          <View style={{ gap: 10, marginTop: 24 }}>
            <Button small kind="outline" title="Sign out" onPress={confirmSignOut} />
            <Button small kind="outlineDanger" title="Format calendar" onPress={formatCalendar} />
            <Button small kind="outlineDanger" title="Delete account" onPress={confirmDelete} />
          </View>
        </>
      ) : (
        <>
          <Card>
            <Button title="Sign in or create account" onPress={() => { onClose(); showSignIn(); }} />
          </Card>
          <PremiumSection />
          <Button small kind="outlineDanger" style={{ marginTop: 16 }} title="Format calendar" onPress={formatCalendar} />
        </>
      )}
    </Sheet>
  );
}

// Premium status, upgrade, manage and restore (Apple purchases, iPhone only).
function PremiumSection() {
  const premium = usePremium();
  const { toast } = useUi();
  if (Platform.OS !== "ios") return null;
  return (
    <>
      <SectionHead title="Premium" />
      <Card style={{ paddingVertical: 2 }}>
        <MenuRow title="Roster Board Premium" right={!premium.status.active ? "Free" : premium.status.kind === "lifetime" ? "Lifetime" : premium.status.kind === "complimentary" ? "Complimentary" : "Monthly"}
          onPress={() => (premium.status.active ? undefined : premium.openPaywall())} />
        {!premium.status.active ? (<><Divider /><MenuRow title="Unlock Premium" onPress={() => premium.openPaywall()} /></>) : null}
        {premium.status.kind === "monthly" ? (<><Divider /><MenuRow title="Manage subscription" onPress={() => Linking.openURL("https://apps.apple.com/account/subscriptions")} /></>) : null}
        <Divider />
        <MenuRow title="Restore purchases" onPress={async () => { const ok = await premium.restore(); toast(ok ? "Purchases restored" : "No purchases found for this Apple ID"); }} />
      </Card>
    </>
  );
}
