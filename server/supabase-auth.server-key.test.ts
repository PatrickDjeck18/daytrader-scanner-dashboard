import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getUser, createClient, upsertSupabaseAuthUser } = vi.hoisted(() => {
  const getUser = vi.fn();
  return {
    getUser,
    createClient: vi.fn(() => ({ auth: { getUser } })),
    upsertSupabaseAuthUser: vi.fn(),
  };
});

vi.mock("@supabase/supabase-js", () => ({ createClient }));
vi.mock("./db", () => ({ upsertSupabaseAuthUser }));

import { authenticateSupabaseRequest } from "./supabase-auth";

describe("Supabase server token verification", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_SUPABASE_URL", "https://project-ref.supabase.co");
    vi.stubEnv("SUPABASE_SERVER_ANON_KEY", "legacy-project-anon-jwt");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "sb_publishable_browser_key");
    getUser.mockResolvedValue({
      data: { user: { id: "auth-user-1", email: "user@example.com", user_metadata: { name: "User" } } },
      error: null,
    });
    upsertSupabaseAuthUser.mockResolvedValue({ id: 1, openId: "auth-user-1", role: "user" });
  });

  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("verifies a bearer access token with the dedicated server key", async () => {
    const user = await authenticateSupabaseRequest({ authorization: "Bearer active-session-token" });

    expect(createClient).toHaveBeenCalledWith(
      "https://project-ref.supabase.co",
      "legacy-project-anon-jwt",
      expect.objectContaining({ auth: { autoRefreshToken: false, persistSession: false } }),
    );
    expect(getUser).toHaveBeenCalledWith("active-session-token");
    expect(user).toMatchObject({ id: 1, openId: "auth-user-1", role: "user" });
  });
});
