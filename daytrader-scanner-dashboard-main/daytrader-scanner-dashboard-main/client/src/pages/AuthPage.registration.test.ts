import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("registration-free authentication page", () => {
  it("does not expose or call a self-service sign-up flow, while retaining password recovery", () => {
    const source = readFileSync(new URL("./AuthPage.tsx", import.meta.url), "utf8");
    expect(source).not.toContain("auth.signUp");
    expect(source).not.toContain("Create an account");
    expect(source).toContain("resetPasswordForEmail");
    expect(source).toContain("Forgot password?");
  });
});
