// Help: short step-by-step guides for the things people actually want to do, each with a picture of what to tap.
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { Card, Divider, IconTile, SectionHead, Sheet, useTheme } from "../components/ui";

type Icon = React.ComponentProps<typeof Ionicons>["name"];

/* ---- pictures: small drawings of the screen, with the thing to tap outlined ---- */
type Line =
  | { t: "tabs"; active: string }
  | { t: "head"; text: string; link?: string }
  | { t: "row"; label: string; value?: string; hl?: boolean; chevron?: boolean }
  | { t: "field"; label: string; value: string; hl?: boolean }
  | { t: "stepper"; label: string; value: number; hl?: boolean }
  | { t: "chips"; items: { label: string; color: string }[]; hl?: number }
  | { t: "shift"; label: string; sub: string; color: string; action?: string }
  | { t: "check"; label: string; value: string; on: boolean; hl?: boolean }
  | { t: "btn"; label: string; hl?: boolean };
type Step = { text: string; pic?: Line[] };
type Guide = { id: string; title: string; icon: Icon; color: string; keywords: string; steps: Step[] };
type Group = { title: string; guides: Guide[] };

const BLUE = "#4C8DFF", TEAL = "#3FC5C0", GOLD = "#E8A33C", GREEN = "#2FA36B", PINK = "#F0679E", VIOLET = "#A76BF0", SLATE = "#5B6B82";
const DAY = { label: "Day Shift", color: "#3B6FD8" }, NIGHT = { label: "Night Shift", color: "#6A4FC8" }, GYM = { label: "Gym", color: "#2FA36B" };

