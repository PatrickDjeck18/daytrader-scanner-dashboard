import { describe, expect, it } from "vitest";
import { formatQuantityForBinance, getBinanceLiveBaseUrl, signBinanceQuery, validateBinanceLiveCredentials } from "./binance-live";

describe("Binance Live API Client", () => {
  it("generates valid HMAC-SHA256 signature for queries", () => {
    const params = { symbol: "BTCUSDT", side: "BUY", type: "MARKET", timestamp: 1600000000000 };
    const secret = "test_secret_key_12345";
    const signed = signBinanceQuery(params, secret);

    expect(signed).toContain("symbol=BTCUSDT");
    expect(signed).toContain("side=BUY");
    expect(signed).toContain("timestamp=1600000000000");
    expect(signed).toContain("&signature=");
    const signature = signed.split("signature=")[1];
    expect(signature).toHaveLength(64); // SHA-256 hex length
  });

  it("returns correct base URL for testnet vs live", () => {
    expect(getBinanceLiveBaseUrl(false)).toBe("https://api.binance.com");
    expect(getBinanceLiveBaseUrl(true)).toBe("https://testnet.binance.vision");
  });

  it("formats quantities correctly according to symbol step sizes", () => {
    expect(formatQuantityForBinance("BTCUSDT", 0.12345678)).toBe("0.12345");
    expect(formatQuantityForBinance("ETHUSDT", 1.2345678)).toBe("1.2345");
    expect(formatQuantityForBinance("SOLUSDT", 10.5678)).toBe("10.56");
    expect(formatQuantityForBinance("DOGEUSDT", 154.987)).toBe("154");
  });

  it("returns clean error check when API keys are not configured", async () => {
    const prevKey = process.env.BINANCE_API_KEY;
    const prevSecret = process.env.BINANCE_API_SECRET;
    delete process.env.BINANCE_API_KEY;
    delete process.env.BINANCE_API_SECRET;

    const result = await validateBinanceLiveCredentials();
    expect(result.ok).toBe(false);
    expect(result.error).toContain("not configured");

    if (prevKey) process.env.BINANCE_API_KEY = prevKey;
    if (prevSecret) process.env.BINANCE_API_SECRET = prevSecret;
  });
});
