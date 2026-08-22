import { describe, expect, it } from "vitest";
import { filterDirectorySymbols, getFreePlanUiState, getQuoteRequestSymbols, getNewsItemKey, getPriceDirection, addUniqueWatchlistSymbol, normalizeWatchlistSymbol, getAlertHistoryState, shouldNotifyProviderNews, getProviderAwareScannerRows, getScannerDataNotice, getVisibleScannerRows, isFreshProviderRateLimit, isProviderAwareScannerEligible, providerQuoteToStock, quoteUniverse, shouldApplyOptionalScannerFilters } from "./Home";

describe("free-plan dashboard state", () => {
  it("shows the entitlement banner when live snapshots are unavailable", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true })).toEqual({ banner: "FREE PLAN · REAL-TIME UNAVAILABLE", showSeededMarketValues: false });
  });

  it("never permits seeded market values in live-only mode", () => {
    expect(getFreePlanUiState({ demoMode: false, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(false);
    expect(getFreePlanUiState({ demoMode: true, liveDataReady: false, planRestricted: true }).showSeededMarketValues).toBe(true);
  });

  it("generates unique keys for duplicate-time catalyst items", () => {
    const item = { time: "08:05 PM", symbol: "SMCI" };
    expect(getNewsItemKey(item, 0)).not.toBe(getNewsItemKey(item, 1));
  });

  it("does not apply optional zero-value metrics to Finnhub quote-only scans", () => {
    expect(shouldApplyOptionalScannerFilters("finnhub")).toBe(false);
    expect(shouldApplyOptionalScannerFilters("massive")).toBe(true);
    const quoteOnlyRow = { price: 12, floatM: 0, marketCap: "—", volume: 0, change: 8, rvol: 0, spread: 0.01 };
    const thresholds = { minPrice: 2, minFloat: 0, maxFloat: 500, minMarketCap: 0, minDollarVolume: 1, minChange: 5, minRvol: 3, maxSpread: 0.08 };
    expect(isProviderAwareScannerEligible(quoteOnlyRow, thresholds, "finnhub")).toBe(true);
    const row = { ...quoteOnlyRow, name: "Quote Only", premarket: 0, high: 13, low: 10, vwap: 11, float: "—", catalystType: "Quote" as const, sector: "", catalyst: "", marketCap: "—", color: "#fff", tape: "" };
    expect(getProviderAwareScannerRows([row], "Low-Float Momentum", thresholds, "finnhub")).toHaveLength(1);
    expect(getProviderAwareScannerRows([row], "Relative Volume Leaders", thresholds, "finnhub")).toHaveLength(1);
    expect(getScannerDataNotice("Relative Volume Leaders", "finnhub")).toContain("RVOL UNAVAILABLE");
    expect(getScannerDataNotice("Top Gainers", "finnhub")).toBeUndefined();
  });

  it("expires stale provider rate-limit state", () => {
    const now = Date.parse("2026-08-21T18:00:00.000Z");
    expect(isFreshProviderRateLimit({ lastError: "Finnhub rate limit reached; retry later", updatedAt: now - 30_000 }, now)).toBe(true);
    expect(isFreshProviderRateLimit({ lastError: "Finnhub rate limit reached; retry later", updatedAt: now - 120_000 }, now)).toBe(false);
    expect(isFreshProviderRateLimit({ lastError: "Finnhub rate limit reached; retry later", updatedAt: now - 30_000 }, now + 1)).toBe(true);
  });

  it("searches the full provider directory without exposing quote values", () => {
    const symbols = [{ symbol: "AAPL", description: "Apple Inc." }, { symbol: "AMD", description: "Advanced Micro Devices" }, { symbol: "MSFT", description: "Microsoft Corporation" }];
    expect(filterDirectorySymbols(symbols, "micro")).toEqual([symbols[1], symbols[2]]);
    expect(filterDirectorySymbols(symbols, "", 2)).toHaveLength(2);
  });

  it("allows sound only for new provider-backed news", () => {
    expect(shouldNotifyProviderNews({ demoMode: false, soundEnabled: true, hasNews: true, isError: false })).toBe(true);
    expect(shouldNotifyProviderNews({ demoMode: true, soundEnabled: true, hasNews: true, isError: false })).toBe(false);
    expect(shouldNotifyProviderNews({ demoMode: false, soundEnabled: false, hasNews: true, isError: false })).toBe(false);
    expect(shouldNotifyProviderNews({ demoMode: false, soundEnabled: true, hasNews: false, isError: false })).toBe(false);
    expect(shouldNotifyProviderNews({ demoMode: false, soundEnabled: true, hasNews: true, isError: true })).toBe(false);
  });

  it("tracks alert history open and empty states", () => {
    const alert = { id: 1, symbol: "AAPL", title: "Breakout", detail: "Provider alert", tone: "green" as const, time: "09:30:00", read: false };
    expect(getAlertHistoryState([alert], false)).toBe("closed");
    expect(getAlertHistoryState([alert], true)).toBe("open");
    expect(getAlertHistoryState([], true)).toBe("empty");
  });

  it("normalizes and safely inserts watchlist symbols", () => {
    expect(normalizeWatchlistSymbol("  aapl ")).toBe("AAPL");
    expect(addUniqueWatchlistSymbol(["AAPL"], " aapl ").added).toBe(false);
    expect(addUniqueWatchlistSymbol(["AAPL"], " msft ")).toEqual({ symbols: ["AAPL", "MSFT"], added: true });
    expect(addUniqueWatchlistSymbol([], "not a ticker!").added).toBe(false);
  });

  it("maps price movement to accessible direction states", () => {
    expect(getPriceDirection(2.5)).toBe("up");
    expect(getPriceDirection(-1.25)).toBe("down");
    expect(getPriceDirection(0)).toBe("flat");
    expect(getPriceDirection(undefined)).toBe("unavailable");
  });

  it("keeps a selected directory ticker inside the ten-symbol quote cap", () => {
    const requested = getQuoteRequestSymbols("ZZZZ");
    expect(requested).toHaveLength(10);
    expect(requested).toContain("ZZZZ");
  });

  it("requests exactly ten provider symbols", () => {
    expect(quoteUniverse).toHaveLength(10);
    expect(new Set(quoteUniverse).size).toBe(10);
  });

  it("shows more than seven rows and supports showing all eligible rows", () => {
    const rows = Array.from({ length: 20 }, (_, index) => index);
    expect(getVisibleScannerRows(rows, false)).toHaveLength(12);
    expect(getVisibleScannerRows(rows, true)).toHaveLength(20);
    const providerRow = providerQuoteToStock({ symbol: "AAPL", price: 200, changePct: 3.2, volume: 1200000, vwap: 199, sessionHigh: 202, sessionLow: 196, bid: 199.99, ask: 200.01, source: "finnhub", lastUpdated: Date.now() }, 0);
    expect(providerRow.price).toBe(200);
    expect(providerRow.float).toBe("—");
    expect(providerRow.rvol).toBe(0);
  });
});
