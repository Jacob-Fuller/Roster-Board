// Premium (Apple in-app purchases), same products and limits as the web app's
// iPhone version. Free: calendar, up to 3 shift types, overtime/excess, leave,
// events, birthdays, reminders and cloud backup. Premium unlocks the rest,
// including roster sharing and shift alarms.
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as IAP from "expo-iap";
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Platform } from "react-native";
import { useStore } from "./store";
import { sb } from "./supabase";

export const PREMIUM_MONTHLY = "net.rosterboard.app.premium.monthly";
export const PREMIUM_LIFETIME = "net.rosterboard.app.premium.lifetime";
export const FREE_TYPE_LIMIT = 3;
const KEY = "rosterBoard.premium";

// Free users get the limited version; Premium unlocks the rest. Purchases only
// work once Apple's Paid Apps Agreement is active and both products exist in
// App Store Connect.
export const PREMIUM_ENFORCED = true;

type Status = { active: boolean; kind: "" | "monthly" | "lifetime" | "complimentary"; until: number };
type Ctx = {
  status: Status;
  locked: boolean;
  prices: { monthly: string; lifetime: string };
  paywall: string | null;
  openPaywall: (reason?: string) => void;
  closePaywall: () => void;
  buy: (kind: "monthly" | "lifetime") => Promise<void>;
  restore: () => Promise<boolean>;
  busy: boolean;
  error: string;
};
const PremiumCtx = createContext<Ctx | null>(null);
export const usePremium = () => {
  const c = useContext(PremiumCtx);
  if (!c) throw new Error("usePremium outside PremiumProvider");
  return c;
};

const supported = Platform.OS === "ios";

function statusFrom(purchases: any[]): Status {
  const now = Date.now();
  let next: Status = { active: false, kind: "", until: 0 };
  (purchases || []).forEach((p) => {
    if (p.productId === PREMIUM_LIFETIME) next = { active: true, kind: "lifetime", until: 0 };
    else if (p.productId === PREMIUM_MONTHLY && next.kind !== "lifetime") {
      const exp = p.expirationDateIOS ? +p.expirationDateIOS : 0;
      if (!exp || exp > now) next = { active: true, kind: "monthly", until: exp || now + 86400000 };
    }
  });
  return next;
}

export function PremiumProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>({ active: false, kind: "", until: 0 });
  const [prices, setPrices] = useState({ monthly: "$4.99 / month", lifetime: "$24.99" });
  const [paywall, setPaywall] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const connected = useRef(false);
  // Complimentary Premium: accounts listed in Supabase (complimentary_access),
  // e.g. the owner and family. Managed from the Supabase dashboard.
  const { user } = useStore();
  const [comp, setComp] = useState(false);
  useEffect(() => {
    if (!user) { setComp(false); return; }
    const k = "rosterBoard.comp." + user.id;
    AsyncStorage.getItem(k).then((v) => { if (v === "1") setComp(true); }).catch(() => {});
    sb.from("complimentary_access").select("email").limit(1).then((r) => {
      if (r.error) return; // offline or not set up: keep the last known answer
      const on = !!(r.data && r.data.length);
      setComp(on);
      AsyncStorage.setItem(k, on ? "1" : "0").catch(() => {});
    });
  }, [user]);

  const save = useCallback((s: Status) => { setStatus(s); AsyncStorage.setItem(KEY, JSON.stringify(s)).catch(() => {}); }, []);

  const refresh = useCallback(async () => {
    if (!supported || !connected.current) return;
    try {
      const list = await IAP.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      save(statusFrom((list as any[]) || []));
    } catch {}
  }, [save]);

  useEffect(() => {
    AsyncStorage.getItem(KEY).then((raw) => {
      try { const s = raw ? JSON.parse(raw) : null; if (s && (s.kind === "lifetime" || s.until > Date.now())) setStatus(s); } catch {}
    }).catch(() => {});
    if (!supported) return;
    let subs: { remove: () => void }[] = [];
    (async () => {
      try {
        await IAP.initConnection();
        connected.current = true;
        subs.push(IAP.purchaseUpdatedListener(async (p: any) => {
          try { await IAP.finishTransaction({ purchase: p, isConsumable: false }); } catch {}
          await refresh();
        }));
        subs.push(IAP.purchaseErrorListener(() => {}));
        await refresh();
      } catch {}
    })();
    return () => { subs.forEach((s) => s.remove()); subs = []; IAP.endConnection().catch(() => {}); };
  }, [refresh]);

  const loadPrices = useCallback(async () => {
    if (!supported || !connected.current) return;
    try {
      const subsList = ((await IAP.fetchProducts({ skus: [PREMIUM_MONTHLY], type: "subs" })) as any[]) || [];
      const once = ((await IAP.fetchProducts({ skus: [PREMIUM_LIFETIME], type: "in-app" })) as any[]) || [];
      setPrices((p) => ({
        monthly: subsList[0] && subsList[0].displayPrice ? subsList[0].displayPrice + " / month" : p.monthly,
        lifetime: once[0] && once[0].displayPrice ? once[0].displayPrice : p.lifetime,
      }));
    } catch {}
  }, []);

  const openPaywall = useCallback((reason?: string) => { setError(""); setPaywall(reason || ""); loadPrices(); }, [loadPrices]);
  const closePaywall = useCallback(() => setPaywall(null), []);

  const buy = useCallback(async (kind: "monthly" | "lifetime") => {
    if (!supported || busy) return;
    setBusy(true); setError("");
    try {
      if (kind === "monthly") await IAP.requestPurchase({ request: { apple: { sku: PREMIUM_MONTHLY } }, type: "subs" });
      else await IAP.requestPurchase({ request: { apple: { sku: PREMIUM_LIFETIME } }, type: "in-app" });
      // the purchase listener finishes the transaction and refreshes the status
    } catch (e: any) {
      if (!IAP.isUserCancelledError(e)) setError("Purchase didn't go through");
    } finally {
      setBusy(false);
    }
  }, [busy]);

  const restore = useCallback(async () => {
    if (!supported) return false;
    try { await IAP.restorePurchases(); } catch {}
    try {
      const list = await IAP.getAvailablePurchases({ onlyIncludeActiveItemsIOS: true });
      const s = statusFrom((list as any[]) || []);
      save(s);
      return s.active;
    } catch { return false; }
  }, [save]);

  // close the paywall once Premium becomes active
  const effective: Status = comp && !status.active ? { active: true, kind: "complimentary", until: 0 } : status;
  useEffect(() => { if (effective.active) setPaywall(null); }, [effective.active]);

  const value = useMemo<Ctx>(() => ({
    status: effective, prices, paywall, openPaywall, closePaywall, buy, restore, busy, error,
    locked: PREMIUM_ENFORCED && supported && !effective.active,
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [effective.active, effective.kind, effective.until, prices, paywall, openPaywall, closePaywall, buy, restore, busy, error]);

  return <PremiumCtx.Provider value={value}>{children}</PremiumCtx.Provider>;
}
