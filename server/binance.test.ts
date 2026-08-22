import { describe, expect, it } from "vitest";
import { normalizeBinanceAggregateTrades, normalizeBinanceRestKlines, normalizeBinanceRestTicker } from "./binance";

describe("Binance public REST normalization", () => {
  it("maps a 24-hour ticker from a public venue without equity-only fields", () => {
    const quote = normalizeBinanceRestTicker({ symbol: "BTCUSDT", lastPrice: "65000.20", bidPrice: "65000.10", askPrice: "65000.30", priceChangePercent: "1.75", highPrice: "65500", lowPrice: "63500", volume: "120", quoteVolume: "7800000", weightedAvgPrice: "64600", closeTime: 1000 }, "global-spot", "BTCUSDT");
    expect(quote).toMatchObject({ market: "global-spot", symbol: "BTCUSDT", availability: "live", price: 65000.2, changePct: 1.75, baseVolume: 120, quoteVolume: 7800000 });
  });

  it("returns only complete provider-returned kline rows", () => {
    const bars = normalizeBinanceRestKlines([[100, "1", "3", "0.5", "2", "4", 159, "8"], [200, "bad", "3", "0.5", "2", "4", 259, "8"]], "ETHUSDT");
    expect(bars).toHaveLength(1);
    expect(bars[0]).toMatchObject({ symbol: "ETHUSDT", start: 100, open: 1, high: 3, low: 0.5, close: 2, volume: 4, quoteVolume: 8 });
  });

  it("maps provider aggregate trades and rejects incomplete trade payloads", () => {
    expect(normalizeBinanceAggregateTrades([{ a: 8, p: "200", q: "2", T: 500, m: false }, { a: 9, p: "bad", q: "2", T: 501 }], "SOLUSDT")).toEqual([{ id: "8", symbol: "SOLUSDT", price: 200, quantity: 2, timestamp: 500, buyerIsMaker: false }]);
  });
});
