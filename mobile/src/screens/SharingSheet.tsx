import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Modal, Pressable, Share, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { MonthGrid, MonthNav } from "../components/MonthGrid";
import { Button, Dim, Divider, Field, H1, SectionHead, Sheet, useTheme, useUi } from "../components/ui";
import { EXCESS_TYPE, MONTHS, OVERTIME_TYPE, startOfMonth, type ShiftType } from "../lib/model";
import { useStore } from "../lib/store";
import { sb, WEB_URL } from "../lib/supabase";

type Conn = { id: string; requester_id: string; target_id: string; requester_email: string; target_email: string; status: string };
type Shared = { email: string; data: any; typesById: { [id: string]: ShiftType } };

// Roster sharing, same server functions as the web app. Only work shifts and
// leave are ever shared; personal entries, events and notes stay private.
export function SharingSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = useTheme();
  const { user } = useStore();
  const { dialog, toast } = useUi();
  const [conns, setConns] = useState<Conn[] | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [shared, setShared] = useState<Shared | null>(null);
  const uid = user ? user.id : "";

  const refresh = useCallback(async () => {
    if (!uid) return;
    const r = await sb.from("connections").select("*").or("requester_id.eq." + uid + ",target_id.eq." + uid);
    if (r.error) { setErr("Couldn't load connections: " + r.error.message); return; }
    setErr(""); setConns((r.data as Conn[]) || []);
  }, [uid]);
  useEffect(() => { if (visible) refresh(); }, [visible, refresh]);

  const other = (c: Conn) => (c.requester_id === uid ? c.target_email : c.requester_email);
  const incoming = (conns || []).filter((c) => c.target_id === uid && c.status === "pending");
  const outgoing = (conns || []).filter((c) => c.requester_id === uid && c.status === "pending");
  const accepted = (conns || []).filter((c) => c.status === "accepted");

  async function invite() {
    const e = email.trim();
    if (!e) { setErr("Enter an email address."); return; }
    setBusy(true); setErr("");
    const r = await sb.rpc("invite_connection", { p_email: e });
    setBusy(false);
    if (r.error) { setErr(r.error.message || "Couldn't send invite"); return; }
    setEmail("");
    toast("If they have a Roster Board account, they'll see your request");
    refresh();
  }
  async function respond(id: string, accept: boolean) {
    const r = await sb.rpc("respond_connection", { p_connection_id: id, p_accept: accept });
    if (r.error) { toast(r.error.message || "Couldn't respond to request"); return; }
    toast(accept ? "Connected" : "Request declined");
    refresh();
  }
  function remove(c: Conn) {
    dialog({
      title: "Remove " + other(c) + "?", message: "You'll stop seeing each other's rosters.", confirm: "Remove", danger: true,
      onConfirm: async () => {
        const r = await sb.rpc("remove_connection", { p_connection_id: c.id });
        if (r.error) { toast("Couldn't remove connection"); return; }
        refresh();
      },
    });
  }
  async function view(c: Conn) {
    const ownerId = c.requester_id === uid ? c.target_id : c.requester_id;
    const r = await sb.rpc("get_shared_roster", { p_owner_id: ownerId });
    if (r.error) { toast(r.error.message || "Couldn't load that roster"); return; }
    const data: any = r.data || { types: [], shifts: {}, leave: {} };
    const typesById: { [id: string]: ShiftType } = { [OVERTIME_TYPE.id]: OVERTIME_TYPE, [EXCESS_TYPE.id]: EXCESS_TYPE };
    // Second safety net: never show personal entries or shift notes.
    (data.types || []).forEach((ty: ShiftType) => { if (ty && ty.kind !== "personal") typesById[ty.id] = ty; });
    const shifts: any = {};
    Object.keys(data.shifts || {}).forEach((k) => {
      const list = (data.shifts[k] || []).filter((s: any) => s && typesById[s.typeId]).map(({ tag: _tag, ...rest }: any) => rest);
      if (list.length) shifts[k] = list;
    });
    setShared({ email: other(c), typesById, data: { shifts, leave: data.leave || {} } });
  }
  const shareApp = () => Share.share({ message: "I'm using Roster Board to manage my shifts and roster. Check it out: " + WEB_URL }).catch(() => {});

  return (
    <Sheet visible={visible} onClose={onClose} title="Share your roster">
      <Dim>Connected people can see your work shifts and leave. Personal events, notes and pay are never shared.</Dim>
      <SectionHead title="Invite someone" />
      <Field value={email} onChangeText={setEmail} placeholder="Their Roster Board email" keyboardType="email-address" autoCapitalize="none" autoComplete="email" onSubmitEditing={invite} />
      {err ? <Text style={{ color: t.danger, marginBottom: 10 }}>{err}</Text> : null}
      <View style={{ flexDirection: "row", gap: 10 }}>
        <Button style={{ flex: 1 }} title={busy ? "Sending…" : "Send request"} onPress={invite} disabled={busy} />
        <Button kind="ghost" title="Share app link" onPress={shareApp} />
      </View>

      {incoming.length ? <SectionHead title="Requests" /> : null}
      {incoming.map((c) => (
        <View key={c.id} style={{ paddingVertical: 10, gap: 8 }}>
          <Text style={{ color: t.text, fontWeight: "600" }}>{other(c)}</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            <Button small title="Accept" onPress={() => respond(c.id, true)} />
            <Button small kind="ghost" title="Decline" onPress={() => respond(c.id, false)} />
          </View>
        </View>
      ))}

      {outgoing.length ? <SectionHead title="Sent" /> : null}
      {outgoing.map((c) => (
        <Line key={c.id} title={other(c)} sub="Pending" action="Cancel" onAction={() => remove(c)} />
      ))}

      <SectionHead title="Connected" />
      {conns === null ? <Dim>Loading…</Dim> : accepted.length ? accepted.map((c) => (
        <Line key={c.id} title={other(c)} sub="Tap to view their roster" onPress={() => view(c)} action="Remove" onAction={() => remove(c)} />
      )) : <Dim>No connections yet.</Dim>}

      <SharedRosterView shared={shared} onClose={() => setShared(null)} />
    </Sheet>
  );
}

