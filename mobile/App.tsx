import Ionicons from "@expo/vector-icons/Ionicons";
import { Fraunces_700Bold, useFonts } from "@expo-google-fonts/fraunces";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import React, { useEffect, useRef, useState } from "react";
import { AppState, Pressable, Text, View } from "react-native";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { UiProvider, useTheme } from "./src/components/ui";
import { askIfRemindersNeedIt, syncReminders } from "./src/lib/reminders";
import { planContactSync, readContactBirthdays } from "./src/lib/contactBirthdays";
import { PremiumProvider } from "./src/lib/premium";
import { StoreProvider, useStore } from "./src/lib/store";
import { Paywall } from "./src/screens/Paywall";
import { AccountScreen } from "./src/screens/AccountScreen";
import { AuthScreen } from "./src/screens/AuthScreen";
import { Onboarding, hasSeenOnboarding } from "./src/screens/Onboarding";
import { CalendarScreen } from "./src/screens/CalendarScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { RosterScreen } from "./src/screens/RosterScreen";
import { TypesScreen } from "./src/screens/TypesScreen";

SplashScreen.preventAutoHideAsync().catch(() => {});

type Tab = "calendar" | "roster" | "reports" | "types" | "account";
type Icon = React.ComponentProps<typeof Ionicons>["name"];
const TABS: { id: Tab; label: string; icon: Icon; iconOn: Icon }[] = [
  { id: "calendar", label: "Calendar", icon: "calendar-outline", iconOn: "calendar" },
  { id: "roster", label: "Roster", icon: "repeat-outline", iconOn: "repeat" },
  { id: "reports", label: "Reports", icon: "stats-chart-outline", iconOn: "stats-chart" },
  { id: "types", label: "Types", icon: "color-palette-outline", iconOn: "color-palette" },
  { id: "account", label: "Account", icon: "person-circle-outline", iconOn: "person-circle" },
];
const SCREENS: { [k in Tab]: () => React.JSX.Element } = {
  calendar: CalendarScreen, roster: RosterScreen, reports: ReportsScreen, types: TypesScreen, account: AccountScreen,
};

function Shell() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { auth, data, sync, update } = useStore();
  const [fontsLoaded, fontError] = useFonts({ Fraunces_700Bold });
  const fontsReady = fontsLoaded || !!fontError;
  useEffect(() => { if (auth !== "loading") syncReminders(data.notes); }, [auth, data.notes]);
  useEffect(() => {
    if (auth === "loading") return;
    askIfRemindersNeedIt(data.notes).then(() => syncReminders(data.notes));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth]);
  const [tab, setTab] = useState<Tab>("calendar");
  // Mirror contact birthdays each time the app opens or comes back to the front,
  // after the account's data has loaded so another phone's copies are known.
  const dataRef = useRef(data); dataRef.current = data;
  const loaded = auth === "localOnly" || (auth === "signedIn" && sync.lastSync > 0);
  useEffect(() => {
    if (!loaded) return;
    let running = false;
    const run = async () => {
      if (running) return; running = true;
      try {
        const contacts = await readContactBirthdays();
        if (!contacts) return;
        const plan = planContactSync(dataRef.current.birthdays, contacts);
        if (!plan.add.length && !plan.change.length && !plan.remove.length) return;
        update((d, tomb) => {
          const gone: { [id: string]: true } = {};
          plan.remove.forEach((id) => { gone[id] = true; tomb(id); });
          d.birthdays = d.birthdays.filter((b) => !gone[b.id]);
          plan.change.forEach((c) => {
            const i = d.birthdays.findIndex((b) => b.id === c.id);
            if (i < 0) return;
            const { year: _y, ...rest } = d.birthdays[i];
            const next: any = { ...rest, name: c.rec.name, day: c.rec.day, month: c.rec.month, updatedAt: Date.now() };
            if (c.rec.year) next.year = c.rec.year;
            d.birthdays[i] = next;
          });
          plan.add.forEach((b) => d.birthdays.push(b));
        });
      } finally { running = false; }
    };
    run();
    const sub = AppState.addEventListener("change", (s) => { if (s === "active") run(); });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);
  const [onboarding, setOnboarding] = useState(false);
  const ready = auth === "signedIn" || auth === "localOnly";
  useEffect(() => { if (ready) hasSeenOnboarding().then((seen) => { if (!seen) setOnboarding(true); }); }, [ready]);

  useEffect(() => {
    if (auth !== "loading" && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [auth, fontsReady]);

  if (auth === "loading" || !fontsReady) return <View style={{ flex: 1, backgroundColor: "#0F2244" }} />;
  if (auth === "signedOut") return (<><StatusBar style={t.dark ? "light" : "dark"} /><AuthScreen /></>);

  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <StatusBar style={t.dark ? "light" : "dark"} />
      <Onboarding visible={onboarding} onClose={() => setOnboarding(false)} />
      <Paywall />
      <View style={{ flex: 1 }}>
        {React.createElement(SCREENS[tab])}
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
              <Ionicons name={on ? x.iconOn : x.icon} size={23} color={on ? t.accent : t.textFaint} />
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
          <PremiumProvider>
            <Shell />
          </PremiumProvider>
        </UiProvider>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
