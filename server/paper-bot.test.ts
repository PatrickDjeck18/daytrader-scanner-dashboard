import { describe, expect, it } from "vitest";
import { assessFastMomentumDecision, assessRangeReversionDecision, assessScalpingDecision, attachHoldDiagnostic, buildLearningPaperOrder, buildRiskManagedPaperOrder, coerceLearningDecision, constrainDecisionToConfiguredSymbols, deriveHoldCategory, detectRangeRegime, isDailyLossStopped, parseDeepSeekDecisionContent, rangeInactiveHold, requestDeepSeekDecision, toUtcDateKey } from "./paper-bot";

const account = { equity: 10_000, buyingPower: 10_000, dailyStartEquity: 10_000, positions: [] };
describe("Binance paper bot risk controls", () => {
  it("sizes a buy by one-percent risk and caps it by simulated exposure", () => expect(buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 99, targetPrice: 104, reason: "paper setup" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 })).toMatchObject({ allowed: true, side: "buy", quantity: 20 }));
  it("blocks invalid stops, duplicate positions, and daily-loss breaches", () => { expect(buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 101, targetPrice: 104, reason: "bad stop" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 }).allowed).toBe(false); expect(isDailyLossStopped({ ...account, equity: 9_700 }, 3)).toBe(true); });
  it("uses a stable UTC daily anchor", () => expect(toUtcDateKey(new Date("2026-08-22T23:30:00.000Z"))).toBe("2026-08-22"));
  it("accepts only structured DeepSeek paper decisions", async () => {
    const decision = await requestDeepSeekDecision({ configuredSymbols: ["BTCUSDT", "ETHUSDT"], marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "hold", symbol: "BTCUSDT", confidence: .62, stopPrice: null, targetPrice: null, reason: "Simulated context is indecisive" }) } }] }), { status: 200 }) });
    expect(decision).toMatchObject({ action: "hold", symbol: "BTCUSDT" });
  });
  it("returns a no-trade decision when the completion API has empty content", async () => {
    const decision = await requestDeepSeekDecision({ configuredSymbols: ["BTCUSDT", "ETHUSDT"], marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }) });
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
  it("normalizes multi-symbol and external-pair decisions into a configured-pair hold instead of an out-of-universe rejection", () => {
    const configured = ["BTCUSDT", "ETHUSDT", "SOLUSDT"];
    const multiSymbol = constrainDecisionToConfiguredSymbols({ action: "hold", symbol: "BTCUSDT,ETHUSDT,SOLUSDT", confidence: 0, stopPrice: null, targetPrice: null, reason: "bad output" }, configured);
    const externalPair = constrainDecisionToConfiguredSymbols({ action: "buy", symbol: "XRPUSDT", confidence: .9, stopPrice: 1, targetPrice: 2, reason: "external pair" }, configured);
    expect(multiSymbol).toMatchObject({ action: "hold", symbol: "BTCUSDT", confidence: 0 });
    expect(externalPair).toMatchObject({ action: "hold", symbol: "BTCUSDT", confidence: 0 });
    expect(externalPair.reason).toContain("exactly one configured pair");
  });
  it("requires 1m momentum, 5m/15m confirmation, controlled stop distance, and reward-to-risk for scalping buys", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "paper scalp" };
    const context = { oneMinute: { bars: 40, changePct: .12 }, fiveMinute: { bars: 40, changePct: .2 }, fifteenMinute: { bars: 40, changePct: .4 } };
    expect(assessScalpingDecision({ decision, markPrice: 100, context }).allowed).toBe(true);
    expect(assessScalpingDecision({ decision, markPrice: 100, context: { ...context, fiveMinute: { bars: 40, changePct: -.1 } } }).allowed).toBe(false);
    expect(assessScalpingDecision({ decision: { ...decision, stopPrice: 98 }, markPrice: 100, context }).allowed).toBe(false);
    expect(assessScalpingDecision({ decision: { ...decision, targetPrice: 100.2 }, markPrice: 100, context }).allowed).toBe(false);
  });
  it("separates conflict and low-volatility holds while allowing faster two-of-three confirmation only in Fast Momentum mode", () => {
    const conflict = { oneMinute: { bars: 40, changePct: .12 }, fiveMinute: { bars: 40, changePct: -.08 }, fifteenMinute: { bars: 40, changePct: .15 } };
    const quiet = { oneMinute: { bars: 40, changePct: .01 }, fiveMinute: { bars: 40, changePct: -.01 }, fifteenMinute: { bars: 40, changePct: .02 } };
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "paper strategy" };
    expect(deriveHoldCategory(conflict)).toBe("timeframe_conflict");
    expect(deriveHoldCategory(quiet)).toBe("low_volatility");
    expect(attachHoldDiagnostic({ action: "hold", symbol: "BTCUSDT", confidence: 0, stopPrice: null, targetPrice: null, reason: "wait" }, quiet).holdCategory).toBe("low_volatility");
    expect(assessScalpingDecision({ decision, markPrice: 100, context: conflict }).allowed).toBe(false);
    expect(assessFastMomentumDecision({ decision, markPrice: 100, context: conflict }).allowed).toBe(true);
  });
  it("keeps Range Reversion paper-only and requires a contained higher-timeframe range plus a meaningful one-minute pullback", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "range paper setup" };
    const range = { oneMinute: { bars: 40, changePct: -.12 }, fiveMinute: { bars: 40, changePct: .08 }, fifteenMinute: { bars: 40, changePct: -.1 } };
    expect(assessRangeReversionDecision({ decision, markPrice: 100, context: range }).allowed).toBe(true);
    expect(assessRangeReversionDecision({ decision, markPrice: 100, context: { ...range, oneMinute: { bars: 40, changePct: .01 } } }).allowed).toBe(false);
    expect(assessRangeReversionDecision({ decision, markPrice: 100, context: { ...range, fifteenMinute: { bars: 40, changePct: 1 } } }).allowed).toBe(false);
  });
  it("marks range mode inactive in a trending regime rather than representing it as an unexplained hold", () => {
    const trend = { oneMinute: { bars: 40, changePct: .15 }, fiveMinute: { bars: 40, changePct: .52 }, fifteenMinute: { bars: 40, changePct: .84 } };
    expect(detectRangeRegime(trend)).toBe("trend");
    expect(rangeInactiveHold("BTCUSDT", "trend")).toMatchObject({ action: "hold", holdCategory: "no_qualified_setup" });
    expect(rangeInactiveHold("BTCUSDT", "trend").reason).toContain("mode inactive");
  });
  it("uses a valid provider mark to demonstrate the paper lifecycle in Learning Mode when the model returns hold", () => {
    const held = { action: "hold" as const, symbol: "BTCUSDT", confidence: 0, stopPrice: null, targetPrice: null, reason: "Mixed context" };
    const entry = coerceLearningDecision({ decision: held, markPrice: 100, hasPosition: false });
    expect(entry).toMatchObject({ action: "buy", learningFallback: true, stopPrice: 99, targetPrice: 101 });
    expect(buildLearningPaperOrder({ decision: entry, markPrice: 100, account })).toMatchObject({ allowed: true, side: "buy", quantity: 10 });
    const exit = coerceLearningDecision({ decision: held, markPrice: 100, hasPosition: true });
    expect(exit).toMatchObject({ action: "sell", learningFallback: true });
    expect(buildLearningPaperOrder({ decision: exit, markPrice: 100, account: { ...account, positions: [{ symbol: "BTCUSDT", quantity: 10, averageCost: 100 }] } })).toMatchObject({ allowed: true, side: "sell", quantity: 10 });
  });
});