const GROUPS: Group[] = [
  {
    title: "Get Started", guides: [
      {
        id: "types", title: "Create your shift types", icon: "color-palette", color: VIOLET, keywords: "new type colour start finish times hours",
        steps: [
          { text: "Open the Types tab and tap New Type.", pic: [{ t: "tabs", active: "Types" }, { t: "btn", label: "New Type", hl: true }] },
          { text: "Give it a name, a colour, and a start and finish time. The hours are worked out for you.", pic: [
            { t: "field", label: "Name", value: "Day Shift" }, { t: "row", label: "Start", value: "7:00 am" }, { t: "row", label: "Finish", value: "7:00 pm" }, { t: "row", label: "Hours", value: "12h" }] },
          { text: "Tap Save. Repeat for each shift you work, like night shift or a short day." },
        ],
      },
      {
        id: "roster", title: "Fill your calendar from your roster", icon: "repeat", color: TEAL, keywords: "pattern rotation weeks repeat fill stamp",
        steps: [
          { text: "Open the Roster tab and set how many weeks your rotation runs before it repeats.", pic: [{ t: "tabs", active: "Roster" }, { t: "row", label: "Weeks in rotation", value: "4", hl: true }] },
          { text: "Tap each day of the rotation and add its shifts." },
          { text: "Tap Fill Calendar from Pattern, pick the start date and how far ahead, then Stamp Onto Calendar.", pic: [
            { t: "btn", label: "Fill Calendar from Pattern", hl: true }, { t: "row", label: "Start date", value: "Mon 2 Nov" }, { t: "row", label: "Fill ahead", value: "1 year" }] },
          { text: "It's a one-off fill. Swaps and changes after that are made on the calendar." },
        ],
      },
      {
        id: "pay", title: "Set up your pay", icon: "cash", color: GREEN, keywords: "hourly rate pay cycle fortnightly overtime rate penalty super tax",
        steps: [
          { text: "Open Reports and tap Pay Setup next to Estimated Pay.", pic: [{ t: "tabs", active: "Reports" }, { t: "head", text: "Estimated Pay", link: "Pay Setup" }] },
          { text: "Enter your hourly rate and your pay cycle, including the date a pay period starts.", pic: [
            { t: "field", label: "Hourly rate ($)", value: "42.50", hl: true }, { t: "row", label: "Pay cycle", value: "Fortnightly" }, { t: "row", label: "Pay period start date", value: "Thu 15 Oct" }] },
          { text: "Open the other sections for overtime rates, penalty rates, shift allowances, leave, super and tax, then tap Save." },
        ],
      },
      {
        id: "parttime", title: "Set up part time", icon: "briefcase", color: BLUE, keywords: "employment part time excess limit rostered shifts overtime cap",
        steps: [
          { text: "Open Account and tap Employment.", pic: [{ t: "tabs", active: "Account" }, { t: "row", label: "Employment", value: "Full time", hl: true, chevron: true }] },
          { text: "Choose Part time, then enter your rostered shifts and the excess hours allowed before overtime.", pic: [
            { t: "row", label: "Part time", value: "✓" }, { t: "field", label: "Rostered shifts per fortnight", value: "4" }, { t: "field", label: "Excess hours per fortnight before overtime", value: "28", hl: true }] },
          { text: "Now add extra shifts as Additional Shift. Excess counts toward your limit and anything past it becomes overtime by itself." },
        ],
      },
    ],
  },
  {
    title: "Calendar", guides: [
      {
        id: "add", title: "Add a shift to a day", icon: "add-circle", color: BLUE, keywords: "add shift day tap",
        steps: [
          { text: "Tap the day on the calendar." },
          { text: "Tap one of your shift types.", pic: [{ t: "chips", items: [DAY, NIGHT, GYM], hl: 0 }] },
          { text: "If the shift can have extra hours, choose the plain shift or Additional Shift / Overtime." },
        ],
      },
      {
        id: "extra", title: "Log an extra shift or overtime", icon: "time", color: GOLD, keywords: "additional shift overtime excess extra hours",
        steps: [
          { text: "Tap the day, then tap the shift type you worked." },
          { text: "Choose Additional Shift (part time) or Overtime, then enter the hours you worked.", pic: [
            { t: "shift", label: "Day Shift", sub: "", color: DAY.color }, { t: "shift", label: "Day Shift", sub: "Additional Shift", color: "#D9822B" }] },
          { text: "To change the hours later, tap the day and tap Hours next to the shift.", pic: [{ t: "shift", label: "Additional Shift", sub: "8h excess + 4h overtime", color: "#D9822B", action: "Hours" }] },
        ],
      },
      {
        id: "leave", title: "Take annual or sick leave", icon: "airplane", color: TEAL, keywords: "annual leave sick leave holiday day off",
        steps: [
          { text: "Tap the day, then + Annual Leave or + Sick Leave.", pic: [{ t: "head", text: "Leave" }, { t: "chips", items: [{ label: "Annual Leave", color: TEAL }, { label: "Sick Leave", color: PINK }], hl: 0 }] },
          { text: "Pick the shift you're taking off and confirm the hours. It replaces the rostered shift, and removing the leave puts the shift back." },
        ],
      },
      {
        id: "swap", title: "Swap a shift", icon: "swap-horizontal", color: VIOLET, keywords: "swap move shift change date",
        steps: [
          { text: "Tap the day and tap Swap next to the shift.", pic: [{ t: "shift", label: "Day Shift", sub: "12h", color: DAY.color, action: "Swap" }] },
          { text: "Choose the new date and, if you like, who you swapped with. Both days show the swap, and Undo swap puts it back." },
        ],
      },
      {
        id: "wand", title: "Fill lots of days quickly", icon: "color-wand", color: PINK, keywords: "wand bulk many days quickly",
        steps: [
          { text: "On the calendar, tap the wand button and choose a shift type." },
          { text: "Tap days to add or remove that shift, then tap Done." },
        ],
      },
      {
        id: "holidays", title: "Show public holidays", icon: "flag", color: GREEN, keywords: "public holiday state ekka show day PH",
        steps: [
          { text: "Open Account → Employment and choose your state, and your area for local show days.", pic: [{ t: "row", label: "State", value: "Queensland", hl: true }, { t: "row", label: "Area", value: "Brisbane" }] },
          { text: "Public holidays are marked PH on the calendar and paid at your public holiday penalty rate." },
        ],
      },
    ],
  },
  {
    title: "Allowances", guides: [
      {
        id: "allowance", title: "Add a missed meal allowance", icon: "restaurant", color: GOLD, keywords: "missed meal break allowance add set up claim",
        steps: [
          { text: "Open Reports and tap Pay Setup.", pic: [{ t: "tabs", active: "Reports" }, { t: "head", text: "Estimated Pay", link: "Pay Setup" }] },
          { text: "Open Allowances and tap Add Allowance. Enter the name and what it pays, then Save. Add a Missed break the same way.", pic: [
            { t: "head", text: "Allowances" }, { t: "field", label: "Name", value: "Missed meal" }, { t: "field", label: "Amount ($)", value: "18.70" }, { t: "btn", label: "Add Allowance", hl: true }] },
          { text: "When you add a shift, use + to count each allowance you got that day.", pic: [
            { t: "stepper", label: "Missed meal", value: 1, hl: true }, { t: "stepper", label: "Missed break", value: 0 }, { t: "shift", label: "Day Shift", sub: "", color: DAY.color }] },
          { text: "It's added to your estimated pay straight away." },
        ],
      },
      {
        id: "allowance-edit", title: "Change allowances on a day", icon: "create", color: GOLD, keywords: "change edit remove allowance count wrong fix",
        steps: [
          { text: "Tap the day on the calendar." },
          { text: "Under Allowances, use − and + to change the count.", pic: [
            { t: "head", text: "Allowances" }, { t: "stepper", label: "Missed meal", value: 2, hl: true }, { t: "stepper", label: "Missed break", value: 1 }] },
        ],
      },
      {
        id: "allowance-tick", title: "Tick off allowances from your payslip", icon: "checkmark-done", color: GREEN, keywords: "tick payslip owed check allowance paid",
        steps: [
          { text: "Open Reports and tap Breakdown on Estimated Pay." },
          { text: "Tick each allowance once you see it on your payslip, so you can see what's still owed.", pic: [
            { t: "check", label: "Missed meal ×2", value: "$37.40", on: true }, { t: "check", label: "Missed break ×2", value: "$24.20", on: false, hl: true }] },
          { text: "Turn on Payday reminder in Pay Setup and you'll be told how many are left to check each payday." },
        ],
      },
    ],
  },
  {
    title: "More", guides: [
      {
        id: "share", title: "Share your roster", icon: "people", color: GOLD, keywords: "share family friends invite see roster",
        steps: [
          { text: "Open Account and tap Share Your Roster.", pic: [{ t: "tabs", active: "Account" }, { t: "row", label: "Share Your Roster", hl: true, chevron: true }] },
          { text: "Invite people by email. They see your shifts and leave only. Personal events stay private." },
        ],
      },
      {
        id: "widget", title: "Add the home screen widget", icon: "apps", color: BLUE, keywords: "widget home screen next shift",
        steps: [
          { text: "Press and hold your home screen, tap Edit, then Add Widget." },
          { text: "Choose Roster Board and pick the small or medium size." },
        ],
      },
      {
        id: "calapp", title: "Show shifts in the Calendar app", icon: "calendar", color: PINK, keywords: "iphone calendar app sync apple calendar",
        steps: [
          { text: "Open Account and, under Appearance → Shifts, choose Show.", pic: [{ t: "tabs", active: "Account" }, { t: "row", label: "Shifts", value: "Show", hl: true }] },
          { text: "Your shifts and leave appear in a Roster Board calendar and stay up to date." },
        ],
      },
      {
        id: "premium", title: "What Premium includes", icon: "star", color: "#C8975F", keywords: "premium price subscription free lifetime",
        steps: [
          { text: "Premium adds estimated pay, full reports, roster patterns, sharing, alarms, PDF export and unlimited shift types. $4.99 a month or $24.99 once." },
          { text: "Free includes the calendar, up to 3 shift types, leave, events, birthdays and sync." },
        ],
      },
    ],
  },
];

