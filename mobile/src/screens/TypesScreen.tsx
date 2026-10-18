import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useState } from "react";
import { Pressable, ScrollView, Text, View } from "react-native";
import { DateField } from "../components/DateField";
import { TimeField } from "../components/TimeField";
import { Button, Card, Dim, Divider, Field, MastButton, Masthead, Segmented, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import { BannerBorder } from "../components/BannerBorder";
import { OptionPicker } from "../components/OptionPicker";
import { requestAlarmPermission, SHIFT_ALARM_OPTIONS, useAlarmsAvailable } from "../lib/shiftAlarms";
import { useStore } from "../lib/store";
import { FREE_TYPE_LIMIT, usePremium } from "../lib/premium";
import { BANNER_BORDERS, PALETTE, TYPE_ICONS, addDays, employmentOf, calcDuration, fmtHours, mkId, parseYmd, typeLabel, ymd, type ShiftType } from "../lib/model";

type Draft = {
  name: string; color: string; ink: string; icon: string | null; border: string; kind: "work" | "personal";
  start: string; end: string; overtimeEligible: boolean; excessEligible: boolean; alarm: number;
  allDay: boolean; timed: boolean; time: string;
  notes: string; useRange: boolean; rangeStart: string; rangeEnd: string;
};
const blank = (): Draft => ({
  name: "", color: PALETTE[0].hex, ink: PALETTE[0].ink, icon: null, border: "none", kind: "work", start: "07:00", end: "19:00",
  overtimeEligible: true, excessEligible: true, alarm: 0, allDay: true, timed: false, time: "09:00",
  notes: "", useRange: false, rangeStart: ymd(new Date()), rangeEnd: ymd(new Date()),
});

export function TypesScreen() {
  const t = useTheme();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const { locked, openPaywall } = usePremium();
  const fullTime = employmentOf(data.settings) === "full";
  const [editing, setEditing] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(blank());
  const types = data.types.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const alarmsOk = useAlarmsAvailable();
  async function chooseAlarm(v: number) {
    if (v > 0 && locked) { setEditing(null); setTimeout(() => openPaywall("Alarms are part of Premium."), 500); return; }
    if (v > 0 && !(await requestAlarmPermission())) { toast("Allow alarms for Roster Board in Settings to use alarms"); return; }
    set({ alarm: v });
  }

  function open(ty?: ShiftType) {
    if (!ty) {
      if (locked && data.types.length >= FREE_TYPE_LIMIT) { openPaywall("The free version includes " + FREE_TYPE_LIMIT + " shift types. Premium gives you unlimited."); return; }
      setDraft(blank()); setEditing("new"); return;
    }
    setDraft({
      name: ty.name, color: ty.color, ink: ty.ink, icon: ty.icon || null, border: ty.border || "none", kind: ty.kind === "personal" ? "personal" : "work",
      start: ty.startTime || "07:00", end: ty.endTime || "19:00",
      overtimeEligible: ty.overtimeEligible !== false, excessEligible: ty.excessEligible !== false, alarm: ty.alarm || 0,
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
      name, color: draft.color, ink: draft.ink, icon: draft.icon, border: draft.border === "none" ? null : draft.border, kind: draft.kind,
      startTime: personal ? (draft.timed ? draft.time : null) : draft.start,
      endTime: personal ? null : draft.end,
      hours: personal ? 0 : calcDuration(draft.start, draft.end),
      overtimeEligible: personal ? false : draft.overtimeEligible,
      excessEligible: personal ? false : draft.excessEligible,
      alarm: !draft.alarm || (personal && !draft.timed) ? null : draft.alarm,
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
      <ScrollView contentContainerStyle={{ paddingBottom: 40 }}>
        <Masthead title="Shift types" right={<MastButton icon="add" label="New type" onPress={() => open()} />} />
        <View style={{ paddingHorizontal: 16, paddingTop: 16 }}>
        {types.length ? (
          <Card style={{ paddingVertical: 2 }}>
            {types.map((ty, i) => (
              <View key={ty.id}>
                {i ? <Divider /> : null}
                <Pressable accessibilityRole="button" onPress={() => open(ty)} style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 13, opacity: pressed ? 0.6 : 1 })}>
                  <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: ty.color, alignItems: "center", justifyContent: "center" }}>
                    <TypeBadgeContent ty={ty} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{ty.name}</Text>
                    <Dim>{ty.kind === "personal" ? "Personal · " + typeLabel(ty) : typeLabel(ty)}</Dim>
                  </View>
                  <Ionicons name="chevron-forward" size={17} color={t.textFaint} />
                </Pressable>
              </View>
            ))}
          </Card>
        ) : (
          <Card><Dim>No shift types yet.</Dim></Card>
        )}
        </View>
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
        <View style={{ gap: 10, marginBottom: 16 }}>
          {[PALETTE.slice(0, 8), PALETTE.slice(8)].map((row, r) => (
            <View key={r} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {row.map((p) => (
                <Pressable key={p.hex} accessibilityRole="button" accessibilityState={{ selected: draft.color === p.hex }} onPress={() => set({ color: p.hex, ink: p.ink })}
                  style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: p.hex, borderWidth: 3, borderColor: draft.color === p.hex ? t.text : "transparent" }} />
              ))}
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 8, fontWeight: "600" }}>Icon</Text>
        <View style={{ gap: 10, marginBottom: 16 }}>
          {[TYPE_ICONS.slice(0, 8), TYPE_ICONS.slice(8)].map((row, r) => (
            <View key={r} style={{ flexDirection: "row", justifyContent: "space-between" }}>
              {row.map((ic) => {
                const on = draft.icon === ic;
                return (
                  <Pressable key={ic} accessibilityRole="button" accessibilityLabel={ic.replace(/-/g, " ")} accessibilityState={{ selected: on }}
                    onPress={() => set({ icon: on ? null : ic })}
                    style={{ width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: on ? draft.color : t.surface2 }}>
                    <Ionicons name={ic} size={18} color={on ? draft.ink : t.textDim} />
                  </Pressable>
                );
              })}
            </View>
          ))}
        </View>
        <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 8, fontWeight: "600" }}>Border</Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 16 }}>
          {BANNER_BORDERS.map((b) => {
            const on = draft.border === b;
            return (
              <Pressable key={b} accessibilityRole="button" accessibilityLabel={b === "none" ? "No border" : b + " border"} accessibilityState={{ selected: on }}
                onPress={() => set({ border: b })}
                style={{ width: "23%", flexGrow: 1, height: 44, borderRadius: 12, padding: 3, borderWidth: 2, borderColor: on ? t.accent : "transparent" }}>
                <View style={{ flex: 1, borderRadius: 8, overflow: "hidden", backgroundColor: b === "none" ? t.surface2 : draft.color, alignItems: "center", justifyContent: "center" }}>
                  {b === "none"
                    ? <Text style={{ color: t.textDim, fontWeight: "700", fontSize: 12 }}>None</Text>
                    : <Text numberOfLines={1} style={{ color: draft.ink, fontWeight: "700", fontSize: 12, paddingHorizontal: 6 }}>{draft.name.trim() || "Shift"}</Text>}
                  {b === "none" ? null : <BannerBorder kind={b} bg={draft.color} ink={draft.ink} radius={8} s={1.25} />}
                </View>
              </Pressable>
            );
          })}
        </View>
        {draft.kind === "work" ? (
          <>
            <TimeField label="Starts" value={draft.start} onChange={(v) => set({ start: v })} />
            <TimeField label="Ends" value={draft.end} onChange={(v) => set({ end: v })} />
            <Dim style={{ marginBottom: 8 }}>{fmtHours(hours)} hours</Dim>
            <ToggleRow label="Overtime" value={draft.overtimeEligible} onChange={(v) => set({ overtimeEligible: v })} />
            {!fullTime ? <ToggleRow label="Excess" value={draft.excessEligible} onChange={(v) => set({ excessEligible: v })} /> : null}
            {alarmsOk ? <OptionPicker label="Alarm" value={draft.alarm} options={SHIFT_ALARM_OPTIONS} onChange={chooseAlarm} /> : null}
          </>
        ) : (
          <>
            <ToggleRow label="Set a time" value={draft.timed} onChange={(v) => set({ timed: v })} />
            {draft.timed ? <TimeField label="Time" value={draft.time} onChange={(v) => set({ time: v })} /> : null}
            {draft.timed && alarmsOk ? <OptionPicker label="Alarm" value={draft.alarm} options={SHIFT_ALARM_OPTIONS} onChange={chooseAlarm} /> : null}
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

// A type's badge: its chosen icon, or the first letter of its name.
function TypeBadgeContent({ ty }: { ty: ShiftType }) {
  if (ty.icon && (TYPE_ICONS as readonly string[]).includes(ty.icon)) return <Ionicons name={ty.icon as any} size={18} color={ty.ink} />;
  return <Text style={{ color: ty.ink, fontWeight: "800" }}>{ty.name.slice(0, 1).toUpperCase()}</Text>;
}
