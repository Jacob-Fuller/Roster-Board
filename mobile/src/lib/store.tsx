// App state, saving on the device, and cloud sync. The sync follows the same
// rules as the web app (see index.html, "cloud sync"):
//  * never upload unless the cloud copy was just read and merged, so a device
//    with old data can't overwrite newer data;
//  * refresh the login before every sync;
//  * remember unsynced changes across restarts and keep retrying;
//  * compare-and-swap on updated_at, so two devices saving at once both survive;
//  * keep up to 10 earlier cloud copies for "Recover from an earlier backup".
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { User } from "@supabase/supabase-js";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { AppState } from "react-native";
import { emptySnapshot, normaliseSnapshot, type Snapshot } from "./model";
import { buildHistory, mergeSnapshots, pruneTombstones, sameSnapshot, stripHistory } from "./merge";
import { sb } from "./supabase";

const K = {
  data: "rosterBoard.v2",
  owner: "rosterBoard.owner",
  dirty: "rosterBoard.unsynced",
  last: "rosterBoard.lastSync",
  force: "rosterBoard.forceBackup",
  localOnly: "rosterBoard.localOnly",
  prefs: "rosterBoard.prefs",
};

export type ThemeChoice = "system" | "light" | "dark";
export type Prefs = { theme: ThemeChoice; hideEvents: boolean; hideBirthdays: boolean };
const DEFAULT_PREFS: Prefs = { theme: "system", hideEvents: false, hideBirthdays: false };

export type AuthState = "loading" | "signedOut" | "signedIn" | "localOnly";
export type SyncState = "idle" | "syncing" | "ok" | "failed" | "authLost";

type Tomb = (id: string | undefined) => void;

type Ctx = {
  data: Snapshot;
  auth: AuthState;
  user: User | null;
  sync: { state: SyncState; lastSync: number; dirty: boolean };
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  update: (fn: (d: Snapshot, tomb: Tomb) => void, opts?: { forceBackup?: boolean }) => void;
  syncNow: () => Promise<void>;
  useWithoutAccount: () => void;
  showSignIn: () => void;
  signOut: () => Promise<{ ok: boolean; error?: string }>;
  deleteAccount: () => Promise<{ ok: boolean; error?: string }>;
  restoreBackup: (snap: any) => void;
};

const StoreCtx = createContext<Ctx | null>(null);
export const useStore = () => {
  const c = useContext(StoreCtx);
  if (!c) throw new Error("useStore outside StoreProvider");
  return c;
};