const ALL = GROUPS.flatMap((g) => g.guides);
const POPULAR = ["allowance", "pay", "extra", "roster"];

export function HelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState<Guide | null>(null);
  useEffect(() => { if (!visible) { setQ(""); setOpen(null); } }, [visible]);

  const results = useMemo(() => {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return null;
    return ALL.filter((g) => {
      const hay = (g.title + " " + g.keywords + " " + g.steps.map((s) => s.text).join(" ")).toLowerCase();
      return words.every((w) => hay.includes(w));
    });
  }, [q]);

  const guideView = open ? (
      <>
        <Pressable accessibilityRole="button" onPress={() => setOpen(null)} hitSlop={8} style={{ flexDirection: "row", alignItems: "center", gap: 4, paddingTop: 4, marginBottom: 12 }}>
          <Ionicons name="chevron-back" size={18} color={t.accent} />
          <Text style={{ color: t.accent, fontWeight: "600", fontSize: 15 }}>Back</Text>
        </Pressable>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 16 }}>
          <IconTile icon={open.icon} color={open.color} size={36} />
          <Text style={{ flex: 1, color: t.text, fontSize: 20, fontWeight: "700" }}>{open.title}</Text>
        </View>
        {open.steps.map((s, i) => (
          <View key={i} style={{ flexDirection: "row", gap: 12, marginBottom: 18 }}>
            <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.accent, alignItems: "center", justifyContent: "center", marginTop: 1 }}>
              <Text style={{ color: t.accentInk, fontWeight: "700", fontSize: 13 }}>{i + 1}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: t.text, fontSize: 15, lineHeight: 22 }}>{s.text}</Text>
              {s.pic ? <Pic lines={s.pic} /> : null}
            </View>
          </View>
        ))}
      </>
  ) : null;

  const list = (guides: Guide[]) => (
    <Card style={{ paddingVertical: 2 }}>
      {guides.map((g, i) => (
        <View key={g.id}>
          {i ? <Divider /> : null}
          <Pressable accessibilityRole="button" onPress={() => setOpen(g)} style={({ pressed }) => ({ paddingVertical: 12, flexDirection: "row", alignItems: "center", gap: 12, opacity: pressed ? 0.7 : 1 })}>
            <IconTile icon={g.icon} color={g.color} size={30} />
            <Text style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "600" }}>{g.title}</Text>
            <Ionicons name="chevron-forward" size={17} color={t.textFaint} />
          </Pressable>
        </View>
      ))}
    </Card>
  );

  return (
    <Sheet visible={visible} onClose={onClose} title="Help">
      {guideView || (<>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: t.surface2, borderRadius: 12, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
        <Ionicons name="search" size={17} color={t.textFaint} />
        <TextInput value={q} onChangeText={setQ} placeholder="What do you want to do?" placeholderTextColor={t.textFaint}
          autoCorrect={false} returnKeyType="search" accessibilityLabel="Search help"
          style={{ flex: 1, color: t.text, fontSize: 15, paddingVertical: 11 }} />
        {q ? <Pressable accessibilityRole="button" accessibilityLabel="Clear search" onPress={() => setQ("")} hitSlop={8}><Ionicons name="close-circle" size={18} color={t.textFaint} /></Pressable> : null}
      </View>
      {results ? (
        results.length ? <View style={{ marginTop: 14 }}>{list(results)}</View>
          : <Text style={{ color: t.textDim, fontSize: 14, marginTop: 18, textAlign: "center" }}>No matches. Try "overtime", "leave" or "allowance".</Text>
      ) : (
        <>
          <SectionHead title="Popular" />
          {list(POPULAR.map((id) => ALL.find((g) => g.id === id)!))}
          {GROUPS.map((g) => (
            <View key={g.title}>
              <SectionHead title={g.title} />
              {list(g.guides.filter((x) => !POPULAR.includes(x.id)))}
            </View>
          ))}
        </>
      )}
      </>)}
      <View style={{ height: 12 }} />
    </Sheet>
  );
}

