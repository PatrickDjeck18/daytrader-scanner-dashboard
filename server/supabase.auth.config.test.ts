import { describe, expect, it } from "vitest";

describe("Supabase Auth client configuration", () => {
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
