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

/**
 * Ensures a fresh, valid Supabase access token is available before returning it.
 *
 * The token is loaded asynchronously on module init (see above), so a
 * user-triggered mutation can fire before the token is attached, causing the
 * server to reject it with UNAUTHED_ERR_MSG and the global redirect handler to
 * bounce the user off the current dashboard. Awaiting this before a mutation
 * closes that race.
 *
 * The cached token can also go stale (Supabase access tokens expire after ~1h).
 * If the session is missing or its access token has expired, we refresh the
 * session so the returned token is always accepted by the server's
 * `client.auth.getUser(token)` check.
 */
export async function ensureSupabaseAccessToken(): Promise<string | undefined> {
  const { data } = await supabase.auth.getSession();
  let session = data.session;
  const expired = session?.expires_at ? session.expires_at * 1000 <= Date.now() : false;
  if (!session || expired) {
    const refreshed = await supabase.auth.refreshSession();
    session = refreshed.data.session ?? null;
  }
  accessToken = session?.access_token;
  return accessToken;
}
