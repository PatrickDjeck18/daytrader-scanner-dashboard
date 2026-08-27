import { afterEach, describe, expect, it, vi } from "vitest";
import { massiveNews, massiveProvider, normalizeRestSnapshot, resetBarsRateLimitForTests } from "./massive";

describe("Massive documented REST shapes", () => {
  afterEach(() => { vi.unstubAllGlobals(); resetBarsRateLimitForTests(); });

  it("normalizes the documented snapshot envelope with quote, trade, day, and minute fields", () => {
    const result = normalizeRestSnapshot({ ticker: { ticker: "IONQ", lastQuote: { bid: 40.1, ask: 40.2 }, lastTrade: { price: 40.15, sip_timestamp: 1_700_000_000_000_000_000 }, min: { vw: 40.05 }, day: { h: 41, l: 38, c: 40, v: 2_000_000, vw: 39.8 }, todaysChangePerc: 4.2, updated: 1_700_000_000_000_000_000 } }, "IONQ");
    expect(result).toMatchObject({ symbol: "IONQ", price: 40.15, bid: 40.1, ask: 40.2, changePct: 4.2, volume: 2_000_000, vwap: 39.8, sessionHigh: 41, sessionLow: 38, source: "massive" });
  });

  it("uses the documented trades query parameters", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ results: [{ price: 40.15, size: 100, participant_timestamp: 1_700_000_000_000_000_000 }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const result = await massiveProvider.getTrades("IONQ", "2026-08-21", "2026-08-21");
    expect(result[0]).toMatchObject({ symbol: "IONQ", price: 40.15, size: 100 });
    const requested = String(fetchMock.mock.calls[0]?.[0]);
    expect(requested).toContain("timestamp=2026-08-21");
    expect(requested).toContain("order=asc");
    expect(requested).toContain("sort=timestamp");
    expect(requested).not.toContain("timestamp.gte");
  });

  it("normalizes documented aggregate bars and news result envelopes", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ o: 40, c: 41, h: 42, l: 39, v: 5000, vw: 40.5, t: 1_700_000_000_000 }] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ results: [{ id: "n1", title: "IonQ update", article_url: "https://example.com/n1", published_utc: "2026-08-21T12:00:00Z", tickers: ["IONQ"], publisher: { name: "Example" } }] }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const bars = await massiveProvider.getBars("IONQ", "2026-08-21", "2026-08-21");
    expect(bars[0]).toMatchObject({ symbol: "IONQ", open: 40, close: 41, high: 42, low: 39, volume: 5000, vwap: 40.5 });
    const news = await massiveNews("IONQ", 1);
    expect(news[0]).toMatchObject({ id: "n1", title: "IonQ update", tickers: ["IONQ"], publisher: { name: "Example" } });
  });

  it("returns an empty delayed chart result and cools down after a bars rate limit", async () => {
    process.env.MASSIVE_API_KEY = "test-key";
    const fetchMock = vi.fn().mockResolvedValue(new Response("rate limited", { status: 429 }));
    vi.stubGlobal("fetch", fetchMock);
    await expect(massiveProvider.getBars("SMCI", "2026-08-22", "2026-08-22")).resolves.toEqual([]);
    await expect(massiveProvider.getBars("SMCI", "2026-08-22", "2026-08-22")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
