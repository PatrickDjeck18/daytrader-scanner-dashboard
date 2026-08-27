import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchFinnhubQuote, finnhubNews, finnhubProvider } from "./finnhub";

afterEach(() => vi.unstubAllGlobals());

describe("Finnhub failure handling", () => {
  it("returns an unavailable quote for an HTTP denial", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    const quote = await fetchFinnhubQuote("AAPL", "test-token");
    expect(quote.source).toBe("unavailable");
    expect(quote.providerError).toContain("403");
  });

  it("returns an unavailable quote for a network failure", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new Error("network down"); }));
    const quote = await fetchFinnhubQuote("AAPL", "test-token");
    expect(quote.source).toBe("unavailable");
    expect(quote.providerError).toContain("network down");
  });

  it("surfaces candle and news errors for router fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    await expect(finnhubProvider.getBars("AAPL", "2026-08-20", "2026-08-21")).rejects.toThrow("403");
    await expect(finnhubNews("AAPL", "2026-08-20", "2026-08-21")).rejects.toThrow("403");
  });
});
