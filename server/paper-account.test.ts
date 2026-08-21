import { describe, expect, it } from "vitest";
import { calculatePaperPnl, simulatePaperFill } from "./db";

describe("paper account P&L", () => {
  it("fills market orders at the current mark and leaves non-crossed limits resting", () => {
    expect(simulatePaperFill({ side: "buy", orderType: "market", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
    expect(simulatePaperFill({ side: "buy", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "submitted", fillPrice: undefined });
    expect(simulatePaperFill({ side: "sell", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
  });

  it("calculates realized and unrealized P&L from filled orders", () => {
    const result = calculatePaperPnl([
      { symbol: "AAPL", side: "buy", quantity: "10", fillPrice: "100" },
      { symbol: "AAPL", side: "sell", quantity: "4", fillPrice: "110", status: "filled" },
      { symbol: "AAPL", side: "buy", quantity: "100", fillPrice: null, status: "submitted" },
    ], { AAPL: 115 });
    expect(result.realizedPnl).toBe(40);
    expect(result.unrealizedPnl).toBe(90);
    expect(result.totalPnl).toBe(130);
    expect(result.positions[0]).toMatchObject({ symbol: "AAPL", quantity: 6, averageCost: 100 });
  });
});
