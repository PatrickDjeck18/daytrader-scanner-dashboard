import { describe, expect, it } from "vitest";
import { getPaperBotDisplayState, getPaperBotQualityStats, getPaperBotRunSummary, getScalpObservationDisplayState, matchesLearningLedgerFilter } from "./BinancePaperBot";

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

  it("recognizes Learning Mode as a persisted paper strategy", () => {
    expect(getPaperBotDisplayState({ enabled: 1, orders: [] })).toBe("scheduled");
  });

  it("filters the full Learning Mode ledger without classifying an open entry as a win or loss", () => {
    const open = { status: "open", realizedPnl: null };
    const win = { status: "exit", realizedPnl: 12.5 };
    const loss = { status: "exit", realizedPnl: -3.25 };
    expect(matchesLearningLedgerFilter(open, "open")).toBe(true);
    expect(matchesLearningLedgerFilter(open, "wins")).toBe(false);
    expect(matchesLearningLedgerFilter(open, "losses")).toBe(false);
    expect(matchesLearningLedgerFilter(win, "wins")).toBe(true);
    expect(matchesLearningLedgerFilter(loss, "losses")).toBe(true);
    expect(matchesLearningLedgerFilter(loss, "all")).toBe(true);
  });
});
