// Pay Setup, ported from the web app's pay setup screen (index.html, "Pay Setup screen").
// Saves into data.settings exactly as the web does (see savePaySetup in lib/pay.ts).
import React, { useEffect, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { DateField } from "../components/DateField";
import { Button, Card, Dim, Divider, Field, Segmented, Sheet, ToggleRow, useTheme, useUi } from "../components/ui";
import { employmentOf, fmtHours, mkId } from "../lib/model";
import { rebalanceAllExtras } from "../lib/partTime";
import {
  fmtMoney, payFormFromConfig, paySetupDraft, paySummaries, savePaySetup, workTypes,
  type PayAllowance, type PayConfig, type PayCycle, type PayForm, type PayTypeRule,
} from "../lib/pay";
import { useStore } from "../lib/store";
import { askReminderPermission } from "../lib/reminders";

type AllowanceKind = "none" | "pct" | "flat";
const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));

export function PaySetupSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data, update } = useStore();
  const fullTime = employmentOf(data.settings) === "full";
  const { toast } = useUi();
  const [draft, setDraft] = useState<PayConfig | null>(null);
  const [form, setForm] = useState<PayForm | null>(null);
  const [amounts, setAmounts] = useState<{ [typeId: string]: string }>({});
  const [allowText, setAllowText] = useState<{ [id: string]: string }>({});
  const th = useTheme();

  // A fresh copy of the saved setup every time the sheet opens (like the web's openPaySetup).
  useEffect(() => {
    if (!visible) { setDraft(null); setForm(null); return; }
    const c = paySetupDraft(data.settings, data.types);
    const a: { [typeId: string]: string } = {};
    Object.keys(c.typeRules).forEach((id) => { const v = c.typeRules[id].allowance; a[id] = v ? String(v) : ""; });
    setDraft(c); setForm(payFormFromConfig(c)); setAmounts(a); setAllowText({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const types = workTypes(data.types);
  const set = <K extends keyof PayForm>(k: K, v: PayForm[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const setAllowance = (id: string, patch: Partial<PayAllowance>) =>
    setDraft((c) => (c ? { ...c, allowances: c.allowances.map((a) => (a.id === id ? { ...a, ...patch } : a)) } : c));
  const setRule = (id: string, patch: Partial<PayTypeRule>) =>
    setDraft((c) => (c ? { ...c, typeRules: { ...c.typeRules, [id]: { ...(c.typeRules[id] || {}), ...patch } } } : c));

  const save = () => {
    if (!draft || !form) return;
    if (!(parseFloat(form.baseRate) > 0)) { toast("Enter your hourly rate"); return; }
    const c = clone(draft), f = form;
    c.allowances = c.allowances.filter((a) => a.name.trim()).map((a) => ({ ...a, name: a.name.trim() }));
    update((d) => {
      d.settings = d.settings || { hourlyRate: 0 };
      savePaySetup(d.settings, c, f);
      // the pay cycle sets the period part-time excess hours are counted over
      rebalanceAllExtras(d);
    });
    onClose();
    toast("Pay Setup saved");
  };

  const footer = (
    <View style={{ flexDirection: "row", gap: 10 }}>
      <Button style={{ flex: 1 }} kind="ghost" title="Cancel" onPress={onClose} />
      <Button style={{ flex: 1 }} title="Save" onPress={save} />
    </View>
  );

  if (!draft || !form) return <Sheet visible={visible} onClose={onClose} title="Pay Setup" footer={footer}><View /></Sheet>;
  const sum = paySummaries(form, draft.cycle, types.length);
  const dec = "decimal-pad" as const;

  return (
    <Sheet visible={visible} onClose={onClose} title="Pay Setup" footer={footer}>
      <Section title="Base Rate" summary={sum.rate} initiallyOpen>
        <Field label="Hourly rate ($)" value={form.baseRate} onChangeText={(v) => set("baseRate", v)} keyboardType={dec} placeholder="e.g. 42.50" />
      </Section>

      <Section title="Pay Cycle" summary={sum.cycle} initiallyOpen>
        <View style={{ marginBottom: 12 }}>
          <Segmented<PayCycle> value={draft.cycle} onChange={(v) => setDraft({ ...draft, cycle: v })}
            options={[{ value: "weekly", label: "Weekly" }, { value: "fortnightly", label: "Fortnightly" }, { value: "monthly", label: "Monthly" }]} />
        </View>
        <DateField label="Pay period start date" value={form.periodStart} onChange={(v) => set("periodStart", v)} />
        <ToggleRow label="Payday reminder" value={!!draft.paydayReminder} onChange={async (v) => {
          if (v && !(await askReminderPermission())) { toast("Allow notifications for Tempus Board in Settings to get payday reminders"); return; }
          setDraft({ ...draft, paydayReminder: v });
        }} />
      </Section>

      <Section title={fullTime ? "Overtime" : "Excess & Overtime"} summary={fullTime ? sum.ot.replace(/^[^·]*excess · /, "") : sum.ot}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          {fullTime ? null : <View style={{ flex: 1 }}><Field label="Excess rate ×" value={form.exMult} onChangeText={(v) => set("exMult", v)} keyboardType={dec} placeholder="1" /></View>}
          <View style={{ flex: 1 }}><Field label="Overtime rate ×" value={form.otMult} onChangeText={(v) => set("otMult", v)} keyboardType={dec} placeholder="1.5" /></View>
          {fullTime ? <View style={{ flex: 1 }} /> : null}
        </View>
        <ToggleRow label="Tiered overtime" value={form.otTiered} onChange={(v) => set("otTiered", v)} />
        {form.otTiered ? (
          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}><Field label="First … hours" value={form.otTierHours} onChangeText={(v) => set("otTierHours", v)} keyboardType={dec} placeholder="3" /></View>
            <View style={{ flex: 1 }}><Field label="Then rate ×" value={form.otMult2} onChangeText={(v) => set("otMult2", v)} keyboardType={dec} placeholder="2" /></View>
          </View>
        ) : null}
      </Section>

      <Section title="Penalty Rates" summary={sum.pen}>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Saturday %" value={form.penSat} onChangeText={(v) => set("penSat", v)} keyboardType={dec} placeholder="e.g. 50" /></View>
          <View style={{ flex: 1 }}><Field label="Sunday %" value={form.penSun} onChangeText={(v) => set("penSun", v)} keyboardType={dec} placeholder="e.g. 100" /></View>
        </View>
        <View style={{ flexDirection: "row", gap: 10 }}>
          <View style={{ flex: 1 }}><Field label="Public holiday %" value={form.penPh} onChangeText={(v) => set("penPh", v)} keyboardType={dec} placeholder="e.g. 150" /></View>
          <View style={{ flex: 1 }}><Field label="Night shift %" value={form.penNight} onChangeText={(v) => set("penNight", v)} keyboardType={dec} placeholder="e.g. 15" /></View>
        </View>
      </Section>

      <Section title="Shift Types" summary={sum.types}>
        {!types.length ? <Dim>Add your shift types on the Types tab first.</Dim> : types.map((t, i) => {
          const rule: PayTypeRule = draft.typeRules[t.id] || {};
          const kind: AllowanceKind = rule.allowanceKind === "pct" || rule.allowanceKind === "flat" ? rule.allowanceKind : "none";
          return (
            <View key={t.id}>
              {i ? <Divider /> : null}
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 12 }}>
                <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: t.color }} />
                <TypeName name={t.name} />
                <Dim>{fmtHours(t.hours || 0) + "h"}</Dim>
              </View>
              <ToggleRow label="Penalty rates apply" value={rule.penalties !== false} onChange={(v) => setRule(t.id, { penalties: v })} />
              <ToggleRow label="Night shift (night penalty applies)" value={!!rule.night} onChange={(v) => setRule(t.id, { night: v })} />
              <Dim style={{ fontWeight: "600", marginBottom: 6 }}>Shift allowance</Dim>
              <View style={{ marginBottom: 12 }}>
                <Segmented<AllowanceKind> value={kind} onChange={(v) => setRule(t.id, { allowanceKind: v })}
                  options={[{ value: "none", label: "None" }, { value: "pct", label: "% of ordinary pay" }, { value: "flat", label: "$ per shift" }]} />
              </View>
              {kind !== "none" ? (
                <Field label="Amount" value={amounts[t.id] || ""} keyboardType={dec} placeholder="e.g. 31.5"
                  onChangeText={(v) => { setAmounts({ ...amounts, [t.id]: v }); setRule(t.id, { allowance: parseFloat(v) || 0 }); }} />
              ) : null}
              {kind === "pct" && !fullTime ? (
                <ToggleRow label="Applies to excess hours" value={!!rule.excessAllowance} onChange={(v) => setRule(t.id, { excessAllowance: v })} />
              ) : null}
            </View>
          );
        })}
      </Section>

      <Section title="Allowances" summary={allowSummary(draft.allowances)}>
        {draft.allowances.map((a, i) => (
          <View key={a.id}>
            {i ? <Divider /> : null}
            <View style={{ paddingTop: i ? 12 : 0 }}>
              <Field label="Name" value={a.name} onChangeText={(v) => setAllowance(a.id, { name: v })} placeholder="e.g. Meal allowance" />
              <Field label="Amount ($)" value={allowText[a.id] ?? (a.amount ? String(a.amount) : "")} keyboardType={dec} placeholder="e.g. 18.50"
                onChangeText={(v) => { setAllowText({ ...allowText, [a.id]: v }); setAllowance(a.id, { amount: parseFloat(v) || 0, kind: "flat" }); }} />
              <Pressable accessibilityRole="button" onPress={() => setDraft({ ...draft, allowances: draft.allowances.filter((x) => x.id !== a.id) })} style={{ alignSelf: "flex-start", paddingBottom: 12 }}>
                <Text style={{ color: th.danger, fontWeight: "700" }}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <Button small kind="outline" title="Add Allowance"
          onPress={() => setDraft({ ...draft, allowances: draft.allowances.concat({ id: mkId(), name: "", kind: "flat", amount: 0 }) })} />
      </Section>

      <Section title="Leave" summary={sum.leave}>
        <ToggleRow label="Paid leave at base rate" value={form.payLeave} onChange={(v) => set("payLeave", v)} />
        <Field label="Annual leave loading %" value={form.leaveLoading} onChangeText={(v) => set("leaveLoading", v)} keyboardType={dec} placeholder="e.g. 17.5" />
      </Section>

      <Section title="Super & Tax" summary={sum.tax}>
        <Field label="Employer super %" value={form.superPct} onChangeText={(v) => set("superPct", v)} keyboardType={dec} placeholder="12" />
        <ToggleRow label="Show estimated tax and take-home" value={form.showTax} onChange={(v) => set("showTax", v)} />
        <ToggleRow label="Claim the tax-free threshold" value={form.taxFree} onChange={(v) => set("taxFree", v)} />
      </Section>
    </Sheet>
  );
}

function allowSummary(list: PayAllowance[]) {
  const named = list.filter((a) => a.name.trim());
  if (!named.length) return "None";
  return named.length === 1 ? named[0].name + " · " + fmtMoney(+(named[0].amount || 0)) : named.length + " allowances";
}

function TypeName({ name }: { name: string }) {
  const t = useTheme();
  return <Text numberOfLines={1} style={{ flex: 1, color: t.text, fontSize: 15, fontWeight: "700" }}>{name}</Text>;
}

// A collapsible card with a one-line summary, like the web's <details> sections.
function Section({ title, summary, initiallyOpen, children }: { title: string; summary: string; initiallyOpen?: boolean; children: React.ReactNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(!!initiallyOpen);
  return (
    <Card style={{ marginTop: 12 }}>
      <Pressable accessibilityRole="button" accessibilityState={{ expanded: open }} onPress={() => setOpen(!open)}
        style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
        <Text style={{ color: t.text, fontSize: 16, fontWeight: "700" }}>{title}</Text>
        <Dim numberOfLines={1} style={{ flex: 1, textAlign: "right" }}>{summary}</Dim>
        <Text style={{ color: t.textFaint, fontSize: 18 }}>{open ? "⌃" : "⌄"}</Text>
      </Pressable>
      {open ? <View style={{ marginTop: 12 }}>{children}</View> : null}
    </Card>
  );
}
