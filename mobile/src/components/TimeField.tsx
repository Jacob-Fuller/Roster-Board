import DateTimePicker from "@react-native-community/datetimepicker";
import React, { useState } from "react";
import { Platform, Pressable, Text, View } from "react-native";
import { Field, useTheme } from "./ui";

const toDate = (hhmm: string) => {
  const [h, m] = (hhmm || "07:00").split(":").map((x) => +x || 0);
  const d = new Date(); d.setHours(h, m, 0, 0); return d;
};
const toHHMM = (d: Date) => String(d.getHours()).padStart(2, "0") + ":" + String(d.getMinutes()).padStart(2, "0");

// The phone's own time picker ("HH:MM" in and out, same format as the web app).
export function TimeField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);

  if (Platform.OS === "web") {
    return <Field label={label} value={value} onChangeText={onChange} placeholder="07:00" />;
  }
  if (Platform.OS === "ios") {
    return (
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <Text style={{ fontSize: 15, color: t.text }}>{label}</Text>
        <DateTimePicker mode="time" display="compact" value={toDate(value)} minuteInterval={5}
          themeVariant={t.dark ? "dark" : "light"} accentColor={t.accent}
          onChange={(_, d) => { if (d) onChange(toHHMM(d)); }} />
      </View>
    );
  }
  return (
    <View style={{ marginBottom: 12 }}>
      <Pressable accessibilityRole="button" onPress={() => setOpen(true)}
        style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 12 }}>
        <Text style={{ fontSize: 15, color: t.text }}>{label}</Text>
        <Text style={{ fontSize: 15, color: t.accent, fontWeight: "700" }}>{value || "Set"}</Text>
      </Pressable>
      {open ? (
        <DateTimePicker mode="time" value={toDate(value)} is24Hour
          onChange={(e, d) => { setOpen(false); if (e.type === "set" && d) onChange(toHHMM(d)); }} />
      ) : null}
    </View>
  );
}
