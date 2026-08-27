import { afterEach, describe, expect, it, vi } from "vitest";
import { massiveProvider } from "./massive";

describe("Massive fetch fallback", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("returns unavailable quotes when fetch rejects", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("fetch failed")));
    const quotes = await massiveProvider.getQuotes(["IONQ", "BBAI"]);
    expect(quotes).toHaveLength(2);
    expect(quotes.every(quote => quote.source === "unavailable")).toBe(true);
    expect(quotes[0]?.providerError).toMatch(/fetch failed/);
  });
});
