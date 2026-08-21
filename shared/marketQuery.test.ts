import { describe, expect, it } from "vitest";
import { MARKET_QUERY_OPTIONS } from "./marketQuery";

describe("market query options", () => {
  it("does not retry denied provider requests", () => {
    expect(MARKET_QUERY_OPTIONS.retry).toBe(false);
    expect(MARKET_QUERY_OPTIONS.refetchInterval).toBe(15000);
  });
});
