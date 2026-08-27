import { describe, expect, it } from "vitest";
import {
  acknowledgeAlert,
  applyPreset,
  defaultThresholds,
  dedupeAlerts,
  meetsBaseFilters,
  scanHighOfDayBreakout,
  scanRelativeVolume,
  scanTopGainers,
  toggleAlertsMuted,
  toggleWatchlist,
  type MarketDataProvider,
  type MarketQuote,
} from "../shared/scanner";

const quote = (overrides: Partial<MarketQuote> = {}): MarketQuote => ({
  symbol: "TEST", price: 10, bid: 9.99, ask: 10.01, changePct: 8, volume: 2_000_000, rvol: 4, floatM: 100, marketCapM: 1000, dollarVolumeM: 20, vwap: 9.4, sessionHigh: 10, sessionLow: 8, halted: false, lastUpdated: Date.now(), ...overrides,
});

describe("scanner architecture", () => {
  it("supports a swappable quote provider contract", async () => {
    const provider: MarketDataProvider = { getQuotes: async symbols => symbols.map(symbol => quote({ symbol })), subscribe: () => () => undefined };
    expect((await provider.getQuotes(["AAPL"]))[0]?.symbol).toBe("AAPL");
  });

  it("applies individually configurable base thresholds", () => {
    expect(meetsBaseFilters(quote(), defaultThresholds)).toBe(true);
    expect(meetsBaseFilters(quote({ rvol: 1.2 }), { ...defaultThresholds, minRvol: 2 })).toBe(false);
  });

  it("sorts top gainers and relative volume leaders", () => {
    const rows = [quote({ symbol: "LOW", changePct: 4, rvol: 8 }), quote({ symbol: "HIGH", changePct: 12, rvol: 3 })];
    expect(scanTopGainers(rows).map(q => q.symbol)).toEqual(["HIGH", "LOW"]);
    expect(scanRelativeVolume(rows).map(q => q.symbol)).toEqual(["LOW", "HIGH"]);
  });

  it("detects high-of-day breakouts", () => {
    expect(scanHighOfDayBreakout([quote({ price: 10 })])).toHaveLength(1);
    expect(scanHighOfDayBreakout([quote({ price: 9 })])).toHaveLength(0);
  });

  it("merges named presets without losing unrelated thresholds", () => {
    const next = applyPreset("Low-Float Gappers");
    expect(next.maxFloatM).toBe(500);
    expect(next.maxSpread).toBe(defaultThresholds.maxSpread);
  });
});

describe("alerts and watchlists", () => {
  it("deduplicates alerts by symbol, rule, and value", () => {
    const alerts = [{ symbol: "AAPL", rule: "rvol", value: "4x" }, { symbol: "AAPL", rule: "rvol", value: "4x" }, { symbol: "AAPL", rule: "rvol", value: "5x" }];
    expect(dedupeAlerts(alerts)).toHaveLength(2);
  });

  it("acknowledges only the selected alert", () => {
    const alerts = [{ id: "1", acknowledged: false }, { id: "2", acknowledged: false }];
    expect(acknowledgeAlert(alerts, "1")).toEqual([{ id: "1", acknowledged: true }, { id: "2", acknowledged: false }]);
  });

  it("adds, removes, and mutes watchlist symbols", () => {
    let items = toggleWatchlist([], "AAPL");
    expect(items[0]?.symbol).toBe("AAPL");
    items = toggleAlertsMuted(items, "AAPL");
    expect(items[0]?.alertsMuted).toBe(true);
    expect(toggleWatchlist(items, "AAPL")).toEqual([]);
  });
});
