import Ionicons from "@expo/vector-icons/Ionicons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { useRef, useState } from "react";
import { Modal, Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, H1, useTheme } from "../components/ui";

export const ONBOARDING_KEY = "rosterBoard.onboardingSeen";
export async function hasSeenOnboarding() { return (await AsyncStorage.getItem(ONBOARDING_KEY).catch(() => null)) === "1"; }

type Icon = React.ComponentProps<typeof Ionicons>["name"];
// Same slides as the web app.
const SLIDES: { icon: Icon; title: string; text: string }[] = [
  { icon: "color-palette-outline", title: "Create your shifts", text: "Start on the Types tab and add your own shift types — name, colour and start/end time — and the hours are worked out for you automatically." },
  { icon: "repeat-outline", title: "Set up your roster", text: "Then on the Roster tab, build your repeating pattern, set how many weeks it runs for, and stamp it onto the calendar as your starting template." },
  { icon: "time-outline", title: "Built-in shift types", text: "Overtime, Excess Hours, Annual Leave and Sick Leave are already set up for you. Choose which of your shift types allow overtime or excess hours from each shift type's settings." },
  { icon: "stats-chart-outline", title: "Reports", text: "See totals for the month or year — hours worked, excess hours, overtime, leave and estimated pay — and export your roster as a PDF." },
  { icon: "person-outline", title: "Personal entries too", text: "Not everything is a shift. Mark a new type as \"Personal\" — like a reminder to call the kids — and it'll show on your calendar without counting toward your hours or reports." },
];

export function Onboarding({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const ref = useRef<ScrollView>(null);
  const [idx, setIdx] = useState(0);
  const last = idx === SLIDES.length - 1;
  const go = (i: number) => { const n = Math.max(0, Math.min(SLIDES.length - 1, i)); ref.current?.scrollTo({ x: n * width, animated: true }); setIdx(n); };
  const close = () => { AsyncStorage.setItem(ONBOARDING_KEY, "1").catch(() => {}); setIdx(0); onClose(); };

  return (
    <Modal visible={visible} animationType="fade" onRequestClose={close}>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }}>
        <View style={{ alignItems: "flex-end", paddingHorizontal: 20 }}>
          <Pressable accessibilityRole="button" onPress={close} hitSlop={10}><Text style={{ color: t.textDim, fontWeight: "700", fontSize: 15 }}>Skip</Text></Pressable>
        </View>
        <ScrollView ref={ref} horizontal pagingEnabled showsHorizontalScrollIndicator={false} style={{ flex: 1 }}
          onMomentumScrollEnd={(e) => setIdx(Math.round(e.nativeEvent.contentOffset.x / width))}>
          {SLIDES.map((s) => (
            <View key={s.title} style={{ width, paddingHorizontal: 32, justifyContent: "center", alignItems: "center" }}>
              <View style={{ width: 96, height: 96, borderRadius: 28, backgroundColor: t.accentSoft, alignItems: "center", justifyContent: "center", marginBottom: 28 }}>
                <Ionicons name={s.icon} size={46} color={t.accent} />
              </View>
              <H1 style={{ textAlign: "center", marginBottom: 12 }}>{s.title}</H1>
              <Text style={{ color: t.textDim, fontSize: 16, lineHeight: 24, textAlign: "center" }}>{s.text}</Text>
            </View>
          ))}
        </ScrollView>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 7, marginBottom: 20 }}>
          {SLIDES.map((s, i) => <View key={s.title} style={{ width: i === idx ? 20 : 7, height: 7, borderRadius: 4, backgroundColor: i === idx ? t.accent : t.border }} />)}
        </View>
        <View style={{ flexDirection: "row", gap: 10, paddingHorizontal: 20 }}>
          <Button kind="ghost" title="Back" disabled={idx === 0} onPress={() => go(idx - 1)} />
          <Button style={{ flex: 1 }} title={last ? "Get started" : "Next"} onPress={() => (last ? close() : go(idx + 1))} />
        </View>
      </View>
    </Modal>
  );
}