function Pic({ lines }: { lines: Line[] }) {
  const t = useTheme();
  const hlBox = (on?: boolean) => on ? { borderWidth: 2, borderColor: t.accent, borderRadius: 10, marginHorizontal: -6, paddingHorizontal: 6 } : { borderWidth: 2, borderColor: "transparent", marginHorizontal: -6, paddingHorizontal: 6 };
  const label = { color: t.text, fontSize: 13, fontWeight: "600" as const };
  const value = { color: t.textDim, fontSize: 13 };
  return (
    <View accessible={false} importantForAccessibility="no-hide-descendants"
      style={{ marginTop: 10, backgroundColor: t.surface2, borderRadius: 14, padding: 12, gap: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border }}>
      {lines.map((l, i) => {
        switch (l.t) {
          case "tabs":
            return (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                {["Calendar", "Types", "Reports", "Roster", "Account"].map((n) => (
                  <View key={n} style={{ paddingVertical: 4, paddingHorizontal: 6, borderRadius: 8, borderWidth: 2, borderColor: n === l.active ? t.accent : "transparent" }}>
                    <Text style={{ fontSize: 11, fontWeight: n === l.active ? "700" : "500", color: n === l.active ? t.accent : t.textFaint }}>{n}</Text>
                  </View>
                ))}
              </View>
            );
          case "head":
            return (
              <View key={i} style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingTop: 2 }}>
                <Text style={{ color: t.textDim, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>{l.text.toUpperCase()}</Text>
                {l.link ? <View style={{ borderWidth: 2, borderColor: t.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: t.accent, fontSize: 13, fontWeight: "600" }}>{l.link}</Text></View> : null}
              </View>
            );
          case "row":
            return (
              <View key={i} style={[{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 6 }, hlBox(l.hl)]}>
                <Text style={label}>{l.label}</Text>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                  {l.value ? <Text style={value}>{l.value}</Text> : null}
                  {l.chevron ? <Ionicons name="chevron-forward" size={14} color={t.textFaint} /> : null}
                </View>
              </View>
            );
          case "field":
            return (
              <View key={i} style={hlBox(l.hl)}>
                <Text style={{ color: t.textDim, fontSize: 11, marginBottom: 3 }}>{l.label}</Text>
                <View style={{ backgroundColor: t.surface, borderRadius: 8, paddingVertical: 6, paddingHorizontal: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: t.border, marginBottom: 2 }}>
                  <Text style={{ color: t.text, fontSize: 13 }}>{l.value}</Text>
                </View>
              </View>
            );
          case "stepper":
            return (
              <View key={i} style={[{ flexDirection: "row", alignItems: "center", paddingVertical: 4 }, hlBox(l.hl)]}>
                <Text style={[label, { flex: 1 }]}>{l.label}</Text>
                {(["remove", "add"] as const).map((ic, k) => (
                  <React.Fragment key={ic}>
                    {k ? <Text style={{ color: t.text, fontWeight: "700", fontSize: 14, minWidth: 22, textAlign: "center" }}>{l.value}</Text> : null}
                    <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: t.surface, alignItems: "center", justifyContent: "center" }}>
                      <Ionicons name={ic} size={14} color={t.text} />
                    </View>
                  </React.Fragment>
                ))}
              </View>
            );
          case "chips":
            return (
              <View key={i} style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {l.items.map((c, k) => (
                  <View key={c.label} style={{ backgroundColor: c.color, borderRadius: 14, paddingVertical: 5, paddingHorizontal: 10, borderWidth: 2, borderColor: k === l.hl ? t.accent : "transparent" }}>
                    <Text style={{ color: "#FFFFFF", fontSize: 12, fontWeight: "700" }}>{"+ " + c.label}</Text>
                  </View>
                ))}
              </View>
            );
          case "shift":
            return (
              <View key={i} style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 4 }}>
                <View style={{ width: 4, alignSelf: "stretch", borderRadius: 2, backgroundColor: l.color }} />
                <View style={{ flex: 1 }}>
                  <Text style={label}>{l.label}</Text>
                  {l.sub ? <Text style={{ color: t.textDim, fontSize: 11 }}>{l.sub}</Text> : null}
                </View>
                {l.action ? <View style={{ borderWidth: 2, borderColor: t.accent, borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 }}><Text style={{ color: t.accent, fontSize: 12, fontWeight: "600" }}>{l.action}</Text></View> : null}
              </View>
            );
          case "check":
            return (
              <View key={i} style={[{ flexDirection: "row", alignItems: "center", gap: 8, paddingVertical: 5 }, hlBox(l.hl)]}>
                <Ionicons name={l.on ? "checkmark-circle" : "ellipse-outline"} size={18} color={l.on ? t.good : t.textFaint} />
                <Text style={[label, { flex: 1 }]}>{l.label}</Text>
                <Text style={value}>{l.value}</Text>
              </View>
            );
          case "btn":
            return (
              <View key={i} style={{ alignSelf: "flex-start", borderRadius: 10, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: t.surface, borderWidth: 2, borderColor: l.hl ? t.accent : t.border }}>
                <Text style={{ color: t.text, fontSize: 13, fontWeight: "600" }}>{l.label}</Text>
              </View>
            );
        }
      })}
    </View>
  );
}