const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v));
async function getNum(k: string) { return +(await AsyncStorage.getItem(k).catch(() => null) || 0) || 0; }

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Snapshot>(emptySnapshot());
  const [auth, setAuth] = useState<AuthState>("loading");
  const [user, setUser] = useState<User | null>(null);
  const [prefs, setPrefsState] = useState<Prefs>(DEFAULT_PREFS);
  const [sync, setSync] = useState<{ state: SyncState; lastSync: number; dirty: boolean }>({ state: "idle", lastSync: 0, dirty: false });

  const dataRef = useRef<Snapshot>(data);
  const userRef = useRef<User | null>(null);
  const loaded = useRef(false);
  const inFlight = useRef(false);
  const failures = useRef(0);
  const retryTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);

  const apply = useCallback((next: Snapshot, persist = true) => {
    dataRef.current = next;
    setData(next);
    if (persist) AsyncStorage.setItem(K.data, JSON.stringify(next)).catch(() => {});
  }, []);

  const refreshSyncFlags = useCallback(async (state?: SyncState) => {
    const [dirty, last] = await Promise.all([getNum(K.dirty), getNum(K.last)]);
    setSync((s) => ({ state: state || s.state, lastSync: last, dirty: !!dirty }));
  }, []);

  /* ---------- one sync: read, merge, write back ---------- */
  const syncOnce = useCallback(async (uid: string): Promise<"same" | "saved" | "conflict"> => {
    const res = await sb.from("app_data").select("data, updated_at").eq("user_id", uid).maybeSingle();
    if (res.error) throw res.error;
    const row: any = res.data || null;
    const remote = (row && row.data) || null;
    const merged = mergeSnapshots(dataRef.current, remote);
    apply(merged);
    if (!userRef.current || userRef.current.id !== uid) throw { message: "account changed" };
    if (remote && sameSnapshot(merged, stripHistory(remote))) return "same";
    const force = (await AsyncStorage.getItem(K.force).catch(() => null)) === "1";
    const toUpload: any = { ...merged, history: buildHistory(remote, force) };
    const stamp = new Date().toISOString();
    if (!row) {
      const r = await sb.from("app_data").insert({ user_id: uid, data: toUpload, updated_at: stamp });
      if (r.error) { if ((r.error as any).code === "23505") return "conflict"; throw r.error; }
    } else {
      let q = sb.from("app_data").update({ data: toUpload, updated_at: stamp }).eq("user_id", uid);
      q = row.updated_at ? q.eq("updated_at", row.updated_at) : q.is("updated_at", null);
      const r = await q.select("user_id");
      if (r.error) throw r.error;
      if (!(r.data && r.data.length)) return "conflict";
    }
    await AsyncStorage.removeItem(K.force).catch(() => {});
    return "saved";
  }, [apply]);

  const syncNow = useCallback(async () => {
    const u = userRef.current;
    if (!u) return;
    if (inFlight.current) { scheduleRetry(); return; }
    inFlight.current = true;
    const startedAt = Date.now();
    setSync((s) => ({ ...s, state: "syncing" }));
    try {
      const { data: sess } = await sb.auth.getSession();
      const session = sess.session;
      if (!session || !session.expires_at || session.expires_at * 1000 - Date.now() < 120000) {
        const r = await sb.auth.refreshSession();
        if (!r.data.session) throw { authLost: true };
      }
      for (let attempt = 0; ; attempt++) {
        const result = await syncOnce(u.id);
        if (result !== "conflict") break;
        if (attempt >= 4) throw { message: "sync conflict" };
        await new Promise((r) => setTimeout(r, 300 + Math.random() * 700));
      }
      // only clear "unsynced" if nothing new was saved while this sync ran
      if ((await getNum(K.dirty)) <= startedAt) await AsyncStorage.removeItem(K.dirty).catch(() => {});
      await AsyncStorage.setItem(K.last, String(Date.now())).catch(() => {});
      failures.current = 0;
      await refreshSyncFlags("ok");
    } catch (err: any) {
      failures.current++;
      const msg = String((err && (err.message || err.code)) || "");
      const authLost = (err && err.authLost) || /jwt|token|auth|401|403/i.test(msg);
      await refreshSyncFlags(authLost ? "authLost" : "failed");
      scheduleRetry();
    } finally {
      inFlight.current = false;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncOnce, refreshSyncFlags]);

  function scheduleRetry() {
    if (retryTimer.current) clearTimeout(retryTimer.current);
    const delay = Math.min(5 * 60000, 15000 * Math.pow(2, Math.min(failures.current, 4)));
    retryTimer.current = setTimeout(() => { syncNow(); }, delay);
  }

  /* ---------- edits ---------- */
  const update = useCallback((fn: (d: Snapshot, tomb: Tomb) => void, opts?: { forceBackup?: boolean }) => {
    const next = clone(dataRef.current);
    const now = Date.now();
    fn(next, (id) => { if (id) next.tombstones[id] = now; });
    apply(next);
    if (opts && opts.forceBackup) AsyncStorage.setItem(K.force, "1").catch(() => {});
    if (userRef.current) {
      AsyncStorage.setItem(K.dirty, String(now)).catch(() => {});
      setSync((s) => ({ ...s, dirty: true }));
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => { syncNow(); }, 1200);
    }
  }, [apply, syncNow]);

  const restoreBackup = useCallback((snap: any) => {
    // Bring back records from an earlier copy: anything it holds is re-saved as
    // newer than its deletion, so it wins the merge on every device.
    const backup = normaliseSnapshot(stripHistory(snap));
    const now = Date.now();
    const revive = (r: any) => { if (r && r.id) r.updatedAt = now; };
    backup.types.forEach(revive); backup.birthdays.forEach(revive);
    (["shifts", "notes", "leave", "swaps", "payTags"] as const).forEach((k) => {
      Object.keys(backup[k]).forEach((d) => (backup[k] as any)[d].forEach(revive));
    });
    const merged = mergeSnapshots(backup, dataRef.current);
    update((d) => { Object.assign(d, merged); }, { forceBackup: true });
  }, [update]);

  /* ---------- account ---------- */
  const onSignedIn = useCallback(async (u: User) => {
    if (userRef.current && userRef.current.id === u.id) return;
    const owner = await AsyncStorage.getItem(K.owner).catch(() => null);
    if (owner && owner !== u.id) {
      // Another account used this phone before: never mix its data into this one.
      apply(emptySnapshot());
      await AsyncStorage.multiRemove([K.dirty, K.last, K.force]).catch(() => {});
    }
    await AsyncStorage.setItem(K.owner, u.id).catch(() => {});
    await AsyncStorage.removeItem(K.localOnly).catch(() => {});
    userRef.current = u;
    setUser(u);
    setAuth("signedIn");
    syncNow();
  }, [apply, syncNow]);

  const wipeLocal = useCallback(async () => {
    userRef.current = null;
    setUser(null);
    apply(emptySnapshot(), false);
    await AsyncStorage.multiRemove([K.data, K.owner, K.dirty, K.last, K.force, K.localOnly]).catch(() => {});
    setSync({ state: "idle", lastSync: 0, dirty: false });
    setAuth("signedOut");
  }, [apply]);

  const signOut = useCallback(async () => {
    const r = await sb.auth.signOut({ scope: "local" });
    if (r.error) return { ok: false, error: r.error.message };
    await wipeLocal();
    return { ok: true };
  }, [wipeLocal]);

  const deleteAccount = useCallback(async () => {
    const r = await sb.rpc("delete_my_account");
    if (r.error) return { ok: false, error: r.error.message };
    await sb.auth.signOut().catch(() => {});
    await wipeLocal();
    return { ok: true };
  }, [wipeLocal]);

  const useWithoutAccount = useCallback(() => {
    AsyncStorage.setItem(K.localOnly, "1").catch(() => {});
    setAuth("localOnly");
  }, []);

  // From "Use without an account": go to sign-in but keep this phone's roster,
  // which is merged into the account on first sync (same as the web app).
  const showSignIn = useCallback(() => {
    AsyncStorage.removeItem(K.localOnly).catch(() => {});
    setAuth("signedOut");
  }, []);

  const setPrefs = useCallback((p: Partial<Prefs>) => {
    setPrefsState((cur) => {
      const next = { ...cur, ...p };
      AsyncStorage.setItem(K.prefs, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /* ---------- start-up ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [raw, rawPrefs, localOnly] = await Promise.all([
        AsyncStorage.getItem(K.data).catch(() => null),
        AsyncStorage.getItem(K.prefs).catch(() => null),
        AsyncStorage.getItem(K.localOnly).catch(() => null),
      ]);
      if (cancelled) return;
      let snap = emptySnapshot();
      try { if (raw) snap = normaliseSnapshot(JSON.parse(raw)); } catch {}
      pruneTombstones(snap.tombstones);
      apply(snap, false);
      try { if (rawPrefs) setPrefsState({ ...DEFAULT_PREFS, ...JSON.parse(rawPrefs) }); } catch {}
      loaded.current = true;
      await refreshSyncFlags();
      const { data: s } = await sb.auth.getSession().catch(() => ({ data: { session: null } } as any));
      if (cancelled) return;
      if (s && s.session && s.session.user) onSignedIn(s.session.user);
      else setAuth(localOnly === "1" ? "localOnly" : "signedOut");
    })();
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (!loaded.current) return;
      if (session && session.user) onSignedIn(session.user);
      else if (event === "SIGNED_OUT" && userRef.current) wipeLocal();
    });
    const appSub = AppState.addEventListener("change", (s) => { if (s === "active" && userRef.current) syncNow(); });
    return () => { cancelled = true; sub.subscription.unsubscribe(); appSub.remove(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const value = useMemo<Ctx>(() => ({
    data, auth, user, sync, prefs, setPrefs, update, syncNow, useWithoutAccount, showSignIn, signOut, deleteAccount, restoreBackup,
  }), [data, auth, user, sync, prefs, setPrefs, update, syncNow, useWithoutAccount, showSignIn, signOut, deleteAccount, restoreBackup]);

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
