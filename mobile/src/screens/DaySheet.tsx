import React, { useEffect, useState } from "react";
import { Keyboard, Modal, Platform, Pressable, Text, View } from "react-native";
import { DateField } from "../components/DateField";
import { TimeField } from "../components/TimeField";
import { Button, Chip, Dim, Divider, Field, H2, SectionHead, Segmented, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import {
  EVENT_CATS, EVENT_CAT_ORDER, EXCESS_ID, EXCESS_TYPE, LEAVE_KINDS, MONTHS, OVERTIME_ID, OVERTIME_TYPE, WEEKDAYS_FULL,
  birthdaysOnDate, employmentOf, entryColor, entryExcessHours, entryName, entryOTHours, fmtHours, isCombo, isSplitEntry, mkId, parseYmd,
  type Rec, type ShiftEntry, type ShiftType, type Snapshot, sortedTypes } from "../lib/model";
import { payAllowances, type PayAllowance, type PayTag } from "../lib/pay";
import { applySplit, autoSplitOn, rebalanceExtras } from "../lib/partTime";
import Ionicons from "@expo/vector-icons/Ionicons";
import { OptionPicker } from "../components/OptionPicker";
import { holidayName, placeOf } from "../lib/holidays";
import { usePremium } from "../lib/premium";
import { askReminderPermission } from "../lib/reminders";
import { EVENT_ALARM_OPTIONS, requestAlarmPermission, useAlarmsAvailable } from "../lib/shiftAlarms";
import { useStore } from "../lib/store";
import { useTypesById } from "./CalendarScreen";

const short = (k: string) => { const d = parseYmd(k); return d.getDate() + " " + MONTHS[d.getMonth()].slice(0, 3); };


export function DaySheet({ dateKey, onClose }: { dateKey: string | null; onClose: () => void }) {
  const t = useTheme();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const typesById = useTypesById();
  const fullTime = employmentOf(data.settings) === "full";
  // Part time with an excess limit: additional shifts split into excess and overtime by themselves.
  const autoSplit = autoSplitOn(data.settings);
  // event form
  const [editing, setEditing] = useState<{ id: string; date: string } | null>(null);
  const [text, setText] = useState("");
  const [cat, setCat] = useState("other");
  const [allDay, setAllDay] = useState(false);
  const [time, setTime] = useState("");
  const [remindOn, setRemind] = useState(false);
  const [alerts, setAlerts] = useState<[number, number]>([-1, -1]);
  const alarmsOk = useAlarmsAvailable();
  const { locked, openPaywall } = usePremium();
  // Premium on iOS 26+: real alarms replace "Remind me", so an event never gets both.
  // alerts: alarms on iPhones that can set them; on the website they're saved and your phone delivers them
  const useAlarms = (alarmsOk || Platform.OS === "web") && !locked;
  const [moveTo, setMoveTo] = useState("");
  // sub-dialogs
  const [chooser, setChooser] = useState<ShiftType | null>(null);
  const [split, setSplit] = useState<{ baseTypeId?: string; ot: string; ex: string; label: string; onSave: (ot: number, ex: number) => void } | null>(null);
  const [swap, setSwap] = useState<{ shift: ShiftEntry } | null>(null);
  const [leavePick, setLeavePick] = useState<"annual" | "sick" | null>(null);

  const resetForm = () => { setEditing(null); setText(""); setCat("other"); setAllDay(false); setTime(""); setRemind(false); setAlerts([-1, -1]); };
  useEffect(() => { resetForm(); }, [dateKey]);
  if (!dateKey) return <Sheet visible={false} onClose={onClose} title=""><View /></Sheet>;
  const key = dateKey;

  const date = parseYmd(key);
  const title = WEEKDAYS_FULL[date.getDay()] + " " + date.getDate() + " " + MONTHS[date.getMonth()];
  const shifts = data.shifts[key] || [];
  const leave = data.leave[key] || [];
  const swaps = data.swaps[key] || [];
  const allowances = payAllowances(data.settings).filter((a) => a.name);
  const dayTags = (data.payTags[key] || []) as PayTag[];
  const holiday = holidayName(placeOf(data.settings), key);
  const events = (data.notes[key] || []).slice().sort((a, b) => (a.allDay ? "" : a.time || "99:99").localeCompare(b.allDay ? "" : b.time || "99:99"));
  const bdays = birthdaysOnDate(data.birthdays, date);

  /* ----- shifts ----- */
  const addShift = (typeId: string, hours?: number | null, baseTypeId?: string | null, tag?: string | null) => {
    update((d) => {
      const e: any = { id: mkId(), typeId };
      if (hours != null) e.hours = hours;
      if (baseTypeId) e.baseTypeId = baseTypeId;
      if (tag) e.tag = tag;
      (d.shifts[key] = d.shifts[key] || []).push(e);
    });
    toast("Shift added");
  };
  // An additional shift: excess hours until the pay period's limit, then overtime.
  const addExtra = (h: number, baseTypeId: string) => {
    let msg = "Shift added";
    update((d) => {
      const e: any = { id: mkId(), typeId: EXCESS_ID, hours: h, addl: h, baseTypeId };
      (d.shifts[key] = d.shifts[key] || []).push(e);
      rebalanceExtras(d, [key]);
      const ot = entryOTHours(e), ex = entryExcessHours(e);
      if (ot > 0) msg = ex > 0 ? fmtHours(ex) + "h excess + " + fmtHours(ot) + "h overtime" : "Excess limit reached · " + fmtHours(ot) + "h overtime";
    });
    toast(msg);
  };
  const setExtraHours = (id: string, h: number) => update((d) => {
    const e: any = (d.shifts[key] || []).find((x) => x.id === id);
    if (!e) return;
    e.addl = h; e.updatedAt = Date.now();
    rebalanceExtras(d, [key]);
  });
  const pickType = (ty: ShiftType) => {
    if (ty.overtimeEligible !== false || (!fullTime && ty.excessEligible !== false) || (ty.kind !== "personal" && allowances.length)) setChooser(ty);
    else addShift(ty.id, null, null, ty.kind === "personal" ? ty.notes : null);
  };
  const askHours = (titleText: string, msg: string, then: (h: number) => void) => dialog({
    title: titleText, message: msg, input: { placeholder: "e.g. 4", keyboard: "decimal-pad" }, confirm: "Add",
    onConfirm: (v) => {
      const h = parseFloat(v.replace(",", "."));
      if (!h || h <= 0) { toast("Enter a number of hours"); return; }
      then(h);
    },
  });
  const removeShift = (id: string) => {
    update((d, tomb) => {
      d.shifts[key] = (d.shifts[key] || []).filter((s) => s.id !== id);
      if (!d.shifts[key].length) delete d.shifts[key];
      tomb(id);
      rebalanceExtras(d, [key]);
      // allowances are added with a shift, so they go once the day has no work shift left
      if (!(d.shifts[key] || []).some((s) => typesById[s.typeId] && typesById[s.typeId].kind !== "personal") && d.payTags[key]) {
        const list = d.payTags[key] as PayTag[];
        list.filter((x) => x.kind === "allowance").forEach((x) => tomb(x.id));
        d.payTags[key] = list.filter((x) => x.kind !== "allowance");
        if (!d.payTags[key].length) delete d.payTags[key];
      }
      // a removed picked-up shift takes its swap records with it
      const onRec = (d.swaps[key] || []).find((r) => r.kind === "on" && r.shiftEntryId === id);
      if (onRec) {
        d.swaps[key] = d.swaps[key].filter((r) => r.id !== onRec.id); tomb(onRec.id);
        const od = onRec.linkedDate;
        if (od && d.swaps[od]) { d.swaps[od] = d.swaps[od].filter((r) => r.id !== onRec.linkedSwapId); tomb(onRec.linkedSwapId); }
      }
    });
    toast("Shift removed");
  };

  /* ----- leave ----- */
  // Leave is taken on a shift (e.g. Dayshift), so the calendar shows that shift with an Annual/Sick leave title.
  const leaveTypes = sortedTypes(data.types).filter((x) => x.kind !== "personal");
  const addLeave = (kind: "annual" | "sick", ty: ShiftType | null) => dialog({
    title: LEAVE_KINDS[kind].label + (ty ? " – " + ty.name : ""), message: "How many hours?",
    input: { placeholder: "e.g. 10", keyboard: "decimal-pad", value: ty && ty.hours ? String(ty.hours) : "" }, confirm: "Add",
    onConfirm: (v) => {
      const h = parseFloat(v.replace(",", "."));
      if (!h || h <= 0) { toast("Enter a number of hours"); return; }
      update((d, tomb) => {
        const e: any = { id: mkId(), kind, hours: h };
        if (ty) {
          e.baseTypeId = ty.id;
          // the rostered shift is taken as leave: it comes off the day, and comes back if the leave is removed
          const list = d.shifts[key] || [];
          const i = list.findIndex((x) => x.typeId === ty.id);
          if (i >= 0) {
            const sh: any = list[i];
            e.replaced = { id: sh.id, typeId: sh.typeId, ...(sh.hours != null ? { hours: sh.hours } : {}) };
            list.splice(i, 1); tomb(sh.id);
            if (!list.length) delete d.shifts[key];
          }
        }
        (d.leave[key] = d.leave[key] || []).push(e);
      });
      toast(LEAVE_KINDS[kind].label + " added");
    },
  });

  const removeLeave = (id: string) => update((d, tomb) => {
    const l: any = (d.leave[key] || []).find((x) => x.id === id);
    d.leave[key] = (d.leave[key] || []).filter((x) => x.id !== id);
    if (!d.leave[key].length) delete d.leave[key];
    tomb(id);
    const r = l && l.replaced;
    if (r && r.id && !(d.shifts[key] || []).some((x) => x.id === r.id)) {
      (d.shifts[key] = d.shifts[key] || []).push({ ...r, updatedAt: Date.now() + 1 });
      delete d.tombstones[r.id];
    }
  });

  /* ----- allowances ----- */
  // Allowances chosen while adding a shift are added to the day's count.
  const addAllowances = (counts: { [allowanceId: string]: number }) => {
    const ids = Object.keys(counts).filter((id) => counts[id] > 0);
    if (!ids.length) return;
    update((d) => {
      const list = ((d.payTags[key] || []) as PayTag[]);
      ids.forEach((allowanceId) => { for (let i = 0; i < counts[allowanceId]; i++) list.push({ id: mkId(), kind: "allowance", allowanceId, updatedAt: Date.now() }); });
      d.payTags[key] = list;
    });
  };

  // Change a day's count for one allowance after the shift is in. Fewer: drop ones not yet ticked off first.
  const setAllowanceCount = (allowanceId: string, n: number) => update((d, tomb) => {
    let list = ((d.payTags[key] || []) as PayTag[]).slice();
    const mine = list.filter((x) => x.kind === "allowance" && x.allowanceId === allowanceId);
    if (n > mine.length) {
      for (let i = mine.length; i < n; i++) list.push({ id: mkId(), kind: "allowance", allowanceId, updatedAt: Date.now() });
    } else if (n < mine.length) {
      const drop = mine.slice().sort((x, y) => Number(!!x.paid) - Number(!!y.paid)).slice(0, mine.length - n).map((x) => x.id);
      drop.forEach((id) => tomb(id));
      list = list.filter((x) => !drop.includes(x.id));
    }
    if (list.length) d.payTags[key] = list; else delete d.payTags[key];
  });

  /* ----- swaps ----- */
  function undoSwap(clickedId: string) {
    let msg = "";
    update((d, tomb) => {
      const rec = (d.swaps[key] || []).find((r) => r.id === clickedId);
      if (!rec) return;
      let offDate: string, offRec: Rec | undefined, onDate: string, onRec: Rec | undefined;
      if (rec.kind === "off") { offDate = key; offRec = rec; onDate = rec.linkedDate; onRec = (d.swaps[onDate] || []).find((r) => r.id === rec.linkedSwapId); }
      else { onDate = key; onRec = rec; offDate = rec.linkedDate; offRec = (d.swaps[offDate] || []).find((r) => r.id === rec.linkedSwapId); }
      const drop = (dk: string, id: string) => { d.swaps[dk] = (d.swaps[dk] || []).filter((r) => r.id !== id); if (!d.swaps[dk].length) delete d.swaps[dk]; tomb(id); };
      if (onRec && onRec.shiftEntryId && !(d.shifts[onDate] || []).some((s) => s.id === onRec!.shiftEntryId)) {
        const again = (d.swaps[onDate] || []).some((r) => r.kind === "off" && r.shiftEntryId === onRec!.shiftEntryId);
        if (again) { msg = "That shift was swapped again — undo the later swap first"; return; }
        if (offRec) drop(offDate, offRec.id);
        drop(onDate, onRec.id);
        msg = "Swap removed"; return;
      }
      if (onRec && d.shifts[onDate]) {
        d.shifts[onDate] = d.shifts[onDate].filter((s) => s.id !== onRec!.shiftEntryId);
        if (!d.shifts[onDate].length) delete d.shifts[onDate];
        tomb(onRec.shiftEntryId);
      }
      const src = offRec || rec;
      const restoreId = (offRec && offRec.shiftEntryId) || mkId();
      const restored: any = { id: restoreId, typeId: src.typeId, updatedAt: Date.now() + 1 };
      if (src.hours != null) restored.hours = src.hours;
      if (src.baseTypeId) restored.baseTypeId = src.baseTypeId;
      if (src.addl) restored.addl = src.addl;
      (d.shifts[offDate] = d.shifts[offDate] || []).push(restored);
      if (offRec) drop(offDate, offRec.id);
      if (onRec) drop(onDate, onRec.id);
      delete d.tombstones[restoreId];
      rebalanceExtras(d, [offDate, onDate]);
      msg = "Swap undone";
    });
    if (msg) toast(msg);
  }
  function showSwap(rec: Rec) {
    const name = entryName(rec, typesById) || "Shift";
    const other = short(rec.linkedDate);
    let msg = name + (rec.kind === "off" ? " swapped away to " : " picked up from ") + other + ".";
    if (rec.partner) msg += " With " + rec.partner + ".";
    if (rec.note) msg += " Note: " + rec.note;
    dialog({ title: "Swap details", message: msg, confirm: "Undo swap", cancel: "Close", onConfirm: () => undoSwap(rec.id) });
  }

  /* ----- events ----- */
  function startEdit(n: any) {
    setEditing({ id: n.id, date: key }); setText(n.text || ""); setAllDay(!!n.allDay); setTime(n.time || "");
    setRemind(!!n.remind); setCat(EVENT_CATS[n.category] ? n.category : "other"); setMoveTo(key);
    const a = (n.alarms || []).filter((m: number) => m >= 0);
    // an older "Remind me" becomes an alert at the time of the event
    if (!a.length && n.remind && useAlarms) a.push(0);
    setAlerts([a.length ? a[0] : -1, a.length > 1 ? a[1] : -1]);
  }
  async function chooseAlert(which: 0 | 1, v: number) {
    if (v >= 0 && locked) { onClose(); setTimeout(() => openPaywall("Alarms are part of Premium."), 500); return; }
    if (v >= 0 && Platform.OS !== "web" && !(await requestAlarmPermission())) { toast("Allow alarms for Roster Board in Settings to use alarms"); return; }
    setAlerts((cur) => (which === 0 ? (v < 0 ? [-1, -1] : [v, cur[1]]) : [cur[0], v]));
  }
  const alarmList = () => (allDay || !time || !useAlarms ? [] : alerts.filter((m, i, a) => m >= 0 && a.indexOf(m) === i));
  async function saveEvent() {
    const v = text.trim();
    const remind = remindOn && !useAlarms;
    if (remind && !allDay && !time) { toast("Pick a time for the reminder"); return; }
    if (!v) { if (editing) toast("Give the event a name"); return; }
    if (remind) {
      const ok = await askReminderPermission();
      if (!ok) toast("Notifications are off for Roster Board in your phone's Settings");
    }
    if (editing) {
      const from = editing.date, to = moveTo || from, id = editing.id;
      update((d) => {
        const list = d.notes[from] || [];
        const i = list.findIndex((x) => x.id === id);
        if (i === -1) return;
        const n: any = list[i];
        const prevTime = n.time, prevRemind = n.remind, prevNotified = !!n.notified;
        n.text = v; n.category = cat || n.category || "other";
        delete n.time; delete n.allDay; delete n.remind; delete n.notified; delete n.alarms;
        if (allDay) n.allDay = true; else if (time) n.time = time;
        if (remind && time && !allDay) { n.remind = true; n.notified = prevRemind && prevTime === time && from === to ? prevNotified : false; }
        const al = alarmList(); if (al.length) n.alarms = al;
        n.updatedAt = Date.now();
        if (to !== from) {
          list.splice(i, 1);
          if (!list.length) delete d.notes[from];
          (d.notes[to] = d.notes[to] || []).push(n);
        }
      });
      toast(to !== from ? "Event moved" : "Event updated");
    } else {
      update((d) => {
        const e: any = { id: mkId(), text: v, category: cat || "other" };
        if (allDay) e.allDay = true; else if (time) e.time = time;
        if (remind && time && !allDay) { e.remind = true; e.notified = false; }
        const al = alarmList(); if (al.length) e.alarms = al;
        (d.notes[key] = d.notes[key] || []).push(e);
      });
      toast("Event added");
    }
    resetForm();
  }
  const removeFrom = (bucket: "leave" | "notes", id: string) => update((d, tomb) => {
    (d as any)[bucket][key] = ((d as any)[bucket][key] || []).filter((x: any) => x.id !== id);
    if (!(d as any)[bucket][key].length) delete (d as any)[bucket][key];
    tomb(id);
  });

  return (
    <Sheet visible onClose={onClose} title={title}>
      {holiday ? <Dim style={{ marginTop: -4, marginBottom: 4 }}>{holiday} · Public holiday</Dim> : null}
      <SectionHead title="Shifts" />
      {shifts.length ? shifts.map((s) => {
        const ty = typesById[s.typeId];
        if (!ty) return null;
        const combo = isCombo(s.typeId);
        const col = entryColor(s, typesById);
        const detail = isSplitEntry(s)
          ? fmtHours(entryExcessHours(s)) + "h excess + " + fmtHours(entryOTHours(s)) + "h overtime"
          : combo && s.hours != null ? fmtHours(s.hours) + "h" : ty.kind === "personal" ? (s.tag ? "“" + s.tag + "”" : "") : fmtHours(ty.hours || 0) + "h";
        return (
          <Item key={s.id} color={col.bg} title={entryName(s, typesById)} sub={detail}
            actions={[
              combo && (s as any).addl > 0 ? { label: "Hours", onPress: () => dialog({
                title: (s.baseTypeId && typesById[s.baseTypeId] ? typesById[s.baseTypeId].name : "Additional Shift"), message: "Total hours worked",
                input: { keyboard: "decimal-pad", value: String((s as any).addl) }, confirm: "Save",
                onConfirm: (v) => { const h = parseFloat(v.replace(",", ".")); if (!h || h <= 0) { toast("Enter a number of hours"); return; } setExtraHours(s.id, h); toast("Hours updated"); },
              }) } : combo && fullTime && !entryExcessHours(s) ? { label: "Hours", onPress: () => askHours("Overtime – " + (s.baseTypeId && typesById[s.baseTypeId] ? typesById[s.baseTypeId].name : "shift"), "How many hours of overtime?", (h) => {
                update((d) => { const e: any = (d.shifts[key] || []).find((x) => x.id === s.id); if (e) { e.hours = h; e.updatedAt = Date.now(); } }); toast("Hours updated");
              }) } : combo ? { label: "Hours", onPress: () => setSplit({
                baseTypeId: s.baseTypeId, ot: String(entryOTHours(s) || ""), ex: String(entryExcessHours(s) || ""), label: "Save",
                onSave: (ot, ex) => { update((d) => { const e = (d.shifts[key] || []).find((x) => x.id === s.id); if (e) applySplit(e, ot, ex); }); toast("Hours updated"); },
              }) } : { label: "Swap", onPress: () => setSwap({ shift: s }) },
              { label: "Remove", danger: true, onPress: () => removeShift(s.id) },
            ]} />
        );
      }) : null}

      {allowances.length && shifts.some((s) => typesById[s.typeId] && typesById[s.typeId].kind !== "personal") ? (
        <>
          <SectionHead title="Allowances" />
          {allowances.map((a, i) => (
            <View key={a.id}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
                <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{a.name}</Text>
                <Stepper value={dayTags.filter((x) => x.kind === "allowance" && x.allowanceId === a.id).length} label={a.name}
                  onChange={(v) => setAllowanceCount(a.id, Math.max(0, v))} />
              </View>
            </View>
          ))}
        </>
      ) : null}

      {swaps.length ? (
        <>
          <SectionHead title="Swaps" />
          {swaps.map((r) => (
            <Item key={r.id} color={entryColor(r, typesById).bg} title={(r.kind === "off" ? "Off · " : "On · ") + (entryName(r, typesById) || "Shift")}
              sub={(r.kind === "off" ? "Moved to " : "Picked up from ") + short(r.linkedDate) + (r.partner ? " · " + r.partner : "")}
              onPress={() => showSwap(r)} />
          ))}
        </>
      ) : null}

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
        {sortedTypes(data.types).map((ty) => <Chip key={ty.id} label={"+ " + ty.name} color={ty.color} ink={ty.ink} onPress={() => pickType(ty)} />)}
      </View>

      <SectionHead title="Leave" />
      {leave.length ? leave.map((l) => {
        const k = LEAVE_KINDS[l.kind] || LEAVE_KINDS.annual;
        const lb = l.baseTypeId ? typesById[l.baseTypeId] : null;
        return <Item key={l.id} color={lb ? lb.color : k.color} title={k.label + (lb ? " – " + lb.name : "")} sub={l.hours != null ? fmtHours(l.hours) + "h" : undefined} actions={[{ label: "Remove", danger: true, onPress: () => removeLeave(l.id) }]} />;
      }) : null}
      <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
        {(["annual", "sick"] as const).map((k) => (
          <Chip key={k} label={"+ " + LEAVE_KINDS[k].label} color={LEAVE_KINDS[k].color} ink={LEAVE_KINDS[k].ink}
            onPress={() => (leaveTypes.length ? setLeavePick(k) : addLeave(k, null))} />
        ))}
      </View>

      {bdays.length ? (
        <>
          <SectionHead title="Birthdays" />
          {bdays.map((b) => <Item key={b.id} color={t.accent} title={"🎂 " + b.name + (b.age != null ? " turns " + b.age : "")} />)}
        </>
      ) : null}

      <SectionHead title="Personal Events" />
      {events.length ? events.map((n) => {
        const c = EVENT_CATS[n.category || "other"] || EVENT_CATS.other;
        return (
          <Item key={n.id} color={c.color} title={n.text} highlight={!!editing && editing.id === n.id}
            sub={n.allDay ? "All day" : n.time ? n.time + (n.remind || (n.alarms || []).length ? " 🔔" : "") : undefined} onPress={() => startEdit(n)}
            actions={[{ label: "Remove", danger: true, onPress: () => { if (editing && editing.id === n.id) resetForm(); removeFrom("notes", n.id); } }]} />
        );
      }) : null}

      {editing ? (
        <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: t.accentSoft, borderRadius: 10, padding: 10, marginTop: 10 }}>
          <Text style={{ flex: 1, color: t.text, fontWeight: "600" }} numberOfLines={1}>Editing {(EVENT_CATS[cat] || EVENT_CATS.other).label.toLowerCase()}: {text}</Text>
          <Pressable accessibilityRole="button" onPress={resetForm} hitSlop={8}><Text style={{ color: t.accent, fontWeight: "700" }}>Cancel</Text></Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10, marginBottom: 10 }}>
        {EVENT_CAT_ORDER.map((k) => (
          <Chip key={k} small label={EVENT_CATS[k].label} color={cat === k ? EVENT_CATS[k].color : t.surface2} ink={cat === k ? EVENT_CATS[k].ink : t.textDim} onPress={() => setCat(k)} />
        ))}
      </View>
      {editing ? <DateField label="Date" value={moveTo || key} onChange={setMoveTo} /> : null}
      <Field value={text} onChangeText={setText} placeholder="e.g. Dentist, Birthday dinner…" returnKeyType="done" />
      <View style={{ marginBottom: 10 }}>
        <Segmented value={allDay ? "all" : time ? "time" : "none"}
          options={[{ value: "none", label: "No Time" }, { value: "time", label: "Set Time" }, { value: "all", label: "All Day" }]}
          onChange={(v) => { Keyboard.dismiss(); setAllDay(v === "all"); setTime(v === "time" ? time || "09:00" : ""); }} />
      </View>
      {!allDay ? (
        <>
          {time ? <TimeField label="Time" value={time} onChange={setTime} /> : null}
          {!useAlarms ? <ToggleRow label="Remind me" value={remindOn} onChange={setRemind} /> : null}
          {useAlarms && time ? (<>
            <OptionPicker label="Alert" value={alerts[0]} options={EVENT_ALARM_OPTIONS} onChange={(v) => chooseAlert(0, v)} />
            {alerts[0] >= 0 ? <OptionPicker label="Second alert" value={alerts[1]} options={EVENT_ALARM_OPTIONS} onChange={(v) => chooseAlert(1, v)} /> : null}
          </>) : null}
        </>
      ) : null}
      <Button title={editing ? "Save" : "Add"} onPress={saveEvent} />

      <KindChooser type={chooser} fullTime={fullTime} autoSplit={autoSplit} allowances={allowances} onClose={() => setChooser(null)} onPick={(kind, counts) => {
        const ty = chooser!;
        setChooser(null);
        addAllowances(counts);
        if (kind === "normal") addShift(ty.id);
        else if (kind === "ot") askHours("Overtime – " + ty.name, "How many hours of overtime?", (h) => addShift(OVERTIME_ID, h, ty.id));
        else if (kind === "ex" && autoSplit) dialog({
          title: "Additional shift – " + ty.name, message: "Total hours worked", input: { keyboard: "decimal-pad", value: ty.hours ? String(ty.hours) : "" }, confirm: "Add",
          onConfirm: (v) => { const h = parseFloat(v.replace(",", ".")); if (!h || h <= 0) { toast("Enter a number of hours"); return; } addExtra(h, ty.id); },
        });
        else if (kind === "ex") askHours("Excess Hours – " + ty.name, "How many excess hours?", (h) => addShift(EXCESS_ID, h, ty.id));
        else setSplit({
          baseTypeId: ty.id, ot: "", ex: "", label: "Add shift",
          onSave: (ot, ex) => { update((d) => { const e: any = { id: mkId(), baseTypeId: ty.id }; applySplit(e, ot, ex); (d.shifts[key] = d.shifts[key] || []).push(e); }); toast("Shift added"); },
        });
      }} />
      <Popup visible={!!leavePick} onClose={() => setLeavePick(null)}>
        <H2 style={{ marginBottom: 12 }}>{leavePick ? LEAVE_KINDS[leavePick].label : ""}</H2>
        <View style={{ gap: 8 }}>
          {leaveTypes.map((ty) => (
            <Pressable key={ty.id} accessibilityRole="button" onPress={() => { const k = leavePick!; setLeavePick(null); setTimeout(() => addLeave(k, ty), 250); }}
              style={({ pressed }) => ({ backgroundColor: ty.color, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", opacity: pressed ? 0.85 : 1 })}>
              <Text style={{ color: ty.ink, fontWeight: "700", fontSize: 15 }}>{ty.name}</Text>
              <Text style={{ color: ty.ink, fontWeight: "700", fontSize: 12, opacity: 0.9 }}>{leavePick ? LEAVE_KINDS[leavePick].label : ""}</Text>
            </Pressable>
          ))}
        </View>
      </Popup>
      <SplitEditor state={split} typesById={typesById} onClose={() => setSplit(null)} />
      <SwapForm pending={swap} dateKey={key} data={data} typesById={typesById} onClose={() => setSwap(null)} />
    </Sheet>
  );
}

/* ---------- pieces ---------- */
type Action = { label: string; onPress: () => void; danger?: boolean };
function Item({ color, title, sub, actions, onPress, highlight }: { color: string; title: string; sub?: string; actions?: Action[]; onPress?: () => void; highlight?: boolean }) {
  const t = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, backgroundColor: highlight ? t.accentSoft : "transparent", borderRadius: 8 }}>
        <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: color, marginLeft: highlight ? 6 : 0 }} />
        <Pressable disabled={!onPress} onPress={onPress} style={{ flex: 1 }} accessibilityRole={onPress ? "button" : undefined}>
          <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{title}</Text>
          {sub ? <Dim>{sub}</Dim> : null}
        </Pressable>
        {(actions || []).map((a) => (
          <Pressable key={a.label} accessibilityRole="button" accessibilityLabel={a.label + " " + title} onPress={a.onPress} hitSlop={6}>
            <Text style={{ color: a.danger ? t.danger : t.accent, fontWeight: "700", fontSize: 14 }}>{a.label}</Text>
          </Pressable>
        ))}
      </View>
      <Divider />
    </>
  );
}

