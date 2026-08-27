import { describe, expect, it, vi } from "vitest";
import { normalizeFinnhubCandle, normalizeFinnhubQuote, finnhubProvider } from "./finnhub";

describe("Finnhub adapter", () => {
  it("normalizes a quote without fabricating bid/ask or volume", () => {
    const quote = normalizeFinnhubQuote({ c: 123.45, dp: 2.5, h: 125, l: 119, t: 1_700_000_000 }, "AAPL");
    expect(quote).toMatchObject({ symbol: "AAPL", price: 123.45, bid: 123.45, ask: 123.45, changePct: 2.5, volume: 0, source: "finnhub" });
  });

  it("normalizes Finnhub candle arrays to shared bars", () => {
    const bars = normalizeFinnhubCandle({ s: "ok", t: [1_700_000_000], o: [10], c: [11], h: [12], l: [9], v: [5000], vwap: [10.5] }, "AAPL");
    expect(bars[0]).toMatchObject({ symbol: "AAPL", open: 10, close: 11, high: 12, low: 9, volume: 5000, vwap: 10.5, start: 1_700_000_000_000 });
  });

  it("surfaces unavailable Finnhub trade history for router fallback", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("forbidden", { status: 403 })));
    await expect(finnhubProvider.getTrades("AAPL", "2026-08-21", "2026-08-21")).rejects.toThrow("403");
    vi.unstubAllGlobals();
  });
});
