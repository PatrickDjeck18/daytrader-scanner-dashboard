import { describe, expect, it } from "vitest";
import { calculateBinancePaperPnl, calculatePaperPnl, simulatePaperFill } from "./db";

describe("paper account P&L", () => {
  it("fills market orders at the current mark and leaves non-crossed limits resting", () => {
    expect(simulatePaperFill({ side: "buy", orderType: "market", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
    expect(simulatePaperFill({ side: "buy", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "submitted", fillPrice: undefined });
    expect(simulatePaperFill({ side: "sell", orderType: "limit", limitPrice: "100", markPrice: 101 })).toEqual({ status: "filled", fillPrice: 101 });
  });

  it("updates mark-to-market P&L without adding a new fill", () => {
    const orders = [{ symbol: "BTCUSDT", side: "buy" as const, quantity: "0.01", fillPrice: "80000" }];
    const before = calculateBinancePaperPnl(orders, { BTCUSDT: 80000 });
    const after = calculateBinancePaperPnl(orders, { BTCUSDT: 80800 });

    expect(after.positions).toHaveLength(1);
    expect(after.positions[0]).toMatchObject({ symbol: "BTCUSDT", quantity: 0.01, averageCost: 80000 });
    expect(after.unrealizedPnl).toBe(8);
    expect(after.unrealizedPnl).toBeGreaterThan(before.unrealizedPnl);
  });

  it("flattens a simulated position after a close-on-stop sell fill", () => {
    const result = calculateBinancePaperPnl([
      { symbol: "BTCUSDT", side: "buy", quantity: "0.01", fillPrice: "80000" },
      { symbol: "BTCUSDT", side: "sell", quantity: "0.01", fillPrice: "80080" },
    ], { BTCUSDT: 80080 });

    expect(result.positions).toEqual([]);
    expect(result.realizedPnl).toBe(0.8);
    expect(result.unrealizedPnl).toBe(0);
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