function Popup({ visible, onClose, children }: { visible: boolean; onClose: () => void; children: React.ReactNode }) {
  const t = useTheme();
  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable onPress={onClose} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "center", padding: 24 }}>
        <Pressable onPress={() => {}} style={{ backgroundColor: t.surface, borderRadius: 18, padding: 18 }}>{children}</Pressable>
      </Pressable>
    </Modal>
  );
}

function KindChooser({ type, fullTime, autoSplit, allowances, onClose, onPick }: {
  type: ShiftType | null; fullTime: boolean; autoSplit: boolean; allowances: PayAllowance[];
  onClose: () => void; onPick: (k: "normal" | "ot" | "ex" | "split", counts: { [allowanceId: string]: number }) => void;
}) {
  const t = useTheme();
  const [counts, setCounts] = useState<{ [id: string]: number }>({});
  useEffect(() => { setCounts({}); }, [type]);
  const opts: { k: "normal" | "ot" | "ex" | "split"; tag: string; bg: string; ink: string }[] = [];
  if (type) {
    opts.push({ k: "normal", tag: "", bg: type.color, ink: type.ink });
    if (!fullTime && (type.excessEligible !== false || (autoSplit && type.overtimeEligible !== false))) opts.push({ k: "ex", tag: autoSplit ? "Additional Shift" : "Excess Hours", bg: EXCESS_TYPE.color, ink: EXCESS_TYPE.ink });
    // with an excess limit, additional shifts are split into excess and overtime automatically
    if (type.overtimeEligible !== false && !autoSplit) opts.push({ k: "ot", tag: "Overtime", bg: OVERTIME_TYPE.color, ink: OVERTIME_TYPE.ink });
    if (!fullTime && !autoSplit && type.overtimeEligible !== false && type.excessEligible !== false) opts.push({ k: "split", tag: "Excess + Overtime", bg: OVERTIME_TYPE.color, ink: OVERTIME_TYPE.ink });
  }
  const showAllowances = !!type && type.kind !== "personal" && allowances.length > 0;
  return (
    <Popup visible={!!type} onClose={onClose}>
      <H2 style={{ marginBottom: 12 }}>{type ? type.name : ""}</H2>
      {showAllowances ? (
        <View style={{ marginBottom: 14 }}>
          {allowances.map((a, i) => (
            <View key={a.id}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8, gap: 10 }}>
                <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }} numberOfLines={1}>{a.name}</Text>
                <Stepper value={counts[a.id] || 0} label={a.name} onChange={(v) => setCounts({ ...counts, [a.id]: Math.max(0, v) })} />
              </View>
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ gap: 8 }}>
        {opts.map((o) => (
          <Pressable key={o.k} accessibilityRole="button" onPress={() => onPick(o.k, counts)}
            style={({ pressed }) => ({ backgroundColor: o.bg, borderRadius: 12, paddingVertical: 13, paddingHorizontal: 14, flexDirection: "row", justifyContent: "space-between", opacity: pressed ? 0.85 : 1 })}>
            <Text style={{ color: o.ink, fontWeight: "700", fontSize: 15 }}>{type ? type.name : ""}</Text>
            {o.tag ? <Text style={{ color: o.ink, fontWeight: "700", fontSize: 12, opacity: 0.9 }}>{o.tag}</Text> : null}
          </Pressable>
        ))}
      </View>
    </Popup>
  );
}

