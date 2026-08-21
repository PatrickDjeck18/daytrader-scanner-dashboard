import { describe, expect, it } from "vitest";
import { assertRateLimit, requestId } from "./production";

describe("production request controls", () => {
  it("preserves a bounded incoming request id", () => {
    expect(requestId({ headers: { "x-request-id": "req-123" } })).toBe("req-123");
  });
  it("throws after the configured request budget is exhausted", () => {
    const key = `test-rate-${Date.now()}`;
    assertRateLimit(key, 1, 60_000);
    expect(() => assertRateLimit(key, 1, 60_000)).toThrow(/Rate limit exceeded/);
  });
});
