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
  // Server-side verification requires the legacy anon JWT that belongs to the
  // same Supabase project as VITE_SUPABASE_URL. Do not fall back to generic
  // injected values or the browser publishable key: either can be unrelated or
  // rejected by GoTrue for getUser(), producing "Please login (10001)" for a
  // valid client session.
  const anonKey = process.env.SUPABASE_SERVER_ANON_KEY;
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
