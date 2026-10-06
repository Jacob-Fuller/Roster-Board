import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateField } from "../components/DateField";
import { TimeField } from "../components/TimeField";
import { Button, Card, Dim, Divider, Field, H1, Segmented, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import { useStore } from "../lib/store";
import { FREE_TYPE_LIMIT, usePremium } from "../lib/premium";
import { PALETTE, addDays, employmentOf, calcDuration, fmtHours, mkId, parseYmd, typeLabel, ymd, type ShiftType } from "../lib/model";

type Draft = {
  name: string; color: string; ink: string; kind: "work" | "personal";
  start: string; end: string; overtimeEligible: boolean; excessEligible: boolean;
  allDay: boolean; timed: boolean; time: string;
  notes: string; useRange: boolean; rangeStart: string; rangeEnd: string;
};
const blank = (): Draft => ({
  name: "", color: PALETTE[0].hex, ink: PALETTE[0].ink, kind: "work", start: "07:00", end: "19:00",
  overtimeEligible: true, excessEligible: true, allDay: true, timed: false, time: "09:00",
  notes: "", useRange: false, rangeStart: ymd(new Date()), rangeEnd: ymd(new Date()),
});

export function TypesScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const { locked, openPaywall } = usePremium();
  const fullTime = employmentOf(data.settings) === "full";
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const types = data.types.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));

  function open(ty?: ShiftType) {
    if (!ty) {
      if (locked && data.types.length >= FREE_TYPE_LIMIT) { openPaywall("The free version includes " + FREE_TYPE_LIMIT + " shift types. Premium gives you unlimited."); return; }
      setDraft(blank()); setEditing("new"); return;
    }
    setDraft({
      name: ty.name, color: ty.color, ink: ty.ink, kind: ty.kind === "personal" ? "personal" : "work",
      start: ty.startTime || "07:00", end: ty.endTime || "19:00",
      overtimeEligible: ty.overtimeEligible !== false, excessEligible: ty.excessEligible !== false,
      allDay: !!ty.allDay, timed: !ty.allDay && !!ty.time, time: ty.time || "09:00",
      notes: ty.notes || "", useRange: false, rangeStart: ymd(new Date()), rangeEnd: ymd(new Date()),
    });
    setEditing(ty.id);
  }

  function save() {
    const name = draft.name.trim();
    if (!name) { toast("Give it a name"); return; }
    const personal = draft.kind === "personal";
    const fields = {
      name, color: draft.color, ink: draft.ink, kind: draft.kind,
      startTime: personal ? (draft.timed ? draft.time : null) : draft.start,
      endTime: personal ? null : draft.end,
      hours: personal ? 0 : calcDuration(draft.start, draft.end),
      overtimeEligible: personal ? false : draft.overtimeEligible,
      excessEligible: personal ? false : draft.excessEligible,
      time: personal && draft.timed ? draft.time : null,
      allDay: personal ? !draft.timed : false,
      notes: personal ? draft.notes.trim() || null : null,
    };
    const id = editing;
    // Personal entries can be put on every day of a date range in one go (same as the web).
    const range = personal && draft.useRange && draft.rangeEnd >= draft.rangeStart ? [draft.rangeStart, draft.rangeEnd] : null;
    let added = 0;
    update((d) => {
      let typeId = id as string;
      if (id && id !== "new") {
        const i = d.types.findIndex((x) => x.id === id);
        if (i >= 0) d.types[i] = { ...d.types[i], ...fields, updatedAt: Date.now() };
      } else {
        typeId = mkId();
        d.types.push({ id: typeId, ...fields, order: d.types.length } as ShiftType);
      }
      if (range) {
        for (let day = parseYmd(range[0]); day <= parseYmd(range[1]); day = addDays(day, 1)) {
          const e: any = { id: mkId(), typeId };
          if (fields.notes) e.tag = fields.notes;
          (d.shifts[ymd(day)] = d.shifts[ymd(day)] || []).push(e);
          added++;
        }
      }
    });
    toast(range ? added + " day" + (added === 1 ? "" : "s") + " added to your calendar" : id === "new" ? "Type created" : "Type updated");
    setEditing(null);
  }

  function remove() {
    const id = editing;
    if (!id || id === "new") return;
    const ty = data.types.find((x) => x.id === id);
    let used = 0;
    Object.keys(data.shifts).forEach((k) => (data.shifts[k] || []).forEach((s) => { if (s.typeId === id) used++; }));
    dialog({
      title: "Delete " + (ty ? ty.name : "this type") + "?",
      message: used ? "It's on your calendar " + used + (used === 1 ? " time" : " times") + ". Those entries will be removed too, along with it in your roster pattern. This can't be undone." : "This can't be undone.",
      confirm: "Delete", danger: true,
      onConfirm: () => {
        update((d, tomb) => {
          d.types = d.types.filter((x) => x.id !== id);
          tomb(id);
          Object.keys(d.shifts).forEach((k) => {
            const list = d.shifts[k] || [];
            const keep = list.filter((s) => { if (s.typeId === id) { tomb(s.id); return false; } return true; });
            if (keep.length !== list.length) { if (keep.length) d.shifts[k] = keep; else delete d.shifts[k]; }
          });
          let changed = false;
          (d.roster.pattern || []).forEach((w) => w.forEach((day, i) => {
            if (day && day.indexOf(id) !== -1) { w[i] = day.filter((x) => x !== id); changed = true; }
          }));
          if (changed) d.roster.updatedAt = Date.now();
        }, { forceBackup: true });
        toast("Type deleted");
        setEditing(null);
      },
    });
  }

  const hours = calcDuration(draft.start, draft.end);
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
        <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <H1>Shift types</H1>
          <Button small title="+ New type" onPress={() => open()} />
        </View>
        {types.length ? (
          <Card style={{ paddingVertical: 2 }}>
            {types.map((ty, i) => (
              <View key={ty.id}>
                {i ? <Divider /> : null}
                <Pressable accessibilityRole="button" onPress={() => open(ty)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: ty.color, alignItems: "center", justifyContent: "center" }}>
                    <Text style={{ color: ty.ink, fontWeight: "800" }}>{ty.name.slice(0, 1).toUpperCase()}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{ty.name}</Text>
                    <Dim>{ty.kind === "personal" ? "Personal · " + typeLabel(ty) : typeLabel(ty)}</Dim>
                  </View>
                  <Text style={{ color: t.textFaint, fontSize: 20 }}>›</Text>
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Dim>No shift types yet. Create one for each shift you work, like Day or Night.</Dim></Card>
        )}
        <Dim style={{ marginTop: 14 }}>{fullTime ? "Overtime is built in. Add it from any day on the calendar." : "Overtime and Excess Hours are built in. Add them from any day on the calendar."}</Dim>
      </ScrollView>

      <Sheet visible={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "New shift type" : "Edit shift type"}
        footer={
          <View style={{ flexDirection: "row", gap: 10 }}>
            {editing && editing !== "new" ? <Button kind="danger" title="Delete" onPress={remove} /> : null}
            <Button style={{ flex: 1 }} title="Save" onPress={save} />
          </View>
        }>
        <Segmented options={[{ value: "work", label: "Work shift" }, { value: "personal", label: "Personal" }]} value={draft.kind} onChange={(k) => set({ kind: k })} />
        <View style={{ height: 14 }} />
        <Field label="Name" value={draft.name} onChangeText={(v) => set({ name: v })} placeholder={draft.kind === "work" ? "e.g. Day shift" : "e.g. Gym"} maxLength={30} />
        <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 8, fontWeight: "600" }}>Colour</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 16 }}>
          {PALETTE.map((p) => (
            <Pressable key={p.hex} accessibilityRole="button" accessibilityState={{ selected: draft.color === p.hex }} onPress={() => set({ color: p.hex, ink: p.ink })}
              style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: p.hex, borderWidth: 3, borderColor: draft.color === p.hex ? t.text : "transparent" }} />
          ))}
        </View>
        {draft.kind === "work" ? (
          <>
            <TimeField label="Starts" value={draft.start} onChange={(v) => set({ start: v })} />
            <TimeField label="Ends" value={draft.end} onChange={(v) => set({ end: v })} />
            <Dim style={{ marginBottom: 8 }}>{fmtHours(hours)} hours</Dim>
            <ToggleRow label="Can have overtime" value={draft.overtimeEligible} onChange={(v) => set({ overtimeEligible: v })} />
            {!fullTime ? <ToggleRow label="Can have excess hours" value={draft.excessEligible} onChange={(v) => set({ excessEligible: v })} /> : null}
          </>
        ) : (
          <>
            <Dim style={{ marginBottom: 8 }}>Personal entries show on your calendar without counting toward your hours or reports.</Dim>
            <ToggleRow label="Set a time" value={draft.timed} onChange={(v) => set({ timed: v })} />
            {draft.timed ? <TimeField label="Time" value={draft.time} onChange={(v) => set({ time: v })} /> : null}
            <Field label="Notes (optional)" value={draft.notes} onChangeText={(v) => set({ notes: v })} multiline style={{ minHeight: 64, textAlignVertical: "top" }} />
            <ToggleRow label="Add to a range of dates" value={draft.useRange} onChange={(v) => set({ useRange: v })} />
            {draft.useRange ? (
              <>
                <DateField label="Start date" value={draft.rangeStart} onChange={(v) => set({ rangeStart: v })} />
                <DateField label="End date" value={draft.rangeEnd} onChange={(v) => set({ rangeEnd: v })} />
              </>
            ) : null}
          </>
        )}
      </Sheet>
    </View>
  );
}
