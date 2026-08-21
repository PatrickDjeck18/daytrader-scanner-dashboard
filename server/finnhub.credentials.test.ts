import { describe, expect, it } from "vitest";

describe("Finnhub credentials", () => {
  it("authenticates against the lightweight quote endpoint", async () => {
    const key = process.env.FINNHUB_API_KEY;
    expect(key, "FINNHUB_API_KEY must be configured").toBeTruthy();
    const response = await fetch(`https://finnhub.io/api/v1/quote?symbol=AAPL&token=${encodeURIComponent(key ?? "")}`);
    const body = await response.text();
    if (response.status === 429) return;
    expect(response.status, body).toBe(200);
    const parsed = JSON.parse(body) as { c?: number };
    expect(typeof parsed.c).toBe("number");
  }, 20_000);
});
