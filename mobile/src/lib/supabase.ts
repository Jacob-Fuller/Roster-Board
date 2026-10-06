import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";
import { AppState, Platform } from "react-native";

// Same Supabase project as the web app, so accounts and data are shared.
// The publishable key is meant to be public; access is protected by row-level security.
export const SUPABASE_URL = "https://ebwfzcbynbsucrjnlumg.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable__cG1svz5wKzy7JyK7PSM0A_IdPBC-ey";
export const WEB_URL = "https://www.rosterboard.net/";

export const sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: Platform.OS === "web" ? undefined : AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});

// Phones suspend apps in the background, so only keep refreshing the login
// while the app is open; it refreshes again as soon as it comes back.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (s) => {
    if (s === "active") sb.auth.startAutoRefresh();
    else sb.auth.stopAutoRefresh();
  });
}
