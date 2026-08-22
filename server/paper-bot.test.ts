import { describe, expect, it } from "vitest";
import { buildRiskManagedPaperOrder, isDailyLossStopped, parseDeepSeekDecisionContent, requestDeepSeekDecision, toUtcDateKey } from "./paper-bot";

const account = { equity: 10_000, buyingPower: 10_000, dailyStartEquity: 10_000, positions: [] };
describe("Binance paper bot risk controls", () => {
  it("sizes a buy by one-percent risk and caps it by simulated exposure", () => expect(buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 99, targetPrice: 104, reason: "paper setup" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 })).toMatchObject({ allowed: true, side: "buy", quantity: 20 }));
  it("blocks invalid stops, duplicate positions, and daily-loss breaches", () => { expect(buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 101, targetPrice: 104, reason: "bad stop" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 }).allowed).toBe(false); expect(isDailyLossStopped({ ...account, equity: 9_700 }, 3)).toBe(true); });
  it("uses a stable UTC daily anchor", () => expect(toUtcDateKey(new Date("2026-08-22T23:30:00.000Z"))).toBe("2026-08-22"));
  it("accepts only structured DeepSeek paper decisions", async () => {
    const decision = await requestDeepSeekDecision({ symbol: "BTCUSDT", marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "hold", symbol: "BTCUSDT", confidence: .62, stopPrice: null, targetPrice: null, reason: "Simulated context is indecisive" }) } }] }), { status: 200 }) });
    expect(decision).toMatchObject({ action: "hold", symbol: "BTCUSDT" });
  });
  it("returns a no-trade decision when the completion API has empty content", async () => {
    const decision = await requestDeepSeekDecision({ symbol: "BTCUSDT", marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }) });
    expect(decision).toMatchObject({ action: "hold", symbol: "BTCUSDT", confidence: 0 });
    expect(decision.reason).toContain("no decision content");
  });
  it("converts empty, malformed, and truncated DeepSeek content into safe hold decisions", () => {
    for (const content of [undefined, "", "{\"action\":\"buy\"", "not-json"]) {
      const decision = parseDeepSeekDecisionContent(content, "BTCUSDT");
      expect(decision).toMatchObject({ action: "hold", symbol: "BTCUSDT", confidence: 0, stopPrice: null, targetPrice: null });
      expect(decision.reason).toContain("no simulated order");
    }
  });
});
