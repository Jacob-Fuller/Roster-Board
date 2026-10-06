import Ionicons from "@expo/vector-icons/Ionicons";
import React from "react";
import { Linking, Modal, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { Button, Card, Dim, H1, LinkText, useTheme, useUi } from "../components/ui";
import { usePremium } from "../lib/premium";
import { WEB_URL } from "../lib/supabase";

// Same content as the web app's paywall.
const PERKS = [
  "Unlimited shift types",
  "Roster patterns: fill your calendar for a year in one tap",
  "Estimated pay for every week, fortnight, month and year",
  "Full reports: by shift type, weekday vs weekend, period comparison",
  "PDF roster export",
];

export function Paywall() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { toast } = useUi();
  const { paywall, closePaywall, prices, buy, restore, busy, error } = usePremium();
  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={paywall !== null} animationType="slide" presentationStyle="pageSheet" onRequestClose={closePaywall}>
      <View style={{ flex: 1, backgroundColor: t.bg }}>
        {Platform.OS === "android" ? <StatusBar style={t.dark ? "light" : "dark"} /> : null}
        <ScrollView contentContainerStyle={{ padding: 22, paddingTop: Platform.OS === "android" ? insets.top + 16 : 22, paddingBottom: insets.bottom + 24 }}>
          <View style={{ alignItems: "flex-end" }}>
            <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={closePaywall} hitSlop={10}
              style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
              <Text style={{ color: t.textDim, fontWeight: "700" }}>✕</Text>
            </Pressable>
          </View>
          <Text style={{ color: t.accent, fontWeight: "800", letterSpacing: 1, fontSize: 12, marginTop: 4 }}>PREMIUM</Text>
          <H1 style={{ marginTop: 4, marginBottom: 8 }}>Roster Board Premium</H1>
          {paywall ? <Dim style={{ fontSize: 15, marginBottom: 14 }}>{paywall}</Dim> : null}
          <View style={{ gap: 10, marginBottom: 20 }}>
            {PERKS.map((p) => (
              <View key={p} style={{ flexDirection: "row", gap: 10, alignItems: "flex-start" }}>
                <Ionicons name="checkmark-circle" size={20} color={t.accent} />
                <Text style={{ flex: 1, color: t.text, fontSize: 15, lineHeight: 21 }}>{p}</Text>
              </View>
            ))}
          </View>
          <Plan title="Lifetime" sub="One payment, yours forever" price={prices.lifetime} onPress={() => buy("lifetime")} disabled={busy} primary />
          <Plan title="Monthly" sub="Cancel anytime" price={prices.monthly} onPress={() => buy("monthly")} disabled={busy} />
          {error ? <Text style={{ color: t.danger, marginTop: 8, textAlign: "center" }}>{error}</Text> : null}
          <Button kind="ghost" style={{ marginTop: 12 }} title="Restore purchases" onPress={async () => {
            const ok = await restore();
            toast(ok ? "Purchases restored" : "No purchases found for this Apple ID");
          }} />
          <Dim style={{ marginTop: 16, lineHeight: 19, fontSize: 12 }}>
            The monthly plan is an auto-renewing subscription charged to your Apple ID. It renews each month unless cancelled at least 24 hours before the end of the current period. Manage or cancel it in your Apple ID settings. Lifetime is a one-off purchase.
          </Dim>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 18, marginTop: 12 }}>
            <LinkText title="Terms of Use" onPress={() => Linking.openURL("https://www.apple.com/legal/internet-services/itunes/dev/stdeula/")} />
            <LinkText title="Privacy Policy" onPress={() => Linking.openURL(WEB_URL + "privacy.html")} />
          </View>
        </ScrollView>
      </View>
    </Modal>
  );
}

function Plan({ title, sub, price, onPress, disabled, primary }: { title: string; sub: string; price: string; onPress: () => void; disabled?: boolean; primary?: boolean }) {
  const t = useTheme();
  return (
    <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: "row", alignItems: "center", borderRadius: 14, padding: 16, marginBottom: 10,
        backgroundColor: primary ? t.accent : t.surface, borderWidth: primary ? 0 : 1, borderColor: t.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1,
      })}>
      <View style={{ flex: 1 }}>
        <Text style={{ color: primary ? t.accentInk : t.text, fontWeight: "800", fontSize: 16 }}>{title}</Text>
        <Text style={{ color: primary ? t.accentInk : t.textDim, fontSize: 13, opacity: 0.9 }}>{sub}</Text>
      </View>
      <Text style={{ color: primary ? t.accentInk : t.text, fontWeight: "800", fontSize: 16 }}>{price}</Text>
    </Pressable>
  );
}

// Shown in place of a locked section (same as the web's lock card).
export function LockCard({ text }: { text: string }) {
  const t = useTheme();
  const { openPaywall } = usePremium();
  return (
    <Card style={{ alignItems: "flex-start", gap: 10 }}>
      <Text style={{ color: t.text, fontSize: 14, lineHeight: 20 }}>{text}</Text>
      <Button small title="Unlock Premium" onPress={() => openPaywall()} />
    </Card>
  );
}
