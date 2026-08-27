import { afterEach, describe, expect, it, vi } from "vitest";
import { getSupabaseAuthConfig } from "./supabase-auth";

describe("Supabase Auth client configuration", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("uses only the explicit project-specific server anon key for token verification", () => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SERVER_ANON_KEY", "legacy-project-anon-jwt");
    vi.stubEnv("SUPABASE_ANON_KEY", "unrelated-injected-value");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_browser_key");

    expect(getSupabaseAuthConfig()).toEqual({
      url: "https://project-ref.supabase.co",
      publishableKey: "legacy-project-anon-jwt",
    });
  });

  it("authenticates the server anon JWT against the configured project Auth settings", async () => {
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const serverAnonKey = process.env.SUPABASE_SERVER_ANON_KEY;

    expect(baseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(serverAnonKey).toMatch(/^eyJ/);

    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: serverAnonKey! },
    });

    expect(response.ok).toBe(true);
  }, 15_000);

  it("authenticates the project publishable key against the public Auth settings endpoint", async () => {
    const baseUrl = process.env.VITE_SUPABASE_URL;
    const publishableKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    expect(baseUrl).toMatch(/^https:\/\/[a-z0-9-]+\.supabase\.co$/i);
    expect(publishableKey).toMatch(/^(sb_publishable_|eyJ)/);

    const response = await fetch(`${baseUrl}/auth/v1/settings`, {
      headers: { apikey: publishableKey! },
    });

    expect(response.ok).toBe(true);
    const settings = await response.json() as Record<string, unknown>;
    expect(settings).toEqual(expect.any(Object));
  }, 15_000);
});