function Line({ title, sub, onPress, action, onAction }: { title: string; sub?: string; onPress?: () => void; action: string; onAction: () => void }) {
  const t = useTheme();
  return (
    <>
      <View style={{ flexDirection: "row", alignItems: "center", paddingVertical: 10, gap: 10 }}>
        <Pressable disabled={!onPress} onPress={onPress} style={{ flex: 1 }} accessibilityRole={onPress ? "button" : undefined}>
          <Text style={{ color: t.text, fontWeight: "600", fontSize: 15 }}>{title}</Text>
          {sub ? <Dim>{sub}</Dim> : null}
        </Pressable>
        <Pressable accessibilityRole="button" onPress={onAction} hitSlop={8}>
          <Text style={{ color: t.danger, fontWeight: "700" }}>{action}</Text>
        </Pressable>
      </View>
      <Divider />
    </>
  );
}

function SharedRosterView({ shared, onClose }: { shared: Shared | null; onClose: () => void }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [month, setMonth] = useState(startOfMonth(new Date()));
  const data = useMemo(() => (shared ? shared.data : { shifts: {}, leave: {} }), [shared]);
  return (
    <Modal visible={!!shared} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.bg, paddingTop: insets.top, paddingBottom: insets.bottom }}>
        <View style={{ paddingHorizontal: 16, paddingTop: 10, paddingBottom: 8 }}>
          <Pressable accessibilityRole="button" onPress={onClose} hitSlop={8} style={{ marginBottom: 8 }}>
            <Text style={{ color: t.accent, fontWeight: "700", fontSize: 15 }}>‹ Back</Text>
          </Pressable>
          <Dim numberOfLines={1}>{shared ? shared.email : ""}</Dim>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 2 }}>
            <H1 style={{ flex: 1 }}>{MONTHS[month.getMonth()]} <Text style={{ color: t.textDim, fontWeight: "400" }}>{month.getFullYear()}</Text></H1>
            <MonthNav month={month} onChange={setMonth} />
          </View>
        </View>
        {shared ? <MonthGrid month={month} data={data} typesById={shared.typesById} /> : null}
      </View>
    </Modal>
  );
}
