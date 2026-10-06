import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { UiProvider, useTheme } from "./src/components/ui";
import { StoreProvider, useStore } from "./src/lib/store";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { TypesScreen } from "./src/screens/TypesScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

type Tab = "calendar" | "types" | "account";
const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: "calendar", label: "Calendar", icon: "▦" },
  { id: "types", label: "Types", icon: "◑" },
  { id: "account", label: "Account", icon: "◉" },
];

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { auth } = useStore();
  const [tab, setTab] = useState<Tab>("calendar");

  useEffect(() => {
    if (auth !== "loading") SplashScreen.hideAsync().catch(() => {});
  }, [auth]);

  if (auth === "loading") return <View style={{ flex: 1, backgroundColor: "#0F2244" }} />;
  if (auth === "signedOut") return (<><StatusBar style={t.dark ? "light" : "dark"} /><AuthScreen /></>);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <View style={{ flex: 1 }}>
        {tab === "calendar" ? <CalendarScreen /> : tab === "types" ? <TypesScreen /> : <AccountScreen />}
      </View>
      <View accessibilityRole="tablist" style={{
        flexDirection: "row", borderTopWidth: 0.5, borderTopColor: t.border, backgroundColor: t.surface,
        paddingBottom: Math.max(insets.bottom, 8), paddingTop: 8,
      }}>
        {TABS.map((x) => {
          const on = x.id === tab;
          return (
            <Pressable key={x.id} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setTab(x.id)}
              style={{ flex: 1, alignItems: "center", gap: 2 }}>
              <Text style={{ fontSize: 20, color: on ? t.accent : t.textFaint }}>{x.icon}</Text>
              <Text style={{ fontSize: 11, fontWeight: "700", color: on ? t.accent : t.textFaint }}>{x.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <UiProvider>
          <Shell />
        </UiProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
