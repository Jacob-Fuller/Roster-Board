import React, { useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, Card, Dim, Field, MastBackground, LinkText, SERIF, useTheme, useUi } from "../components/ui";
import { useStore } from "../lib/store";
import { sb, WEB_URL } from "../lib/supabase";

export function AuthScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { useWithoutAccount } = useStore();
  const { dialog, toast } = useUi();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok?: boolean } | null>(null);

  async function submit() {
    const e = email.trim();
    if (!e || !pw) { setMsg({ text: "Enter an email and password." }); return; }
    if (pw.length < 6) { setMsg({ text: "Password must be at least 6 characters." }); return; }
    setMsg(null); setBusy(true);
    try {
      if (mode === "signup") {
        const r = await sb.auth.signUp({ email: e, password: pw, options: { emailRedirectTo: WEB_URL } });
        if (r.error) { setMsg({ text: r.error.message }); return; }
        if (r.data.user && !r.data.session) {
          setMode("login");
          setMsg({ text: "Check your email to confirm your account, then log in.", ok: true });
        }
      } else {
        const r = await sb.auth.signInWithPassword({ email: e, password: pw });
        if (r.error) setMsg({ text: r.error.message });
      }
    } catch {
      setMsg({ text: "Couldn't reach Tempus Board. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  function forgot() {
    dialog({
      title: "Reset password",
      message: "Enter your account email. We'll send a link to set a new password.",
      input: { placeholder: "you@example.com", value: email.trim(), keyboard: "email-address" },
      confirm: "Send link",
      onConfirm: async (v) => {
        const e = v.trim();
        if (!e) return;
        const r = await sb.auth.resetPasswordForEmail(e, { redirectTo: WEB_URL });
        toast(r.error ? "Couldn't send reset link" : "Check your email for a reset link");
      },
    });
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
        <View style={{ backgroundColor: t.mast, paddingTop: insets.top + 48, paddingBottom: 76, alignItems: "center", borderBottomLeftRadius: 34, borderBottomRightRadius: 34, overflow: "hidden" }}>
          <MastBackground t={t} />
          <Image source={require("../../assets/icon.png")} style={{ width: 84, height: 84, borderRadius: 20, marginBottom: 16 }} />
          <Text style={{ fontFamily: SERIF, fontSize: 34, letterSpacing: -0.6, color: t.mastInk }}>Tempus Board</Text>
          <Text style={{ color: t.mastDim, fontSize: 15, marginTop: 4 }}>Shifts, rosters and pay in one calendar</Text>
        </View>
        <Card style={{ marginHorizontal: 18, marginTop: -44, padding: 20 }}>
        <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" autoComplete="email"
          keyboardType="email-address" textContentType="emailAddress" placeholder="you@example.com" />
        <Field label="Password" value={pw} onChangeText={setPw} secureTextEntry autoComplete={mode === "login" ? "current-password" : "new-password"}
          textContentType={mode === "login" ? "password" : "newPassword"} placeholder="At least 6 characters" onSubmitEditing={submit} />
        {msg ? <Text style={{ color: msg.ok ? t.good : t.danger, marginBottom: 12, fontSize: 14 }}>{msg.text}</Text> : null}
        <Button title={busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account"} onPress={submit} disabled={busy} />
        <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 16 }}>
          <LinkText title={mode === "login" ? "Create an account" : "I have an account"} onPress={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} />
          {mode === "login" ? <LinkText title="Forgot Password?" onPress={forgot} /> : null}
        </View>
        </Card>
        <View style={{ alignItems: "center", marginTop: 28, paddingHorizontal: 24 }}>
          <LinkText title="Use Without an Account" color={t.textDim} onPress={useWithoutAccount} />
          <Dim style={{ marginTop: 6, textAlign: "center" }}>Your roster stays on this phone only.</Dim>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
