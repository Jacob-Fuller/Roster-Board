import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Button, Dim, Divider, Field, Sheet, useTheme, useUi } from "../components/ui";
import { MONTHS, mkId, type Birthday } from "../lib/model";
import { useStore } from "../lib/store";

type Draft = { id: string | null; name: string; day: string; month: number; year: string };

export function BirthdaysSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const [draft, setDraft] = useState<Draft | null>(null);
  const sorted = data.birthdays.slice().sort((a, b) => a.month - b.month || a.day - b.day || (a.name || "").localeCompare(b.name || ""));

  const open = (b?: Birthday) => setDraft(b
    ? { id: b.id, name: b.name, day: String(b.day), month: b.month, year: b.year ? String(b.year) : "" }
    : { id: null, name: "", day: "", month: new Date().getMonth() + 1, year: "" });

  function save() {
    if (!draft) return;
    const name = draft.name.trim();
    const day = parseInt(draft.day, 10);
    const year = draft.year.trim() ? parseInt(draft.year, 10) : null;
    const maxDay = new Date(2024, draft.month, 0).getDate();
    if (!name) { toast("Enter a name"); return; }
    if (!day || day < 1 || day > maxDay) { toast("Enter a valid day"); return; }
    if (year != null && (isNaN(year) || year < 1900 || year > 2100)) { toast("Enter a valid year"); return; }
    const id = draft.id;
    update((d) => {
      const rec: any = { name, day, month: draft.month };
      if (year) rec.year = year;
      if (id) {
        const i = d.birthdays.findIndex((x) => x.id === id);
        if (i >= 0) { const { year: _y, ...rest } = d.birthdays[i]; d.birthdays[i] = { ...rest, ...rec, updatedAt: Date.now() }; }
      } else d.birthdays.push({ id: mkId(), ...rec });
    });
    toast(id ? "Birthday updated" : "Birthday added");
    setDraft(null);
  }

  function remove() {
    const id = draft && draft.id;
    if (!id) return;
    dialog({
      title: "Delete " + draft!.name + "'s birthday?", confirm: "Delete", danger: true,
      onConfirm: () => {
        update((d, tomb) => { d.birthdays = d.birthdays.filter((x) => x.id !== id); tomb(id); });
        toast("Birthday deleted");
        setDraft(null);
      },
    });
  }

  return (
    <Sheet visible={visible} onClose={() => { setDraft(null); onClose(); }} title={draft ? (draft.id ? "Edit birthday" : "Add birthday") : "Birthdays"}
      footer={draft ? (
        <View style={{ flexDirection: "row", gap: 10 }}>
          {draft.id ? <Button kind="danger" title="Delete" onPress={remove} /> : <Button kind="ghost" title="Back" onPress={() => setDraft(null)} />}
          <Button style={{ flex: 1 }} title="Save" onPress={save} />
        </View>
      ) : <Button title="+ Add birthday" onPress={() => open()} />}>
      {draft ? (
        <>
          <Field label="Name" value={draft.name} onChangeText={(v) => setDraft({ ...draft, name: v })} maxLength={30} />
          <Field label="Day" value={draft.day} onChangeText={(v) => setDraft({ ...draft, day: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={2} placeholder="e.g. 14" />
          <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 6, fontWeight: "600" }}>Month</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }} contentContainerStyle={{ gap: 6 }}>
            {MONTHS.map((m, i) => {
              const on = draft.month === i + 1;
              return (
                <Pressable key={m} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => setDraft({ ...draft, month: i + 1 })}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, backgroundColor: on ? t.accent : t.surface2 }}>
                  <Text style={{ color: on ? t.accentInk : t.text, fontWeight: "600" }}>{m.slice(0, 3)}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
          <Field label="Year (optional)" value={draft.year} onChangeText={(v) => setDraft({ ...draft, year: v.replace(/\D/g, "") })} keyboardType="number-pad" maxLength={4} placeholder="Shows their age" />
        </>
      ) : sorted.length ? sorted.map((b, i) => (
        <View key={b.id}>
          {i ? <Divider /> : null}
          <Pressable accessibilityRole="button" onPress={() => open(b)} style={{ paddingVertical: 12, flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>🎂 {b.name}</Text>
            <Dim>{b.day} {MONTHS[b.month - 1].slice(0, 3)}{b.year ? " " + b.year : ""}</Dim>
          </Pressable>
        </View>
      )) : <Dim>No birthdays added yet.</Dim>}
    </Sheet>
  );
}