function SplitEditor({ state, typesById, onClose }: {
  state: { baseTypeId?: string; ot: string; ex: string; label: string; onSave: (ot: number, ex: number) => void } | null;
  typesById: { [id: string]: ShiftType }; onClose: () => void;
}) {
  const t = useTheme();
  const { toast } = useUi();
  const [ot, setOt] = useState(""); const [ex, setEx] = useState("");
  useEffect(() => { if (state) { setOt(state.ot); setEx(state.ex); } }, [state]);
  const bt = state && state.baseTypeId ? typesById[state.baseTypeId] : null;
  const len = bt && bt.hours ? bt.hours : 0;
  const num = (v: string) => Math.max(0, parseFloat(v.replace(",", ".")) || 0);
  const total = num(ot) + num(ex);
  const matches = len > 0 && Math.abs(total - len) < 0.01;
  // fill the other box with the rest of the shift, like the web
  const fill = (field: "ot" | "ex") => {
    if (!len) return;
    if (field === "ot" && num(ot) > 0 && num(ot) < len && !ex) setEx(String(+(len - num(ot)).toFixed(2)));
    if (field === "ex" && num(ex) > 0 && num(ex) < len && !ot) setOt(String(+(len - num(ex)).toFixed(2)));
  };
  return (
    <Popup visible={!!state} onClose={onClose}>
      <H2 style={{ marginBottom: 12 }}>{bt ? bt.name : "Shift hours"}</H2>
      <Field label="Excess hours" value={ex} onChangeText={setEx} onBlur={() => fill("ex")} keyboardType="decimal-pad" placeholder="0" />
      <Field label="Overtime hours" value={ot} onChangeText={setOt} onBlur={() => fill("ot")} keyboardType="decimal-pad" placeholder="0" />
      <Text style={{ color: matches ? t.good : t.textDim, fontWeight: "700", marginBottom: 12 }}>
        {"Total " + fmtHours(total) + "h" + (len ? (matches ? " · matches shift ✓" : " · shift is " + fmtHours(len) + "h") : "")}
      </Text>
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button style={{ flex: 1 }} kind="ghost" title="Cancel" onPress={onClose} />
        <Button style={{ flex: 1 }} title={state ? state.label : "Save"} onPress={() => {
          if (total <= 0) { toast("Enter overtime and/or excess hours"); return; }
          const s = state!; onClose(); s.onSave(num(ot), num(ex));
        }} />
      </View>
    </Popup>
  );
}

