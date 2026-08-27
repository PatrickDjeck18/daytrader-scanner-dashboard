import { describe, expect, it } from "vitest";

describe("DeepSeek managed credential", () => {
  it("authorizes a lightweight models request without exposing the key", async () => {
    const key = process.env.DEEPSEEK_API_KEY;
    expect(key).toBeTruthy();
    const response = await fetch("https://api.deepseek.com/v1/models", {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(10_000),
    });
    expect(response.status).toBe(200);
    const payload = await response.json() as { data?: unknown[] };
    expect(Array.isArray(payload.data)).toBe(true);
  }, 15_000);
});
