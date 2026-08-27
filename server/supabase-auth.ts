import { createClient } from "@supabase/supabase-js";
import type { User } from "../drizzle/schema";
import { upsertSupabaseAuthUser } from "./db";

function readBearerToken(headers: Record<string, unknown>) {
  const value = headers.authorization;
  if (typeof value !== "string") return undefined;
  const match = value.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

export function getSupabaseAuthConfig() {
  const url = process.env.VITE_SUPABASE_URL;
  // Server-side token verification must use the anon key (a JWT), not the
  // client-side publishable key (`sb_publishable_...`). The publishable key is
  // only authorized for browser-side Auth operations; GoTrue rejects it for
  // server-side `getUser()` calls, which surfaces as "Please login (10001)" even
  // when the client sends a valid, non-expired access token.
  const anonKey = process.env.SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && anonKey ? { url, publishableKey: anonKey } : undefined;
}

export async function authenticateSupabaseRequest(headers: Record<string, unknown>): Promise<User | null> {
  const token = readBearerToken(headers);
  const config = getSupabaseAuthConfig();
  if (!token || !config) {
    return null;
  }
  const client = createClient(config.url, config.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) {
    return null;
  }
  const rawName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
  const name = typeof rawName === "string" && rawName.length <= 240 ? rawName : null;
  try {
    return await upsertSupabaseAuthUser({ authId: data.user.id, email: data.user.email ?? null, name });
  } catch (dbError) {
    // The Supabase token is valid, but the application database is unavailable
    // (e.g. SUPABASE_DATABASE_URL is not configured). Do not let the DB sync
    // failure masquerade as an authentication failure ("Please login (10001)").
    // Return a synthetic user so the caller is authenticated; DB-backed
    // procedures will surface their own clear "Database unavailable" error.
    console.warn("[auth] Supabase token valid but user sync failed; using fallback user", { error: dbError instanceof Error ? dbError.message : String(dbError) });
    const now = new Date();
    return {
      id: -1,
      openId: data.user.id,
      name,
      email: data.user.email ?? null,
      loginMethod: "supabase",
      role: "user",
      createdAt: now,
      updatedAt: now,
      lastSignedIn: now,
    };
  }
}

export function extractSupabaseBearerToken(headers: Record<string, unknown>) { return readBearerToken(headers); }
