import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { DateField } from "../components/DateField";
import { Button, Card, Chip, Dim, H1, SectionHead, Segmented, Sheet, useTheme, useUi } from "../components/ui";
import { TYPE_ICONS, WEEKDAYS_SHORT, ymd } from "../lib/model";
import { applyRosterPattern, ensurePatternShape, patternHasContent } from "../lib/roster";
import { useStore } from "../lib/store";
import { useTypesById } from "./CalendarScreen";
import { usePremium } from "../lib/premium";

const DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
type Months = "3" | "6" | "12" | "24";

export function RosterScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { data, update } = useStore();
  const { dialog, toast } = useUi();
  const { locked, openPaywall } = usePremium();
  const typesById = useTypesById();
  const [rowW, setRowW] = useState(0);
  const [cell, setCell] = useState<{ w: number; d: number } | null>(null);
  const [start, setStart] = useState(ymd(new Date()));
  const [months, setMonths] = useState<Months>("12");

  const pattern = useMemo(() => {
    const copy = JSON.parse(JSON.stringify(data));
    ensurePatternShape(copy);
    return copy.roster.pattern as string[][][];
  }, [data]);
  const weeks = pattern.length;

  function setWeeks(n: number) {
    n = Math.max(1, Math.min(52, n));
    if (n === weeks) return;
    const apply = () => update((d) => { d.roster.weeks = n; ensurePatternShape(d); d.roster.updatedAt = Date.now(); });
    const losing = pattern.slice(n).some((w) => w.some((day) => day && day.length));
    if (!losing) { apply(); return; }
    dialog({
      title: "Shorten the rotation?",
      message: "Weeks " + (n + 1) + "–" + weeks + " have shifts in them. Shortening to " + n + (n === 1 ? " week" : " weeks") + " removes them.",
      confirm: "Shorten", danger: true, onConfirm: apply,
    });
  }

  function toggle(typeId: string) {
    if (!cell) return;
    update((d) => {
      ensurePatternShape(d);
      const day = d.roster.pattern[cell.w][cell.d];
      const i = day.indexOf(typeId);
      if (i === -1) day.push(typeId); else day.splice(i, 1);
      d.roster.updatedAt = Date.now();
    });
  }

  function fill() {
    if (locked) { openPaywall("Filling your calendar from a roster pattern is part of Premium."); return; }
    if (!patternHasContent(data)) { toast("Assign shifts to the pattern first"); return; }
    dialog({
      title: "Fill the calendar?",
      message: "This fills the calendar with your repeating pattern from " + start + " for " + months + " months, replacing the regular shifts already on those dates.\n\nDays you've changed by hand (overtime or excess, shift notes, swaps or leave) are left as they are, and personal entries are kept.",
      confirm: "Fill calendar",
      onConfirm: () => {
        let filled = 0;
        update((d, tomb) => { filled = applyRosterPattern(d, typesById, start, +months, tomb); }, { forceBackup: true });
        toast("Filled " + filled + " days from the pattern");
      },
    });
  }

  const current = cell ? pattern[cell.w][cell.d] : [];
  return (
    <View style={{ flex: 1, backgroundColor: t.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: insets.top + 10, paddingBottom: 40 }}>
        <H1 style={{ marginBottom: 14 }}>Roster pattern</H1>
        <Card>
          <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 12 }}>
            <Text style={{ flex: 1, color: t.text, fontSize: 15 }}>Rotation length</Text>
            <Stepper value={weeks} onChange={setWeeks} onTapValue={() => dialog({
              title: "Rotation length", message: "How many weeks before the pattern repeats? (1–52)",
              input: { value: String(weeks), keyboard: "decimal-pad" }, confirm: "Update",
              onConfirm: (v) => { const n = parseInt(v, 10); if (n) setWeeks(n); },
            })} />
          </View>
          <View onLayout={(e) => setRowW(e.nativeEvent.layout.width)} style={{ flexDirection: "row", marginBottom: 4 }}>
            <View style={{ width: 30 }} />
            {WEEKDAYS_SHORT.map((w) => <Text key={w} style={{ flex: 1, textAlign: "center", fontSize: 10, fontWeight: "700", color: t.textFaint }}>{w.toUpperCase()}</Text>)}
          </View>
          {pattern.map((week, wi) => (
            <View key={wi} style={{ flexDirection: "row", alignItems: "stretch", marginBottom: 3 }}>
              <Text style={{ width: 30, fontSize: 11, fontWeight: "700", color: t.textDim, alignSelf: "center" }}>W{wi + 1}</Text>
              {week.map((ids, di) => (
                <Pressable key={di} accessibilityRole="button" accessibilityLabel={"Week " + (wi + 1) + " " + DAY_NAMES[di]} onPress={() => setCell({ w: wi, d: di })}
                  style={({ pressed }) => ({ flex: 1, minHeight: 40, margin: 1.5, borderRadius: 7, padding: 2, gap: 2, backgroundColor: t.surface2, opacity: pressed ? 0.6 : 1, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border })}>
                  {ids.slice(0, 2).map((id) => {
                    const ty = typesById[id];
                    if (!ty) return null;
                    // the type's icon when it has one, otherwise its whole name sized to fit the cell
                    const icon = ty.icon && (TYPE_ICONS as readonly string[]).includes(ty.icon) ? ty.icon : null;
                    const room = rowW ? (rowW - 30) / 7 - 3 - 4 - 4 - 2 : 30;
                    const size = Math.max(6, Math.min(9, room / (Math.max(1, ty.name.length) * 0.62)));
                    return (
                      <View key={id} style={{ backgroundColor: ty.color, borderRadius: 4, paddingHorizontal: 2, paddingVertical: icon ? 2 : 0, alignItems: "center" }}>
                        {icon ? <Ionicons name={icon as any} size={13} color={ty.ink} accessibilityLabel={ty.name} />
                          : <Text numberOfLines={1} style={{ color: ty.ink, fontSize: size, fontWeight: "700" }}>{ty.name}</Text>}
                      </View>
                    );
                  })}
                  {ids.length > 2 ? <Text style={{ fontSize: 9, color: t.textDim }}>+{ids.length - 2}</Text> : null}
                </Pressable>
              ))}
            </View>
          ))}
        </Card>

        <SectionHead title="Stamp onto calendar" />
        <Card>
          <DateField label="Start date" value={start} onChange={setStart} />
          <Text style={{ fontSize: 13, color: t.textDim, marginBottom: 8, fontWeight: "600" }}>Repeat for</Text>
          <Segmented<Months> value={months} onChange={setMonths}
            options={[{ value: "3", label: "3 mo" }, { value: "6", label: "6 mo" }, { value: "12", label: "1 yr" }, { value: "24", label: "2 yrs" }]} />
          <Button style={{ marginTop: 14 }} title="Fill calendar from pattern" onPress={fill} />
        </Card>
      </ScrollView>

      <Sheet visible={!!cell} onClose={() => setCell(null)} title={cell ? "Week " + (cell.w + 1) + " · " + DAY_NAMES[cell.d] : ""}>
        {data.types.length ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {data.types.map((ty) => {
              const on = current.indexOf(ty.id) !== -1;
              return <Chip key={ty.id} label={(on ? "✓ " : "") + ty.name} color={on ? ty.color : t.surface2} ink={on ? ty.ink : t.text} onPress={() => toggle(ty.id)} />;
            })}
          </View>
        ) : <Dim>No shift types yet. Add one from the Types tab first.</Dim>}
      </Sheet>
    </View>
  );
}

function Stepper({ value, onChange, onTapValue }: { value: number; onChange: (n: number) => void; onTapValue: () => void }) {
  const t = useTheme();
  const btn = (label: string, n: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => onChange(n)} hitSlop={6}
      style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: t.surface2, alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: t.text, fontSize: 18, fontWeight: "700" }}>{label}</Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
      {btn("−", value - 1, "Fewer weeks")}
      <Pressable accessibilityRole="button" accessibilityLabel="Set rotation length" onPress={onTapValue}>
        <Text style={{ color: t.text, fontWeight: "700", fontSize: 15, minWidth: 58, textAlign: "center" }}>{value} {value === 1 ? "week" : "weeks"}</Text>
      </Pressable>
      {btn("+", value + 1, "More weeks")}
    </View>
  );
}
