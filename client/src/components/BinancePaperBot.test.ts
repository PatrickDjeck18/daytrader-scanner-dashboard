import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { getPaperBotDisplayState, getPaperBotPerformanceMetrics, getPaperBotQualityStats, getPaperBotRunSummary, getScalpObservationDisplayState } from "./BinancePaperBot";

describe("BinancePaperBot display state", () => {
  it("labels a new account as ready, an enabled config as scheduled, and historical activity as paused", () => {
    expect(getPaperBotDisplayState(undefined)).toBe("loading");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [] })).toBe("ready");
    expect(getPaperBotDisplayState({ enabled: 1, orders: [] })).toBe("scheduled");
    expect(getPaperBotDisplayState({ enabled: 0, orders: [{ id: 1 }] })).toBe("paused");
  });

  it("shows the live observation state only when all three provider-backed context windows are available", () => {
    expect(getScalpObservationDisplayState(undefined)).toBe("unavailable");
    expect(getScalpObservationDisplayState({ availability: "live", oneMinute: { bars: 40 }, fiveMinute: { bars: 40 }, fifteenMinute: { bars: 40 } })).toBe("live");
    expect(getScalpObservationDisplayState({ availability: "live", oneMinute: { bars: 40 }, fiveMinute: { bars: 0 }, fifteenMinute: { bars: 40 } })).toBe("unavailable");
  });

  it("labels persisted hold diagnostics separately from generic run errors", () => {
    const detail = getPaperBotRunSummary({ status: "hold", decision: JSON.stringify({ holdCategory: "timeframe_conflict", reason: "1m is positive while 5m is negative" }) });
    expect(detail).toContain("Timeframes conflict");
    expect(detail).toContain("1m is positive");
  });

  it("summarizes the raw confidence distribution and model/parser holds without treating them as market holds", () => {
    const stats = getPaperBotQualityStats([
      { decision: JSON.stringify({ confidence: .72, holdCategory: "timeframe_conflict" }) },
      { decision: JSON.stringify({ confidence: .48, holdCategory: "model_unavailable" }) },
      { decision: JSON.stringify({ confidence: .2, holdCategory: "low_volatility" }) },
    ]);
    expect(stats).toMatchObject({ decisions: 3, under40: 1, mid: 1, qualified: 1, modelOrParserHolds: 1 });
    expect(stats.averageConfidence).toBeCloseTo(.466, 2);
  });

  it("wires individual position close to the mutation and refresh callback", async () => {
    const source = await readFile(new URL("./BinancePaperBot.tsx", import.meta.url), "utf8");
    expect(source).toContain("trpc.binancePaper.closePosition.useMutation({");
    expect(source).toContain("useSupabaseAuth()");
    expect(source).toContain("const authed = Boolean(supabaseUser) && !supabaseAuthLoading");
    expect(source).toContain("const [closingSymbol, setClosingSymbol] = useState<string | null>(null)");
    expect(source).toContain("void Promise.all([account.refetch(), orders.refetch(), utils.binancePaper.account.invalidate(), utils.binancePaper.orders.invalidate()])");
    expect(source).toContain("closePosition.mutateAsync({ symbol, markPrice })");
    expect(source).toContain("closingSymbol === position.symbol");
    expect(source).toContain("const refresh = async () =>");
    expect(source).toContain("account.refetch()");
    expect(source).toContain("orders.refetch()");
  });

  it("calculates accurate win rate, profit factor, and symbol attribution for closed paper trades", () => {
    const sampleOrders = [
      { symbol: "BTCUSDT", side: "buy", fillPrice: 50_000, quantity: 0.1 },
      { symbol: "BTCUSDT", side: "sell", fillPrice: 51_000, quantity: 0.1 }, // +$100 gross (~$92.4 net)
      { symbol: "ETHUSDT", side: "buy", fillPrice: 3_000, quantity: 1.0 },
      { symbol: "ETHUSDT", side: "sell", fillPrice: 2_950, quantity: 1.0 }, // -$50 gross (~-$54.4 net)
    ];
    const metrics = getPaperBotPerformanceMetrics(sampleOrders, 10_038, 10_000);
    expect(metrics.totalTrades).toBe(2);
    expect(metrics.winRate).toBe(50);
    expect(metrics.profitFactor).toBeGreaterThan(1.0);
    expect(metrics.attribution).toHaveLength(2);
    expect(metrics.attribution.find(a => a.symbol === "BTCUSDT")?.winRate).toBe(100);
    expect(metrics.attribution.find(a => a.symbol === "ETHUSDT")?.winRate).toBe(0);
  });
});

