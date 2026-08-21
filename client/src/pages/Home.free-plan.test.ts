import { describe, expect, it } from "vitest";
import { getFreePlanUiState, getNewsItemKey, getProviderAwareScannerRows, getScannerDataNotice, getVisibleScannerRows, isFreshProviderRateLimit, isProviderAwareScannerEligible, providerQuoteToStock, quoteUniverse, shouldApplyOptionalScannerFilters } from "./Home";

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
