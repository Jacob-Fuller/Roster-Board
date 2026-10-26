// Allowances Owed: every allowance not yet seen on a payslip, from any week.
// Tap the ones on your payslip, then mark them paid together.
import Ionicons from "@expo/vector-icons/Ionicons";
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, Text, View } from "react-native";
import { Button, Card, Dim, Divider, Sheet, useTheme, useUi } from "../components/ui";
import { MONTHS, WEEKDAYS_FULL, parseYmd } from "../lib/model";
import { fmtMoney, owedAllowances, type PayTag } from "../lib/pay";
import { useStore } from "../lib/store";

const rowKey = (dateKey: string, allowanceId: string) => dateKey + "|" + allowanceId;

export function OwedSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { toast } = useUi();
  const { data, update } = useStore();
  const owed = useMemo(() => owedAllowances(data), [data]);
  const [picked, setPicked] = useState<{ [k: string]: true }>({});
  useEffect(() => { if (!visible) setPicked({}); }, [visible]);

  const keys = owed.map((c) => rowKey(c.dateKey, c.allowance.id));
  const chosen = owed.filter((c) => picked[rowKey(c.dateKey, c.allowance.id)]);
  const allPicked = owed.length > 0 && chosen.length === owed.length;
  const total = owed.reduce((n, c) => n + c.amount, 0);
  const chosenTotal = chosen.reduce((n, c) => n + c.amount, 0);

  const toggle = (k: string) => setPicked((p) => { const n = { ...p }; if (n[k]) delete n[k]; else n[k] = true; return n; });
  const markPaid = () => {
    if (!chosen.length) return;
    const ids: { [id: string]: true } = {};
    chosen.forEach((c) => c.tags.forEach((x) => { ids[x.id] = true; }));
    const count = Object.keys(ids).length;
    update((d) => {
      chosen.forEach((c) => ((d.payTags[c.dateKey] || []) as PayTag[]).forEach((x) => {
        if (ids[x.id]) { x.paid = true; x.updatedAt = Date.now(); }
      }));
    });
    setPicked({});
    toast(count === 1 ? "1 allowance marked paid" : count + " allowances marked paid");
  };

  const footer = owed.length ? (
    <Button title={chosen.length ? "Mark Paid · " + fmtMoney(chosenTotal) : "Mark Paid"} onPress={markPaid} disabled={!chosen.length} />
  ) : undefined;

  return (
    <Sheet visible={visible} onClose={onClose} title="Allowances Owed" footer={footer}>
      {owed.length ? (
        <>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: -4, marginBottom: 10 }}>
            <Dim>{owed.reduce((n, c) => n + c.tags.length, 0) + " owed · " + fmtMoney(total)}</Dim>
            <Pressable accessibilityRole="button" hitSlop={8}
              onPress={() => setPicked(allPicked ? {} : Object.fromEntries(keys.map((k) => [k, true as const])))}>
              <Text style={{ color: t.accent, fontWeight: "600", fontSize: 14 }}>{allPicked ? "Clear" : "Select All"}</Text>
            </Pressable>
          </View>
          <Card style={{ paddingVertical: 4 }}>
            {owed.map((c, i) => {
              const k = rowKey(c.dateKey, c.allowance.id);
              const on = !!picked[k];
              const dt = parseYmd(c.dateKey);
              return (
                <View key={k}>
                  {i ? <Divider /> : null}
                  <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: on }} onPress={() => toggle(k)}
                    style={({ pressed }) => ({ flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
                    <Ionicons name={on ? "checkmark-circle" : "ellipse-outline"} size={24} color={on ? t.good : t.textFaint} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: t.text, fontSize: 15, fontWeight: "600" }}>{c.allowance.name + (c.tags.length > 1 ? " ×" + c.tags.length : "")}</Text>
                      <Dim>{WEEKDAYS_FULL[dt.getDay()].slice(0, 3) + " " + dt.getDate() + " " + MONTHS[dt.getMonth()].slice(0, 3) + (dt.getFullYear() !== new Date().getFullYear() ? " " + dt.getFullYear() : "")}</Dim>
                    </View>
                    <Text style={{ color: t.text, fontSize: 14, fontWeight: "700", fontVariant: ["tabular-nums"] }}>{fmtMoney(c.amount)}</Text>
                  </Pressable>
                </View>
              );
            })}
          </Card>
        </>
      ) : (
        <View style={{ alignItems: "center", paddingVertical: 40, gap: 10 }}>
          <Ionicons name="checkmark-done-circle" size={44} color={t.good} />
          <Text style={{ color: t.text, fontSize: 16, fontWeight: "600" }}>All allowances paid</Text>
        </View>
      )}
    </Sheet>
  );
}