function SwapForm({ pending, dateKey, data, typesById, onClose }: {
  pending: { shift: ShiftEntry } | null; dateKey: string; data: Snapshot; typesById: { [id: string]: ShiftType }; onClose: () => void;
}) {
  const t = useTheme();
  const { update } = useStore();
  const { toast } = useUi();
  const [to, setTo] = useState(dateKey);
  const [partner, setPartner] = useState("");
  const [note, setNote] = useState("");
  const [replace, setReplace] = useState<string | null>(null);
  const s = pending ? pending.shift : null;
  const effType = s ? (isCombo(s.typeId) ? s.baseTypeId : s.typeId) : null;
  useEffect(() => { if (pending) { setTo(dateKey); setPartner(""); setNote(""); setReplace(effType || null); } }, [pending, dateKey, effType]);

  function confirm() {
    if (!s) return;
    if (!to || to === dateKey) { toast(to ? "Pick a different date" : "Pick the date you're swapping to"); return; }
    const p = partner.trim(), n = note.trim();
    let ok = false;
    update((d, tomb) => {
      const list = d.shifts[dateKey] || [];
      const idx = list.findIndex((x) => x.id === s.id);
      if (idx === -1) return;
      list.splice(idx, 1);
      if (!list.length) delete d.shifts[dateKey];
      tomb(s.id);
      const ne: any = replace && replace !== effType ? { id: mkId(), typeId: replace } : { id: mkId(), typeId: s.typeId };
      if (!(replace && replace !== effType)) {
        if (s.hours != null) ne.hours = s.hours; if (s.baseTypeId) ne.baseTypeId = s.baseTypeId;
        if (s.excessHours) ne.excessHours = s.excessHours; if (s.addl) ne.addl = s.addl;
      }
      (d.shifts[to] = d.shifts[to] || []).push(ne);
      const offId = mkId(), onId = mkId();
      (d.swaps[dateKey] = d.swaps[dateKey] || []).push({ id: offId, kind: "off", partner: p, note: n, linkedDate: to, linkedSwapId: onId, typeId: s.typeId, baseTypeId: s.baseTypeId || null, hours: s.hours != null ? s.hours : null, addl: s.addl || null, shiftEntryId: s.id });
      (d.swaps[to] = d.swaps[to] || []).push({ id: onId, kind: "on", partner: p, note: n, linkedDate: dateKey, linkedSwapId: offId, typeId: ne.typeId, baseTypeId: ne.baseTypeId || null, hours: ne.hours != null ? ne.hours : null, shiftEntryId: ne.id });
      rebalanceExtras(d, [dateKey, to]);
      ok = true;
    });
    if (!ok) { toast("Couldn't find that shift"); return; }
    toast("Shift swapped" + (p ? " with " + p : ""));
    onClose();
  }

  return (
    <Sheet visible={!!pending} onClose={onClose} title={"Swap " + (s ? entryName(s, typesById) : "shift")}
      footer={<View style={{ flexDirection: "row", gap: 10 }}><Button kind="ghost" title="Cancel" onPress={onClose} /><Button style={{ flex: 1 }} title="Swap Shift" onPress={confirm} /></View>}>
      <DateField label="Swap to" value={to} onChange={setTo} />
      <Field label="Swapping with (optional)" value={partner} onChangeText={setPartner} placeholder="e.g. Sam" />
      <Field label="Note (optional)" value={note} onChangeText={setNote} />
      <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 8, fontWeight: "600" }}>Shift on the new date</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {data.types.length ? sortedTypes(data.types).map((ty) => (
          <Chip key={ty.id} label={ty.name} color={replace === ty.id ? ty.color : t.surface2} ink={replace === ty.id ? ty.ink : t.text} onPress={() => setReplace(ty.id)} />
        )) : <Dim>(no shift types yet)</Dim>}
      </View>
    </Sheet>
  );
}

function Stepper({ value, onChange, label }: { value: number; onChange: (v: number) => void; label: string }) {
  const t = useTheme();
  const btn = (icon: "remove" | "add", disabled: boolean, next: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} disabled={disabled} onPress={() => onChange(next)} hitSlop={6}
      style={({ pressed }) => ({ width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center",
        backgroundColor: t.surface2, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 })}>
      <Ionicons name={icon} size={18} color={t.text} />
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {btn("remove", value <= 0, value - 1, "One less " + label)}
      <Text style={{ color: t.text, fontSize: 16, fontWeight: "700", minWidth: 16, textAlign: "center", fontVariant: ["tabular-nums"] }}>{value}</Text>
      {btn("add", false, value + 1, "One more " + label)}
    </View>
  );
}
