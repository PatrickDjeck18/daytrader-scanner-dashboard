import { describe, expect, it } from "vitest";
import { isSupportedCryptoSymbol, normalizeBinanceStreamKline, normalizeBinanceStreamTicker, normalizeBinanceStreamTrade, normalizeCryptoSymbol } from "./crypto";

describe("Binance crypto shared normalizers", () => {
  it("normalizes common pair entry formats without accepting malformed symbols", () => {
    expect(normalizeCryptoSymbol(" btc/usdt ")).toBe("BTCUSDT");
    expect(isSupportedCryptoSymbol("BTCUSDT")).toBe(true);
    expect(isSupportedCryptoSymbol("BTC!USDT")).toBe(false);
  });

  it("maps real-time ticker fields without inventing missing values", () => {
    const quote = normalizeBinanceStreamTicker({ s: "BTCUSDT", c: "65000.2", b: "65000.1", a: "65000.3", P: "2.4", h: "65800", l: "63100", v: "100", q: "6500000", w: "64500", E: 123 }, "global-spot");
    expect(quote).toMatchObject({ symbol: "BTCUSDT", availability: "live", price: 65000.2, changePct: 2.4, bid: 65000.1, ask: 65000.3, lastUpdated: 123 });
    expect(normalizeBinanceStreamTicker({ s: "BTCUSDT", c: "not-a-number" }, "global-spot")).toBeUndefined();
  });

  it("maps aggregate trades and current kline updates", () => {
    expect(normalizeBinanceStreamTrade({ s: "ETHUSDT", a: 7, p: "3000", q: "0.5", T: 456, m: true })).toEqual({ id: "7", symbol: "ETHUSDT", price: 3000, quantity: 0.5, timestamp: 456, buyerIsMaker: true });
    expect(normalizeBinanceStreamKline({ s: "ETHUSDT", k: { t: 60, T: 119, o: "1", h: "3", l: "0.5", c: "2", v: "4", q: "8", x: false } })).toEqual({ symbol: "ETHUSDT", start: 60, end: 119, open: 1, high: 3, low: 0.5, close: 2, volume: 4, quoteVolume: 8, closed: false });
  });
});
