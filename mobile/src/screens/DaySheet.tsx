import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { TimeField } from "../components/TimeField";
import { Button, Chip, Dim, Divider, Field, SectionHead, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import { useStore } from "../lib/store";
import {
  EVENT_CATS, EVENT_CAT_ORDER, EXCESS_TYPE, LEAVE_KINDS, MONTHS, OVERTIME_TYPE, WEEKDAYS_FULL, birthdaysOnDate, effectiveHours, entryName, fmtHours, mkId,
  parseYmd, typeLabel,
} from "../lib/model";
import { useTypesById } from "./CalendarScreen";

export function DaySheet({ dateKey, onClose }: { dateKey: string | null; onClose: () => void }) {
  const t = useTheme();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const typesById = useTypesById();
  const [text, setText] = useState("");
  const [cat, setCat] = useState("other");
  const [timed, setTimed] = useState(false);
  const [time, setTime] = useState("09:00");

  useEffect(() => { setText(""); setTimed(false); }, [dateKey]);
  if (!dateKey) return <Sheet visible={false} onClose={onClose} title=""><View /></Sheet>;

  const date = parseYmd(dateKey);
  const title = WEEKDAYS_FULL[date.getDay()] + " " + date.getDate() + " " + MONTHS[date.getMonth()];
  const shifts = data.shifts[dateKey] || [];
  const leave = data.leave[dateKey] || [];
  const events = data.notes[dateKey] || [];
  const bdays = birthdaysOnDate(data.birthdays, date);
  const types = data.types.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const addShift = (typeId: string, hours?: number) => {
    update((d) => {
      const entry: any = { id: mkId(), typeId };
      if (hours != null) entry.hours = hours;
      (d.shifts[dateKey] = d.shifts[dateKey] || []).push(entry);
    });
    toast("Shift added");
  };
  const askHours = (label: string, then: (h: number) => void) => dialog({
    title: label, message: "How many hours?", input: { placeholder: "e.g. 2.5", keyboard: "decimal-pad" }, confirm: "Add",
    onConfirm: (v) => {
      const h = parseFloat(v.replace(",", "."));
      if (!h || h <= 0) { toast("Enter a number of hours"); return; }
      then(Math.round(h * 100) / 100);
    },
  });
  const removeFrom = (bucket: "shifts" | "leave" | "notes", id: string) => update((d, tomb) => {
    const list = (d as any)[bucket][dateKey] || [];
    (d as any)[bucket][dateKey] = list.filter((x: any) => x.id !== id);
    if (!(d as any)[bucket][dateKey].length) delete (d as any)[bucket][dateKey];
    tomb(id);
    if (bucket === "shifts") {
      // a removed picked-up shift takes its swap records with it (same as the web app)
      const onRec = (d.swaps[dateKey] || []).find((r) => r.kind === "on" && r.shiftEntryId === id);
      if (onRec) {
        d.swaps[dateKey] = d.swaps[dateKey].filter((r) => r.id !== onRec.id); tomb(onRec.id);
        const od = onRec.linkedDate;
        if (od && d.swaps[od]) { d.swaps[od] = d.swaps[od].filter((r) => r.id !== onRec.linkedSwapId); tomb(onRec.linkedSwapId); }
      }
    }
  });
  const addEvent = () => {
    const v = text.trim();
    if (!v) { toast("Give the event a name"); return; }
    update((d) => {
      const e: any = { id: mkId(), text: v, category: cat };
      if (timed) e.time = time; else e.allDay = true;
      (d.notes[dateKey] = d.notes[dateKey] || []).push(e);
    });
    setText(""); setTimed(false);
    toast("Event added");
  };

  return (
    <Sheet visible onClose={onClose} title={title}>
      <SectionHead title="Shifts" />
      {shifts.length ? shifts.map((s) => {
        const ty = typesById[s.typeId];
        const hours = effectiveHours(s, typesById);
        return (
          <Row key={s.id} color={ty ? ty.color : t.textFaint} title={entryName(s, typesById)}
            sub={[ty && ty.kind !== "personal" ? fmtHours(hours) + "h" : ty ? typeLabel(ty) : "", s.tag].filter(Boolean).join(" · ")}
            onRemove={() => removeFrom("shifts", s.id)} />
        );
      }) : <Dim style={{ marginBottom: 8 }}>Nothing rostered.</Dim>}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
        {types.map((ty) => <Chip key={ty.id} label={"+ " + ty.name} color={ty.color} ink={ty.ink} onPress={() => addShift(ty.id)} />)}
        <Chip label="+ Overtime" color={OVERTIME_TYPE.color} ink={OVERTIME_TYPE.ink} onPress={() => askHours("Overtime", (h) => addShift(OVERTIME_TYPE.id, h))} />
        <Chip label="+ Excess Hours" color={EXCESS_TYPE.color} ink={EXCESS_TYPE.ink} onPress={() => askHours("Excess Hours", (h) => addShift(EXCESS_TYPE.id, h))} />
      </View>
      {!types.length ? <Dim style={{ marginTop: 8 }}>Create your shift types in the Types tab.</Dim> : null}

      <SectionHead title="Leave" />
      {leave.map((l) => {
        const k = LEAVE_KINDS[l.kind] || LEAVE_KINDS.annual;
        return <Row key={l.id} color={k.color} title={k.label} sub={l.hours != null ? fmtHours(l.hours) + "h" : undefined} onRemove={() => removeFrom("leave", l.id)} />;
      })}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
        {(["annual", "sick"] as const).map((k) => (
          <Chip key={k} label={"+ " + LEAVE_KINDS[k].label} color={LEAVE_KINDS[k].color} ink={LEAVE_KINDS[k].ink}
            onPress={() => askHours(LEAVE_KINDS[k].label, (h) => {
              update((d) => { (d.leave[dateKey] = d.leave[dateKey] || []).push({ id: mkId(), kind: k, hours: h }); });
              toast(LEAVE_KINDS[k].label + " added");
            })} />
        ))}
      </View>

      <SectionHead title="Personal events" />
      {events.map((n) => {
        const c = EVENT_CATS[n.category || "other"] || EVENT_CATS.other;
        return <Row key={n.id} color={c.color} title={n.text} sub={[c.label, n.allDay ? "All day" : n.time].filter(Boolean).join(" · ")} onRemove={() => removeFrom("notes", n.id)} />;
      })}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6, marginBottom: 10 }}>
        {EVENT_CAT_ORDER.map((k) => (
          <Chip key={k} small label={EVENT_CATS[k].label} color={cat === k ? EVENT_CATS[k].color : t.surface2} ink={cat === k ? EVENT_CATS[k].ink : t.textDim} onPress={() => setCat(k)} />
        ))}
      </View>
      <Field value={text} onChangeText={setText} placeholder="e.g. Dentist, Birthday dinner…" returnKeyType="done" onSubmitEditing={addEvent} />
      <ToggleRow label="Set a time" value={timed} onChange={setTimed} />
      {timed ? <TimeField label="Time" value={time} onChange={setTime} /> : null}
      <Button title="Add event" onPress={addEvent} />

      {bdays.length ? (
        <>
          <SectionHead title="Birthdays" />
          {bdays.map((b) => <Row key={b.id} color={t.accent} title={"🎂 " + b.name} sub={b.age != null ? "Turns " + b.age : undefined} />)}
        </>
      ) : null}
    </Sheet>
  );
}

function Row({ color, title, sub, onRemove }: { color: string; title: string; sub?: string; onRemove?: () => void }) {
  const t = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color }} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{title}</Text>
          {sub ? <Dim>{sub}</Dim> : null}
        </View>
        {onRemove ? (
          <Pressable accessibilityRole="button" accessibilityLabel={"Remove " + title} onPress={onRemove} hitSlop={8}>
            <Text style={{ color: t.danger, fontWeight: "700", fontSize: 14 }}>Remove</Text>
          </Pressable>
        ) : null}
      </View>
      <Divider />
    </>
  );
}
