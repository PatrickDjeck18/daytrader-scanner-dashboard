import { describe, expect, it } from "vitest";
import { assertRateLimit, isAbortError, requestId } from "./production";

describe("production request controls", () => {
  it("preserves a bounded incoming request id", () => {
    expect(requestId({ headers: { "x-request-id": "req-123" } })).toBe("req-123");
  });
  it("classifies timeout and operation-aborted failures as expected cancellation", () => {
    expect(isAbortError(new DOMException("The operation was aborted", "AbortError"))).toBe(true);
    expect(isAbortError(new Error("This operation was aborted"))).toBe(true);
    expect(isAbortError(new Error("Finnhub returned 429"))).toBe(false);
  });
  it("throws after the configured request budget is exhausted", () => {
    const key = `test-rate-${Date.now()}`;
    assertRateLimit(key, 1, 60_000);
    expect(() => assertRateLimit(key, 1, 60_000)).toThrow(/Rate limit exceeded/);
  });
});
