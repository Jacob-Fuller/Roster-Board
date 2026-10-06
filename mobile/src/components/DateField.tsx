import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { MONTHS, parseYmd, ymd } from "../lib/model";
import { Field, useTheme } from "./ui";

const pretty = (k: string) => { const d = parseYmd(k); return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3) + " " + d.getFullYear(); };

// The phone's own date picker ("YYYY-MM-DD" in and out).
export function DateField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  if (Platform.OS === "web") return <Field label={label} value={value} onChangeText={onChange} placeholder="2026-01-31" />;
  if (Platform.OS === "ios") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 15, color: t.text }}>{label}</Text>
        <DateTimePicker mode="date" display="compact" value={parseYmd(value)} themeVariant={t.dark ? "dark" : "light"} accentColor={t.accent}
          onChange={(_, d) => { if (d) onChange(ymd(d)); }} />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, color: t.text }}>{label}</Text>
        <Text style={{ fontSize: 15, color: t.accent, fontWeight: "700" }}>{pretty(value)}</Text>
      </Pressable>
      {open ? <DateTimePicker mode="date" value={parseYmd(value)} onChange={(e, d) => { setOpen(false); if (e.type === "set" && d) onChange(ymd(d)); }} /> : null}
    </View>
  );
}
