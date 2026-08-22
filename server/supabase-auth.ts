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
  const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  return url && publishableKey ? { url, publishableKey } : undefined;
}

export async function authenticateSupabaseRequest(headers: Record<string, unknown>): Promise<User | null> {
  const token = readBearerToken(headers);
  const config = getSupabaseAuthConfig();
  if (!token || !config) return null;
  const client = createClient(config.url, config.publishableKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const { data, error } = await client.auth.getUser(token);
  if (error || !data.user) return null;
  const rawName = data.user.user_metadata?.full_name ?? data.user.user_metadata?.name;
  const name = typeof rawName === "string" && rawName.length <= 240 ? rawName : null;
  return upsertSupabaseAuthUser({ authId: data.user.id, email: data.user.email ?? null, name });
}

export function extractSupabaseBearerToken(headers: Record<string, unknown>) { return readBearerToken(headers); }
