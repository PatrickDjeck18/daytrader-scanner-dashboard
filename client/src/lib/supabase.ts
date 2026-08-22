import { createClient, type Session } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const publishableKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

if (!url || !publishableKey) {
  throw new Error("Supabase authentication configuration is unavailable");
}

export const supabase = createClient(url, publishableKey, {
  auth: {
    autoRefreshToken: true,
    detectSessionInUrl: true,
    flowType: "pkce",
    persistSession: true,
    storageKey: "arcane-monitor-supabase-auth",
  },
});

let accessToken: string | undefined;
void supabase.auth.getSession().then(({ data }) => { accessToken = data.session?.access_token; });
supabase.auth.onAuthStateChange((_event, session: Session | null) => { accessToken = session?.access_token; });

export function getSupabaseAccessToken() { return accessToken; }
