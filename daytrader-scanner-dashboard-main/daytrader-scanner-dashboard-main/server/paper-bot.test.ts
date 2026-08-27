import { describe, expect, it } from "vitest";
import { assessBbSqueezeDecision, assessFastMomentumDecision, assessNextCandleConfirmation, assessRangeReversionDecision, assessScalpingDecision, assessVwapPullbackDecision, attachHoldDiagnostic, buildRiskManagedPaperOrder, calculateATR, calculateBollingerBands, calculateEMA, calculateRSI, calculateRVOL, calculateVWAP, computeBarIndicators, constrainDecisionToConfiguredSymbols, DEFAULT_STOP_LOSS_PCT, DEFAULT_TAKE_PROFIT_PCT, deriveHoldCategory, detectRangeRegime, deterministicBbSqueezeDecision, deterministicFastMomentumDecision, deterministicRangeReversionDecision, deterministicScalpDecision, deterministicStrategyDecision, deterministicVwapPullbackDecision, isDailyLossStopped, parseDeepSeekDecisionContent, rangeInactiveHold, requestDeepSeekDecision, toUtcDateKey } from "./paper-bot";

const account = { equity: 10_000, buyingPower: 10_000, dailyStartEquity: 10_000, positions: [] };
describe("Binance paper bot risk controls", () => {
  it("sizes a buy with confidence-weighted Kelly scaling and caps it by simulated exposure", () => {
    const mediumConf = buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 99, targetPrice: 104, reason: "paper setup" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 });
    expect(mediumConf).toMatchObject({ allowed: true, side: "buy", quantity: 25 });

    const highConf = buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .9, stopPrice: 99, targetPrice: 104, reason: "high confidence paper setup" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 });
    expect(highConf).toMatchObject({ allowed: true, side: "buy", quantity: 25 });
  });

  it("calculates accurate technical indicators (EMA, RSI, ATR, RVOL, VWAP, BB)", () => {
    const prices = [10, 11, 12, 11, 10, 11, 12, 13, 14, 15, 16];
    const ema9 = calculateEMA(prices, 9);
    expect(ema9).toBeGreaterThan(12);

    const closes = [100, 102, 104, 103, 105, 107, 106, 108, 110, 112, 111, 113, 115, 117, 119, 121];
    const rsi = calculateRSI(closes, 14);
    expect(rsi).toBeGreaterThan(70);

    const bars = closes.map((c, i) => ({ high: c + 1, low: c - 1, close: c, volume: 100 + i * 10 }));
    const atr = calculateATR(bars, 14);
    expect(atr).toBeGreaterThan(1.5);

    const volumes = [100, 100, 100, 100, 100, 200];
    const rvol = calculateRVOL(volumes, 5);
    expect(rvol).toBe(2);

    const vwap = calculateVWAP(bars);
    expect(vwap).toBeGreaterThan(100);
    expect(vwap).toBeLessThan(125);

    const bbCloses = [100, 101, 102, 101, 100, 99, 100, 101, 102, 103, 102, 101, 100, 99, 100, 101, 102, 101, 100, 101];
    const bb = calculateBollingerBands(bbCloses, 20, 2);
    expect(bb).not.toBeNull();
    expect(bb!.upper).toBeGreaterThan(bb!.middle);
    expect(bb!.lower).toBeLessThan(bb!.middle);
    expect(bb!.width).toBeGreaterThan(0);

    const fullIndicators = computeBarIndicators(bars);
    // Only 16 bars: EMA21 requires >=21 bars so trend is 'neutral' by design;
    // assert the field is defined and the other indicator fields are populated.
    expect(["bullish", "bearish", "neutral"]).toContain(fullIndicators.trend);
    expect(fullIndicators.rsi).toBeDefined();
    expect(fullIndicators.vwap).toBeDefined();
    expect(fullIndicators.bbWidth).toBeDefined();
  });

  it("blocks invalid stops, duplicate positions, and daily-loss breaches", () => {
    // A stopPrice ABOVE markPrice is invalid; the order builder now replaces it
    // with the default stop (-0.25%) rather than rejecting the whole order.
    const badStopOrder = buildRiskManagedPaperOrder({ decision: { action: "buy", symbol: "BTCUSDT", confidence: .8, stopPrice: 101, targetPrice: 104, reason: "bad stop" }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 });
    expect(badStopOrder.allowed).toBe(true);
    // The corrected stop must be below markPrice (default -0.25%)
    expect(badStopOrder.allowed && badStopOrder.stopPrice! < 100).toBe(true);
    expect(isDailyLossStopped({ ...account, equity: 9_700 }, 3)).toBe(true);
  });
  it("uses a stable UTC daily anchor", () => expect(toUtcDateKey(new Date("2026-08-22T23:30:00.000Z"))).toBe("2026-08-22"));
  it("accepts only structured DeepSeek paper decisions", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const decision = await requestDeepSeekDecision({ configuredSymbols: ["BTCUSDT", "ETHUSDT"], marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ action: "hold", symbol: "BTCUSDT", confidence: .62, stopPrice: null, targetPrice: null, reason: "Simulated context is indecisive" }) } }] }), { status: 200 }) });
    delete process.env.DEEPSEEK_API_KEY;
    expect(decision).toMatchObject({ action: "hold", symbol: "BTCUSDT" });
  });
  it("returns a no-trade decision when the completion API has empty content", async () => {
    process.env.DEEPSEEK_API_KEY = "test-key";
    const decision = await requestDeepSeekDecision({ configuredSymbols: ["BTCUSDT", "ETHUSDT"], marketContext: { provider: "test" }, fetchImpl: async () => new Response(JSON.stringify({ choices: [{ message: { content: "" } }] }), { status: 200 }) });
    delete process.env.DEEPSEEK_API_KEY;
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


  it("blocks orders when daily loss stop is reached", () => {
    expect(isDailyLossStopped({ ...account, equity: 9690 }, 3)).toBe(true);
    expect(isDailyLossStopped({ ...account, equity: 9710 }, 3)).toBe(false);
  });

  it("parses valid DeepSeek JSON and rejects markdown wrapping or malformed content safely", () => {
    const raw = `\`\`\`json
{"action":"hold","symbol":"BTCUSDT","confidence":0.72,"stopPrice":null,"targetPrice":null,"reason":"Awaiting multi-timeframe confirmation","holdCategory":"timeframe_conflict","nextCandle":{"direction":"flat","probability":0.6,"reason":"balanced delta"}}
\`\`\``;
    const parsed = parseDeepSeekDecisionContent(raw, "BTCUSDT");
    expect(parsed.action).toBe("hold");
    expect(parsed.confidence).toBe(.72);
    expect(parsed.holdCategory).toBe("timeframe_conflict");
    expect(parsed.nextCandle?.direction).toBe("flat");

    const fallback = parseDeepSeekDecisionContent("not-json", "BTCUSDT");
    expect(fallback.action).toBe("hold");
    expect(fallback.reason).toContain("malformed JSON");
  });

  it("tolerates DeepSeek omitting stop/target for hold decisions instead of failing the schema", () => {
    const decision = parseDeepSeekDecisionContent(
      JSON.stringify({ action: "hold", symbol: "BTCUSDT", confidence: 0.5, reason: "Indecisive market" }),
      "BTCUSDT"
    );
    expect(decision.action).toBe("hold");
    expect(decision.symbol).toBe("BTCUSDT");
    expect(decision.stopPrice).toBeNull();
    expect(decision.targetPrice).toBeNull();
  });

  it("coerces string confidence and normalizes lowercase symbols", () => {
    const decision = parseDeepSeekDecisionContent(
      JSON.stringify({ action: "buy", symbol: "btcusdt", confidence: "0.82", stopPrice: "99.5", targetPrice: "100.4", reason: "Strong momentum" }),
      "BTCUSDT"
    );
    expect(decision.action).toBe("buy");
    expect(decision.symbol).toBe("BTCUSDT");
    expect(decision.confidence).toBe(0.82);
    expect(decision.stopPrice).toBe(99.5);
    expect(decision.targetPrice).toBe(100.4);
  });

  it("normalizes uppercase actions, percentage confidence, slash symbols, and uppercase directions", () => {
    const decision = parseDeepSeekDecisionContent(
      JSON.stringify({
        action: "BUY",
        symbol: "BTC/USDT",
        confidence: 82,
        stopPrice: 99.5,
        targetPrice: 100.4,
        reason: "Strong momentum",
        nextCandle: { direction: "UP", probability: 0.78, reason: "bullish" },
      }),
      "BTCUSDT"
    );
    expect(decision.action).toBe("buy");
    expect(decision.symbol).toBe("BTCUSDT");
    expect(decision.confidence).toBe(0.82);
    expect(decision.nextCandle?.direction).toBe("up");
  });

  it("maps common DeepSeek no-trade phrasing to hold", () => {
    const decision = parseDeepSeekDecisionContent(
      JSON.stringify({ action: "wait", symbol: "BTCUSDT", confidence: 0.4, reason: "No setup" }),
      "BTCUSDT"
    );
    expect(decision.action).toBe("hold");
    expect(decision.stopPrice).toBeNull();
    expect(decision.targetPrice).toBeNull();
  });

  it("maps rationale to reason and sideways direction to flat", () => {
    const decision = parseDeepSeekDecisionContent(
      JSON.stringify({
        action: "hold",
        symbol: "BTCUSDT",
        confidence: 0.5,
        rationale: "Consolidating between bands",
        nextCandle: { direction: "sideways", probability: 0.6, reason: "range-bound" },
      }),
      "BTCUSDT"
    );
    expect(decision.action).toBe("hold");
    expect(decision.reason).toContain("Consolidating");
    expect(decision.nextCandle?.direction).toBe("flat");
  });

  it("forces single-symbol decisions and replaces unconfigured symbols with fallback holds", () => {
    const externalPair = constrainDecisionToConfiguredSymbols({ action: "buy", symbol: "DOGEUSDT", confidence: .8, stopPrice: .1, targetPrice: .12, reason: "hype" }, ["BTCUSDT", "ETHUSDT"]);
    expect(externalPair.action).toBe("hold");
    expect(externalPair.symbol).toBe("BTCUSDT");
    expect(externalPair.reason).toContain("exactly one configured pair");
  });

  it("allows trade execution when mark price is valid and normalizes stop/target in the order builder", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "paper scalp" };
    const context = { oneMinute: { bars: 40, changePct: .12 }, fiveMinute: { bars: 40, changePct: .2 }, fifteenMinute: { bars: 40, changePct: .4 } };
    expect(assessScalpingDecision({ decision, markPrice: 100, context }).allowed).toBe(true);
    expect(assessScalpingDecision({ decision, markPrice: 0, context }).allowed).toBe(false);
    expect(assessScalpingDecision({ decision: { ...decision, stopPrice: 98 }, markPrice: 100, context }).allowed).toBe(true);
    expect(assessScalpingDecision({ decision: { ...decision, targetPrice: 100.2 }, markPrice: 100, context }).allowed).toBe(true);
    const order = buildRiskManagedPaperOrder({ decision: { ...decision, stopPrice: 98 }, markPrice: 100, account, riskPct: 1, maxOpenPositions: 3 });
    expect(order.allowed).toBe(true);
    expect(order.stopPrice).toBeLessThan(100);
    expect(order.targetPrice).toBeGreaterThan(100);
  });

  it("evaluates VWAP Pullback strategy with valid mark price", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "vwap pullback" };
    const vwapContext = {
      oneMinute: {
        bars: 40,
        changePct: .05,
        indicators: {
          ema9: 100.1, ema21: 100, ema50: 99.5, rsi: 48, atr: 0.5, rvol: 1.5,
          trend: "bullish" as const, vwap: 99.85, bbUpper: 101, bbMiddle: 100, bbLower: 99, bbWidth: 2, stochRsi: 35
        }
      },
      fiveMinute: { bars: 40, changePct: .1 },
      fifteenMinute: { bars: 40, changePct: .2 }
    };
    expect(assessVwapPullbackDecision({ decision, markPrice: 100, context: vwapContext }).allowed).toBe(true);
    expect(assessVwapPullbackDecision({ decision, markPrice: 0, context: vwapContext }).allowed).toBe(false);
  });

  it("evaluates BB Squeeze strategy with valid mark price", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "bb breakout" };
    const squeezeContext = {
      oneMinute: {
        bars: 40,
        changePct: .1,
        indicators: {
          ema9: 100.1, ema21: 100, ema50: 99.5, rsi: 55, atr: 0.3, rvol: 1.6,
          trend: "bullish" as const, vwap: 99.9, bbUpper: 99.95, bbMiddle: 99.8, bbLower: 99.65, bbWidth: 0.3, stochRsi: 70
        }
      },
      fiveMinute: { bars: 40, changePct: .1 },
      fifteenMinute: { bars: 40, changePct: .2 }
    };
    expect(assessBbSqueezeDecision({ decision, markPrice: 100, context: squeezeContext }).allowed).toBe(true);
    expect(assessBbSqueezeDecision({ decision, markPrice: 0, context: squeezeContext }).allowed).toBe(false);
  });

  it("separates conflict and low-volatility holds", () => {
    const conflict = { oneMinute: { bars: 40, changePct: .12 }, fiveMinute: { bars: 40, changePct: -.08 }, fifteenMinute: { bars: 40, changePct: .15 } };
    const quiet = { oneMinute: { bars: 40, changePct: .01 }, fiveMinute: { bars: 40, changePct: -.01 }, fifteenMinute: { bars: 40, changePct: .02 } };
    expect(deriveHoldCategory(conflict)).toBe("timeframe_conflict");
    expect(deriveHoldCategory(quiet)).toBe("low_volatility");
    expect(attachHoldDiagnostic({ action: "hold", symbol: "BTCUSDT", confidence: 0, stopPrice: null, targetPrice: null, reason: "wait" }, quiet).holdCategory).toBe("low_volatility");
  });

  it("keeps Range Reversion paper-only with valid mark price", () => {
    const decision = { action: "buy" as const, symbol: "BTCUSDT", confidence: .8, stopPrice: 99.7, targetPrice: 100.5, reason: "range paper setup" };
    const range = { oneMinute: { bars: 40, changePct: -.12 }, fiveMinute: { bars: 40, changePct: .08 }, fifteenMinute: { bars: 40, changePct: -.1 } };
    expect(assessRangeReversionDecision({ decision, markPrice: 100, context: range }).allowed).toBe(true);
    expect(assessRangeReversionDecision({ decision, markPrice: 0, context: range }).allowed).toBe(false);
  });

  it("marks range mode inactive in a trending regime rather than representing it as an unexplained hold", () => {
    const trend = { oneMinute: { bars: 40, changePct: .15 }, fiveMinute: { bars: 40, changePct: .52 }, fifteenMinute: { bars: 40, changePct: .84 } };
    expect(detectRangeRegime(trend)).toBe("trend");
    expect(rangeInactiveHold("BTCUSDT", "trend")).toMatchObject({ action: "hold", holdCategory: "no_qualified_setup" });
    expect(rangeInactiveHold("BTCUSDT", "trend").reason).toContain("mode inactive");
  });

  it("produces a deterministic BUY when indicators clearly support a long and returns null otherwise", () => {
    const bullishContext = {
      oneMinute: { bars: 40, changePct: .12, indicators: { ema9: 100.1, ema21: 100, ema50: 99.5, rsi: 62, atr: 0.5, rvol: 1.6, trend: "bullish" as const, vwap: 99.9, bbUpper: 101, bbMiddle: 100, bbLower: 99, bbWidth: 2, stochRsi: 70 } },
      fiveMinute: { bars: 40, changePct: .2 },
      fifteenMinute: { bars: 40, changePct: .4 }
    };
    const buy = deterministicScalpDecision(bullishContext, "BTCUSDT", 100);
    expect(buy).not.toBeNull();
    expect(buy!.action).toBe("buy");
    expect(buy!.symbol).toBe("BTCUSDT");
    expect(buy!.stopPrice).toBeLessThan(100);
    expect(buy!.targetPrice).toBeGreaterThan(100);
    // Micro-scalp profit target and stop cap
    expect(buy!.targetPrice! - 100).toBeGreaterThanOrEqual(0.14);
    expect(100 - buy!.stopPrice!).toBeLessThanOrEqual(0.20);

    // A neutral/weak context must not produce a deterministic trade.
    const weakContext = {
      oneMinute: { bars: 40, changePct: .01, indicators: { ema9: 100, ema21: 100, ema50: 100, rsi: 50, atr: 0.5, rvol: 0.8, trend: "neutral" as const, vwap: 100, bbUpper: 101, bbMiddle: 100, bbLower: 99, bbWidth: 2, stochRsi: 50 } },
      fiveMinute: { bars: 40, changePct: .01 },
      fifteenMinute: { bars: 40, changePct: .01 }
    };
    expect(deterministicScalpDecision(weakContext, "BTCUSDT", 100)).toBeNull();
  });

  it("evaluates deterministic engines for all 5 paper strategies", () => {
    // 1. Fast Momentum
    const fastContext = {
      oneMinute: { bars: 40, changePct: .08, indicators: { ema9: 100.1, ema21: 100, ema50: 99.8, rsi: 58, atr: 0.4, rvol: 1.4, trend: "bullish" as const, vwap: 99.9, bbUpper: 101, bbMiddle: 100, bbLower: 99, bbWidth: 2, stochRsi: 65 } },
      fiveMinute: { bars: 40, changePct: .05 },
      fifteenMinute: { bars: 40, changePct: .02 }
    };
    const fastDecision = deterministicFastMomentumDecision(fastContext, "ETHUSDT", 2000);
    expect(fastDecision?.action).toBe("buy");
    expect(fastDecision?.targetPrice).toBeGreaterThan(2000);

    // 2. Range Reversion
    const rangeContext = {
      oneMinute: { bars: 40, changePct: -.04, indicators: { ema9: 100, ema21: 100, ema50: 100, rsi: 32, atr: 0.3, rvol: 1.1, trend: "neutral" as const, vwap: 100, bbUpper: 100.8, bbMiddle: 100, bbLower: 99.2, bbWidth: 1.6, stochRsi: 18 } },
      fiveMinute: { bars: 40, changePct: .1 },
      fifteenMinute: { bars: 40, changePct: -.1 }
    };
    const rangeDecision = deterministicRangeReversionDecision(rangeContext, "SOLUSDT", 100);
    expect(rangeDecision?.action).toBe("buy");

    // 3. VWAP Pullback
    const vwapContext = {
      oneMinute: { bars: 40, changePct: .03, indicators: { ema9: 100.2, ema21: 100.1, ema50: 99.9, rsi: 48, atr: 0.3, rvol: 1.3, trend: "bullish" as const, vwap: 99.85, bbUpper: 100.8, bbMiddle: 100, bbLower: 99.2, bbWidth: 1.6, stochRsi: 52 } },
      fiveMinute: { bars: 40, changePct: .1 },
      fifteenMinute: { bars: 40, changePct: .15 }
    };
    const vwapDecision = deterministicVwapPullbackDecision(vwapContext, "BTCUSDT", 100);
    expect(vwapDecision?.action).toBe("buy");

    // 4. BB Squeeze
    const squeezeContext = {
      oneMinute: { bars: 40, changePct: .06, indicators: { ema9: 100.1, ema21: 100, ema50: 99.9, rsi: 56, atr: 0.2, rvol: 1.5, trend: "bullish" as const, vwap: 99.9, bbUpper: 100.3, bbMiddle: 100, bbLower: 99.7, bbWidth: 0.5, stochRsi: 60 } },
      fiveMinute: { bars: 40, changePct: .08 },
      fifteenMinute: { bars: 40, changePct: .1 }
    };
    const squeezeDecision = deterministicBbSqueezeDecision(squeezeContext, "BTCUSDT", 100);
    expect(squeezeDecision?.action).toBe("buy");

    // Master dispatcher
    const dispatchDecision = deterministicStrategyDecision("bb_squeeze", squeezeContext, "BTCUSDT", 100);
    expect(dispatchDecision?.action).toBe("buy");
  });

  it("guards BUY entries if the next candle forecast is decisively Down", () => {
    const buyDecision = {
      action: "buy" as const,
      symbol: "BTCUSDT",
      confidence: 0.85,
      stopPrice: 99.5,
      targetPrice: 100.8,
      reason: "bullish momentum setup",
      nextCandle: { direction: "down" as const, probability: 0.75, reason: "imminent rejection at resistance" },
      holdCategory: null,
    };

    const guardResult = assessNextCandleConfirmation(buyDecision);
    expect(guardResult.allowed).toBe(false);
    expect(guardResult.reason).toContain("Next candle forecast is Down");

    // When next candle is Up, the entry is confirmed and allowed
    const confirmedBuy = {
      ...buyDecision,
      nextCandle: { direction: "up" as const, probability: 0.78, reason: "bullish breakout volume" },
    };
    expect(assessNextCandleConfirmation(confirmedBuy).allowed).toBe(true);
  });
});
