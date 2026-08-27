import { describe, expect, it } from "vitest";
import { extractSupabaseBearerToken, getSupabaseAuthConfig } from "./supabase-auth";

describe("Supabase request authentication", () => {
  it("accepts only a well-formed bearer access token and reads managed public configuration", () => {
    expect(extractSupabaseBearerToken({ authorization: "Bearer session-token" })).toBe("session-token");
    expect(extractSupabaseBearerToken({ authorization: "Basic session-token" })).toBeUndefined();
    expect(extractSupabaseBearerToken({})).toBeUndefined();
    expect(getSupabaseAuthConfig()).toMatchObject({ url: expect.stringMatching(/^https:\/\/.*\.supabase\.co$/), publishableKey: expect.any(String) });
  });
});
