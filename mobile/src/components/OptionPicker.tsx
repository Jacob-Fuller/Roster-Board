// A settings-style row ("Alert   30 minutes before ›") that opens a list of options with a tick on the chosen one.
import React, { useState } from "react";
import { Pressable, Text } from "react-native";
import { Card, Dim, Divider, MenuRow, Sheet, useTheme } from "./ui";

export function OptionPicker({ label, value, options, onChange }: {
  label: string; value: number; options: { value: number; label: string }[]; onChange: (v: number) => void;
}) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const current = options.find((o) => o.value === value) || options[0];
  return (
    <>
      <Pressable accessibilityRole="button" accessibilityLabel={label + ": " + current.label} onPress={() => setOpen(true)}
        style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", paddingVertical: 12, gap: 10, opacity: pressed ? 0.6 : 1 })}>
        <Text style={{ flex: 1, color: t.text, fontSize: 15 }}>{label}</Text>
        <Dim>{current.label}</Dim>
        <Text style={{ color: t.textFaint, fontSize: 20 }}>›</Text>
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <Card style={{ paddingVertical: 2 }}>
          {options.map((o, i) => (
            <React.Fragment key={o.value}>
              {i ? <Divider /> : null}
              <MenuRow center title={(o.value === value ? "✓  " : "") + o.label} onPress={() => { setOpen(false); onChange(o.value); }} />
            </React.Fragment>
          ))}
        </Card>
      </Sheet>
    </>
  );
}
